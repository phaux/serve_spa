import { extname } from "https://deno.land/std@0.203.0/path/extname.ts";
import { join } from "https://deno.land/std@0.203.0/path/join.ts";
import { serveFile } from "https://deno.land/std@0.202.0/http/file_server.ts";
import { transform } from "https://deno.land/x/swc@0.2.1/mod.ts";

export interface ServeSpaOptions {
  /**
   * The root directory to serve files from.
   *
   * Defaults to the current working directory.
   */
  fsRoot?: string | undefined;

  /**
   * Whether to log requests to stdout.
   */
  log?:
    | boolean
    | ((request: Request, response: Response) => boolean)
    | undefined;

  /**
   * Render root `index.html` at every extension-less path that doesn't match a file or directory.
   */
  indexFallback?: boolean | undefined;

  /**
   * If set, injects import map JSON file into HTML files.
   *
   * Use this to use your Deno import map in the browser.
   *
   * Should be relative to {@link fsRoot}.
   */
  importMapFile?: string | undefined;

  /**
   * Rewrites URL paths to FS paths.
   *
   * All paths must begin with `/`, otherwise they won't match.
   *
   * If a URL path ends with `*` then only the path prefix is matched
   * and the remaining URL is appended to the FS path.
   *
   * FS paths should be relative to {@link fsRoot}.
   */
  pathAliasMap?: Record<string, string> | undefined;

  /**
   * Enable CORS via the "Access-Control-Allow-Origin" header.
   */
  enableCors?: boolean | undefined;

  /**
   * Enable JSX transformation.
   */
  jsx?: "classic" | "automatic" | undefined;

  /**
   * Set the import source when JSX mode is "automatic".
   */
  jsxImportSource?: string | undefined;

  /**
   * Set the JSX factory when JSX mode is "classic".
   */
  jsxFactory?: string | undefined;

  /**
   * Set the JSX fragment factory when JSX mode is "classic".
   */
  jsxFragmentFactory?: string | undefined;
}

/**
 * Like `serveDir` from `std/http`, but also transforms TypeScript files to JavaScript.
 */
export async function serveSpa(
  request: Request,
  options: ServeSpaOptions,
): Promise<Response> {
  let requestUrl = new URL(request.url).pathname;
  for (
    const [aliasUrl, aliasFsPath] of Object.entries(options.pathAliasMap ?? {})
  ) {
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
  const filePath = join(options.fsRoot ?? ".", requestUrl);

  let response;
  try {
    response = await serveSpaFile(request, filePath, options);
  } catch (error) {
    console.error(`Serving ${request.url} failed: ${error}`);
    response = new Response(String(error.message), { status: 500 });
  }

  if (
    options.enableCors && !(response.status >= 300 && response.status < 400)
  ) {
    response.headers.append("access-control-allow-origin", "*");
    response.headers.append(
      "access-control-allow-headers",
      "Origin, X-Requested-With, Content-Type, Accept, Range",
    );
  }

  if (
    options.log instanceof Function
      ? options.log(request, response)
      : options.log
  ) {
    console.log(`${request.method} ${request.url} - ${response.status}`);
  }

  return response;
}

async function serveSpaFile(
  request: Request,
  filePath: string,
  options: Pick<
    ServeSpaOptions,
    | "fsRoot"
    | "importMapFile"
    | "indexFallback"
    | "jsx"
    | "jsxImportSource"
    | "jsxFactory"
    | "jsxFragmentFactory"
  >,
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
          transform: {
            react: {
              runtime: options.jsx,
              importSource: options.jsxImportSource,
              pragma: options.jsxFactory,
              pragmaFrag: options.jsxFragmentFactory,
              useBuiltins: true,
            },
          },
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
          await Deno.readTextFile(
            join(options.fsRoot ?? ".", options.importMapFile),
          ),
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
      join(options.fsRoot ?? ".", "index.html"),
      options,
    );
  }

  return new Response("Not found", { status: 404 });
}
