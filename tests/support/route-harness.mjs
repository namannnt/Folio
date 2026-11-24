import { build } from "esbuild";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

// Exercise the real Worker route and SQL with an isolated, in-memory SQLite DB.
// Only the Cloudflare D1 binding is substituted; no HTTP server or browser is started.
export async function createHarness() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    await readFile(
      new URL("../../drizzle/0000_short_kang.sql", import.meta.url),
      "utf8",
    ),
  );
  let failWrites = false;
  const DB = {
    prepare(sql) {
      let params = [];
      return {
        bind(...values) {
          params = values;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...params) || null;
        },
        async run() {
          if (failWrites && sql.startsWith("UPDATE workspaces"))
            throw new Error("INTERNAL_DATABASE_FAILURE");
          const result = sqlite.prepare(sql).run(...params);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
  };
  const key = "__folioTestDB_" + crypto.randomUUID().replaceAll("-", "");
  globalThis[key] = DB;
  const bundle = await build({
    entryPoints: [
      new URL("../../app/api/library/route.ts", import.meta.url).pathname,
    ],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    logLevel: "silent",
    plugins: [
      {
        name: "isolated-d1-binding",
        setup(b) {
          b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
            path: "env",
            namespace: "folio-test",
          }));
          b.onLoad({ filter: /.*/, namespace: "folio-test" }, () => ({
            contents: `export const env={DB:globalThis[${JSON.stringify(key)}]};`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const route = await import(
    "data:text/javascript;base64," +
      Buffer.from(bundle.outputFiles[0].text).toString("base64")
  );
  async function request(body, cookie = "", headers = {}) {
    const req = new Request("https://folio.test/api/library", {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    });
    const response = await route[body === undefined ? "GET" : "POST"](req);
    let data = await response.json();
    return { status: response.status, data, headers: response.headers };
  }
  async function login(role = "admin") {
    const out = await request({
      action: "login",
      payload: {
        email: role === "admin" ? "admin@folio.local" : "desk@folio.local",
        password: role === "admin" ? "FolioAdmin!2026" : "FolioDesk!2026",
      },
    });
    if (out.status !== 200) throw new Error(JSON.stringify(out.data));
    return out.headers.get("set-cookie").split(";")[0];
  }
  async function state(cookie) {
    const out = await request(undefined, cookie);
    if (out.status !== 200) throw new Error(JSON.stringify(out.data));
    return out.data;
  }
  async function action(cookie, action, payload, options = {}) {
    const current = await state(cookie);
    return request(
      {
        action,
        payload,
        version: options.version ?? current.version,
        requestId: options.requestId ?? crypto.randomUUID(),
      },
      cookie,
    );
  }
  return {
    request,
    login,
    state,
    action,
    sqlite,
    route,
    DB,
    setFailWrites(v) {
      failWrites = v;
    },
    close() {
      sqlite.close();
      delete globalThis[key];
    },
  };
}
