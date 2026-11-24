import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./support/route-harness.mjs";

test("real API route, SQLite persistence and staff authorization", async (t) => {
  const h = await createHarness();
  t.after(() => h.close());
  let admin, desk;
  await t.test(
    "anonymous reads omit member data; anonymous mutations are rejected",
    async () => {
      const get = await h.request();
      assert.equal(get.status, 200);
      assert.deepEqual(get.data, { authenticated: false });
      const post = await h.request({
        action: "issue",
        payload: {},
        version: 0,
        requestId: "anonymous",
      });
      assert.equal(post.status, 401);
    },
  );
  await t.test(
    "malformed JSON, null bodies, wrong payload types and oversized requests are rejected",
    async () => {
      for (const body of [
        "{",
        "null",
        "[]",
        "{}",
        JSON.stringify({ action: "issue", payload: [] }),
      ])
        assert.equal((await h.request(body)).status, 400);
      assert.equal(
        (
          await h.request({ action: "login" }, "", {
            "Content-Length": "150001",
          })
        ).status,
        413,
      );
      assert.equal(
        (
          await h.request({
            action: "login",
            payload: {},
            padding: "x".repeat(150001),
          })
        ).status,
        413,
      );
    },
  );
  await t.test("cross-origin writes are rejected", async () => {
    assert.equal(
      (
        await h.request({ action: "login", payload: {} }, "", {
          Origin: "https://unrelated.example",
        })
      ).status,
      403,
    );
  });
  await t.test(
    "invalid passwords fail and both real demo roles can sign in",
    async () => {
      const bad = await h.request({
        action: "login",
        payload: { email: "admin@folio.local", password: "incorrect" },
      });
      assert.equal(bad.status, 401);
      admin = await h.login();
      desk = await h.login("librarian");
      const a = await h.state(admin),
        d = await h.state(desk);
      assert.equal(a.actor.role, "admin");
      assert.equal(d.actor.role, "librarian");
      assert.ok(!JSON.stringify(a).includes("passwordHash"));
      assert.ok(!JSON.stringify(a).includes("salt"));
      assert.ok(!("completed" in a.state));
    },
  );
  await t.test(
    "sessions have HttpOnly, SameSite, Secure and a 24-hour lifetime",
    async () => {
      const out = await h.request({
        action: "login",
        payload: { email: "admin@folio.local", password: "FolioAdmin!2026" },
      });
      const cookie = out.headers.get("set-cookie");
      for (const flag of [
        "HttpOnly",
        "SameSite=Lax",
        "Secure",
        "Max-Age=86400",
      ])
        assert.ok(cookie.includes(flag));
    },
  );
  await t.test(
    "librarians cannot invoke admin-only policy, waiver, reversal, recovery or staff actions",
    async () => {
      const st = await h.state(desk),
        ch = st.state.charges[0];
      for (const [a, p] of [
        ["savePolicy", {}],
        ["waive", { chargeId: ch.id, amount: 1, note: "Test" }],
        ["reverseEntry", { entryId: "RC-0001", reason: "Test" }],
        ["recoverLost", { copyId: "LIB-0001", reason: "Test" }],
        ["addStaff", {}],
      ])
        assert.equal((await h.action(desk, a, p)).status, 403, a);
    },
  );
  let titleId, copyIds, memberId;
  await t.test(
    "title, member and physical-copy creation persist across reads",
    async () => {
      let out = await h.action(admin, "saveTitle", {
        title: "Integration QA title",
        author: "QA Author",
        edition: "First edition",
        category: "Technology",
      });
      assert.equal(out.status, 200);
      titleId = out.data.state.titles.at(-1).id;
      out = await h.action(admin, "addCopies", {
        titleId,
        count: 2,
        shelf: "QA-01",
        cost: "123.45",
        lendable: true,
      });
      assert.equal(out.status, 200);
      copyIds = out.data.state.copies
        .filter((c) => c.titleId === titleId)
        .map((c) => c.id);
      assert.equal(new Set(copyIds).size, 2);
      out = await h.action(admin, "saveMember", {
        id: "QA-MEMBER",
        name: "QA Reader",
        email: "qa@example.test",
        department: "QA",
        expires: "2099-12-31",
        status: "active",
      });
      assert.equal(out.status, 200);
      memberId = "QA-MEMBER";
      const read = await h.state(admin);
      assert.equal(
        read.state.copies.find((c) => c.id === copyIds[0]).cost,
        12345,
      );
      assert.ok(read.state.members.some((m) => m.id === memberId));
    },
  );
  await t.test("edit forms update the intended stable records", async () => {
    const a = await h.action(admin, "saveTitle", {
      id: titleId,
      title: "Integration QA edited",
      author: "QA Author",
      edition: "First edition",
      category: "Science",
    });
    assert.equal(a.status, 200);
    const b = await h.action(admin, "editCopy", {
      copyId: copyIds[0],
      shelf: "QA-02",
      cost: 130,
      lendable: true,
    });
    assert.equal(b.status, 200);
    assert.equal(
      b.data.state.copies.find((c) => c.id === copyIds[0]).shelf,
      "QA-02",
    );
    const m = await h.action(admin, "saveMember", {
      originalId: memberId,
      id: memberId,
      name: "QA Reader edited",
      email: "qa@example.test",
      department: "QA",
      expires: "2099-12-31",
      status: "active",
    });
    assert.equal(m.status, 200);
  });
  await t.test(
    "concurrent revisions allow one winner and one conflict; duplicate request IDs replay exactly once",
    async () => {
      const st = await h.state(admin),
        requestId = crypto.randomUUID(),
        body = {
          action: "saveTitle",
          payload: {
            title: "Concurrent A",
            author: "QA",
            edition: "Test",
            category: "Science",
          },
          version: st.version,
          requestId,
        };
      const second = {
        ...body,
        payload: { ...body.payload, title: "Concurrent B" },
        requestId: crypto.randomUUID(),
      };
      const [a, b] = await Promise.all([
        h.request(body, admin),
        h.request(second, admin),
      ]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      const win = a.status === 200 ? body : second,
        replay = await h.request(win, admin);
      assert.equal(replay.status, 200);
      assert.match(replay.data.message, /already completed/);
      assert.equal(replay.data.version, st.version + 1);
      assert.equal(
        replay.data.state.titles.filter((t) =>
          ["Concurrent A", "Concurrent B"].includes(t.title),
        ).length,
        1,
      );
    },
  );
  await t.test(
    "issue, renewal and return use the exact copy and produce durable receipts",
    async () => {
      let out = await h.action(desk, "issue", {
        memberId,
        copyIds: [copyIds[0]],
      });
      assert.equal(out.status, 200);
      assert.equal(out.data.result.kind, "issue");
      assert.equal(out.data.result.balanceAfter, 0);
      const loan = out.data.state.loans.at(-1);
      assert.equal(
        (await h.action(desk, "renew", { loanId: loan.id })).status,
        200,
      );
      out = await h.action(desk, "return", {
        copyId: copyIds[0],
        condition: "good",
      });
      assert.equal(out.status, 200);
      assert.equal(out.data.result.fine, 0);
      assert.equal(
        out.data.state.copies.find((c) => c.id === copyIds[0]).status,
        "available",
      );
      assert.equal(
        (
          await h.action(desk, "return", {
            copyId: copyIds[0],
            condition: "good",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "reservation allocations prevent wrong-member issue and cancellation releases the copy",
    async () => {
      let out = await h.action(desk, "placeHold", { memberId, titleId });
      assert.equal(out.status, 200);
      const hold = out.data.state.holds.at(-1);
      assert.equal(hold.status, "ready");
      assert.equal(
        (
          await h.action(desk, "issue", {
            memberId: "M-1003",
            copyIds: [hold.copyId],
          })
        ).status,
        400,
      );
      out = await h.action(desk, "cancelHold", {
        holdId: hold.id,
        reason: "QA cancellation",
      });
      assert.equal(out.status, 200);
      assert.equal(
        out.data.state.copies.find((c) => c.id === hold.copyId).status,
        "available",
      );
    },
  );
  let paymentId, chargeId;
  await t.test(
    "damage assessment, partial payment, waiver and reversal preserve balances and original entries",
    async () => {
      await h.action(desk, "issue", { memberId, copyIds: [copyIds[0]] });
      let out = await h.action(desk, "return", {
        copyId: copyIds[0],
        condition: "damaged",
        damageAmount: "12.34",
        note: "QA damage assessment",
      });
      assert.equal(out.status, 200);
      const ch = out.data.state.charges.at(-1);
      chargeId = ch.id;
      out = await h.action(desk, "payment", {
        chargeId,
        amount: "2.34",
        method: "Cash",
      });
      assert.equal(out.status, 200);
      paymentId = out.data.result.entry.id;
      assert.equal(out.data.result.entry.balanceAfter, 1000);
      out = await h.action(admin, "waive", {
        chargeId,
        amount: "10.00",
        note: "QA approved",
      });
      assert.equal(out.status, 200);
      assert.equal(out.data.result.entry.balanceAfter, 0);
      out = await h.action(admin, "reverseEntry", {
        entryId: paymentId,
        reason: "QA entry correction",
      });
      assert.equal(out.status, 200);
      assert.equal(
        out.data.state.entries.find((e) => e.id === paymentId).amount,
        234,
      );
      assert.equal(out.data.state.entries.at(-1).amount, -234);
      assert.equal(
        (
          await h.action(admin, "reverseEntry", {
            entryId: paymentId,
            reason: "Duplicate",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "lost-copy handling and recovery use their own state transitions",
    async () => {
      let out = await h.action(desk, "issue", {
        memberId: "M-1003",
        copyIds: [copyIds[1]],
      });
      assert.equal(out.status, 200);
      out = await h.action(desk, "reportLost", {
        copyId: copyIds[1],
        reason: "QA loss",
      });
      assert.equal(out.status, 200);
      assert.equal(
        out.data.state.copies.find((c) => c.id === copyIds[1]).status,
        "lost",
      );
      out = await h.action(admin, "recoverLost", {
        copyId: copyIds[1],
        reason: "QA found, inspect",
      });
      assert.equal(out.status, 200);
      assert.equal(
        out.data.state.copies.find((c) => c.id === copyIds[1]).status,
        "repair",
      );
    },
  );
  await t.test(
    "stocktake results persist without mutating loan or charge counts",
    async () => {
      const before = await h.state(admin),
        out = await h.action(desk, "stocktake", {
          shelf: "QA-02",
          barcodes: [copyIds[0], "UNKNOWN-QA"],
        });
      assert.equal(out.status, 200);
      assert.equal(out.data.state.loans.length, before.state.loans.length);
      assert.equal(out.data.state.charges.length, before.state.charges.length);
      assert.ok(
        out.data.result.audit.rows.some((r) => r.finding === "Unknown barcode"),
      );
      assert.equal(
        (await h.state(admin)).state.audits[0].id,
        out.data.result.audit.id,
      );
    },
  );
  await t.test(
    "safe deletion protects unsettled charges and preserves withdrawn copy records",
    async () => {
      assert.equal(
        (
          await h.action(admin, "deleteCopy", {
            copyId: copyIds[0],
            reason: "QA removal",
          })
        ).status,
        400,
      );
      let out = await h.action(admin, "waive", {
        chargeId,
        amount: "2.34",
        note: "QA final settlement",
      });
      assert.equal(out.status, 200);
      out = await h.action(admin, "deleteCopy", {
        copyId: copyIds[0],
        reason: "QA removal",
      });
      assert.equal(out.status, 200);
      assert.equal(
        out.data.state.copies.find((c) => c.id === copyIds[0]).status,
        "withdrawn",
      );
    },
  );
  await t.test(
    "staff input validation, case-normalized email and new account login work",
    async () => {
      assert.equal((await h.action(admin, "addStaff", {})).status, 400);
      let out = await h.action(admin, "addStaff", {
        name: "QA Staff",
        email: "  QA.STAFF@example.test  ",
        password: "QAPassword!2026",
        role: "librarian",
      });
      assert.equal(out.status, 200);
      out = await h.request({
        action: "login",
        payload: {
          email: "qa.staff@example.test",
          password: "QAPassword!2026",
        },
      });
      assert.equal(out.status, 200);
      assert.equal(
        (
          await h.action(admin, "addStaff", {
            name: "Duplicate",
            email: "qa.staff@example.test",
            password: "QAPassword!2026",
            role: "admin",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "internal database failures return a generic 500 without exposing SQL details",
    async () => {
      h.setFailWrites(true);
      const old = console.error;
      console.error = () => {};
      try {
        const out = await h.action(admin, "saveTitle", {
          title: "Will not commit",
          author: "QA",
          category: "Science",
          edition: "Test",
        });
        assert.equal(out.status, 500);
        assert.ok(
          !JSON.stringify(out.data).includes("INTERNAL_DATABASE_FAILURE"),
        );
      } finally {
        console.error = old;
        h.setFailWrites(false);
      }
    },
  );
  await t.test(
    "logout revokes the session and expired sessions cannot read records",
    async () => {
      assert.equal((await h.request({ action: "logout" }, desk)).status, 200);
      assert.equal((await h.state(desk)).authenticated, false);
      h.sqlite.exec("UPDATE sessions SET expires=0");
      assert.equal((await h.state(admin)).authenticated, false);
    },
  );
});
