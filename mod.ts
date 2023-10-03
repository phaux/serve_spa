import { extname } from "https://deno.land/std@0.203.0/path/extname.ts";
import { join } from "https://deno.land/std@0.203.0/path/join.ts";
import { serveFile } from "https://deno.land/std@0.202.0/http/file_server.ts";
import { transform } from "https://deno.land/x/swc@0.2.1/mod.ts";
import { parse } from "https://deno.land/std@0.203.0/flags/mod.ts";

if (import.meta.main) {
  const flags = parse(Deno.args, {
    boolean: ["help", "cors", "quiet", "index-fallback"],
    string: ["port", "fs-root", "alias", "import-map-file"],
    collect: ["alias"],
    alias: { "help": "h", "port": "p" },
  });
  if (flags.help) {
    // take help text from README.md from between triple backticks and print it
    const readme = await Deno.readTextFile(
      new URL("./README.md", import.meta.url),
    );
    const helpText = readme.match(/```man\n([\s\S]*?)\n```\n/)?.[1];
    if (helpText) {
      console.log(helpText);
    } else {
      console.log("README.md not found");
    }
  } else {
    const port = Number(flags.port) || 8123;
    const fsRoot = flags["fs-root"] ? String(flags["fs-root"]) : undefined;
    const options: ServeSpaOptions = {
      fsRoot,
      enableCors: flags.cors,
      quiet: flags.quiet,
      aliasMap: Object.fromEntries(
        flags.alias.map((alias) => alias.split("=", 2)),
      ),
      importMapFile: flags["import-map-file"],
      indexFallback: flags["index-fallback"],
    };
    const server = Deno.serve(
      { port },
      (request) => serveSpa(request, options),
    );
    if (!options.quiet) {
      console.log(`Serving SPA on http://localhost:${port}`);
    }
    await server.finished;
  }
}

export interface ServeSpaOptions {
  /**
   * The root directory to serve files from.
   *
   * Defaults to the current working directory.
   */
  fsRoot?: string;

  /**
   * Enable CORS via the "Access-Control-Allow-Origin" header.
   */
  enableCors?: boolean;

  /**
   * Do not print request level logs.
   */
  quiet?: boolean;

  /**
   * Map of additional URL paths to FS paths.
   *
   * FS paths should be relative to {@link fsRoot}.
   *
   * If a URL path ends with `*` then only the path prefix is matched
   * and the remaining URL is appended to the FS path.
   *
   * All paths must begin with `/`, otherwise they won't match.
   */
  aliasMap?: Record<string, string>;

  /**
   * If set, injects import map JSON file into HTML files.
   *
   * Use this to use your Deno import map in the browser.
   *
   * Should be relative to {@link fsRoot}.
   */
  importMapFile?: string;

  /**
   * Render root `index.html` at every extension-less path that doesn't match a file or directory.
   */
  indexFallback?: boolean;
}

/**
 * Like `serveDir` from `std/http`, but also transforms TypeScript files to JavaScript.
 */
export async function serveSpa(
  request: Request,
  options: ServeSpaOptions,
): Promise<Response> {
  const { fsRoot = ".", aliasMap = {}, importMapFile, indexFallback = false } =
    options;
  let requestUrl = new URL(request.url).pathname;
  for (const [aliasUrl, aliasFsPath] of Object.entries(aliasMap)) {
    if (aliasUrl.endsWith("*")) {
      const prefix = aliasUrl.slice(0, -1);
      if (requestUrl.startsWith(prefix)) {
        requestUrl = join(aliasFsPath, requestUrl.slice(prefix.length));
        break;
      }
    } else if (requestUrl === aliasUrl) {
      requestUrl = aliasFsPath;
      break;
    }
  }
  const filePath = join(fsRoot, requestUrl);

  const response = await serveSpaFile(request, filePath, {
    fsRoot,
    importMapFile,
    indexFallback,
  });

  if (
    options.enableCors && !(response.status >= 300 && response.status < 400)
  ) {
    response.headers.append("access-control-allow-origin", "*");
    response.headers.append(
      "access-control-allow-headers",
      "Origin, X-Requested-With, Content-Type, Accept, Range",
    );
  }

  if (!options.quiet) {
    console.log(`${request.method} ${request.url} - ${response.status}`);
  }

  return response;
}

async function serveSpaFile(
  request: Request,
  filePath: string,
  options: { fsRoot: string; importMapFile?: string; indexFallback: boolean },
): Promise<Response> {
  const fileExt = extname(filePath).toLowerCase();
  const fileStat = await Deno.stat(filePath).catch(() => null);

  if (fileStat?.isFile) {
    if (fileExt === ".ts" || fileExt === ".tsx") {
      const file = await Deno.readTextFile(filePath);
      const result = await transform(file, {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: fileExt === ".tsx",
          },
          target: "es2022",
        },
      });
      return new Response(result.code, {
        status: 200,
        headers: {
          "content-type": "application/javascript",
        },
      });
    }

    if (fileExt === ".html") {
      if (options.importMapFile) {
        // inject import map
        let fileContent = await Deno.readTextFile(filePath);
        const importMap = JSON.parse(
          await Deno.readTextFile(join(options.fsRoot, options.importMapFile)),
        );
        const { imports } = importMap;
        fileContent = fileContent.replace(
          "<head>",
          `<head>\n<script type="importmap">\n${
            JSON.stringify({ imports }, null, 2)
          }\n</script>`,
        );
        return new Response(fileContent, {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        });
      }
    }

    return await serveFile(request, filePath);
  }

  if (fileStat?.isDirectory) {
    return await serveSpaFile(request, join(filePath, "index.html"), options);
  }

  if (options.indexFallback && !filePath.split("/").pop()?.includes(".")) {
    return await serveSpaFile(
      request,
      join(options.fsRoot, "index.html"),
      options,
    );
  }

  return new Response("Not found", { status: 404 });
}
