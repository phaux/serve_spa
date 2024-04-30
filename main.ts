import { parse } from "https://deno.land/std@0.203.0/flags/mod.ts";
import { bold, underline } from "https://deno.land/std@0.222.1/fmt/colors.ts";
import * as v from "jsr:@badrap/valita";
import { serveSpa, ServeSpaOptions } from "./mod.ts";

const jsxModes = v.union(
  v.literal("classic"),
  v.literal("automatic"),
  v.undefined(),
);

// deno-fmt-ignore
const helpText = `
${bold(`NAME`)}
  serve_spa - Make frontend apps with Deno.

${bold(`SYNOPSIS`)}
  ${bold(`deno`)} run ${bold(`https://deno.land/x/serve_spa/main.ts`)} [${underline(`OPTION`)}]... [${underline(`ROOT`)}]

${bold(`DESCRIPTION`)}
  Serves files in ${underline(`ROOT`)} if specified, otherwise current directory.
  Compiles TypeScript and JSX on the fly.

${bold(`OPTIONS`)}
  ${bold(`-h`)}, ${bold(`--help`)}
    Print this help message and exit.

  ${bold(`-q`)}, ${bold(`--quiet`)}
    Do not log requests to stdout.

  ${bold(`-p`)}, ${bold(`--port`)} ${underline(`PORT`)}
    Port to listen on. Default is 8123.

  ${bold(`--index-fallback`)}
    Render root \`index.html\` at every extension-less path
    that doesn't match a file or directory.

  ${bold(`--import-map-file`)} ${underline(`IMPORT_MAP_FILE`)}
    Inject import map JSON file into HTML files.
    Use this to use your Deno import map in the browser.
    Should be relative to ${underline(`ROOT`)}.

  ${bold(`--alias-path`)} ${underline(`URL_PATH`)}=${underline(`FS_PATH`)}
    Rewrite ${underline(`URL_PATH`)} to ${underline(`FS_PATH`)}.
    ${underline(`URL_PATH`)} must begin with \`/\`, otherwise it won't match.
    If ${underline(`URL_PATH`)} ends with \`*\`, then only the prefix is matched and replaced.
    ${underline(`FS_PATH`)} should be relative to ${underline(`ROOT`)}.
    Can be specified multiple times.

  ${bold(`--cors`)}
    Enable CORS via the "Access-Control-Allow-Origin" header.

  ${bold(`--jsx`)} ${underline(`MODE`)}
    Enable JSX transformation.
    Available modes are "classic" and "automatic".

  ${bold(`--jsx-import-source`)} ${underline(`IMPORT_SOURCE`)}
    Set the import source when JSX mode is "automatic".

  ${bold(`--jsx-factory`)} ${underline(`FACTORY`)}
    Set the JSX factory when JSX mode is "classic".

  ${bold(`--jsx-fragment-factory`)} ${underline(`FACTORY`)}
    Set the JSX fragment factory when JSX mode is "classic".

`;

if (import.meta.main) {
  const flags = parse(Deno.args, {
    boolean: [
      "help",
      "cors",
      "quiet",
      "index-fallback",
    ],
    string: [
      "port",
      "alias-path",
      "import-map-file",
      "jsx",
      "jsx-import-source",
      "jsx-factory",
      "jsx-fragment-factory",
    ],
    collect: [
      "alias-path",
    ],
    alias: {
      "help": "h",
      "port": "p",
      "alias-path": "alias",
    },
  });

  if (flags.help) {
    console.log(helpText);
  } else {
    const port = Number(flags.port) || 8123;
    const fsRoot = flags._[0] ? String(flags._[0]) : undefined;
    const options: ServeSpaOptions = {
      fsRoot,
      enableCors: flags.cors,
      log: !flags.quiet,
      pathAliasMap: Object.fromEntries(
        flags["alias-path"].map((alias) => alias.split("=", 2)),
      ),
      importMapFile: flags["import-map-file"],
      indexFallback: flags["index-fallback"],
      jsx: jsxModes.parse(flags.jsx),
      jsxImportSource: flags["jsx-import-source"],
      jsxFactory: flags["jsx-factory"],
      jsxFragmentFactory: flags["jsx-fragment-factory"],
    };
    const server = Deno.serve(
      { port },
      (request) => serveSpa(request, options),
    );
    await server.finished;
  }
}
