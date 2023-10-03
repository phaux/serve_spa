# Serve SPA

[![deno doc](https://doc.deno.land/badge.svg)](https://deno.land/x/serve_spa)

Make frontend apps with Deno.

## Features

- Compiles TypeScript and JSX on the fly.
- Injects your Deno importMap into HTML files.

## Example

```ts
import { serveSpa } from "https://deno.land/x/serve_spa/mod.ts";

Deno.serve({ port }, async (request) => {
  return await serveSpa(request, {
    fsRoot: "./web",
    indexFallback: true,
    alias: {
      "/favicon.png": "../logo.png",
      "/utils/*": "../utils/",
    },
    importMapFile: "./deno.json",
  });
});
```

## Use as a command

```man
serve_spa - Make frontend apps with Deno

USAGE:
  deno run -A https://deno.land/x/serve_spa/mod.ts [OPTIONS] [<fsRoot>]

OPTIONS:
  <fsRoot>
    Root directory to serve files from. Default is the current directory.

  -h, --help
    Prints help.

  -p, --port <port>
    Port to listen on. Default is 8123.

  --cors
    Enable CORS via the "Access-Control-Allow-Origin" header.

  --quiet
    Suppress log messages from output.

  --index-fallback
    Fallback to /index.html when a file is not found.

  --alias <urlPath=fsPath>
    Map a URL path to a filesystem path. 
    urlPath must begin with a slash (/).
    urlPath can end with a star (*) to match all sub paths.
    fsPath should be relative to the fsRoot.
    Can be used multiple times.

  --import-map-file <path>
    Path to import map file.
    When specified, injects the import map into every HTML file.
    Use this to use your Deno import maps in the browser.
```
