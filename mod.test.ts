import { serveSpa, ServeSpaOptions } from "./mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/join.ts";
import { assertMatch } from "https://deno.land/std@0.224.0/assert/assert_match.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";

function startServer(options?: ServeSpaOptions) {
  return Deno.serve((request) =>
    serveSpa(request, {
      fsRoot: join(import.meta.dirname!, "fixtures"),
      ...options,
    })
  );
}

async function fetchText(server: Deno.HttpServer<Deno.NetAddr>, path: string) {
  return await fetch(
    new URL(path, `http://localhost:${server.addr.port}/`).href,
  ).then((res) => res.text());
}

Deno.test("serves static files", async () => {
  const server = startServer();
  assertMatch(await fetchText(server, "/index.html"), /Serve SPA Test/i);
  assertMatch(await fetchText(server, "/static/test.txt"), /Hello/i);
  await server.shutdown();
});

Deno.test("serves index.html when requesting directory", async () => {
  const server = startServer();
  assertMatch(await fetchText(server, "/"), /Serve SPA Test/i);
  await server.shutdown();
});

Deno.test("responds with 404 for missing files", async () => {
  const server = startServer();
  const resp = await fetch(
    new URL("/missing.txt", `http://localhost:${server.addr.port}/`).href,
  );
  assertEquals(resp.status, 404);
  await resp.body?.cancel();
  await server.shutdown();
});

Deno.test("compiles ts to js", async () => {
  const server = startServer();
  assertMatch(
    await fetchText(server, "/scripts/index.ts"),
    /function add\(a, b\)/,
  );
  await server.shutdown();
});

Deno.test("supports path aliases", async () => {
  const server = startServer({
    pathAliasMap: {
      "/js/*": "scripts",
      "/test.txt": "static/test.txt",
    },
  });
  assertMatch(await fetchText(server, "/js/index.ts"), /function add\(a, b\)/);
  assertMatch(await fetchText(server, "/test.txt"), /Hello/i);
  await server.shutdown();
});

Deno.test("supports CORS", async () => {
  const server = startServer({ enableCors: true });
  const resp = await fetch(
    new URL("/index.html", `http://localhost:${server.addr.port}/`).href,
  );
  assertEquals(resp.headers.get("access-control-allow-origin"), "*");
  await resp.body?.cancel();
  await server.shutdown();
});

Deno.test("injects import map", async () => {
  const server = startServer({ importMapFile: "import_map.json" });
  const text = await fetchText(server, "/index.html");
  assertMatch(text, /esm.sh\/preact/i);
  await server.shutdown();
});

Deno.test("serves index.html at extension-less paths", async () => {
  const server = startServer({ indexFallback: true });
  assertMatch(await fetchText(server, "/test"), /Serve SPA Test/i);
  await server.shutdown();
});
