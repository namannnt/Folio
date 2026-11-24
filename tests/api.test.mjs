import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.FOLIO_TEST_ORIGIN || "http://127.0.0.1:4173";
let adminCookie = "",
  deskCookie = "";
async function request(body, cookie = "") {
  const r = await fetch(base + "/api/library", {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.FOLIO_TEST_ACCESS_TOKEN
        ? {
            "OAI-Sites-Authorization":
              "Bearer " + process.env.FOLIO_TEST_ACCESS_TOKEN,
          }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { r, data: await r.json() };
}
async function login(email, password) {
  const { r } = await request({
    action: "login",
    payload: { email, password },
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
test(
  "API: authentication, role enforcement, durable writes, stale revision and retry deduplication",
  { skip: !process.env.FOLIO_TEST_ORIGIN },
  async () => {
    let out = await request();
    assert.equal(out.data.authenticated, false);
    out = await request({
      action: "issue",
      payload: {},
      requestId: crypto.randomUUID(),
      version: 0,
    });
    assert.equal(out.r.status, 401);
    adminCookie = await login("admin@folio.local", "FolioAdmin!2026");
    deskCookie = await login("desk@folio.local", "FolioDesk!2026");
    out = await request(null, adminCookie);
    assert.equal(out.data.actor.role, "admin");
    const version = out.data.version;
    let denied = await request(
      {
        action: "savePolicy",
        payload: {},
        version,
        requestId: crypto.randomUUID(),
      },
      deskCookie,
    );
    assert.match(denied.data.error, /permission/);
    const requestId = crypto.randomUUID();
    const title = "API verification " + requestId.slice(0, 5);
    const body = {
      action: "saveTitle",
      payload: {
        title,
        author: "Folio QA",
        category: "Technology",
        edition: "Test edition",
      },
      version,
      requestId,
    };
    const bodyB = { ...body, requestId: crypto.randomUUID() };
    const [a, b] = await Promise.all([
      request(body, adminCookie),
      request(bodyB, adminCookie),
    ]);
    assert.equal([a.r.status, b.r.status].filter((x) => x === 200).length, 1);
    assert.equal([a.r.status, b.r.status].filter((x) => x === 409).length, 1);
    const winnerBody = a.r.status === 200 ? body : bodyB;
    out = await request(null, adminCookie);
    assert.equal(
      out.data.state.titles.filter((t) => t.title === title).length,
      1,
    );
    assert.equal(out.data.version, version + 1);
    if (winnerBody) {
      const retry = await request(winnerBody, adminCookie);
      assert.equal(retry.r.status, 200);
      assert.equal(retry.data.version, version + 1);
      assert.match(retry.data.message, /already completed/);
    }
    const fresh = out.data;
    const t = fresh.state.titles.find((t) => t.title === title);
    const archived = await request(
      {
        action: "archiveTitle",
        payload: {
          titleId: t.id,
          reason: "Automated API verification complete",
        },
        version: fresh.version,
        requestId: crypto.randomUUID(),
      },
      adminCookie,
    );
    assert.equal(archived.r.status, 200);
    const signedOut = await request({ action: "logout" }, deskCookie);
    assert.equal(signedOut.r.status, 200);
    assert.equal((await request(null, deskCookie)).data.authenticated, false);
  },
);
