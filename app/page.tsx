"use client";

// Domain data is validated by the server. UI models follow lib/domain.mjs.
import React, { useEffect, useState, useRef, useId } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Library,
  ArrowLeftRight,
  Users,
  Bookmark,
  Wallet,
  Package,
  History,
  Settings,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  X,
  Download,
  MoreHorizontal,
  ScanLine,
  CalendarDays,
  Clock,
  AlertCircle,
  CheckCircle2,
  LogOut,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  Printer,
  Trash2,
  Pencil,
  MapPin,
  LockKeyhole,
  Menu,
  CheckCheck,
  Undo2,
} from "lucide-react";
import {
  today as getToday,
  addDays,
  activeLoans,
  balance,
  outstanding,
  titleOf,
  canBorrow,
  fineFor,
  lateDays,
  activeHolds,
} from "../lib/domain.mjs";
// Runtime-validated JSON records and heterogeneous component/form props share this UI boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n / 100);
const dateLabel = (v: string) =>
  v
    ? new Date(v + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const shortDate = (v: string) =>
  v
    ? new Date(v + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : "—";
const initials = (n: string) =>
  n
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
const nav = [
  ["Overview", LayoutDashboard],
  ["Catalogue", Library],
  ["Circulation", ArrowLeftRight],
  ["Members", Users],
  ["Reservations", Bookmark],
  ["Fines & payments", Wallet],
  ["Inventory", Package],
  ["Activity", History],
] as const;
function Badge({ children, tone = "neutral" }: Any) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Cover({ t, small = false }: Any) {
  return (
    <div
      className={"book-cover " + (small ? "small" : "")}
      style={{
        background: t?.color || "#7e9b8b",
        color: ["#233e49", "#1c3043", "#202d5d", "#675b72", "#55705b"].includes(
          t?.color,
        )
          ? "#f9f3df"
          : "#24372d",
      }}
    >
      <span className="cover-edition">FOLIO COLLECTION</span>
      <b>{t?.title}</b>
      <span className="cover-rule" />
      <small>{t?.author}</small>
    </div>
  );
}
function Empty({
  icon: Icon = Search,
  title = "Nothing here yet",
  text = "Try a different search or add your first record.",
  action,
}: Any) {
  return (
    <div className="empty">
      <Icon size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Field({ label, hint, children, ...p }: Any) {
  const id = useId(),
    hintId = hint ? id + "-hint" : undefined;
  function attach(nodes: Any): Any {
    return React.Children.map(nodes, (node: Any) => {
      if (!React.isValidElement(node)) return node;
      const el = node as React.ReactElement<Any>;
      if (["input", "select", "textarea"].includes(String(el.type)))
        return React.cloneElement(el, {
          id,
          "aria-describedby": hintId,
        });
      return el.props.children
        ? React.cloneElement(el, {}, attach(el.props.children))
        : el;
    });
  }
  return (
    <div className={"field " + (p.full ? "full" : "")}>
      <label htmlFor={id}>{label}</label>
      {children ? (
        attach(children)
      ) : (
        <input
          {...Object.fromEntries(
            Object.entries(p).filter(([k]) => k !== "full"),
          )}
          id={id}
          aria-describedby={hintId}
        />
      )}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}
function SelectField({ label, name, children, ...p }: Any) {
  return (
    <Field label={label}>
      <select name={name} {...p}>
        {children}
      </select>
    </Field>
  );
}
function Dialog({ title, subtitle, children, onClose, wide = false }: Any) {
  const ref = useRef<HTMLDialogElement>(null),
    headingId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className={"dialog " + (wide ? "wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
function SearchBox({ placeholder = "Search…", q, onChange }: Any) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {q && (
        <button
          onClick={() => onChange("")}
          className="icon-btn"
          aria-label="Clear search"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
function BookCell({ t, sub }: Any) {
  return (
    <div className="book-cell">
      <Cover t={t} small />
      <div>
        <b>{t?.title || "Unknown title"}</b>
        <small>{sub || t?.author}</small>
      </div>
    </div>
  );
}
function MemberCell({ m }: Any) {
  return (
    <div className="member-cell">
      <span
        className={
          "avatar color-" +
          ((Array.from(String(m?.id || "")).reduce(
            (sum, c) => sum + c.charCodeAt(0),
            0,
          ) %
            4) +
            1)
        }
      >
        {m ? initials(m.name) : "?"}
      </span>
      <div>
        <b>{m?.name}</b>
        <small>{m?.id}</small>
      </div>
    </div>
  );
}
function PageHead({ title, subtitle, action }: Any) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">LIBRARY WORKSPACE</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="head-actions">{action}</div>
    </div>
  );
}
function LoanTable({ items, s, date, onReturn, onRenew, onLost }: Any) {
  const copy = (id: string) => s.copies.find((c: Any) => c.id === id),
    member = (id: string) => s.members.find((m: Any) => m.id === id),
    loanBook = (l: Any) => titleOf(s, copy(l.copyId));
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Book / copy</th>
            <th>Borrower</th>
            <th>Issued</th>
            <th>Due date</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((l: Any) => (
            <tr key={l.id}>
              <td>
                <BookCell t={loanBook(l)} sub={l.copyId} />
              </td>
              <td>
                <MemberCell m={member(l.memberId)} />
              </td>
              <td>{shortDate(l.issuedAt)}</td>
              <td
                className={
                  l.status === "active" && l.dueAt < date ? "text-red" : ""
                }
              >
                {dateLabel(l.dueAt)}
              </td>
              <td>
                <Badge
                  tone={
                    l.status === "active" && l.dueAt < date
                      ? "red"
                      : statusTone(l.status)
                  }
                >
                  {l.status === "active"
                    ? l.dueAt < date
                      ? `${lateDays(s, l, date)} days overdue`
                      : "On loan"
                    : l.status === "returned"
                      ? "Returned"
                      : "Reported lost"}
                </Badge>
              </td>
              <td>
                <div className="row-actions">
                  {l.status === "active" && (
                    <>
                      <button className="text-btn" onClick={() => onReturn(l)}>
                        Return
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={"Renew " + loanBook(l)?.title}
                        onClick={() => onRenew(l)}
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={"Report lost " + l.copyId}
                        onClick={() => onLost(l)}
                      >
                        <AlertCircle size={16} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && (
        <Empty
          title="No loans to show"
          text="Issued books will appear here with their due dates."
        />
      )}
    </div>
  );
}
const statusTone = (status: string) =>
  ["available", "active", "returned", "Seen", "fulfilled"].includes(status)
    ? "green"
    : ["loaned", "ready", "reserved"].includes(status)
      ? "blue"
      : ["repair", "waiting", "expired", "Overdue"].includes(status)
        ? "amber"
        : ["lost", "missing", "suspended"].includes(status)
          ? "red"
          : "neutral";
export default function Home() {
  const [s, setS] = useState<Any>(null),
    [actor, setActor] = useState<Any>(null),
    [version, setVersion] = useState(0),
    [date, setDate] = useState(getToday()),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState("Overview"),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("All categories"),
    [statusFilter, setStatusFilter] = useState("All statuses"),
    [modal, setModal] = useState<Any>(null),
    [toast, setToast] = useState<Any>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Issue books"),
    [memberId, setMemberId] = useState(""),
    [scan, setScan] = useState(""),
    [cart, setCart] = useState<string[]>([]),
    [returnId, setReturnId] = useState(""),
    [returnCopy, setReturnCopy] = useState(""),
    [mobile, setMobile] = useState(false),
    [fineTab, setFineTab] = useState("Outstanding"),
    [similar, setSimilar] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const mutationLock = useRef(false),
    pendingWrite = useRef<Any>(null);
  const notify = (message: string, type = "success") => {
    setToast({
      message,
      type,
    });
  };
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function refresh(force = false) {
    if (mutationLock.current && !force) return;
    try {
      const r = await fetch("/api/library", {
        cache: "no-store",
      });
      const d: Any = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.authenticated) {
        setS(d.state);
        setActor(d.actor);
        setVersion(d.version);
        setDate(d.today);
      } else {
        setActor(null);
        setS(null);
      }
      setError("");
    } catch (e: Any) {
      setError(e.message || "Could not connect to the library.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(() => refresh());
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function go(p: string) {
    if (mutationLock.current) return;
    setPage(p);
    setQ("");
    setFilter("All categories");
    setStatusFilter("All statuses");
    setMobile(false);
    setError("");
  }
  function open(type: string, data: Any = {}) {
    if (mutationLock.current) return;
    setError("");
    setSimilar("");
    setModal({
      type,
      ...data,
    });
  }
  function close() {
    if (!mutationLock.current) {
      setModal(null);
      setError("");
    }
  }
  async function act(
    action: string,
    payload: Any,
    after?: (data: Any) => void,
  ) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    const intent = JSON.stringify({
      action,
      payload,
    });
    if (pendingWrite.current?.intent !== intent)
      pendingWrite.current = {
        intent,
        requestId: crypto.randomUUID(),
        version,
      };
    const request = pendingWrite.current;
    try {
      const r = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          payload,
          version: request.version,
          requestId: request.requestId,
        }),
      });
      const d: Any = await r.json();
      if (!r.ok) {
        if (r.status < 500) pendingWrite.current = null;
        if (r.status === 409) await refresh(true);
        if (r.status === 401) {
          setModal(null);
          setActor(null);
          setS(null);
          setCart([]);
        }
        throw new Error(d.error || "The change could not be saved.");
      }
      pendingWrite.current = null;
      if (d.state) {
        setS(d.state);
        setVersion(d.version);
        setDate(d.today);
      }
      setModal(null);
      notify(d.message);
      if (after) after(d);
      else if (d.result && d.result.kind !== "audit")
        setModal({
          type: "receipt",
          result: d.result,
        });
      return d;
    } catch (e: Any) {
      const message =
        e.message ||
        "Connection interrupted. Retry the same action to safely check its result.";
      setError(message);
      notify(message, "error");
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  const titles = s?.titles.filter((t: Any) => !t.archived) || [],
    copies = s?.copies.filter((c: Any) => c.status !== "withdrawn") || [],
    loans = s ? activeLoans(s) : [],
    overdue = loans.filter((l: Any) => l.dueAt < date),
    available = copies.filter(
      (c: Any) => c.status === "available" && c.lendable,
    ),
    holds = s ? activeHolds(s) : [],
    ready = holds.filter((h: Any) => h.status === "ready");
  const member = (id: string) => s.members.find((m: Any) => m.id === id),
    copy = (id: string) => s.copies.find((c: Any) => c.id === id),
    book = (id: string) => s.titles.find((t: Any) => t.id === id),
    loanBook = (l: Any) => titleOf(s, copy(l.copyId));
  const categories = [
    ...new Set(titles.map((t: Any) => t.category)),
  ].sort() as string[];
  const memberStatus = (m: Any) =>
    m.status === "active" && m.expires < date ? "expired" : m.status;
  const matches = (...values: Any[]) =>
    values.join(" ").toLowerCase().includes(q.toLowerCase());
  const copyStatus = (c: Any) =>
    c.status === "available" && !c.lendable
      ? "Reference only"
      : c.status === "repair"
        ? "Under repair"
        : c.status === "loaned"
          ? "On loan"
          : c.status === "reserved"
            ? "Ready for pickup"
            : c.status[0].toUpperCase() + c.status.slice(1);
  const tone = (status: string) =>
    ["available", "active", "returned", "Seen", "fulfilled"].includes(status)
      ? "green"
      : ["loaned", "ready", "reserved"].includes(status)
        ? "blue"
        : ["repair", "waiting", "expired", "Overdue"].includes(status)
          ? "amber"
          : ["lost", "missing", "suspended"].includes(status)
            ? "red"
            : "neutral";
  function exportCSV() {
    let rows: Any[][] = [];
    if (page === "Members")
      rows = [
        [
          "ID",
          "Name",
          "Email",
          "Department",
          "Status",
          "Expires",
          "Balance INR",
        ],
        ...s.members.map((m: Any) => [
          m.id,
          m.name,
          m.email,
          m.department,
          memberStatus(m),
          m.expires,
          balance(s, m.id) / 100,
        ]),
      ];
    else if (page === "Fines & payments")
      rows = [
        ["Charge", "Member", "Type", "Assessed INR", "Outstanding INR", "Date"],
        ...s.charges.map((c: Any) => [
          c.id,
          member(c.memberId)?.name,
          c.type,
          c.amount / 100,
          outstanding(s, c) / 100,
          c.date,
        ]),
      ];
    else
      rows = [
        ["Barcode", "Title", "Edition", "Shelf", "Status", "Replacement INR"],
        ...copies.map((c: Any) => [
          c.id,
          book(c.titleId)?.title,
          book(c.titleId)?.edition,
          c.shelf,
          copyStatus(c),
          c.cost / 100,
        ]),
      ];
    const csv = rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[\t\r\n ]*[=+@-]/, (m) => "'" + m)
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Folio-" + page.replaceAll(" ", "-") + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("CSV exported.");
  }
  function scanCopy() {
    const id = scan.trim().toUpperCase();
    const c = copy(id);
    if (!c) {
      notify("Copy not found. Enter a copy barcode such as LIB-0002.", "error");
      return;
    }
    if (cart.includes(id)) {
      notify("This copy is already in your issue list.", "error");
      return;
    }
    setCart([...cart, id]);
    setScan("");
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d = await act("login", Object.fromEntries(f), () => {});
    if (d) await refresh();
  }
  if (loading)
    return (
      <div className="boot">
        <div className="brand-mark">f</div>
        <h2>Opening your library…</h2>
        {error && <p>{error}</p>}
      </div>
    );
  if (!actor || !s)
    return (
      <div className="login-page">
        <div className="login-art">
          <div className="login-brand">
            <div className="brand-mark">f</div>
            <span>
              folio<span className="brand-period">.</span>
            </span>
          </div>
          <div className="login-story">
            <span className="eyebrow">A LITTLE ORDER. A WORLD OF IDEAS.</span>
            <h1>
              Good books.
              <br />
              Great possibilities.
            </h1>
            <p>
              A calmer way to care for your collection,
              <br />
              and the people who read it.
            </p>
            <div className="shelf-art">
              {[
                "#c7d5bd",
                "#d0a36a",
                "#8ba9a2",
                "#e6d9be",
                "#738b77",
                "#bea4a1",
              ].map((color, i) => (
                <div
                  key={color}
                  style={{
                    background: color,
                    height: 145 + (i % 3) * 28 + "px",
                    transform: `rotate(${i === 1 ? -7 : i === 4 ? 7 : 0}deg)`,
                  }}
                >
                  <span>
                    {
                      [
                        "THE ART OF READING",
                        "COLLECTED STORIES",
                        "A WORLD OF IDEAS",
                        "THE QUIET HOURS",
                        "THINKING IN SYSTEMS",
                        "EVERYDAY DISCOVERIES",
                      ][i]
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
          <span className="login-foot">BUILT FOR THE EVERYDAY LIBRARY</span>
        </div>
        <main className="login-panel">
          <div className="login-form">
            <Badge tone="green">
              <ShieldCheck size={13} /> Staff workspace
            </Badge>
            <h2>Welcome back.</h2>
            <p>Sign in to your library workspace.</p>
            <form onSubmit={login}>
              <Field
                label="Email address"
                name="email"
                type="email"
                placeholder="you@library.org"
                required
                autoComplete="username"
              />
              <Field
                label="Password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              {error && (
                <div className="inline-error" role="alert">
                  {error}
                </div>
              )}
              <button className="btn primary full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in to Folio"}
              </button>
            </form>
            <div className="demo-credentials">
              <div>
                <LockKeyhole size={15} />
                <b>Explore the demo library</b>
              </div>
              <p>
                Administrator: <strong>admin@folio.local</strong>
                <br />
                Password: <strong>FolioAdmin!2026</strong>
              </p>
              <p>
                Librarian: <strong>desk@folio.local</strong>
                <br />
                Password: <strong>FolioDesk!2026</strong>
              </p>
              <small>
                Fictional collection and members. Changes are saved.
              </small>
            </div>
          </div>
        </main>
        {toast && <div className={"toast " + toast.type}>{toast.message}</div>}
      </div>
    );
  const titleRows = titles.filter(
    (t: Any) =>
      matches(
        t.title,
        t.author,
        t.isbn,
        t.edition,
        ...s.copies
          .filter((c: Any) => c.titleId === t.id)
          .map((c: Any) => c.id),
      ) &&
      (filter === "All categories" || t.category === filter) &&
      (statusFilter === "All statuses" ||
        (statusFilter === "Available"
          ? s.copies.some(
              (c: Any) =>
                c.titleId === t.id && c.status === "available" && c.lendable,
            )
          : !s.copies.some(
              (c: Any) =>
                c.titleId === t.id && c.status === "available" && c.lendable,
            ))),
  );
  const visibleMembers = s.members.filter(
    (m: Any) =>
      matches(m.name, m.id, m.email, m.department) &&
      (statusFilter === "All statuses" || memberStatus(m) === statusFilter),
  );
  const loanActions = {
    s,
    date,
    onReturn: (l: Any) => {
      setModal(null);
      go("Circulation");
      setTab("Return books");
      setReturnCopy(l.copyId);
      setReturnId(l.copyId);
    },
    onRenew: (l: Any) =>
      open("renew", {
        loan: l,
      }),
    onLost: (l: Any) =>
      open("lost", {
        copy: copy(l.copyId),
      }),
  };
  const selectedReturnCopy = copy(returnCopy),
    selectedReturnLoan = loans.find((l: Any) => l.copyId === returnCopy);
  const descriptions: Any = {
    Catalogue: "Every title, edition, and copy. All in one place.",
    Circulation: "A smooth checkout. A simple return.",
    Members: "The people at the heart of your library.",
    Reservations: "The next great read, held in the right hands.",
    "Fines & payments": "Clear balances. Thoughtful accountability.",
    Inventory: "Know what you have, and where it belongs.",
    Activity: "A clear record of what changed and who changed it.",
    Settings: "The rules that keep your library running.",
  };
  return (
    <div className={"app-shell " + (busy ? "is-busy" : "")}>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <button className="brand" onClick={() => go("Overview")}>
          <div className="brand-mark">f</div>
          <span>
            folio<span className="brand-period">.</span>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Library size={18} />
          </span>
          <div>
            <b>Campus Library</b>
            <small>Library workspace</small>
          </div>
          <Badge>DEMO</Badge>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={"nav-item " + (page === name ? "selected" : "")}
              onClick={() => go(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Reservations" && holds.length > 0 && (
                <span className="nav-count">{holds.length}</span>
              )}
              {name === "Fines & payments" &&
                s.charges.some((c: Any) => outstanding(s, c) > 0) && (
                  <span className="nav-dot" />
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="library-note">
            <BookOpen size={22} />
            <p>
              A place for every book.
              <br />
              <b>A book for every reader.</b>
            </p>
          </div>
          <button
            className={"nav-item " + (page === "Settings" ? "selected" : "")}
            onClick={() => go("Settings")}
          >
            <Settings size={19} />
            Settings
          </button>
          <button className="nav-item" onClick={() => open("help")}>
            <HelpCircle size={19} />
            Workspace guide
          </button>
          <button className="staff-profile" onClick={() => open("account")}>
            <span className="avatar staff">{initials(actor.name)}</span>
            <div>
              <b>{actor.name}</b>
              <small>
                {actor.role === "admin" ? "Administrator" : "Librarian"}
              </small>
            </div>
            <ChevronDown size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={15} />
            <b>{page}</b>
          </div>
          <div className="global-search">
            <Search size={16} />
            <input
              ref={searchRef}
              placeholder="Search your collection…"
              aria-label="Search your collection"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  go("Catalogue");
                  setQ(e.currentTarget.value);
                  e.currentTarget.value = "";
                }
              }}
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-date">
            <CalendarDays size={16} />
            {dateLabel(date)}
          </div>
          <button
            className="icon-btn"
            aria-label="Refresh library"
            title="Refresh library"
            onClick={() => refresh().then(() => notify("Library refreshed."))}
          >
            <RefreshCw size={17} />
          </button>
        </header>
        <main className="content">
          {error && !modal && (
            <div className="inline-error" role="alert">
              <AlertCircle size={17} />
              {error}
            </div>
          )}
          {page === "Overview" && (
            <>
              <PageHead
                title="A good day to turn a page."
                subtitle="Here’s what’s happening in your library today."
                action={
                  <>
                    <button
                      className="btn"
                      onClick={() => {
                        go("Circulation");
                        setTab("Return books");
                      }}
                    >
                      <ArrowDownLeft size={17} />
                      Return book
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => {
                        go("Circulation");
                        setTab("Issue books");
                      }}
                    >
                      <Plus size={18} />
                      Issue book
                    </button>
                  </>
                }
              />
              <div className="overview-hero">
                <div>
                  <span className="hero-label">
                    <span /> YOUR COLLECTION, CONNECTED
                  </span>
                  <h2>
                    Less managing.
                    <br />
                    More discovering.
                  </h2>
                  <p>Keep books moving and your library in balance.</p>
                  <button className="hero-link" onClick={() => go("Catalogue")}>
                    Explore the collection <ChevronRight size={17} />
                  </button>
                </div>
                <div className="hero-books">
                  {[titles[0], titles[1], titles[2]]
                    .filter(Boolean)
                    .map((t: Any, i: number) => (
                      <div
                        key={t.id}
                        style={{
                          transform: `translateY(${i === 1 ? -13 : 8}px) rotate(${i === 0 ? -9 : i === 2 ? 8 : -2}deg)`,
                        }}
                      >
                        <Cover t={t} />
                      </div>
                    ))}
                </div>
                <span className="hero-watermark">f.</span>
              </div>
              <div className="stats-grid">
                {[
                  [
                    BookOpen,
                    "Total titles",
                    titles.length,
                    `${copies.length} physical copies`,
                    "green",
                  ],
                  [
                    Package,
                    "Available to borrow",
                    available.length,
                    `${copies.filter((c: Any) => !c.lendable).length} reference-only ${copies.filter((c: Any) => !c.lendable).length === 1 ? "copy" : "copies"}`,
                    "blue",
                  ],
                  [
                    ArrowUpRight,
                    "Books on loan",
                    loans.length,
                    `${loans.filter((l: Any) => l.dueAt === date).length} due today`,
                    "purple",
                  ],
                  [
                    Clock,
                    "Overdue books",
                    overdue.length,
                    overdue.length
                      ? "A little follow-up needed"
                      : "Everything is on time",
                    "orange",
                  ],
                ].map(([Icon, label, value, sub, color]: Any) => (
                  <button
                    className="stat-card"
                    key={label}
                    onClick={() => {
                      go(
                        label === "Total titles"
                          ? "Catalogue"
                          : label === "Available to borrow"
                            ? "Inventory"
                            : "Circulation",
                      );
                      if (label === "Available to borrow")
                        setStatusFilter("available");
                      if (label === "Overdue books") setTab("Overdue");
                      if (label === "Books on loan") setTab("All loans");
                    }}
                  >
                    <div className="stat-top">
                      <span>{label}</span>
                      <div className={"stat-icon " + color}>
                        <Icon size={19} />
                      </div>
                    </div>
                    <strong>{value}</strong>
                    <small>{sub}</small>
                  </button>
                ))}
              </div>
              <div className="overview-columns">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Needs a little attention</h2>
                      <p>Overdue books to follow up on.</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => {
                        go("Circulation");
                        setTab("Overdue");
                      }}
                    >
                      View all <ChevronRight size={15} />
                    </button>
                  </div>
                  <LoanTable {...loanActions} items={overdue.slice(0, 4)} />
                  <div className="panel-foot">
                    <span className="tiny-indicator amber" />
                    {overdue.length} overdue{" "}
                    {overdue.length === 1 ? "loan" : "loans"} · Estimated fines{" "}
                    {currency(
                      overdue.reduce(
                        (a: number, l: Any) => a + fineFor(s, l, date),
                        0,
                      ),
                    )}
                  </div>
                </section>
                <section className="panel activity-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Recent activity</h2>
                      <p>The latest around your library.</p>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label="View all activity"
                      onClick={() => go("Activity")}
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                  <div className="activity-list">
                    {s.activity.slice(0, 4).map((a: Any, i: number) => (
                      <div className="activity-item" key={a.id}>
                        <div
                          className={
                            "activity-icon " +
                            ["green", "blue", "orange", "purple"][i % 4]
                          }
                        >
                          {i % 2 ? (
                            <Wallet size={16} />
                          ) : (
                            <BookOpen size={16} />
                          )}
                        </div>
                        <div>
                          <b>
                            {a.action
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (c: string) => c.toUpperCase())}
                          </b>
                          <p>{a.detail}</p>
                          <small>
                            {a.actor} · {shortDate(a.date)}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="activity-all"
                    onClick={() => go("Activity")}
                  >
                    View activity log <ChevronRight size={15} />
                  </button>
                </section>
              </div>
              <div className="section-title">
                <div>
                  <h2>From the shelves</h2>
                  <p>A few familiar faces in your collection.</p>
                </div>
                <button className="text-btn" onClick={() => go("Catalogue")}>
                  Browse catalogue <ChevronRight size={15} />
                </button>
              </div>
              <div className="shelf-grid">
                {titles.slice(0, 6).map((t: Any) => (
                  <button
                    className="shelf-book"
                    key={t.id}
                    onClick={() =>
                      open("title", {
                        id: t.id,
                      })
                    }
                  >
                    <Cover t={t} />
                    <b>{t.title}</b>
                    <small>{t.author}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {page === "Catalogue" && (
            <>
              <PageHead
                title="The collection"
                subtitle={descriptions[page]}
                action={
                  <>
                    <button className="btn" onClick={exportCSV}>
                      <Download size={17} />
                      Export
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => open("titleForm")}
                    >
                      <Plus size={18} />
                      Add title
                    </button>
                  </>
                }
              />
              <div className="summary-strip">
                <span>
                  <b>{titles.length}</b> titles
                </span>
                <i />
                <span>
                  <b>{copies.length}</b> physical copies
                </span>
                <i />
                <span>
                  <b>{available.length}</b> available to borrow
                </span>
              </div>
              <section className="panel">
                <div className="toolbar">
                  <SearchBox
                    q={q}
                    onChange={setQ}
                    placeholder="Search title, author, ISBN, or barcode…"
                  />
                  <div className="toolbar-selects">
                    <select
                      aria-label="Category filter"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option>All categories</option>
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Availability filter"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option>All statuses</option>
                      <option>Available</option>
                      <option>Unavailable</option>
                    </select>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="catalogue-table">
                    <thead>
                      <tr>
                        <th>Book title</th>
                        <th>Category</th>
                        <th>Edition / ISBN</th>
                        <th>Availability</th>
                        <th>Copies</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {titleRows.map((t: Any) => {
                        const cs = copies.filter(
                            (c: Any) => c.titleId === t.id,
                          ),
                          av = cs.filter(
                            (c: Any) => c.status === "available" && c.lendable,
                          ).length;
                        return (
                          <tr
                            key={t.id}
                            onClick={() =>
                              open("title", {
                                id: t.id,
                              })
                            }
                            className="clickable"
                          >
                            <td>
                              <BookCell t={t} />
                            </td>
                            <td>
                              <Badge>{t.category}</Badge>
                            </td>
                            <td>
                              <b className="cell-primary">{t.edition}</b>
                              <small className="mono">
                                {t.isbn || "No ISBN · internal record"}
                              </small>
                            </td>
                            <td>
                              <Badge tone={av ? "green" : "amber"}>
                                {av
                                  ? `${av} available`
                                  : cs.every((c: Any) => !c.lendable) &&
                                      cs.length
                                    ? "Reference only"
                                    : "Unavailable"}
                              </Badge>
                            </td>
                            <td>
                              <span className="copy-number">{cs.length}</span>
                            </td>
                            <td>
                              <button
                                className="icon-btn"
                                aria-label={"View " + t.title}
                              >
                                <ChevronRight size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!titleRows.length && (
                  <Empty
                    title="No matching books"
                    text="Try a different keyword or clear the filters."
                    action={
                      <button
                        className="btn"
                        onClick={() => {
                          setQ("");
                          setFilter("All categories");
                          setStatusFilter("All statuses");
                        }}
                      >
                        Clear filters
                      </button>
                    }
                  />
                )}
                <div className="panel-foot between">
                  <span>
                    Showing {titleRows.length} of {titles.length} titles
                  </span>
                  <span>Each edition has its own record</span>
                </div>
              </section>
            </>
          )}
          {page === "Members" && (
            <>
              <PageHead
                title="Your reading community"
                subtitle={descriptions[page]}
                action={
                  <>
                    <button className="btn" onClick={exportCSV}>
                      <Download size={17} />
                      Export
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => open("memberForm")}
                    >
                      <Plus size={18} />
                      Add member
                    </button>
                  </>
                }
              />
              <div className="mini-stats">
                <div>
                  <Users size={20} />
                  <span>
                    <b>{s.members.length}</b> registered members
                  </span>
                </div>
                <div>
                  <CheckCircle2 size={20} />
                  <span>
                    <b>
                      {
                        s.members.filter(
                          (m: Any) => memberStatus(m) === "active",
                        ).length
                      }
                    </b>{" "}
                    active memberships
                  </span>
                </div>
                <div>
                  <Wallet size={20} />
                  <span>
                    <b>
                      {currency(
                        s.charges.reduce(
                          (a: number, c: Any) => a + outstanding(s, c),
                          0,
                        ),
                      )}
                    </b>{" "}
                    outstanding
                  </span>
                </div>
              </div>
              <section className="panel">
                <div className="toolbar">
                  <SearchBox
                    q={q}
                    onChange={setQ}
                    placeholder="Search name, member ID, or department…"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Member status"
                  >
                    <option>All statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Department</th>
                        <th>Membership</th>
                        <th>Active loans</th>
                        <th>Balance</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMembers.map((m: Any) => (
                        <tr
                          key={m.id}
                          className="clickable"
                          onClick={() =>
                            open("member", {
                              id: m.id,
                            })
                          }
                        >
                          <td>
                            <MemberCell m={m} />
                          </td>
                          <td>
                            {m.department}
                            <small>{m.email}</small>
                          </td>
                          <td>
                            <Badge tone={tone(memberStatus(m))}>
                              {memberStatus(m)}
                            </Badge>
                            <small>Until {shortDate(m.expires)}</small>
                          </td>
                          <td>
                            {activeLoans(s, m.id).length} / {s.policy.maxLoans}
                          </td>
                          <td
                            className={balance(s, m.id) > 0 ? "text-amber" : ""}
                          >
                            {currency(balance(s, m.id))}
                          </td>
                          <td>
                            <ChevronRight size={18} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!visibleMembers.length && (
                  <Empty title="No matching members" />
                )}
                <div className="panel-foot">
                  Showing {visibleMembers.length} members
                </div>
              </section>
            </>
          )}
          {page === "Circulation" && (
            <>
              <PageHead
                title="The circulation desk"
                subtitle={descriptions[page]}
                action={
                  <Badge tone="green">
                    <span className="tiny-indicator green" />
                    Desk open
                  </Badge>
                }
              />
              <div className="tabs">
                {["Issue books", "Return books", "All loans", "Overdue"].map(
                  (t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTab(t);
                        setQ("");
                        setError("");
                      }}
                      className={tab === t ? "active" : ""}
                    >
                      {t}
                      {t === "Overdue" && overdue.length > 0 && (
                        <span>{overdue.length}</span>
                      )}
                    </button>
                  ),
                )}
              </div>
              {tab === "Issue books" && (
                <div className="desk-grid">
                  <section className="panel desk-panel">
                    <div className="panel-head">
                      <div>
                        <span className="step-label">STEP 01</span>
                        <h2>Who’s borrowing?</h2>
                      </div>
                      <Users size={21} />
                    </div>
                    <div className="panel-pad">
                      <Field label="Find a member">
                        <select
                          value={memberId}
                          onChange={(e) => setMemberId(e.target.value)}
                        >
                          <option value="">Select a member…</option>
                          {s.members.map((m: Any) => (
                            <option key={m.id} value={m.id}>
                              {m.name} · {m.id}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {memberId ? (
                        <>
                          <div className="borrower-card">
                            <MemberCell m={member(memberId)} />
                            <Badge tone={tone(memberStatus(member(memberId)))}>
                              {memberStatus(member(memberId))}
                            </Badge>
                          </div>
                          <div className="member-facts">
                            <span>
                              Current loans
                              <b>
                                {activeLoans(s, memberId).length} /{" "}
                                {s.policy.maxLoans}
                              </b>
                            </span>
                            <span>
                              Assessed balance
                              <b>{currency(balance(s, memberId))}</b>
                            </span>
                            <span>
                              Membership ends
                              <b>{dateLabel(member(memberId).expires)}</b>
                            </span>
                          </div>
                          {canBorrow(s, member(memberId), date) ? (
                            <div className="notice amber">
                              <AlertCircle size={18} />
                              {canBorrow(s, member(memberId), date)}
                            </div>
                          ) : (
                            <div className="notice green">
                              <CheckCircle2 size={18} />
                              Ready to borrow
                            </div>
                          )}
                        </>
                      ) : (
                        <Empty
                          icon={Users}
                          title="Start with a member"
                          text="Select a borrower to check eligibility and view their account."
                        />
                      )}
                    </div>
                  </section>
                  <section className="panel desk-panel">
                    <div className="panel-head">
                      <div>
                        <span className="step-label">STEP 02</span>
                        <h2>Choose their next read</h2>
                      </div>
                      <ScanLine size={22} />
                    </div>
                    <div className="panel-pad">
                      <label className="field">
                        <span>Scan or enter copy barcode</span>
                        <div className="input-action">
                          <ScanLine size={20} />
                          <input
                            value={scan}
                            onChange={(e) => setScan(e.target.value)}
                            placeholder="e.g. LIB-0002"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") scanCopy();
                            }}
                          />
                          <button className="btn" onClick={scanCopy}>
                            Add
                          </button>
                        </div>
                      </label>
                      <Field label="Or choose from the collection">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const id = e.target.value;
                              if (!cart.includes(id)) setCart([...cart, id]);
                              else
                                notify(
                                  "This copy is already selected.",
                                  "error",
                                );
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">Browse physical copies…</option>
                          {copies.map((c: Any) => (
                            <option key={c.id} value={c.id}>
                              {c.id} · {book(c.titleId)?.title} ·{" "}
                              {copyStatus(c)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {cart.length ? (
                        <div className="issue-list">
                          {cart.map((id) => (
                            <div className="issue-row" key={id}>
                              <BookCell t={titleOf(s, copy(id))} sub={id} />
                              <Badge tone={tone(copy(id).status)}>
                                {copyStatus(copy(id))}
                              </Badge>
                              <button
                                className="icon-btn"
                                aria-label={"Remove " + id}
                                onClick={() =>
                                  setCart(cart.filter((x) => x !== id))
                                }
                              >
                                <X size={17} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="scan-empty">
                          <ScanLine size={33} />
                          <b>Your issue list is empty</b>
                          <p>Add a copy by barcode or choose it above.</p>
                        </div>
                      )}
                      <div className="checkout-summary">
                        <span>
                          Loan period<b>{s.policy.loanDays} days</b>
                        </span>
                        <span>
                          Books selected<b>{cart.length}</b>
                        </span>
                      </div>
                      <button
                        className="btn primary full"
                        disabled={busy || !memberId || !cart.length}
                        onClick={() =>
                          act(
                            "issue",
                            {
                              memberId,
                              copyIds: cart,
                            },
                            (d: Any) => {
                              setCart([]);
                              setModal({
                                type: "receipt",
                                result: d.result,
                              });
                            },
                          )
                        }
                      >
                        <Check size={18} />
                        {busy
                          ? "Saving…"
                          : `Issue ${cart.length || ""} ${cart.length === 1 ? "book" : "books"}`}
                      </button>
                    </div>
                  </section>
                </div>
              )}
              {tab === "Return books" && (
                <div className="return-layout">
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>A book comes home</h2>
                        <p>Find the physical copy to complete its return.</p>
                      </div>
                      <ArrowDownLeft size={23} />
                    </div>
                    <div className="panel-pad">
                      <Field label="Copy barcode">
                        <div className="input-action">
                          <ScanLine size={21} />
                          <input
                            value={returnId}
                            onChange={(e) => setReturnId(e.target.value)}
                            placeholder="Scan or enter barcode"
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                setReturnCopy(returnId.trim().toUpperCase());
                            }}
                          />
                          <button
                            className="btn primary"
                            onClick={() =>
                              setReturnCopy(returnId.trim().toUpperCase())
                            }
                          >
                            Find loan
                          </button>
                        </div>
                      </Field>
                      <Field label="Or select an active loan">
                        <select
                          value={returnCopy}
                          onChange={(e) => {
                            setReturnCopy(e.target.value);
                            setReturnId(e.target.value);
                          }}
                        >
                          <option value="">Choose an issued copy…</option>
                          {loans.map((l: Any) => (
                            <option key={l.id} value={l.copyId}>
                              {l.copyId} · {loanBook(l)?.title} ·{" "}
                              {member(l.memberId)?.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {returnCopy &&
                        (!selectedReturnLoan ? (
                          <div className="notice amber">
                            <AlertCircle size={20} />
                            {selectedReturnCopy
                              ? "This copy has no active loan. It may already be returned."
                              : "Barcode not found in the collection."}
                          </div>
                        ) : (
                          <div className="return-found">
                            <BookCell
                              t={loanBook(selectedReturnLoan)}
                              sub={selectedReturnLoan.copyId}
                            />
                            <div className="detail-grid">
                              <span>
                                Borrower
                                <b>
                                  {member(selectedReturnLoan.memberId)?.name}
                                </b>
                              </span>
                              <span>
                                Due date
                                <b>{dateLabel(selectedReturnLoan.dueAt)}</b>
                              </span>
                              <span>
                                Late chargeable days
                                <b>{lateDays(s, selectedReturnLoan, date)}</b>
                              </span>
                              <span>
                                Fine on return
                                <b>
                                  {currency(
                                    fineFor(s, selectedReturnLoan, date),
                                  )}
                                </b>
                              </span>
                            </div>
                            <button
                              className="btn primary full"
                              onClick={() =>
                                open("return", {
                                  copy: selectedReturnCopy,
                                  loan: selectedReturnLoan,
                                })
                              }
                            >
                              <Check size={17} />
                              Review & return book
                            </button>
                            <button
                              className="text-btn danger center"
                              onClick={() =>
                                open("lost", {
                                  copy: selectedReturnCopy,
                                })
                              }
                            >
                              Report this copy lost
                            </button>
                          </div>
                        ))}
                    </div>
                  </section>
                  <aside className="policy-card">
                    <BookOpen size={29} />
                    <h3>
                      Returns first.
                      <br />
                      Payments second.
                    </h3>
                    <p>
                      Every valid return is accepted, even when the borrower has
                      an unpaid balance.
                    </p>
                    <hr />
                    <p>
                      Overdue fines stop on return. Damaged copies go to repair.
                      Reserved copies are held for the next reader.
                    </p>
                    <small>
                      Daily fine {currency(s.policy.dailyFine)} · cap{" "}
                      {currency(s.policy.fineCap)} per loan
                    </small>
                  </aside>
                </div>
              )}
              {["All loans", "Overdue"].includes(tab) && (
                <section className="panel">
                  <div className="toolbar">
                    <SearchBox
                      q={q}
                      onChange={setQ}
                      placeholder="Search book, copy, or borrower…"
                    />
                    {tab === "All loans" && (
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        aria-label="Loan status"
                      >
                        <option>All statuses</option>
                        <option value="active">Active</option>
                        <option value="returned">Returned</option>
                        <option value="lost">Lost</option>
                      </select>
                    )}
                  </div>
                  <LoanTable
                    {...loanActions}
                    items={(tab === "Overdue" ? overdue : s.loans).filter(
                      (l: Any) =>
                        matches(
                          l.copyId,
                          loanBook(l)?.title,
                          member(l.memberId)?.name,
                        ) &&
                        (tab === "Overdue" ||
                          statusFilter === "All statuses" ||
                          l.status === statusFilter),
                    )}
                  />
                </section>
              )}
            </>
          )}
          {page === "Reservations" && (
            <>
              <PageHead
                title="Next in line"
                subtitle={descriptions[page]}
                action={
                  <button className="btn primary" onClick={() => open("hold")}>
                    <Plus size={18} />
                    Place reservation
                  </button>
                }
              />
              <div className="mini-stats">
                <div>
                  <Bookmark size={20} />
                  <span>
                    <b>
                      {holds.filter((h: Any) => h.status === "waiting").length}
                    </b>{" "}
                    waiting in queue
                  </span>
                </div>
                <div>
                  <CheckCheck size={20} />
                  <span>
                    <b>{ready.length}</b> ready for pickup
                  </span>
                </div>
                <div>
                  <Clock size={20} />
                  <span>
                    <b>{s.policy.pickupDays} opening days</b> to collect
                  </span>
                </div>
              </div>
              <section className="panel">
                <div className="toolbar">
                  <SearchBox
                    q={q}
                    onChange={setQ}
                    placeholder="Search title or member…"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Reservation status"
                  >
                    <option>All statuses</option>
                    <option value="waiting">Waiting</option>
                    <option value="ready">Ready</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Book / edition</th>
                        <th>Member</th>
                        <th>Placed</th>
                        <th>Status</th>
                        <th>Pickup / queue</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.holds
                        .filter(
                          (h: Any) =>
                            matches(
                              book(h.titleId)?.title,
                              member(h.memberId)?.name,
                            ) &&
                            (statusFilter === "All statuses" ||
                              h.status === statusFilter),
                        )
                        .map((h: Any) => (
                          <tr key={h.id}>
                            <td>
                              <BookCell
                                t={book(h.titleId)}
                                sub={book(h.titleId)?.edition}
                              />
                            </td>
                            <td>
                              <MemberCell m={member(h.memberId)} />
                            </td>
                            <td>{shortDate(h.createdAt)}</td>
                            <td>
                              <Badge tone={tone(h.status)}>
                                {h.status === "ready"
                                  ? "Ready for pickup"
                                  : h.status}
                              </Badge>
                            </td>
                            <td>
                              {h.status === "ready" ? (
                                <>
                                  <b className="cell-primary">
                                    By {dateLabel(h.pickupBy)}
                                  </b>
                                  <small className="mono">{h.copyId}</small>
                                </>
                              ) : h.status === "waiting" ? (
                                `Position ${s.holds.filter((x: Any) => x.titleId === h.titleId && x.status === "waiting" && x.sequence <= h.sequence).length}`
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              <div className="row-actions">
                                {h.status === "ready" && (
                                  <button
                                    className="text-btn"
                                    onClick={() => {
                                      go("Circulation");
                                      setTab("Issue books");
                                      setMemberId(h.memberId);
                                      setCart([h.copyId]);
                                    }}
                                  >
                                    Issue
                                  </button>
                                )}
                                {["waiting", "ready"].includes(h.status) && (
                                  <button
                                    className="icon-btn"
                                    aria-label={"Cancel reservation " + h.id}
                                    onClick={() =>
                                      open("cancelHold", {
                                        hold: h,
                                      })
                                    }
                                  >
                                    <X size={17} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      {s.holds.filter(
                        (h: Any) =>
                          matches(
                            book(h.titleId)?.title,
                            member(h.memberId)?.name,
                          ) &&
                          (statusFilter === "All statuses" ||
                            h.status === statusFilter),
                      ).length === 0 && (
                        <tr>
                          <td colSpan={6}>
                            <Empty
                              title="No reservations to show"
                              text="Try another search or filter, or create a record to get started."
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="panel-foot">
                  Reservations are specific to an edition. Copies are allocated
                  in queue order.
                </div>
              </section>
            </>
          )}
          {page === "Fines & payments" && (
            <>
              <PageHead
                title="A balanced account"
                subtitle={descriptions[page]}
                action={
                  <button className="btn" onClick={exportCSV}>
                    <Download size={17} />
                    Export ledger
                  </button>
                }
              />
              <div className="finance-stats">
                {[
                  [
                    "Outstanding balance",
                    s.charges.reduce(
                      (a: number, c: Any) => a + outstanding(s, c),
                      0,
                    ),
                    "amber",
                  ],
                  [
                    "Payments received",
                    s.entries
                      .filter(
                        (e: Any) => e.type === "payment" || e.type === "refund",
                      )
                      .reduce((a: number, e: Any) => a + e.amount, 0),
                    "green",
                  ],
                  [
                    "Charges waived",
                    s.entries
                      .filter(
                        (e: Any) =>
                          e.type === "waiver" || e.type === "reversal",
                      )
                      .reduce((a: number, e: Any) => a + e.amount, 0),
                    "blue",
                  ],
                ].map(([label, value, t]: Any) => (
                  <div className="panel finance-card" key={label}>
                    <span>{label}</span>
                    <strong>{currency(value)}</strong>
                    <small>
                      {t === "amber"
                        ? "Assessed charges only"
                        : t === "green"
                          ? "Net of recorded refunds"
                          : "Net of reversed waivers"}
                    </small>
                  </div>
                ))}
              </div>
              <div className="tabs">
                {["Outstanding", "All charges", "Transactions"].map((t) => (
                  <button
                    key={t}
                    className={fineTab === t ? "active" : ""}
                    onClick={() => setFineTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <section className="panel">
                <div className="toolbar">
                  <SearchBox
                    q={q}
                    onChange={setQ}
                    placeholder="Search member, charge, or transaction…"
                  />
                </div>
                <div className="table-scroll">
                  {fineTab === "Transactions" ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Receipt / entry</th>
                          <th>Member</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Date / staff</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.entries
                          .filter((e: Any) =>
                            matches(e.id, member(e.memberId)?.name, e.type),
                          )
                          .slice()
                          .reverse()
                          .map((e: Any) => (
                            <tr key={e.id}>
                              <td>
                                <b className="mono">{e.id}</b>
                                <small>{e.method}</small>
                              </td>
                              <td>
                                <MemberCell m={member(e.memberId)} />
                              </td>
                              <td>
                                <Badge tone={e.amount < 0 ? "amber" : "green"}>
                                  {e.type}
                                </Badge>
                              </td>
                              <td>{currency(e.amount)}</td>
                              <td>
                                {dateLabel(e.date)}
                                <small>{e.staff}</small>
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="text-btn"
                                    onClick={() =>
                                      open("receipt", {
                                        result: {
                                          kind: "payment",
                                          entry: e,
                                        },
                                      })
                                    }
                                  >
                                    Receipt
                                  </button>
                                  {actor.role === "admin" &&
                                    e.amount > 0 &&
                                    !s.entries.some(
                                      (x: Any) => x.reverses === e.id,
                                    ) && (
                                      <button
                                        className="icon-btn"
                                        aria-label={"Reverse " + e.id}
                                        onClick={() =>
                                          open("reverse", {
                                            entry: e,
                                          })
                                        }
                                      >
                                        <Undo2 size={16} />
                                      </button>
                                    )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        {s.entries
                          .filter((e: Any) =>
                            matches(e.id, member(e.memberId)?.name, e.type),
                          )
                          .slice()
                          .reverse().length === 0 && (
                          <tr>
                            <td colSpan={6}>
                              <Empty
                                title="No transactions to show"
                                text="Try another search or filter, or create a record to get started."
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Charge</th>
                          <th>Assessed</th>
                          <th>Outstanding</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.charges
                          .filter(
                            (c: Any) =>
                              (fineTab !== "Outstanding" ||
                                outstanding(s, c) > 0) &&
                              matches(member(c.memberId)?.name, c.id, c.type),
                          )
                          .map((c: Any) => (
                            <tr key={c.id}>
                              <td>
                                <MemberCell m={member(c.memberId)} />
                              </td>
                              <td>
                                <b className="cell-primary">{c.type}</b>
                                <small>{c.note}</small>
                              </td>
                              <td>
                                {currency(c.amount)}
                                <small>{shortDate(c.date)}</small>
                              </td>
                              <td
                                className={
                                  outstanding(s, c) > 0 ? "text-amber" : ""
                                }
                              >
                                <b>{currency(outstanding(s, c))}</b>
                              </td>
                              <td>
                                <Badge
                                  tone={
                                    outstanding(s, c) === 0
                                      ? "green"
                                      : outstanding(s, c) < c.amount
                                        ? "blue"
                                        : "amber"
                                  }
                                >
                                  {outstanding(s, c) === 0
                                    ? "Settled"
                                    : outstanding(s, c) < c.amount
                                      ? "Part-paid"
                                      : "Unpaid"}
                                </Badge>
                              </td>
                              <td>
                                {outstanding(s, c) > 0 && (
                                  <div className="row-actions">
                                    <button
                                      className="btn small-btn"
                                      onClick={() =>
                                        open("payment", {
                                          charge: c,
                                        })
                                      }
                                    >
                                      Record payment
                                    </button>
                                    {actor.role === "admin" && (
                                      <button
                                        className="text-btn muted"
                                        onClick={() =>
                                          open("waive", {
                                            charge: c,
                                          })
                                        }
                                      >
                                        Waive
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        {s.charges.filter(
                          (c: Any) =>
                            (fineTab !== "Outstanding" ||
                              outstanding(s, c) > 0) &&
                            matches(member(c.memberId)?.name, c.id, c.type),
                        ).length === 0 && (
                          <tr>
                            <td colSpan={6}>
                              <Empty
                                title="No charges to show"
                                text="Try another search or filter, or create a record to get started."
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="panel-foot">
                  Payments are recorded by staff. External payment processing
                  and refunds happen outside Folio.
                </div>
              </section>
            </>
          )}
          {page === "Inventory" && (
            <>
              <PageHead
                title="Every copy accounted for"
                subtitle={descriptions[page]}
                action={
                  <>
                    <button className="btn" onClick={exportCSV}>
                      <Download size={17} />
                      Export stock
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => open("stocktake")}
                    >
                      <ScanLine size={18} />
                      Verify a shelf
                    </button>
                  </>
                }
              />
              <div className="inventory-counts">
                {[
                  ["Registered", copies.length, "All statuses"],
                  ["Available", available.length, "available"],
                  ["On loan", loans.length, "loaned"],
                  ["Reserved", ready.length, "reserved"],
                  [
                    "Under repair",
                    copies.filter((c: Any) => c.status === "repair").length,
                    "repair",
                  ],
                  [
                    "Missing / lost",
                    copies.filter((c: Any) =>
                      ["lost", "missing"].includes(c.status),
                    ).length,
                    "missing-lost",
                  ],
                ].map(([label, n, value]: Any) => (
                  <button
                    className={statusFilter === value ? "active" : ""}
                    key={label}
                    onClick={() => setStatusFilter(value)}
                  >
                    <strong>{n}</strong>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <section className="panel">
                <div className="toolbar">
                  <SearchBox
                    q={q}
                    onChange={setQ}
                    placeholder="Search barcode, title, or shelf…"
                  />
                  <select
                    aria-label="Inventory status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option>All statuses</option>
                    {[
                      "available",
                      "loaned",
                      "reserved",
                      "repair",
                      "missing",
                      "lost",
                      "missing-lost",
                      "withdrawn",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {x === "missing-lost"
                          ? "Missing or lost"
                          : x[0].toUpperCase() + x.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Copy barcode</th>
                        <th>Book</th>
                        <th>Shelf</th>
                        <th>Status</th>
                        <th>Last seen</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.copies
                        .filter(
                          (c: Any) =>
                            (statusFilter === "withdrawn"
                              ? c.status === "withdrawn"
                              : c.status !== "withdrawn") &&
                            (statusFilter === "All statuses" ||
                            statusFilter === "missing-lost"
                              ? statusFilter === "All statuses" ||
                                ["missing", "lost"].includes(c.status)
                              : statusFilter === "available"
                                ? c.status === "available" && c.lendable
                                : c.status === statusFilter) &&
                            matches(c.id, book(c.titleId)?.title, c.shelf),
                        )
                        .map((c: Any) => (
                          <tr key={c.id}>
                            <td>
                              <b className="mono">{c.id}</b>
                              <small>{currency(c.cost)} replacement</small>
                            </td>
                            <td>
                              <b className="cell-primary">
                                {book(c.titleId)?.title}
                              </b>
                              <small>{book(c.titleId)?.edition}</small>
                            </td>
                            <td>
                              <span className="shelf-tag">
                                <MapPin size={13} />
                                {c.shelf}
                              </span>
                            </td>
                            <td>
                              <Badge tone={tone(c.status)}>
                                {copyStatus(c)}
                              </Badge>
                            </td>
                            <td>
                              {c.lastSeen
                                ? shortDate(c.lastSeen)
                                : "Not verified"}
                            </td>
                            <td>
                              <button
                                className="icon-btn"
                                aria-label={"Manage " + c.id}
                                onClick={() =>
                                  open("copy", {
                                    id: c.id,
                                  })
                                }
                              >
                                <MoreHorizontal size={21} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {s.copies.filter(
                        (c: Any) =>
                          (statusFilter === "withdrawn"
                            ? c.status === "withdrawn"
                            : c.status !== "withdrawn") &&
                          (statusFilter === "All statuses" ||
                          statusFilter === "missing-lost"
                            ? statusFilter === "All statuses" ||
                              ["missing", "lost"].includes(c.status)
                            : statusFilter === "available"
                              ? c.status === "available" && c.lendable
                              : c.status === statusFilter) &&
                          matches(c.id, book(c.titleId)?.title, c.shelf),
                      ).length === 0 && (
                        <tr>
                          <td colSpan={6}>
                            <Empty
                              title="No copies to show"
                              text="Try another search or filter, or create a record to get started."
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="panel-foot">
                  Registered copies include missing and lost items. Withdrawn
                  copies are excluded from active stock.
                </div>
              </section>
              <div className="section-title">
                <div>
                  <h2>Shelf verification history</h2>
                  <p>Check the physical shelf against the register.</p>
                </div>
              </div>
              <section className="panel">
                {s.audits.length ? (
                  s.audits.map((a: Any) => (
                    <button
                      className="audit-row"
                      key={a.id}
                      onClick={() =>
                        open("audit", {
                          audit: a,
                        })
                      }
                    >
                      <span className="activity-icon green">
                        <ScanLine size={20} />
                      </span>
                      <div>
                        <b>Shelf {a.shelf}</b>
                        <small>
                          {dateLabel(a.date)} · {a.staff}
                        </small>
                      </div>
                      <Badge
                        tone={
                          a.rows.some((r: Any) => r.finding !== "Seen")
                            ? "amber"
                            : "green"
                        }
                      >
                        {a.rows.filter((r: Any) => r.finding !== "Seen").length}{" "}
                        discrepancies
                      </Badge>
                      <ChevronRight size={18} />
                    </button>
                  ))
                ) : (
                  <Empty
                    icon={ScanLine}
                    title="A fresh look at the shelves"
                    text="Start a shelf verification to record seen copies and review discrepancies."
                    action={
                      <button className="btn" onClick={() => open("stocktake")}>
                        Verify first shelf
                      </button>
                    }
                  />
                )}
              </section>
            </>
          )}
          {page === "Activity" && (
            <>
              <PageHead
                title="The library log"
                subtitle={descriptions[page]}
                action={
                  <button
                    className="btn"
                    onClick={() =>
                      refresh().then(() => notify("Activity refreshed."))
                    }
                  >
                    <RefreshCw size={17} />
                    Refresh
                  </button>
                }
              />
              <section className="panel">
                <div className="toolbar">
                  <SearchBox
                    q={q}
                    onChange={setQ}
                    placeholder="Search action, detail, or staff member…"
                  />
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Details</th>
                        <th>Staff member</th>
                        <th>Date & time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.activity
                        .filter((a: Any) =>
                          matches(a.action, a.detail, a.actor),
                        )
                        .map((a: Any) => (
                          <tr key={a.id}>
                            <td>
                              <b className="cell-primary">
                                {a.action
                                  .replace(/([A-Z])/g, " $1")
                                  .replace(/^./, (c: string) =>
                                    c.toUpperCase(),
                                  )}
                              </b>
                            </td>
                            <td className="wrap-cell">{a.detail}</td>
                            <td>{a.actor}</td>
                            <td>
                              {dateLabel(a.date)}
                              <small>
                                {new Date(a.at).toLocaleTimeString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                IST
                              </small>
                            </td>
                          </tr>
                        ))}
                      {s.activity.filter((a: Any) =>
                        matches(a.action, a.detail, a.actor),
                      ).length === 0 && (
                        <tr>
                          <td colSpan={4}>
                            <Empty
                              title="No activity to show"
                              text="Try another search or filter, or create a record to get started."
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {page === "Settings" && (
            <>
              <PageHead
                title="Make it your library"
                subtitle={descriptions[page]}
              />
              <div className="settings-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Circulation & fine policy</h2>
                      <p>
                        Applies to new loans. Existing loans retain their rules.
                      </p>
                    </div>
                    <ShieldCheck size={21} />
                  </div>
                  <form
                    className="panel-pad"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      act("savePolicy", {
                        ...f,
                        closures: String(f.closures || "")
                          .split(/[\s,]+/)
                          .filter(Boolean),
                      });
                    }}
                  >
                    <fieldset disabled={busy || actor.role !== "admin"}>
                      <div className="form-grid">
                        <Field
                          label="Maximum active loans"
                          name="maxLoans"
                          type="number"
                          min="1"
                          max="20"
                          defaultValue={s.policy.maxLoans}
                          required
                        />
                        <Field
                          label="Loan period (days)"
                          name="loanDays"
                          type="number"
                          min="1"
                          max="90"
                          defaultValue={s.policy.loanDays}
                          required
                        />
                        <Field
                          label="Maximum renewals"
                          name="maxRenewals"
                          type="number"
                          min="0"
                          max="5"
                          defaultValue={s.policy.maxRenewals}
                          required
                        />
                        <Field
                          label="Pickup window (opening days)"
                          name="pickupDays"
                          type="number"
                          min="1"
                          max="10"
                          defaultValue={s.policy.pickupDays}
                          required
                        />
                        <Field
                          label="Daily fine (₹)"
                          name="dailyFine"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={s.policy.dailyFine / 100}
                          required
                        />
                        <Field
                          label="Fine cap per loan (₹)"
                          name="fineCap"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={s.policy.fineCap / 100}
                          required
                        />
                      </div>
                      <Field
                        label="Closure dates"
                        hint="Separate dates with commas. These dates extend due dates and do not accrue fines."
                      >
                        <textarea
                          name="closures"
                          rows={3}
                          defaultValue={s.policy.closures.join(", ")}
                          placeholder="2026-12-25, 2027-01-26"
                        />
                      </Field>
                      <div className="notice blue">
                        <CalendarDays size={19} />
                        Dates and fines use Asia/Kolkata. All days are
                        chargeable except the closure dates listed above.
                      </div>
                      <button className="btn primary" type="submit">
                        Save policy
                      </button>
                    </fieldset>
                    {actor.role !== "admin" && (
                      <div className="notice amber">
                        Only administrators can change library policy.
                      </div>
                    )}
                  </form>
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Staff & permissions</h2>
                      <p>Every action has an accountable person.</p>
                    </div>
                    {actor.role === "admin" && (
                      <button
                        className="icon-btn"
                        aria-label="Add staff account"
                        onClick={() => open("staff")}
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </div>
                  <div className="staff-list">
                    {s.staff.map((a: Any) => (
                      <div className="staff-row" key={a.id}>
                        <span className="avatar staff">{initials(a.name)}</span>
                        <div>
                          <b>{a.name}</b>
                          <small>{a.email}</small>
                        </div>
                        <Badge tone={a.role === "admin" ? "green" : "neutral"}>
                          {a.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="panel-pad">
                    <div className="notice green">
                      <ShieldCheck size={20} />
                      <span>
                        Administrators manage policies, staff, waivers and
                        reversals. Librarians manage daily circulation and
                        recorded payments.
                      </span>
                    </div>
                    <p className="muted small-text">
                      This private demo uses fictional records. Member balances
                      are recorded in INR.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}
          <footer className="app-footer">
            <span>Folio · A little order. A world of ideas.</span>
            <span aria-live="polite">
              <span
                className={
                  "tiny-indicator " + (busy ? "amber" : error ? "red" : "green")
                }
              />
              {busy
                ? "Saving changes…"
                : error
                  ? "Review the message above"
                  : "Changes saved to your library"}
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <Dialog
          key={modal.type}
          title={dialogTitle(modal)}
          subtitle={dialogSubtitle(modal)}
          onClose={close}
          wide={["title", "member", "receipt", "audit"].includes(modal.type)}
        >
          <fieldset disabled={busy} className="modal-fieldset">
            {renderModal()}
          </fieldset>
        </Dialog>
      )}
      {toast && (
        <div role="status" className={"toast " + toast.type}>
          {toast.type === "error" ? (
            <AlertCircle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
  function dialogTitle(m: Any): string {
    const map: Any = {
      title: book(m.id)?.title || "Title details",
      titleForm: m.title ? "Edit title" : "Add a title",
      copies: "Add physical copies",
      editCopy: "Edit copy",
      deleteCopy: "Delete this copy?",
      archiveTitle: "Archive this title?",
      memberForm: m.member ? "Edit member" : "Add a member",
      member: member(m.id)?.name || "Member profile",
      return: "Review this return",
      renew: "Renew this loan?",
      lost: "Report a lost copy",
      copyStatus: "Update copy status",
      recover: "Recover lost copy",
      copy: "Manage physical copy",
      hold: "Place a reservation",
      cancelHold: "Cancel reservation?",
      payment: "Record a payment",
      waive: "Waive a charge",
      reverse: "Reverse a ledger entry",
      stocktake: "Verify a shelf",
      audit: "Shelf verification results",
      receipt: "Transaction receipt",
      account: "Your staff account",
      staff: "Create staff account",
      help: "A calmer way to run your library",
    };
    return map[m.type] || "Details";
  }
  function dialogSubtitle(m: Any): string {
    const map: Any = {
      title: "One edition. Every physical copy.",
      copies: "Each copy receives a unique barcode.",
      deleteCopy:
        "Remove from active inventory. Transaction history stays intact.",
      archiveTitle:
        "Only titles with no active copies or reservations can be archived.",
      member: "Membership, loans, and account balance.",
      return: "Complete the return even if the fine remains unpaid.",
      renew: "The server checks eligibility before extending the due date.",
      lost: "The loan will close and applicable charges will be assessed.",
      stocktake:
        "Record what is physically on the shelf. Review exceptions separately.",
      payment: "Record a payment already received by library staff.",
      waive: "Administrator action. A reason is required.",
      reverse:
        "Creates a compensating entry; the original stays in the ledger.",
      staff: "This account grants access within the private library workspace.",
    };
    return map[m.type] || "";
  }
  function actions(label = "Save", danger = false) {
    return (
      <div className="form-actions">
        {error && (
          <div className="inline-error full" role="alert">
            {error}
          </div>
        )}
        <button type="button" className="btn" onClick={close}>
          Cancel
        </button>
        <button
          type="submit"
          className={"btn " + (danger ? "danger-btn" : "primary")}
          disabled={busy}
        >
          {busy ? "Saving…" : label}
        </button>
      </div>
    );
  }
  function formSubmit(
    action: string,
    extra: Any = {},
    after?: (data: Any) => void,
  ) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget));
      act(
        action,
        {
          ...f,
          ...extra,
        },
        after,
      );
    };
  }
  function renderModal() {
    const m = modal;
    if (m.type === "title") {
      const t = book(m.id),
        cs = s.copies.filter(
          (c: Any) => c.titleId === t.id && c.status !== "withdrawn",
        );
      return (
        <>
          <div className="title-profile">
            <Cover t={t} />
            <div>
              <Badge>{t.category}</Badge>
              <h3>{t.author}</h3>
              <p>
                {t.edition} · {t.publisher || "Publisher not listed"}
              </p>
              <p>
                {t.year} · <span className="mono">{t.isbn || "No ISBN"}</span>
              </p>
              {t.description && <p>{t.description}</p>}
              <div className="button-row">
                <button
                  className="btn small-btn"
                  onClick={() =>
                    open("titleForm", {
                      title: t,
                    })
                  }
                >
                  <Pencil size={15} />
                  Edit title
                </button>
                <button
                  className="btn small-btn"
                  onClick={() =>
                    open("hold", {
                      titleId: t.id,
                    })
                  }
                >
                  <Bookmark size={15} />
                  Reserve
                </button>
                <button
                  className="icon-btn"
                  aria-label="Archive title"
                  onClick={() =>
                    open("archiveTitle", {
                      title: t,
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className="section-title compact">
            <h3>
              Physical copies <Badge>{cs.length}</Badge>
            </h3>
            <button
              className="btn primary small-btn"
              onClick={() =>
                open("copies", {
                  titleId: t.id,
                })
              }
            >
              <Plus size={16} />
              Add copies
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Shelf</th>
                  <th>Status</th>
                  <th>Borrower / due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cs.map((c: Any) => {
                  const l = loans.find((l: Any) => l.copyId === c.id);
                  return (
                    <tr key={c.id}>
                      <td className="mono">{c.id}</td>
                      <td>{c.shelf}</td>
                      <td>
                        <Badge tone={tone(c.status)}>{copyStatus(c)}</Badge>
                      </td>
                      <td>
                        {l ? (
                          <>
                            {member(l.memberId)?.name}
                            <small>{dateLabel(l.dueAt)}</small>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={"Manage " + c.id}
                          onClick={() =>
                            open("copy", {
                              id: c.id,
                            })
                          }
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!cs.length && (
            <Empty
              icon={BookOpen}
              title="No physical copies"
              text="Add copies to make this title part of the lendable collection."
            />
          )}
        </>
      );
    }
    if (m.type === "titleForm") {
      const t = m.title || {};
      return (
        <form
          onSubmit={formSubmit("saveTitle", {
            id: t.id,
          })}
          onChange={(e) => {
            const f = new FormData(e.currentTarget);
            const name = String(f.get("title") || "")
              .toLowerCase()
              .trim();
            const similarTitle = titles.find(
              (x: Any) =>
                x.id !== t.id &&
                name.length > 3 &&
                x.title.toLowerCase().includes(name),
            );
            setSimilar(
              similarTitle
                ? `Similar title found: ${similarTitle.title} (${similarTitle.edition}). Check before creating a new record.`
                : "",
            );
          }}
        >
          <div className="form-grid">
            <Field
              full
              label="Book title"
              name="title"
              defaultValue={t.title}
              placeholder="e.g. The Art of Statistics"
              required
              maxLength={200}
            />
            <Field
              full
              label="Author(s)"
              name="author"
              defaultValue={t.author}
              required
            />
            <Field
              label="ISBN (optional)"
              name="isbn"
              defaultValue={t.isbn}
              placeholder="ISBN-10 or ISBN-13"
            />
            <Field
              label="Edition"
              name="edition"
              defaultValue={t.edition || "Standard edition"}
              required
            />
            <Field label="Category">
              <select name="category" defaultValue={t.category || "Technology"}>
                {[
                  ...new Set([
                    ...categories,
                    "Technology",
                    "Fiction",
                    "Science",
                    "Design",
                    "Business",
                    "History",
                    "Psychology",
                    "Personal growth",
                    "Reference",
                    "Other",
                  ]),
                ]
                  .sort()
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            </Field>
            <Field
              label="Publication year"
              name="year"
              defaultValue={t.year}
              type="number"
              min="1000"
              max={Number(date.slice(0, 4)) + 1}
            />
            <Field
              full
              label="Publisher"
              name="publisher"
              defaultValue={t.publisher}
            />
            <Field full label="Description (optional)">
              <textarea
                name="description"
                defaultValue={t.description}
                rows={3}
                maxLength={2000}
              />
            </Field>
          </div>
          {similar && (
            <div className="notice amber">
              <AlertCircle size={18} />
              {similar}
            </div>
          )}
          <div className="notice blue">
            <BookOpen size={18} />A title describes an edition. Add individually
            tracked physical copies after saving.
          </div>
          {actions(t.id ? "Save title" : "Add title")}
        </form>
      );
    }
    if (m.type === "copies" || m.type === "editCopy") {
      const c = m.copy || {};
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            act(m.type === "copies" ? "addCopies" : "editCopy", {
              ...Object.fromEntries(fd),
              lendable: fd.get("lendable") === "on",
              titleId: m.titleId,
              copyId: c.id,
            });
          }}
        >
          <div className="form-grid">
            {m.type === "copies" && (
              <>
                <Field
                  label="Number of copies"
                  name="count"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue="1"
                  required
                />
                <Field
                  label="Custom barcode (one copy only)"
                  name="barcode"
                  placeholder="Leave blank to generate"
                />
              </>
            )}
            <Field
              label="Shelf location"
              name="shelf"
              defaultValue={c.shelf || "CS-01"}
              required
              maxLength={40}
            />
            <Field
              label="Replacement cost per copy (₹)"
              name="cost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={(c.cost ?? 60000) / 100}
              required
            />
          </div>
          <label className="checkbox-field">
            <input
              name="lendable"
              type="checkbox"
              defaultChecked={c.lendable !== false}
            />
            <span>
              Available for lending
              <small>Uncheck for reference-only copies.</small>
            </span>
          </label>
          {actions(m.type === "copies" ? "Add copies" : "Save copy")}
        </form>
      );
    }
    if (m.type === "copy") {
      const c = copy(m.id),
        l = loans.find((l: Any) => l.copyId === c.id);
      return (
        <>
          <BookCell t={book(c.titleId)} sub={c.id} />
          <div className="detail-grid">
            <span>
              Status<Badge tone={tone(c.status)}>{copyStatus(c)}</Badge>
            </span>
            <span>
              Shelf<b>{c.shelf}</b>
            </span>
            <span>
              Replacement cost<b>{currency(c.cost)}</b>
            </span>
            <span>
              Last seen
              <b>{c.lastSeen ? dateLabel(c.lastSeen) : "Not verified"}</b>
            </span>
          </div>
          {c.conditionNote && (
            <div className="notice amber">{c.conditionNote}</div>
          )}
          {c.status !== "withdrawn" && (
            <div className="action-stack">
              <button
                className="btn"
                onClick={() =>
                  open("editCopy", {
                    copy: c,
                  })
                }
              >
                <Pencil size={17} />
                Edit copy details
              </button>
              {l ? (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      close();
                      go("Circulation");
                      setTab("Return books");
                      setReturnId(c.id);
                      setReturnCopy(c.id);
                    }}
                  >
                    <ArrowDownLeft size={17} />
                    Return this copy
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      open("lost", {
                        copy: c,
                      })
                    }
                  >
                    <AlertCircle size={17} />
                    Report lost
                  </button>
                </>
              ) : c.status === "lost" ? (
                actor.role === "admin" && (
                  <button
                    className="btn"
                    onClick={() =>
                      open("recover", {
                        copy: c,
                      })
                    }
                  >
                    Recover lost copy
                  </button>
                )
              ) : (
                <button
                  className="btn"
                  onClick={() =>
                    open("copyStatus", {
                      copy: c,
                    })
                  }
                >
                  <Package size={17} />
                  Update status
                </button>
              )}
              <button
                className="btn danger"
                onClick={() =>
                  open("deleteCopy", {
                    copy: c,
                  })
                }
              >
                <Trash2 size={17} />
                Delete copy
              </button>
            </div>
          )}
        </>
      );
    }
    if (
      [
        "deleteCopy",
        "archiveTitle",
        "cancelHold",
        "lost",
        "recover",
        "reverse",
      ].includes(m.type)
    ) {
      const a: Any = {
        deleteCopy: [
          "deleteCopy",
          {
            copyId: m.copy?.id,
          },
          "Delete copy",
        ],
        archiveTitle: [
          "archiveTitle",
          {
            titleId: m.title?.id,
          },
          "Archive title",
        ],
        cancelHold: [
          "cancelHold",
          {
            holdId: m.hold?.id,
          },
          "Cancel reservation",
        ],
        lost: [
          "reportLost",
          {
            copyId: m.copy?.id,
          },
          "Report lost",
        ],
        recover: [
          "recoverLost",
          {
            copyId: m.copy?.id,
          },
          "Record recovery",
        ],
        reverse: [
          "reverseEntry",
          {
            entryId: m.entry?.id,
          },
          "Record reversal",
        ],
      };
      const [action, extra, label] = a[m.type];
      return (
        <form onSubmit={formSubmit(action, extra)}>
          <div className="notice amber">
            <AlertCircle size={21} />
            <span>
              {m.copy
                ? `${m.copy.id} · ${book(m.copy.titleId)?.title}`
                : m.title
                  ? m.title.title
                  : m.hold
                    ? `${book(m.hold.titleId)?.title} · ${member(m.hold.memberId)?.name}`
                    : `${m.entry.id} · ${currency(m.entry.amount)}`}
            </span>
          </div>
          {m.type === "deleteCopy" && (
            <p>
              Active loans, allocated reservations, and linked unpaid charges
              prevent deletion. The final copy also requires a clear reservation
              queue.
            </p>
          )}
          {m.type === "lost" && (
            <p>
              Overdue accrual stops today. The replacement cost is{" "}
              <b>{currency(m.copy.cost)}</b>. The copy will remain registered as
              lost.
            </p>
          )}
          {m.type === "reverse" && (
            <p>
              A payment reversal reopens the amount owed. For a lost book that
              was found, refund the payment and then waive the replacement
              charge if approved.
            </p>
          )}
          <Field
            label={
              m.type === "recover" ? "Recovery and inspection note" : "Reason"
            }
          >
            <textarea
              name="reason"
              required
              rows={3}
              placeholder="Explain the decision for the activity record…"
            />
          </Field>
          {actions(
            label,
            ["deleteCopy", "archiveTitle", "lost", "reverse"].includes(m.type),
          )}
        </form>
      );
    }
    if (m.type === "copyStatus") {
      const c = m.copy;
      return (
        <form
          onSubmit={formSubmit("copyStatus", {
            copyId: c.id,
          })}
        >
          <BookCell t={book(c.titleId)} sub={c.id} />
          <Field label="New status">
            <select
              name="status"
              defaultValue={
                ["available", "repair", "missing"].includes(c.status)
                  ? c.status
                  : "available"
              }
            >
              <option value="available">Available (inspected and ready)</option>
              <option value="repair">Under repair / damaged</option>
              <option value="missing">Missing from shelf</option>
            </select>
          </Field>
          <Field label="Reason / condition note">
            <textarea name="reason" rows={3} required />
          </Field>
          <div className="notice blue">
            An issued or allocated copy must be resolved through its circulation
            workflow first.
          </div>
          {actions("Update status")}
        </form>
      );
    }
    if (m.type === "memberForm") {
      const b = m.member || {};
      return (
        <form
          onSubmit={formSubmit("saveMember", {
            originalId: b.id,
          })}
        >
          <div className="form-grid">
            <Field
              full
              label="Full name"
              name="name"
              defaultValue={b.name}
              required
            />
            <Field
              label="Member ID"
              name="id"
              defaultValue={b.id}
              placeholder="e.g. M-1013"
              readOnly={!!b.id}
              required
            />
            <Field
              label="Department"
              name="department"
              defaultValue={b.department}
              required
            />
            <Field
              label="Email"
              name="email"
              type="email"
              defaultValue={b.email}
              required
            />
            <Field
              label="Phone (optional)"
              name="phone"
              defaultValue={b.phone}
            />
            <Field
              label="Membership expires"
              name="expires"
              type="date"
              defaultValue={b.expires || addDays(date, 365)}
              required
            />
            <SelectField
              label="Status"
              name="status"
              defaultValue={b.status || "active"}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </SelectField>
          </div>
          {actions(b.id ? "Save member" : "Add member")}
        </form>
      );
    }
    if (m.type === "member") {
      const b = member(m.id);
      return (
        <>
          <div className="member-profile">
            <MemberCell m={b} />
            <Badge tone={tone(memberStatus(b))}>{memberStatus(b)}</Badge>
            <button
              className="btn small-btn"
              onClick={() =>
                open("memberForm", {
                  member: b,
                })
              }
            >
              <Pencil size={15} />
              Edit member
            </button>
          </div>
          <div className="detail-grid">
            <span>
              Email<b>{b.email}</b>
            </span>
            <span>
              Department<b>{b.department}</b>
            </span>
            <span>
              Membership expires<b>{dateLabel(b.expires)}</b>
            </span>
            <span>
              Assessed balance
              <b className={balance(s, b.id) ? "text-amber" : ""}>
                {currency(balance(s, b.id))}
              </b>
            </span>
          </div>
          <h3>Borrowing history</h3>
          <LoanTable
            {...loanActions}
            items={s.loans.filter((l: Any) => l.memberId === b.id)}
          />
          <div className="form-actions">
            <button
              className="btn"
              onClick={() => {
                close();
                go("Fines & payments");
                setQ(b.name);
              }}
            >
              View account
            </button>
            <button
              className="btn primary"
              onClick={() => {
                close();
                go("Circulation");
                setTab("Issue books");
                setMemberId(b.id);
              }}
            >
              Issue a book
            </button>
          </div>
        </>
      );
    }
    if (m.type === "return") {
      const l = m.loan,
        c = m.copy;
      return (
        <form
          onSubmit={formSubmit("return", {
            copyId: c.id,
          })}
        >
          <BookCell t={book(c.titleId)} sub={c.id} />
          <div className="detail-grid">
            <span>
              Borrower<b>{member(l.memberId)?.name}</b>
            </span>
            <span>
              Fine calculation
              <b>
                {lateDays(s, l, date)} days ×{" "}
                {currency(l.policy?.dailyFine ?? s.policy.dailyFine)}
              </b>
            </span>
            <span>
              Per-loan cap
              <b>{currency(l.policy?.fineCap ?? s.policy.fineCap)}</b>
            </span>
            <span>
              Overdue charge<b>{currency(fineFor(s, l, date))}</b>
            </span>
          </div>
          <SelectField
            label="Return condition"
            name="condition"
            defaultValue="good"
          >
            <option value="good">Good — ready for the collection</option>
            <option value="damaged">Damaged — send for repair</option>
          </SelectField>
          <Field
            label="Damage charge, if assessed (₹)"
            name="damageAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            hint="Applied only when the return condition is Damaged."
          />
          <Field label="Damage assessment / note">
            <textarea
              name="note"
              rows={2}
              placeholder="Required when a damage charge is applied"
            />
          </Field>
          <div className="notice green">
            <CheckCircle2 size={19} />
            The return is accepted independently of payment. Any charge remains
            on the member’s account.
          </div>
          {actions("Confirm return")}
        </form>
      );
    }
    if (m.type === "renew") {
      const l = m.loan;
      return (
        <form
          onSubmit={formSubmit("renew", {
            loanId: l.id,
          })}
        >
          <BookCell t={loanBook(l)} sub={l.copyId} />
          <div className="detail-grid">
            <span>
              Borrower<b>{member(l.memberId)?.name}</b>
            </span>
            <span>
              Current due date<b>{dateLabel(l.dueAt)}</b>
            </span>
            <span>
              Renewals used
              <b>
                {l.renewals} / {l.policy?.maxRenewals ?? s.policy.maxRenewals}
              </b>
            </span>
          </div>
          <div className="notice blue">
            Renewal adds the original loan period to the current due date. A
            waiting reservation or restricted account blocks renewal.
          </div>
          {actions("Renew loan")}
        </form>
      );
    }
    if (m.type === "hold")
      return (
        <form onSubmit={formSubmit("placeHold")}>
          <SelectField
            label="Title / edition"
            name="titleId"
            defaultValue={m.titleId || ""}
            required
          >
            <option value="" disabled>
              Choose a title…
            </option>
            {titles.map((t: Any) => (
              <option key={t.id} value={t.id}>
                {t.title} · {t.edition}
              </option>
            ))}
          </SelectField>
          <SelectField label="Member" name="memberId" required defaultValue="">
            <option value="" disabled>
              Choose a member…
            </option>
            {s.members.map((b: Any) => (
              <option value={b.id} key={b.id}>
                {b.name} · {b.id}
              </option>
            ))}
          </SelectField>
          <div className="notice blue">
            <Bookmark size={19} />
            The next suitable copy is allocated in queue order. Once ready, the
            member has {s.policy.pickupDays} opening days to collect.
          </div>
          {actions("Place reservation")}
        </form>
      );
    if (m.type === "payment" || m.type === "waive") {
      const c = m.charge;
      return (
        <form
          onSubmit={formSubmit(m.type === "payment" ? "payment" : "waive", {
            chargeId: c.id,
          })}
        >
          <MemberCell m={member(c.memberId)} />
          <div className="payment-total">
            <span>Outstanding on this charge</span>
            <strong>{currency(outstanding(s, c))}</strong>
            <small>
              {c.type} · {c.id}
            </small>
          </div>
          <Field
            label={
              m.type === "payment"
                ? "Amount received (₹)"
                : "Amount to waive (₹)"
            }
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={outstanding(s, c) / 100}
            defaultValue={outstanding(s, c) / 100}
            required
          />
          {m.type === "payment" && (
            <SelectField label="Payment method" name="method">
              <option>Cash</option>
              <option>UPI (external)</option>
              <option>Card (external)</option>
            </SelectField>
          )}
          <Field
            label={
              m.type === "waive"
                ? "Reason (required)"
                : "External reference / note"
            }
          >
            <textarea
              name="note"
              rows={3}
              required={m.type === "waive"}
              placeholder={
                m.type === "waive"
                  ? "Why is this charge being waived?"
                  : "Required for UPI or card payments"
              }
            />
          </Field>
          {actions(m.type === "payment" ? "Record payment" : "Confirm waiver")}
        </form>
      );
    }
    if (m.type === "stocktake")
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            act(
              "stocktake",
              {
                shelf: f.get("shelf"),
                barcodes: String(f.get("barcodes"))
                  .split(/[\s,]+/)
                  .filter(Boolean),
              },
              (d: Any) =>
                setModal({
                  type: "audit",
                  audit: d.result.audit,
                }),
            );
          }}
        >
          <SelectField label="Shelf to verify" name="shelf" required>
            {[...new Set(copies.map((c: Any) => c.shelf))]
              .sort()
              .map((shelf: Any) => (
                <option key={shelf}>{shelf}</option>
              ))}
          </SelectField>
          <Field
            label="Scanned / observed copy barcodes"
            hint="One per line, or separated by commas. Duplicate scans are ignored."
          >
            <textarea
              name="barcodes"
              rows={7}
              required
              placeholder={"LIB-0001\nLIB-0002\nLIB-0003"}
            />
          </Field>
          <div className="notice amber">
            <AlertCircle size={20} />
            Unscanned items are flagged for review. Scanning an issued copy will
            not automatically return it or change fines.
          </div>
          {actions("Complete verification")}
        </form>
      );
    if (m.type === "audit") {
      const a = m.audit;
      return (
        <>
          <div className="detail-grid">
            <span>
              Shelf<b>{a.shelf}</b>
            </span>
            <span>
              Verified by<b>{a.staff}</b>
            </span>
            <span>
              Date<b>{dateLabel(a.date)}</b>
            </span>
            <span>
              Discrepancies
              <b>{a.rows.filter((r: Any) => r.finding !== "Seen").length}</b>
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Book</th>
                  <th>Finding</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {a.rows.map((r: Any) => (
                  <tr key={r.copyId}>
                    <td className="mono">{r.copyId}</td>
                    <td>
                      {titleOf(s, copy(r.copyId))?.title || "Unknown item"}
                    </td>
                    <td>
                      <Badge tone={r.finding === "Seen" ? "green" : "amber"}>
                        {r.finding}
                      </Badge>
                    </td>
                    <td>
                      {copy(r.copyId) && (
                        <button
                          className="text-btn"
                          onClick={() =>
                            open("copy", {
                              id: r.copyId,
                            })
                          }
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="notice blue">
            Results are observations, not automatic loss declarations. Review
            each discrepancy before changing inventory.
          </div>
        </>
      );
    }
    if (m.type === "receipt") {
      const r = m.result,
        e = r.entry,
        b = member(e?.memberId || r.memberId);
      return (
        <div className="receipt">
          <div className="receipt-brand">
            <div className="brand-mark">f</div>
            <div>
              <h2>folio.</h2>
              <p>Campus Library</p>
            </div>
            <Badge tone="green">
              <CheckCircle2 size={14} />
              Recorded
            </Badge>
          </div>
          <h3>
            {r.kind === "issue"
              ? "Issue receipt"
              : r.kind === "return"
                ? "Return receipt"
                : e.type === "payment"
                  ? "Payment receipt"
                  : e.type === "waiver"
                    ? "Waiver record"
                    : "Reversal record"}
          </h3>
          <div className="detail-grid">
            <span>
              Member
              <b>
                {b?.name} · {b?.id}
              </b>
            </span>
            <span>
              Date<b>{dateLabel(e?.date || r.date)}</b>
            </span>
            <span>
              Recorded by<b>{e?.staff || r.staff}</b>
            </span>
            {r.kind === "issue" && (
              <span>
                Return by<b>{dateLabel(r.dueAt)}</b>
              </span>
            )}
            {e && (
              <span>
                Entry ID<b className="mono">{e.id}</b>
              </span>
            )}
          </div>
          {r.copyIds?.map((id: string) => (
            <div className="receipt-book" key={id}>
              <BookCell t={titleOf(s, copy(id))} sub={id} />
            </div>
          ))}
          {r.kind === "return" && (
            <>
              <div className="receipt-line">
                <span>Overdue charge</span>
                <b>{currency(r.fine)}</b>
              </div>
              <div className="receipt-line">
                <span>Damage charge</span>
                <b>{currency(r.damage || 0)}</b>
              </div>
              <div className="notice green">
                Returned successfully. Copy status: {r.status}. Payment may be
                completed separately.
              </div>
            </>
          )}
          {e && (
            <>
              <div className="receipt-line total">
                <span>
                  {e.type === "waiver" ? "Amount waived" : "Recorded amount"}
                </span>
                <strong>{currency(e.amount)}</strong>
              </div>
              <div className="receipt-line">
                <span>Method</span>
                <b>{e.method}</b>
              </div>
              {e.note && <p>Note: {e.note}</p>}
            </>
          )}
          <div className="receipt-line">
            <span>
              {e?.balanceAfter !== undefined || r.balanceAfter !== undefined
                ? "Balance after this transaction"
                : "Current assessed balance"}
            </span>
            <b>
              {currency(e?.balanceAfter ?? r.balanceAfter ?? balance(s, b?.id))}
            </b>
          </div>
          <p className="receipt-thanks">
            A little order. A world of ideas.
            <br />
            Thank you for being part of our reading community.
          </p>
          <div className="form-actions no-print">
            <button className="btn" onClick={close}>
              Done
            </button>
            <button className="btn primary" onClick={() => window.print()}>
              <Printer size={17} />
              Print receipt
            </button>
          </div>
        </div>
      );
    }
    if (m.type === "staff")
      return (
        <form onSubmit={formSubmit("addStaff")}>
          <Field label="Full name" name="name" required />
          <Field label="Email" name="email" type="email" required />
          <SelectField label="Role" name="role">
            <option value="librarian">Librarian</option>
            <option value="admin">Administrator</option>
          </SelectField>
          <Field
            label="Temporary password"
            name="password"
            type="password"
            minLength={12}
            maxLength={200}
            autoComplete="new-password"
            required
            hint="At least 12 characters. Share with the staff member securely."
          />
          {actions("Create account")}
        </form>
      );
    if (m.type === "account")
      return (
        <>
          <div className="member-profile">
            <span className="avatar staff">{initials(actor.name)}</span>
            <div>
              <h3>{actor.name}</h3>
              <p>{actor.email}</p>
            </div>
          </div>
          <Badge tone="green">
            {actor.role === "admin" ? "Administrator" : "Librarian"}
          </Badge>
          <p>
            Your actions are recorded in the activity log. Sessions expire after
            24 hours.
          </p>
          <div className="form-actions">
            <button
              className="btn danger"
              onClick={() =>
                act("logout", {}, () => {
                  setActor(null);
                  setS(null);
                  setCart([]);
                })
              }
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </>
      );
    if (m.type === "help")
      return (
        <div className="guide">
          <p>
            Folio keeps the title, its physical copies, and each borrowing
            transaction connected.
          </p>
          {[
            [
              "Add a book",
              "Catalogue → Add title, then open the title and add physical copies. Every copy needs its own barcode.",
            ],
            [
              "Issue and return",
              "Use the Circulation desk. Select a member, scan copies, and issue. Returns are accepted even when charges are unpaid.",
            ],
            [
              "Understand availability",
              "Only lendable, available copies can be issued. Allocated reservations are held for their designated member.",
            ],
            [
              "Handle fines",
              "Overdue estimates become assessed charges on return or loss. Record a payment already received, or ask an administrator to waive it.",
            ],
            [
              "Verify stock",
              "Inventory → Verify a shelf. Discrepancies require review; stocktaking never silently changes loans or fines.",
            ],
            [
              "Use the demo",
              "The collection is fictional. Changes are durable and shared by your staff accounts. Export stock, members, or charges as CSV.",
            ],
          ].map(([h, p]) => (
            <div key={h}>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      );
    return null;
  }
}
