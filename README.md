# Serve SPA

[![deno doc](https://doc.deno.land/badge.svg)](https://deno.land/x/serve_spa)

Make frontend apps with Deno.

## SYNOPSIS

```sh
deno run https://deno.land/x/serve_spa/main.ts [OPTION]... [ROOT]
```

## DESCRIPTION

Spins up a dev server for single-page applications (SPA). Serves static files
from `ROOT` or current directory if not specified. Compiles TypeScript on the
fly.

## OPTIONS

- `-q`, `--quiet`

  Suppress logging.

- `-p`, `--port PORT`

  Port to listen on. Default is 8123.

- `--index-fallback`

  Render root `index.html` at every extension-less path that doesn't match a
  file or directory.

- `--import-map-file IMPORT_MAP_FILE`

  Inject import map JSON file into HTML files. Use this to use your Deno import
  map in the browser.

- `--path-alias URL_PATH=FS_PATH`

  Rewrite URL_PATH to FS_PATH.

- `--cors`

  Enable CORS.

- `--jsx MODE`

  Enable JSX transformation. Available modes are "classic" and "automatic".

- `--jsx-import-source IMPORT_SOURCE`

  Set the import source when JSX mode is "automatic".

- `--jsx-factory FACTORY`

  Set the JSX factory when JSX mode is "classic".

- `--jsx-fragment-factory FACTORY`

  Set the JSX fragment factory when JSX mode is "classic".

## JS API

Example:

```ts
import { serveSpa } from "https://deno.land/x/serve_spa/mod.ts";

Deno.serve({ port }, async (request) => {
  return await serveSpa(request, {
    fsRoot: "./web",
    indexFallback: true,
    pathAliasMap: {
      "/favicon.png": "../logo.png",
      "/utils/*": "../utils/",
    },
    importMapFile: "../deno.json",
  });
});
```
