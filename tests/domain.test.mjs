import test from "node:test";
import assert from "node:assert/strict";
import {
  seedState,
  mutate,
  fineFor,
  lateDays,
  balance,
  outstanding,
  validISBN,
  maintain,
  dueDate,
  openingDeadline,
  activeLoans,
} from "../lib/domain.mjs";
const date = "2026-11-24",
  admin = { name: "Test Admin", role: "admin" },
  desk = { name: "Test Desk", role: "librarian" };
const fresh = () => seedState(date);
const run = (s, a, p, actor = admin, d = date) => mutate(s, a, p, actor, d);
function blank() {
  const s = fresh();
  s.loans = [];
  s.holds = [];
  s.charges = [];
  s.entries = [];
  for (const c of s.copies) c.status = "available";
  return s;
}
test("seed collection has unique copies and consistent active loans", () => {
  const s = fresh();
  assert.equal(new Set(s.copies.map((c) => c.id)).size, s.copies.length);
  assert.equal(s.titles.length, 18);
  for (const l of activeLoans(s))
    assert.equal(s.copies.find((c) => c.id === l.copyId).status, "loaned");
});
test("ISBN check digits and optional ISBN", () => {
  assert.ok(validISBN("978-1-4493-7332-0"));
  assert.ok(validISBN("0-306-40615-2"));
  assert.ok(validISBN(""));
  assert.equal(validISBN("9781449373321"), false);
});
test("issue tracks the physical copy and due date", () => {
  const s = blank(),
    r = run(s, "issue", { memberId: "M-1001", copyIds: ["LIB-0001"] });
  assert.equal(r.state.copies[0].status, "loaned");
  assert.equal(r.state.loans[0].dueAt, "2026-12-08");
  assert.equal(s.copies[0].status, "available");
});
test("same copy cannot be issued twice", () => {
  const s = run(blank(), "issue", {
    memberId: "M-1001",
    copyIds: ["LIB-0001"],
  }).state;
  assert.throws(
    () => run(s, "issue", { memberId: "M-1002", copyIds: ["LIB-0001"] }),
    /cannot be issued/,
  );
});
test("batch issue is atomic if one copy is unavailable", () => {
  const s = blank();
  s.copies[1].status = "repair";
  assert.throws(() =>
    run(s, "issue", { memberId: "M-1001", copyIds: ["LIB-0001", "LIB-0002"] }),
  );
  assert.equal(s.copies[0].status, "available");
  assert.equal(s.loans.length, 0);
});
test("duplicate barcode selection does not create duplicate loans", () => {
  const r = run(blank(), "issue", {
    memberId: "M-1001",
    copyIds: ["LIB-0001", "LIB-0001"],
  });
  assert.equal(r.state.loans.length, 1);
});
test("loan limit blocks issue", () => {
  assert.throws(
    () =>
      run(blank(), "issue", {
        memberId: "M-1001",
        copyIds: ["LIB-0001", "LIB-0002", "LIB-0003", "LIB-0004"],
      }),
    /limit/,
  );
});
test("expired and suspended members cannot borrow", () => {
  for (const id of ["M-1011", "M-1012"])
    assert.throws(
      () => run(blank(), "issue", { memberId: id, copyIds: ["LIB-0001"] }),
      /suspended|expired/,
    );
});
test("reference-only copies cannot circulate", () => {
  const s = blank(),
    c = s.copies.find((c) => !c.lendable);
  assert.throws(
    () => run(s, "issue", { memberId: "M-1001", copyIds: [c.id] }),
    /reference-only/,
  );
});
test("unpaid assessed charges and overdue loans block new issue", () => {
  const s = fresh();
  assert.throws(
    () => run(s, "issue", { memberId: "M-1005", copyIds: ["LIB-0002"] }),
    /charges/,
  );
  assert.throws(
    () => run(s, "issue", { memberId: "M-1001", copyIds: ["LIB-0002"] }),
    /overdue/,
  );
});
test("returns are accepted despite existing unpaid charges", () => {
  const s = fresh(),
    l = s.loans.find((l) => l.memberId === "M-1005");
  const r = run(s, "return", { copyId: l.copyId, condition: "good" });
  assert.equal(r.state.loans.find((x) => x.id === l.id).status, "returned");
  assert.ok(balance(r.state, "M-1005") > 0);
});
test("on-time returns have zero overdue charge", () => {
  const s = run(blank(), "issue", {
    memberId: "M-1001",
    copyIds: ["LIB-0001"],
  }).state;
  const r = run(s, "return", { copyId: "LIB-0001", condition: "good" });
  assert.equal(r.result.fine, 0);
  assert.equal(r.state.charges.length, 0);
});
test("duplicate return cannot charge twice", () => {
  const s = run(fresh(), "return", {
    copyId: "LIB-0001",
    condition: "good",
  }).state;
  assert.throws(
    () => run(s, "return", { copyId: "LIB-0001", condition: "good" }),
    /no active loan/,
  );
});
test("fine boundaries and cap", () => {
  const s = blank(),
    l = { dueAt: "2026-11-20", policy: s.policy };
  assert.equal(fineFor(s, l, "2026-11-20"), 0);
  assert.equal(fineFor(s, l, "2026-11-21"), 500);
  assert.equal(fineFor(s, l, "2027-01-20"), 20000);
});
test("closure calendar excludes fines and extends due dates", () => {
  const s = blank();
  s.policy.closures = ["2026-12-08", "2026-12-09"];
  assert.equal(dueDate(s, date), "2026-12-10");
  const l = { dueAt: "2026-12-07", policy: s.policy };
  assert.equal(lateDays(s, l, "2026-12-10"), 1);
  assert.equal(openingDeadline(s, "2026-12-07"), "2026-12-11");
});
test("policy changes do not alter an existing loan fine", () => {
  let s = run(blank(), "issue", {
    memberId: "M-1001",
    copyIds: ["LIB-0001"],
  }).state;
  const l = s.loans[0];
  s.policy.dailyFine = 9900;
  assert.equal(fineFor(s, l, "2026-12-09"), 500);
});
test("damaged return routes copy to repair with separate charge", () => {
  const s = fresh();
  const r = run(s, "return", {
    copyId: "LIB-0001",
    condition: "damaged",
    damageAmount: 50,
    note: "Cover repair",
  });
  assert.equal(r.state.copies[0].status, "repair");
  assert.ok(
    r.state.charges.some(
      (c) =>
        c.copyId === "LIB-0001" && c.type === "Damage" && c.amount === 5000,
    ),
  );
});
test("renewal extends current due date and enforces limit", () => {
  let s = run(blank(), "issue", {
    memberId: "M-1001",
    copyIds: ["LIB-0001"],
  }).state;
  const id = s.loans[0].id;
  s = run(s, "renew", { loanId: id }).state;
  assert.equal(s.loans[0].dueAt, "2026-12-22");
  assert.throws(() => run(s, "renew", { loanId: id }), /limit/);
});
test("waiting reservations prevent renewal", () => {
  let s = run(blank(), "issue", {
    memberId: "M-1001",
    copyIds: ["LIB-0001"],
  }).state;
  for (const c of s.copies.filter(
    (c) => c.titleId === "T-001" && c.id !== "LIB-0001",
  ))
    c.status = "repair";
  s = run(s, "placeHold", { memberId: "M-1002", titleId: "T-001" }).state;
  assert.throws(() => run(s, "renew", { loanId: s.loans[0].id }), /waiting/);
});
test("reservation allocation and fulfillment", () => {
  let s = run(blank(), "placeHold", {
    memberId: "M-1002",
    titleId: "T-001",
  }).state;
  assert.equal(s.holds[0].status, "ready");
  const id = s.holds[0].copyId;
  assert.throws(
    () => run(s, "issue", { memberId: "M-1001", copyIds: [id] }),
    /reserved/,
  );
  s = run(s, "issue", { memberId: "M-1002", copyIds: [id] }).state;
  assert.equal(s.holds[0].status, "fulfilled");
});
test("reservation duplicate and unusable title are rejected", () => {
  let s = run(blank(), "placeHold", {
    memberId: "M-1002",
    titleId: "T-001",
  }).state;
  assert.throws(
    () => run(s, "placeHold", { memberId: "M-1002", titleId: "T-001" }),
    /already/,
  );
  assert.throws(
    () => run(s, "placeHold", { memberId: "M-1002", titleId: "T-018" }),
    /serviceable/,
  );
});
test("expired pickup releases copy and allocates next member", () => {
  let s = blank();
  for (const c of s.copies.filter(
    (c) => c.titleId === "T-001" && c.id !== "LIB-0001",
  ))
    c.status = "repair";
  s = run(s, "placeHold", { memberId: "M-1002", titleId: "T-001" }).state;
  s = run(s, "placeHold", { memberId: "M-1003", titleId: "T-001" }).state;
  maintain(s, "2026-11-27");
  assert.equal(s.holds[0].status, "expired");
  assert.equal(s.holds[1].status, "ready");
  assert.equal(s.holds[1].copyId, "LIB-0001");
});
test("return allocates next waiting hold", () => {
  let s = blank();
  s = run(s, "issue", {
    memberId: "M-1001",
    copyIds: ["LIB-0001", "LIB-0002", "LIB-0003"],
  }).state;
  s = run(s, "placeHold", { memberId: "M-1002", titleId: "T-001" }).state;
  s = run(s, "return", { copyId: "LIB-0001", condition: "good" }).state;
  assert.equal(s.copies[0].status, "reserved");
  assert.equal(s.holds[0].status, "ready");
});
test("partial payment and overpayment rules", () => {
  const s = fresh(),
    ch = s.charges[0];
  let r = run(s, "payment", { chargeId: ch.id, amount: 5, method: "Cash" });
  assert.equal(outstanding(r.state, ch), 1000);
  assert.throws(
    () =>
      run(r.state, "payment", { chargeId: ch.id, amount: 11, method: "Cash" }),
    /outstanding/,
  );
  assert.throws(() =>
    run(s, "payment", { chargeId: ch.id, amount: -1, method: "Cash" }),
  );
});
test("external payment requires a reference", () => {
  const s = fresh();
  assert.throws(
    () =>
      run(s, "payment", {
        chargeId: s.charges[0].id,
        amount: 1,
        method: "UPI (external)",
      }),
    /reference/,
  );
});
test("waivers, reversals, policy and recovery are admin-only", () => {
  const s = fresh();
  assert.throws(
    () =>
      run(
        s,
        "waive",
        { chargeId: s.charges[0].id, amount: 1, note: "Approved" },
        desk,
      ),
    /permission/,
  );
  assert.throws(() => run(s, "savePolicy", {}, desk), /permission/);
  assert.throws(
    () =>
      run(
        s,
        "reverseEntry",
        { entryId: s.entries[0].id, reason: "Correction" },
        desk,
      ),
    /permission/,
  );
});
test("reversal is a compensating entry and cannot be repeated", () => {
  const s = fresh(),
    id = s.entries[0].id;
  const r = run(s, "reverseEntry", {
    entryId: id,
    reason: "Payment entered in error",
  });
  assert.equal(r.state.entries.find((e) => e.id === id).amount, 1000);
  assert.equal(balance(r.state, "M-1005"), 2500);
  assert.throws(
    () => run(r.state, "reverseEntry", { entryId: id, reason: "Again" }),
    /already/,
  );
});
test("issued copy cannot be deleted or made reference-only", () => {
  const s = fresh();
  assert.throws(
    () => run(s, "deleteCopy", { copyId: "LIB-0001", reason: "Remove" }),
    /issued/,
  );
  assert.throws(
    () =>
      run(s, "editCopy", {
        copyId: "LIB-0001",
        shelf: "CS-01",
        cost: 600,
        lendable: false,
      }),
    /Resolve/,
  );
});
test("eligible deletion preserves history and final-copy holds block deletion", () => {
  let s = blank();
  s = run(s, "deleteCopy", {
    copyId: "LIB-0002",
    reason: "Withdraw worn copy",
  }).state;
  assert.equal(s.copies[1].status, "withdrawn");
  assert.equal(s.copies.length, 45);
  s.copies[2].status = "withdrawn";
  s.holds.push({
    id: "HX",
    titleId: "T-001",
    memberId: "M-1002",
    status: "waiting",
    createdAt: date,
    sequence: 1,
  });
  assert.throws(
    () => run(s, "deleteCopy", { copyId: "LIB-0001", reason: "Final copy" }),
    /allocated|reservations/,
  );
});
test("title archive requires all copies removed", () => {
  const s = blank();
  assert.throws(
    () => run(s, "archiveTitle", { titleId: "T-001", reason: "Retire" }),
    /remaining/,
  );
  for (const c of s.copies.filter((c) => c.titleId === "T-001"))
    c.status = "withdrawn";
  assert.equal(
    run(s, "archiveTitle", { titleId: "T-001", reason: "Retire" }).state
      .titles[0].archived,
    true,
  );
});
test("lost workflow stops fine accrual and recovery needs inspection", () => {
  let s = fresh();
  s = run(s, "reportLost", {
    copyId: "LIB-0001",
    reason: "Borrower reported loss",
  }).state;
  assert.equal(s.loans[0].status, "lost");
  assert.equal(s.copies[0].status, "lost");
  assert.equal(fineFor(s, s.loans[0], "2027-01-01"), 2500);
  assert.ok(s.charges.some((c) => c.type === "Replacement"));
  s = run(s, "recoverLost", {
    copyId: "LIB-0001",
    reason: "Found, inspect binding",
  }).state;
  assert.equal(s.copies[0].status, "repair");
  assert.ok(s.charges.some((c) => c.type === "Replacement"));
});
test("stocktaking flags discrepancies without returning loans", () => {
  const s = fresh();
  const r = run(s, "stocktake", {
    shelf: "CS-01",
    barcodes: ["LIB-0001", "LIB-0002", "LIB-0002", "BAD-ITEM", "LIB-0004"],
  });
  assert.equal(r.state.loans[0].status, "active");
  assert.equal(r.state.charges.length, s.charges.length);
  assert.equal(
    r.result.audit.rows.filter((r) => r.copyId === "LIB-0002").length,
    1,
  );
  assert.ok(r.result.audit.rows.some((r) => r.finding === "Issued copy found"));
  assert.ok(r.result.audit.rows.some((r) => r.finding === "Unknown barcode"));
  assert.ok(r.result.audit.rows.some((r) => r.finding === "Wrong shelf"));
});
test("duplicate copy barcodes and member IDs are rejected", () => {
  const s = fresh();
  assert.throws(
    () =>
      run(s, "addCopies", {
        titleId: "T-001",
        count: 1,
        barcode: "LIB-0001",
        shelf: "CS-01",
        cost: 200,
      }),
    /already/,
  );
  assert.throws(
    () =>
      run(s, "saveMember", {
        id: "M-1001",
        name: "Other",
        department: "Science",
        email: "a@b.com",
        expires: "2027-01-01",
        status: "active",
      }),
    /already/,
  );
});
test("generated copy barcodes remain unique after deletion and custom numeric IDs", () => {
  let s = blank();
  s = run(s, "deleteCopy", { copyId: "LIB-0044", reason: "Withdraw" }).state;
  s = run(s, "addCopies", {
    titleId: "T-001",
    count: 1,
    barcode: "LIB-0050",
    shelf: "CS-01",
    cost: "0.29",
  }).state;
  s = run(s, "addCopies", {
    titleId: "T-001",
    count: 50,
    shelf: "CS-01",
    cost: "0.29",
  }).state;
  assert.equal(new Set(s.copies.map((c) => c.id)).size, s.copies.length);
  assert.equal(s.copies.at(-1).id, "LIB-0100");
  assert.equal(s.copies.at(-1).cost, 29);
});
test("malformed payloads and untyped lending flags fail validation", () => {
  for (const p of [null, [], false])
    assert.throws(() => run(blank(), "issue", p), /object/);
  for (const p of [{ copyIds: "LIB-0001" }, { copyIds: [1] }])
    assert.throws(() => run(blank(), "issue", p), /list/);
  assert.throws(
    () =>
      run(blank(), "addCopies", {
        titleId: "T-001",
        count: 1,
        shelf: "CS-01",
        cost: 10,
        lendable: "false",
      }),
    /true or false/,
  );
  assert.throws(
    () => run(blank(), "stocktake", { shelf: "CS-01", barcodes: "LIB-0001" }),
    /list/,
  );
});
test("money fields reject null, booleans, blank and excessive precision", () => {
  for (const cost of [null, true, "", "   ", "0.001", -1, "Infinity"])
    assert.throws(() =>
      run(blank(), "addCopies", {
        titleId: "T-001",
        count: 1,
        shelf: "CS-01",
        cost,
      }),
    );
});
test("editing a missing record cannot silently create another one", () => {
  assert.throws(
    () =>
      run(blank(), "saveTitle", {
        id: "NOT-A-TITLE",
        title: "QA",
        author: "QA",
        edition: "QA",
        category: "QA",
      }),
    /not found/,
  );
  assert.throws(
    () =>
      run(blank(), "saveMember", {
        originalId: "NO-MEMBER",
        id: "NO-MEMBER",
        name: "QA",
        email: "qa@example.test",
        department: "QA",
        expires: "2099-01-01",
        status: "active",
      }),
    /not found/,
  );
});
test("invalid dates and unauthorized actors are rejected", () => {
  assert.throws(
    () => run(blank(), "saveTitle", {}, admin, "2026-02-30"),
    /date/,
  );
  assert.throws(
    () => run(blank(), "saveTitle", {}, { name: "Anonymous", role: "visitor" }),
    /permission/,
  );
});
test("ready holds are released when membership is suspended and allocated to the next member", () => {
  let s = blank();
  s.copies
    .filter((c) => c.titleId === "T-001" && c.id !== "LIB-0001")
    .forEach((c) => (c.status = "repair"));
  s = run(s, "placeHold", { memberId: "M-1002", titleId: "T-001" }).state;
  s = run(s, "placeHold", { memberId: "M-1003", titleId: "T-001" }).state;
  s.members.find((m) => m.id === "M-1002").status = "suspended";
  assert.equal(maintain(s, date), true);
  assert.equal(s.holds[0].status, "cancelled");
  assert.equal(s.holds[1].status, "ready");
  assert.ok(s.activity.some((a) => a.actor === "System"));
});
test("receipt balance is a transaction snapshot rather than a later balance", () => {
  let s = fresh();
  const c = s.charges[0];
  const payment = run(s, "payment", {
    chargeId: c.id,
    amount: "5.00",
    method: "Cash",
  });
  assert.equal(payment.result.entry.balanceAfter, 1000);
  s = run(payment.state, "payment", {
    chargeId: c.id,
    amount: "10.00",
    method: "Cash",
  }).state;
  assert.equal(balance(s, c.memberId), 0);
  assert.equal(
    s.entries.find((e) => e.id === payment.result.entry.id).balanceAfter,
    1000,
  );
});
test("checkout records last-seen date and renewal records old and new due dates", () => {
  let s = run(blank(), "issue", {
    memberId: "M-1001",
    copyIds: ["LIB-0001"],
  }).state;
  assert.equal(s.copies[0].lastSeen, date);
  const old = s.loans[0].dueAt;
  s = run(s, "renew", { loanId: s.loans[0].id }).state;
  assert.deepEqual(s.loans[0].renewalHistory[0], {
    date,
    staff: "Test Admin",
    previousDue: old,
    newDue: "2026-12-22",
  });
});
test("suspending a member releases their ready reservation in the same response", () => {
  let s = blank();
  s = run(s, "placeHold", { memberId: "M-1002", titleId: "T-001" }).state;
  const m = s.members.find((m) => m.id === "M-1002");
  s = run(s, "saveMember", {
    originalId: m.id,
    id: m.id,
    name: m.name,
    email: m.email,
    department: m.department,
    expires: m.expires,
    status: "suspended",
  }).state;
  assert.equal(s.holds[0].status, "cancelled");
  assert.equal(
    s.copies.find((c) => c.id === s.holds[0].copyId).status,
    "available",
  );
});
