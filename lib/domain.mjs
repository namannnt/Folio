export const uid = (p) =>
  `${p}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a, b) =>
  Math.max(
    0,
    Math.round((new Date(b + "T12:00Z") - new Date(a + "T12:00Z")) / 86400000),
  );
export const isClosed = (s, d) => s.policy.closures.includes(d);
export function dueDate(s, from, days = s.policy.loanDays) {
  let d = addDays(from, days),
    i = 0;
  while (isClosed(s, d) && i++ < 366) d = addDays(d, 1);
  return d;
}
export function openingDeadline(s, from, n = s.policy.pickupDays) {
  let d = from,
    i = 0,
    guard = 0;
  while (i < n && guard++ < 730) {
    d = addDays(d, 1);
    if (!isClosed(s, d)) i++;
  }
  return d;
}
export function lateDays(s, loan, asOf = today()) {
  let n = 0;
  const end = loan.returnedAt || loan.lostAt || asOf;
  for (
    let d = addDays(loan.dueAt, 1), i = 0;
    d <= end && i < 10000;
    d = addDays(d, 1), i++
  )
    if (!(loan.policy?.closures || s.policy.closures).includes(d)) n++;
  return n;
}
export const fineFor = (s, l, asOf = today()) =>
  Math.min(
    lateDays(s, l, asOf) * (l.policy?.dailyFine ?? s.policy.dailyFine),
    l.policy?.fineCap ?? s.policy.fineCap,
  );
export const outstanding = (s, c) =>
  Math.max(
    0,
    c.amount -
      s.entries
        .filter((e) => e.chargeId === c.id)
        .reduce((a, e) => a + e.amount, 0),
  );
export const balance = (s, memberId) =>
  s.charges
    .filter((c) => c.memberId === memberId)
    .reduce((a, c) => a + outstanding(s, c), 0);
export const activeLoans = (s, memberId) =>
  s.loans.filter(
    (l) => l.status === "active" && (!memberId || l.memberId === memberId),
  );
export const titleOf = (s, c) => s.titles.find((t) => t.id === c?.titleId);
export const activeHolds = (s, titleId) =>
  s.holds.filter(
    (h) =>
      ["waiting", "ready"].includes(h.status) &&
      (!titleId || h.titleId === titleId),
  );
export function canBorrow(s, m, date = today()) {
  if (!m) return "Member not found.";
  if (m.status !== "active") return `Membership is ${m.status}.`;
  if (m.expires < date)
    return "Membership has expired. Renew the membership first.";
  if (balance(s, m.id) > 0)
    return "Outstanding assessed charges must be settled first.";
  if (activeLoans(s, m.id).some((l) => l.dueAt < date))
    return "Return overdue books before borrowing or renewing.";
  return "";
}
export class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "DomainError";
    this.status = status;
  }
}
const fail = (m, status = 400) => {
  throw new DomainError(m, status);
};
const required = (v, name, max = 200) => {
  const a = String(v ?? "").trim();
  if (!a) fail(`${name} is required.`);
  if (a.length > max) fail(`${name} is too long.`);
  return a;
};
const money = (n, name = "Amount") => {
  if (!["string", "number"].includes(typeof n) || String(n).trim() === "")
    fail(`${name} is required.`);
  const v = Number(n);
  if (
    !Number.isFinite(v) ||
    v < 0 ||
    v > 1000000 ||
    Math.abs(Math.round(v * 100) - v * 100) > 0.00001
  )
    fail(`${name} must be a non-negative amount with at most two decimals.`);
  return Math.round(v * 100);
};
const integer = (n, min, max, name) => {
  if (!["string", "number"].includes(typeof n) || String(n).trim() === "")
    fail(`${name} is required.`);
  const v = Number(n);
  if (!Number.isInteger(v) || v < min || v > max)
    fail(`${name} must be between ${min} and ${max}.`);
  return v;
};
const dateOK = (d) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !isNaN(Date.parse(d + "T12:00:00Z")) &&
  new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d;
export function validISBN(input) {
  const x = input.replace(/[-\s]/g, "").toUpperCase();
  if (!x) return true;
  if (/^\d{13}$/.test(x))
    return (
      [...x].reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0) % 10 === 0
    );
  if (/^\d{9}[\dX]$/.test(x))
    return (
      [...x].reduce(
        (n, c, i) => n + (c === "X" ? 10 : Number(c)) * (10 - i),
        0,
      ) %
        11 ===
      0
    );
  return false;
}
function log(s, actor, action, detail, date) {
  s.activity.unshift({
    id: uid("EV"),
    actor: actor.name,
    action,
    detail,
    at: new Date().toISOString(),
    date,
  });
}
function charge(s, memberId, loanId, copyId, type, amount, date, note = "") {
  if (amount <= 0) return null;
  const c = {
    id: uid("CH"),
    memberId,
    loanId,
    copyId,
    type,
    amount,
    date,
    note,
  };
  s.charges.push(c);
  return c;
}
function allocate(s, titleId, date) {
  const waiting = s.holds
    .filter((h) => h.titleId === titleId && h.status === "waiting")
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.sequence - b.sequence,
    );
  for (const h of waiting) {
    const m = s.members.find((m) => m.id === h.memberId);
    if (!m || m.status !== "active" || m.expires < date) {
      h.status = "cancelled";
      h.reason = "Membership is no longer active.";
      continue;
    }
    const c = s.copies.find(
      (c) => c.titleId === titleId && c.status === "available" && c.lendable,
    );
    if (!c) break;
    c.status = "reserved";
    h.status = "ready";
    h.copyId = c.id;
    h.readyAt = date;
    h.pickupBy = openingDeadline(s, date);
  }
}
export function maintain(s, date = today()) {
  let changed = false;
  for (const h of s.holds.filter((h) => h.status === "ready")) {
    const m = s.members.find((m) => m.id === h.memberId);
    const invalid = !m || m.status !== "active" || m.expires < date;
    if (!invalid && h.pickupBy >= date) continue;
    h.status = invalid ? "cancelled" : "expired";
    h.reason = invalid
      ? "Membership is no longer active."
      : "Pickup window expired.";
    log(
      s,
      {
        name: "System",
      },
      invalid ? "Reservation cancelled" : "Reservation expired",
      `${h.id} · ${h.reason}`,
      date,
    );
    const c = s.copies.find((c) => c.id === h.copyId);
    if (c?.status === "reserved") c.status = "available";
    changed = true;
  }
  for (const t of s.titles.filter((t) => !t.archived)) {
    const before = JSON.stringify(s.holds);
    allocate(s, t.id, date);
    if (before !== JSON.stringify(s.holds)) changed = true;
  }
  return changed;
}
export function seedState(date = today()) {
  const books = [
    [
      "Designing Data-Intensive Applications",
      "Martin Kleppmann",
      "9781449373320",
      "Technology",
      "2017",
      "O’Reilly Media",
      "#d6e4db",
      "DD",
      "3",
    ],
    [
      "The Midnight Library",
      "Matt Haig",
      "9781786892737",
      "Fiction",
      "2020",
      "Canongate",
      "#233e49",
      "ML",
      "3",
    ],
    [
      "Atomic Habits",
      "James Clear",
      "9780735211292",
      "Personal growth",
      "2018",
      "Avery",
      "#e4d1bd",
      "AH",
      "3",
    ],
    [
      "Clean Code",
      "Robert C. Martin",
      "9780132350884",
      "Technology",
      "2008",
      "Prentice Hall",
      "#1c3043",
      "CC",
      "3",
    ],
    [
      "The Psychology of Money",
      "Morgan Housel",
      "9780857197689",
      "Business",
      "2020",
      "Harriman House",
      "#dfddd0",
      "PM",
      "3",
    ],
    [
      "A Brief History of Time",
      "Stephen Hawking",
      "9780553380163",
      "Science",
      "1998",
      "Bantam",
      "#202d5d",
      "BT",
      "3",
    ],
    [
      "The Design of Everyday Things",
      "Don Norman",
      "9780465050659",
      "Design",
      "2013",
      "Basic Books",
      "#dd9c71",
      "DE",
      "2",
    ],
    [
      "Sapiens",
      "Yuval Noah Harari",
      "9780062316097",
      "History",
      "2015",
      "Harper",
      "#ded8c5",
      "SA",
      "3",
    ],
    [
      "Introduction to Algorithms",
      "Thomas H. Cormen et al.",
      "9780262046305",
      "Technology",
      "2022",
      "MIT Press",
      "#819aae",
      "IA",
      "3",
    ],
    [
      "Thinking, Fast and Slow",
      "Daniel Kahneman",
      "9780374533557",
      "Psychology",
      "2013",
      "Farrar, Straus and Giroux",
      "#e8d5ba",
      "TF",
      "2",
    ],
    [
      "The Alchemist",
      "Paulo Coelho",
      "9780061122415",
      "Fiction",
      "2006",
      "HarperOne",
      "#bd8055",
      "AL",
      "3",
    ],
    [
      "Deep Work",
      "Cal Newport",
      "9781455586691",
      "Personal growth",
      "2016",
      "Grand Central",
      "#c3d6cd",
      "DW",
      "2",
    ],
    [
      "Database System Concepts",
      "Abraham Silberschatz et al.",
      "9780078022159",
      "Technology",
      "2019",
      "McGraw-Hill",
      "#675b72",
      "DS",
      "3",
    ],
    [
      "The Art of Statistics",
      "David Spiegelhalter",
      "9781541618510",
      "Science",
      "2019",
      "Basic Books",
      "#7d9b94",
      "AS",
      "2",
    ],
    [
      "Pride and Prejudice",
      "Jane Austen",
      "9780141439518",
      "Fiction",
      "2002",
      "Penguin Classics",
      "#c1a3a4",
      "PP",
      "2",
    ],
    [
      "Operating System Concepts",
      "Abraham Silberschatz et al.",
      "9781119800361",
      "Technology",
      "2021",
      "Wiley",
      "#749095",
      "OS",
      "2",
    ],
    [
      "The Creative Act",
      "Rick Rubin",
      "9780593652886",
      "Design",
      "2023",
      "Penguin Press",
      "#eee6db",
      "CA",
      "2",
    ],
    [
      "Campus Research Handbook",
      "Library committee",
      "",
      "Reference",
      "2026",
      "College Library",
      "#55705b",
      "RH",
      "1",
    ],
  ];
  const s = {
    titles: [],
    copies: [],
    members: [],
    loans: [],
    holds: [],
    charges: [],
    entries: [],
    activity: [],
    audits: [],
    staff: [],
    completed: [],
    policy: {
      maxLoans: 3,
      loanDays: 14,
      maxRenewals: 1,
      dailyFine: 500,
      fineCap: 20000,
      pickupDays: 2,
      closures: [],
    },
  };
  let serial = 1;
  books.forEach((b, i) => {
    const t = {
      id: `T-${String(i + 1).padStart(3, "0")}`,
      title: b[0],
      author: b[1],
      isbn: b[2],
      category: b[3],
      year: b[4],
      publisher: b[5],
      color: b[6],
      monogram: b[7],
      edition:
        i === 12 ? "7th edition" : i === 8 ? "4th edition" : "Standard edition",
      description: "",
      archived: false,
      createdAt: date,
    };
    s.titles.push(t);
    for (let k = 0; k < Number(b[8]); k++)
      s.copies.push({
        id: `LIB-${String(serial++).padStart(4, "0")}`,
        titleId: t.id,
        shelf: `${t.category === "Technology" ? "CS" : t.category === "Fiction" ? "FI" : "GE"}-${String((i % 4) + 1).padStart(2, "0")}`,
        status: "available",
        lendable: t.category !== "Reference",
        cost: ((i % 5) + 4) * 15000,
        addedAt: date,
        lastSeen: null,
      });
  });
  const names = [
    ["Aarav Sharma", "Computer Science"],
    ["Ananya Rao", "Design"],
    ["Ishaan Mehta", "Mechanical Engineering"],
    ["Diya Patel", "Business"],
    ["Rohan Desai", "Computer Science"],
    ["Meera Iyer", "Electronics"],
    ["Kabir Singh", "Science"],
    ["Tara Kapoor", "Humanities"],
    ["Arjun Nair", "Computer Science"],
    ["Sana Khan", "Design"],
    ["Vikram Joshi", "Science"],
    ["Priya Shah", "Business"],
  ];
  names.forEach((n, i) =>
    s.members.push({
      id: `M-${1001 + i}`,
      name: n[0],
      department: n[1],
      email: n[0].toLowerCase().replace(" ", ".") + "@college.example",
      phone: `90000000${String(i + 1).padStart(2, "0")}`,
      status: i === 10 ? "suspended" : "active",
      joinedAt: addDays(date, -90),
      expires: addDays(date, i === 11 ? -7 : 180),
    }),
  );
  const loanSpecs = [
    [0, 0, -19],
    [3, 1, -16],
    [6, 2, -10],
    [9, 3, -8],
    [12, 4, -7],
    [15, 5, -4],
    [18, 6, -2],
    [24, 7, -1],
    [25, 8, -5],
    [26, 9, -3],
  ];
  loanSpecs.forEach(([ci, mi, offset], i) => {
    const c = s.copies[ci];
    c.status = "loaned";
    s.loans.push({
      id: `LN-${String(i + 1).padStart(4, "0")}`,
      copyId: c.id,
      memberId: s.members[mi].id,
      issuedAt: addDays(date, offset),
      dueAt: addDays(date, offset + 14),
      status: "active",
      renewals: 0,
      policy: structuredClone(s.policy),
      staff: "Alex Morgan",
    });
  });
  s.copies[10].status = "repair";
  s.copies[35].status = "missing";
  s.holds.push({
    id: "H-0001",
    titleId: "T-009",
    memberId: "M-1002",
    status: "waiting",
    createdAt: addDays(date, -2),
    sequence: 1,
  });
  s.holds.push({
    id: "H-0002",
    titleId: "T-002",
    memberId: "M-1006",
    status: "waiting",
    createdAt: addDays(date, -1),
    sequence: 2,
  });
  allocate(s, "T-002", date);
  charge(
    s,
    "M-1005",
    "HIST-01",
    s.copies[30].id,
    "Overdue",
    2500,
    addDays(date, -3),
    "5 late days × ₹5",
  );
  charge(
    s,
    "M-1004",
    "HIST-02",
    s.copies[31].id,
    "Overdue",
    1500,
    addDays(date, -1),
    "3 late days × ₹5",
  );
  charge(
    s,
    "M-1007",
    "HIST-03",
    s.copies[32].id,
    "Damage",
    8000,
    addDays(date, -4),
    "Repair assessment",
  );
  s.entries.push({
    id: "RC-0001",
    chargeId: s.charges[0].id,
    memberId: "M-1005",
    type: "payment",
    amount: 1000,
    date: addDays(date, -2),
    method: "Cash",
    note: "",
    staff: "Alex Morgan",
  });
  for (const [action, detail] of [
    ["Book issued", "The Alchemist · Kabir Singh"],
    ["Payment recorded", "₹10 received · Rohan Desai"],
    ["Reservation ready", "The Midnight Library · Meera Iyer"],
    ["Copy sent for repair", "LIB-0011 · Clean Code"],
  ])
    log(
      s,
      {
        name: "Alex Morgan",
      },
      action,
      detail,
      date,
    );
  return s;
}
export function mutate(input, action, p, actor, date = today()) {
  if (!p || typeof p !== "object" || Array.isArray(p))
    fail("Action payload must be an object.");
  if (!actor || !["admin", "librarian"].includes(actor.role))
    fail("Staff permission is required.", 403);
  if (!dateOK(date)) fail("Invalid transaction date.");
  if (
    action === "issue" &&
    (!Array.isArray(p.copyIds) ||
      p.copyIds.some((id) => typeof id !== "string"))
  )
    fail("Copy IDs must be a list of barcode strings.");
  if (
    action === "stocktake" &&
    (!Array.isArray(p.barcodes) ||
      p.barcodes.some((id) => typeof id !== "string" || id.length > 40))
  )
    fail(
      "Barcodes must be a list of barcode strings, each at most 40 characters.",
    );
  if (p.lendable !== undefined && typeof p.lendable !== "boolean")
    fail("Lending eligibility must be true or false.");
  const s = structuredClone(input);
  maintain(s, date);
  let message = "Saved successfully.",
    result = null;
  const admin = () => {
    if (actor.role !== "admin")
      fail("Administrator permission is required.", 403);
  };
  const copy = () =>
    s.copies.find((c) => c.id === p.copyId) || fail("Copy not found.");
  const member = () =>
    s.members.find((m) => m.id === p.memberId) || fail("Member not found.");
  if (action === "saveTitle") {
    const title = required(p.title, "Title"),
      author = required(p.author, "Author"),
      isbn = String(p.isbn || "")
        .replace(/[-\s]/g, "")
        .toUpperCase();
    if (!validISBN(isbn))
      fail("Enter a valid ISBN-10 or ISBN-13, or leave ISBN blank.");
    const existing = s.titles.find((t) => t.id === p.id);
    if (p.id && !existing) fail("Title not found.");
    if (existing?.archived) fail("An archived title cannot be edited.");
    if (isbn && s.titles.some((t) => t.id !== p.id && t.isbn === isbn))
      fail("This ISBN already exists. Open that title and add copies instead.");
    if (
      p.year &&
      (!/^\d{4}$/.test(String(p.year)) ||
        Number(p.year) > Number(date.slice(0, 4)) + 1 ||
        Number(p.year) < 1000)
    )
      fail("Enter a valid publication year.");
    const data = {
      title,
      author,
      isbn,
      category: required(p.category, "Category"),
      edition: required(p.edition, "Edition"),
      publisher: String(p.publisher || "").trim(),
      year: String(p.year || ""),
      description: String(p.description || "").slice(0, 2000),
    };
    if (existing) Object.assign(existing, data);
    else
      s.titles.push({
        ...data,
        id: uid("T"),
        color: "#8ba498",
        monogram: title
          .split(" ")
          .slice(0, 2)
          .map((x) => x[0])
          .join(""),
        archived: false,
        createdAt: date,
      });
    message = existing
      ? "Title updated."
      : "Title added. Add physical copies from its details.";
  } else if (action === "addCopies") {
    const t =
      s.titles.find((t) => t.id === p.titleId && !t.archived) ||
      fail("Active title not found.");
    const count = integer(p.count, 1, 50, "Number of copies"),
      shelf = required(p.shelf, "Shelf location", 40),
      cost = money(p.cost, "Replacement cost");
    const explicit = String(p.barcode || "")
      .trim()
      .toUpperCase();
    if (explicit && count !== 1)
      fail("A custom barcode can only be used when adding one copy.");
    if (explicit && !/^[A-Z0-9-]{3,40}$/.test(explicit))
      fail("Use 3–40 letters, numbers or hyphens for a barcode.");
    if (explicit && s.copies.some((c) => c.id === explicit))
      fail("This barcode already belongs to a copy.");
    let nextNumber =
      Math.max(
        0,
        ...s.copies.map((c) =>
          /^LIB-\d{1,9}$/.test(c.id) ? Number(c.id.slice(4)) : 0,
        ),
      ) + 1;
    for (let i = 0; i < count; i++) {
      let id = explicit;
      if (!id) {
        do {
          id = `LIB-${String(nextNumber++).padStart(4, "0")}`;
        } while (s.copies.some((c) => c.id === id));
      }
      s.copies.push({
        id,
        titleId: t.id,
        shelf,
        cost,
        status: "available",
        lendable: p.lendable !== false,
        addedAt: date,
        lastSeen: null,
      });
    }
    allocate(s, t.id, date);
    message = `${count} ${count === 1 ? "copy" : "copies"} added to the collection.`;
  } else if (action === "editCopy") {
    const c = copy();
    if (c.status === "withdrawn") fail("Withdrawn copies cannot be edited.");
    if (p.lendable === false && ["loaned", "reserved"].includes(c.status))
      fail(
        "Resolve the loan or reservation before making this copy reference-only.",
      );
    c.shelf = required(p.shelf, "Shelf", 40);
    c.cost = money(p.cost, "Replacement cost");
    c.lendable = p.lendable !== false;
    allocate(s, c.titleId, date);
    message = "Copy details updated.";
  } else if (action === "deleteCopy") {
    const c = copy();
    if (["loaned", "reserved"].includes(c.status))
      fail(
        "This copy is issued or allocated to a reservation. Resolve that transaction before deleting.",
      );
    if (s.charges.some((ch) => ch.copyId === c.id && outstanding(s, ch) > 0))
      fail("Resolve outstanding charges linked to this copy first.");
    if (c.status === "withdrawn") fail("This copy has already been removed.");
    if (
      s.copies.filter(
        (x) => x.titleId === c.titleId && x.status !== "withdrawn",
      ).length === 1 &&
      activeHolds(s, c.titleId).length
    )
      fail("Cancel the pending reservations before deleting the final copy.");
    c.status = "withdrawn";
    c.withdrawReason = required(p.reason, "Deletion reason");
    message = "Copy removed from active inventory. History preserved.";
  } else if (action === "archiveTitle") {
    const t =
      s.titles.find((t) => t.id === p.titleId) || fail("Title not found.");
    if (s.copies.some((c) => c.titleId === t.id && c.status !== "withdrawn"))
      fail("Delete the remaining physical copies before archiving this title.");
    if (activeHolds(s, t.id).length)
      fail("Resolve pending reservations first.");
    t.archived = true;
    t.archiveReason = required(p.reason, "Archive reason");
    message = "Title archived. Transaction history is retained.";
  } else if (action === "saveMember") {
    const name = required(p.name, "Name"),
      id = required(p.id || uid("M"), "Member ID", 40).toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(id))
      fail("Member ID can contain letters, numbers and hyphens.");
    const email = required(p.email, "Email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email.");
    if (!dateOK(p.expires)) fail("Enter a valid membership expiry date.");
    if (!["active", "suspended"].includes(p.status))
      fail("Invalid membership status.");
    const existing = s.members.find((m) => m.id === p.originalId);
    if (p.originalId && !existing) fail("Member not found.");
    if (s.members.some((m) => m.id === id && m.id !== p.originalId))
      fail("Member ID already exists.");
    if (existing && id !== existing.id)
      fail("Member IDs cannot change after creation.");
    const data = {
      name,
      email,
      department: required(p.department, "Department"),
      phone: String(p.phone || "").trim(),
      expires: p.expires,
      status: p.status,
    };
    if (existing) Object.assign(existing, data);
    else
      s.members.push({
        ...data,
        id,
        joinedAt: date,
      });
    maintain(s, date);
    message = existing ? "Member updated." : "Member added.";
  } else if (action === "issue") {
    const m = member(),
      reason = canBorrow(s, m, date);
    if (reason) fail(reason);
    const ids = [...new Set(p.copyIds || [])];
    if (!ids.length || ids.length > 50)
      fail("Select at least one physical copy.");
    if (activeLoans(s, m.id).length + ids.length > s.policy.maxLoans)
      fail(
        `Borrowing limit exceeded. Maximum ${s.policy.maxLoans} active loans.`,
      );
    for (const id of ids) {
      const c =
          s.copies.find((c) => c.id === id) || fail(`Copy ${id} not found.`),
        t = titleOf(s, c);
      if (!t || t.archived) fail("This title has been archived.");
      if (!c.lendable) fail(`${id} is reference-only and cannot be issued.`);
      const h = s.holds.find((h) => h.copyId === id && h.status === "ready");
      if (
        c.status !== "available" &&
        !(c.status === "reserved" && h?.memberId === m.id)
      )
        fail(`${id} is ${c.status} and cannot be issued.`);
      if (activeLoans(s).some((l) => l.copyId === id))
        fail("This copy already has an active loan.");
      c.status = "loaned";
      c.lastSeen = date;
      if (h) h.status = "fulfilled";
      s.loans.push({
        id: uid("LN"),
        copyId: id,
        memberId: m.id,
        issuedAt: date,
        dueAt: dueDate(s, date),
        status: "active",
        renewals: 0,
        policy: structuredClone(s.policy),
        staff: actor.name,
      });
    }
    message = `${ids.length} ${ids.length === 1 ? "book" : "books"} issued to ${m.name}.`;
    result = {
      kind: "issue",
      memberId: m.id,
      copyIds: ids,
      date,
      dueAt: dueDate(s, date),
      staff: actor.name,
      balanceAfter: balance(s, m.id),
    };
  } else if (action === "return") {
    const c = copy(),
      l =
        s.loans.find((l) => l.copyId === c.id && l.status === "active") ||
        fail(
          "This copy has no active loan. It may already have been returned.",
        );
    if (!["good", "damaged"].includes(p.condition))
      fail("Select the return condition.");
    l.returnedAt = date;
    l.status = "returned";
    const amount = fineFor(s, l, date);
    charge(
      s,
      l.memberId,
      l.id,
      c.id,
      "Overdue",
      amount,
      date,
      `${lateDays(s, l, date)} late chargeable days`,
    );
    c.status = p.condition === "damaged" ? "repair" : "available";
    c.lastSeen = date;
    const damage =
      p.condition === "damaged"
        ? money(p.damageAmount || 0, "Damage charge")
        : 0;
    if (damage)
      charge(
        s,
        l.memberId,
        l.id,
        c.id,
        "Damage",
        damage,
        date,
        required(p.note, "Damage assessment"),
      );
    allocate(s, c.titleId, date);
    message = amount
      ? `Book returned. ₹${(amount / 100).toFixed(2)} overdue fine assessed.`
      : "Book returned successfully.";
    result = {
      kind: "return",
      copyIds: [c.id],
      memberId: l.memberId,
      date,
      fine: amount,
      damage,
      staff: actor.name,
      status: c.status,
      balanceAfter: balance(s, l.memberId),
    };
  } else if (action === "renew") {
    const l =
      s.loans.find((l) => l.id === p.loanId && l.status === "active") ||
      fail("Active loan not found.");
    const m = s.members.find((m) => m.id === l.memberId),
      reason = canBorrow(s, m, date);
    if (reason) fail(reason);
    if (l.dueAt < date) fail("An overdue loan cannot be renewed.");
    if (l.renewals >= (l.policy?.maxRenewals ?? s.policy.maxRenewals))
      fail("Renewal limit reached.");
    const c = s.copies.find((c) => c.id === l.copyId);
    if (activeHolds(s, c.titleId).length)
      fail("Another member is waiting. Return this copy by its due date.");
    const previousDue = l.dueAt;
    l.dueAt = dueDate(
      {
        ...s,
        policy: l.policy || s.policy,
      },
      l.dueAt,
      l.policy?.loanDays ?? s.policy.loanDays,
    );
    l.renewals++;
    l.renewalHistory ??= [];
    l.renewalHistory.push({
      date,
      staff: actor.name,
      previousDue,
      newDue: l.dueAt,
    });
    message = `Renewed. New due date: ${l.dueAt}.`;
  } else if (action === "placeHold") {
    const m = member();
    if (m.status !== "active" || m.expires < date)
      fail("An active membership is required.");
    const t =
      s.titles.find((t) => t.id === p.titleId && !t.archived) ||
      fail("Title not found.");
    if (activeHolds(s, t.id).some((h) => h.memberId === m.id))
      fail("This member already has an active reservation for this edition.");
    if (
      activeLoans(s, m.id).some(
        (l) => s.copies.find((c) => c.id === l.copyId)?.titleId === t.id,
      )
    )
      fail("This member already has a copy of this edition on loan.");
    if (
      !s.copies.some(
        (c) =>
          c.titleId === t.id &&
          c.lendable &&
          !["withdrawn", "lost", "missing", "repair"].includes(c.status),
      )
    )
      fail(
        "No serviceable lendable copies exist. Resolve inventory before reserving.",
      );
    s.holds.push({
      id: uid("H"),
      memberId: m.id,
      titleId: t.id,
      status: "waiting",
      createdAt: date,
      sequence: s.holds.length + 1,
    });
    allocate(s, t.id, date);
    message =
      "Reservation placed. Available copies are allocated in queue order.";
  } else if (action === "cancelHold") {
    const h =
      s.holds.find(
        (h) => h.id === p.holdId && ["waiting", "ready"].includes(h.status),
      ) || fail("Active reservation not found.");
    h.status = "cancelled";
    h.reason = required(p.reason, "Cancellation reason");
    if (h.copyId) {
      const c = s.copies.find((c) => c.id === h.copyId);
      if (c?.status === "reserved") c.status = "available";
    }
    allocate(s, h.titleId, date);
    message = "Reservation cancelled. Next member considered.";
  } else if (action === "payment" || action === "waive") {
    if (action === "waive") admin();
    const ch =
        s.charges.find((c) => c.id === p.chargeId) || fail("Charge not found."),
      amount = money(p.amount);
    if (amount <= 0 || amount > outstanding(s, ch))
      fail(
        "Amount must be greater than zero and no more than the outstanding balance.",
      );
    if (
      action === "payment" &&
      !["Cash", "UPI (external)", "Card (external)"].includes(p.method)
    )
      fail("Select a payment method.");
    if (
      action === "payment" &&
      p.method !== "Cash" &&
      !String(p.note || "").trim()
    )
      fail("Enter the external payment reference.");
    const e = {
      id: uid(action === "payment" ? "RC" : "WV"),
      chargeId: ch.id,
      memberId: ch.memberId,
      type: action === "payment" ? "payment" : "waiver",
      amount,
      date,
      method: action === "payment" ? p.method : "Waiver",
      note:
        action === "waive"
          ? required(p.note, "Waiver reason")
          : String(p.note || ""),
      staff: actor.name,
    };
    s.entries.push(e);
    e.balanceAfter = balance(s, ch.memberId);
    message =
      action === "payment"
        ? "Payment recorded. Receipt created."
        : "Charge waived with an audit record.";
    result = {
      kind: "payment",
      entry: e,
    };
  } else if (action === "copyStatus") {
    const c = copy();
    if (["loaned", "reserved", "withdrawn"].includes(c.status))
      fail(
        "Use the return/lost workflow or resolve the reservation before changing this copy.",
      );
    if (!["available", "repair", "missing"].includes(p.status))
      fail("Invalid copy status.");
    if (c.status === "lost")
      fail("Use Recover lost copy so linked charges can be reviewed.");
    c.status = p.status;
    c.conditionNote = required(p.reason, "Reason");
    if (p.status === "available") c.lastSeen = date;
    allocate(s, c.titleId, date);
    message = "Copy status updated.";
  } else if (action === "reportLost") {
    const c = copy(),
      l =
        s.loans.find((l) => l.copyId === c.id && l.status === "active") ||
        fail(
          "Select a copy on an active loan. Missing shelf copies use the Missing status.",
        );
    l.status = "lost";
    l.lostAt = date;
    c.status = "lost";
    c.conditionNote = required(p.reason, "Loss note");
    const late = fineFor(s, l, date);
    charge(
      s,
      l.memberId,
      l.id,
      c.id,
      "Overdue",
      late,
      date,
      "Accrual stopped on reported loss",
    );
    charge(
      s,
      l.memberId,
      l.id,
      c.id,
      "Replacement",
      c.cost,
      date,
      c.conditionNote,
    );
    message =
      "Loss recorded. Loan resolved; applicable fines and replacement charge assessed.";
  } else if (action === "recoverLost") {
    admin();
    const c = copy();
    if (c.status !== "lost") fail("This copy is not marked lost.");
    c.status = "repair";
    c.lastSeen = date;
    c.conditionNote = required(p.reason, "Recovery inspection note");
    message =
      "Recovered copy sent for inspection. Review replacement charges and any refund separately.";
  } else if (action === "reverseEntry") {
    admin();
    const e =
      s.entries.find((e) => e.id === p.entryId && e.amount > 0) ||
      fail("Payment or waiver not found.");
    if (s.entries.some((x) => x.reverses === e.id))
      fail("This entry has already been reversed.");
    const note = required(p.reason, "Reversal reason");
    s.entries.push({
      id: uid("RV"),
      chargeId: e.chargeId,
      memberId: e.memberId,
      type: e.type === "payment" ? "refund" : "reversal",
      amount: -e.amount,
      date,
      method: e.method,
      note,
      staff: actor.name,
      reverses: e.id,
    });
    s.entries.at(-1).balanceAfter = balance(s, e.memberId);
    message =
      e.type === "payment"
        ? "Refund/reversal recorded. Complete any external refund separately."
        : "Waiver reversed.";
  } else if (action === "stocktake") {
    const shelf = required(p.shelf, "Shelf"),
      barcodes = [
        ...new Set(
          (p.barcodes || [])
            .map((x) => String(x).trim().toUpperCase())
            .filter(Boolean),
        ),
      ];
    if (!barcodes.length || barcodes.length > 500)
      fail("Enter between 1 and 500 copy barcodes.");
    const expected = s.copies.filter(
      (c) =>
        c.shelf === shelf &&
        ["available", "repair", "missing"].includes(c.status),
    );
    const rows = [];
    for (const id of barcodes) {
      const c = s.copies.find((c) => c.id === id);
      let finding = !c
        ? "Unknown barcode"
        : c.status === "withdrawn"
          ? "Withdrawn copy found"
          : c.shelf !== shelf
            ? "Wrong shelf"
            : c.status === "loaned"
              ? "Issued copy found"
              : c.status === "reserved"
                ? "Allocated copy found"
                : c.status === "lost"
                  ? "Lost copy found"
                  : "Seen";
      rows.push({
        copyId: id,
        finding,
      });
      if (c) c.lastSeen = date;
    }
    for (const c of expected)
      if (!barcodes.includes(c.id))
        rows.push({
          copyId: c.id,
          finding: "Not scanned — review",
        });
    const a = {
      id: uid("AUD"),
      shelf,
      date,
      staff: actor.name,
      rows,
    };
    s.audits.unshift(a);
    result = {
      kind: "audit",
      audit: a,
    };
    message =
      "Shelf verification saved. Discrepancies need review; no loan or fine was changed.";
  } else if (action === "savePolicy") {
    admin();
    const closures = Array.isArray(p.closures) ? [...new Set(p.closures)] : [];
    if (closures.length > 366 || closures.some((d) => !dateOK(d)))
      fail("Enter valid closure dates (YYYY-MM-DD).");
    s.policy = {
      maxLoans: integer(p.maxLoans, 1, 20, "Loan limit"),
      loanDays: integer(p.loanDays, 1, 90, "Loan period"),
      maxRenewals: integer(p.maxRenewals, 0, 5, "Renewals"),
      dailyFine: money(p.dailyFine, "Daily fine"),
      fineCap: money(p.fineCap, "Fine cap"),
      pickupDays: integer(p.pickupDays, 1, 10, "Pickup days"),
      closures,
    };
    message = "Policy saved. Existing loans retain their original rules.";
  } else fail("Unknown action.");
  const context = [
    p.copyId,
    p.copyIds?.join(", "),
    p.loanId,
    p.memberId,
    p.holdId,
    p.chargeId,
    p.entryId,
    p.titleId,
    p.id,
    p.title,
    p.name,
    p.shelf,
    p.reason,
  ]
    .filter(Boolean)
    .join(" · ");
  log(s, actor, action, context ? `${context} — ${message}` : message, date);
  return {
    state: s,
    message,
    result,
  };
}
