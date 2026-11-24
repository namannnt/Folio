import { env } from "cloudflare:workers";
import {
  seedState,
  mutate,
  maintain,
  today,
  uid,
  DomainError,
} from "../../../lib/domain.mjs";
type StaffRole = "admin" | "librarian";
interface StaffRecord {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  salt: string;
  passwordHash: string;
}
interface ActivityRecord {
  id: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
  date: string;
}
interface CompletedRequest {
  id: string;
  result: unknown;
}
type LibrarySnapshot = Omit<
  ReturnType<typeof seedState>,
  "staff" | "completed" | "activity"
> & {
  staff: StaffRecord[];
  completed: CompletedRequest[];
  activity: ActivityRecord[];
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const dynamic = "force-dynamic";
const encoder = new TextEncoder();
const hex = (a: ArrayBuffer) =>
  Array.from(new Uint8Array(a), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
async function digest(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(s)));
}
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
const db = () => {
  if (!env.DB) throw new Error("Database unavailable.");
  return env.DB;
};
const json = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
async function load() {
  let row = await db()
    .prepare("SELECT data,version FROM workspaces WHERE id=?")
    .bind("library")
    .first<{
      data: string;
      version: number;
    }>();
  if (!row) {
    const state = seedState() as unknown as LibrarySnapshot;
    for (const [id, name, email, password, role] of [
      [
        "STAFF-01",
        "Alex Morgan",
        "admin@folio.local",
        "FolioAdmin!2026",
        "admin",
      ],
      [
        "STAFF-02",
        "Jamie Parker",
        "desk@folio.local",
        "FolioDesk!2026",
        "librarian",
      ],
    ] as const) {
      const salt = crypto.randomUUID();
      state.staff.push({
        id,
        name,
        email,
        role,
        salt,
        passwordHash: await passwordHash(password, salt),
      });
    }
    await db()
      .prepare(
        "INSERT OR IGNORE INTO workspaces (id,data,version) VALUES (?,?,0)",
      )
      .bind("library", JSON.stringify(state))
      .run();
    row = await db()
      .prepare("SELECT data,version FROM workspaces WHERE id=?")
      .bind("library")
      .first<{
        data: string;
        version: number;
      }>();
  }
  return {
    state: JSON.parse(row!.data) as LibrarySnapshot,
    version: row!.version,
  };
}
function sessionToken(req: Request) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("folio_session="))
      ?.slice(14) || ""
  );
}
async function actorFor(req: Request, state: LibrarySnapshot) {
  const raw = sessionToken(req);
  if (!raw) return null;
  const row = await db()
    .prepare("SELECT staff_id FROM sessions WHERE token=? AND expires>?")
    .bind(await digest(raw), Date.now())
    .first<{
      staff_id: string;
    }>();
  return row ? state.staff.find((x) => x.id === row.staff_id) || null : null;
}
function clientState(s: LibrarySnapshot) {
  const { staff, completed, ...publicData } = structuredClone(s);
  void completed;
  return {
    ...publicData,
    staff: staff.map(({ id, name, email, role }) => ({
      id,
      name,
      email,
      role,
    })),
  };
}
const cookie = (req: Request, token: string, maxAge: number) =>
  `folio_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
export async function GET(req: Request) {
  try {
    const { state, version } = await load();
    const actor = await actorFor(req, state);
    if (!actor)
      return json({
        authenticated: false,
      });
    let current = version;
    if (maintain(state)) {
      const result = await db()
        .prepare(
          "UPDATE workspaces SET data=?,version=version+1 WHERE id=? AND version=?",
        )
        .bind(JSON.stringify(state), "library", version)
        .run();
      if (result.meta.changes) current++;
      else return GET(req);
    }
    return json({
      authenticated: true,
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
      },
      state: clientState(state),
      version: current,
      today: today(),
    });
  } catch (e) {
    console.error("Library API read failed", e);
    return json(
      {
        error: "The library could not be loaded. Please try again.",
      },
      500,
    );
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin)
      return json(
        {
          error: "Cross-origin requests are not allowed.",
        },
        403,
      );
    if (Number(req.headers.get("content-length") || 0) > 150000)
      return json(
        {
          error: "Request too large.",
        },
        413,
      );
    let parsed: unknown;
    try {
      const raw = await req.text();
      if (raw.length > 150000)
        return json(
          {
            error: "Request too large.",
          },
          413,
        );
      parsed = JSON.parse(raw);
    } catch {
      return json(
        {
          error: "Enter a valid JSON request.",
        },
        400,
      );
    }
    if (
      !isRecord(parsed) ||
      typeof parsed.action !== "string" ||
      !parsed.action
    )
      return json(
        {
          error: "A valid action is required.",
        },
        400,
      );
    const body = parsed;
    if (body.payload !== undefined && !isRecord(body.payload))
      return json(
        {
          error: "Action payload must be an object.",
        },
        400,
      );
    const payload = isRecord(body.payload) ? body.payload : {};
    const { state, version } = await load();
    if (body.action === "login") {
      const email = String(payload.email || "")
          .trim()
          .toLowerCase(),
        password = String(payload.password || "");
      if (password.length > 200)
        return json(
          {
            error: "Invalid email or password.",
          },
          401,
        );
      const staff = state.staff.find((x) => x.email.toLowerCase() === email);
      const salt = staff?.salt || "invalid-user-salt";
      const hash = await passwordHash(password, salt);
      if (!staff || hash !== staff.passwordHash)
        return json(
          {
            error: "Invalid email or password.",
          },
          401,
        );
      const raw = crypto.randomUUID() + crypto.randomUUID();
      await db()
        .prepare("DELETE FROM sessions WHERE expires<?")
        .bind(Date.now())
        .run();
      await db()
        .prepare("INSERT INTO sessions (token,staff_id,expires) VALUES (?,?,?)")
        .bind(await digest(raw), staff.id, Date.now() + 86400000)
        .run();
      return json(
        {
          message: "Signed in.",
        },
        200,
        {
          "Set-Cookie": cookie(req, raw, 86400),
        },
      );
    }
    const actor = await actorFor(req, state);
    if (!actor)
      return json(
        {
          error: "Your session expired. Please sign in again.",
        },
        401,
      );
    if (body.action === "logout") {
      await db()
        .prepare("DELETE FROM sessions WHERE token=?")
        .bind(await digest(sessionToken(req)))
        .run();
      return json(
        {
          message: "Signed out.",
        },
        200,
        {
          "Set-Cookie": cookie(req, "", 0),
        },
      );
    }
    if (
      !body.requestId ||
      typeof body.requestId !== "string" ||
      body.requestId.length > 100
    )
      return json(
        {
          error: "A valid request ID is required.",
        },
        400,
      );
    if (state.completed.some((x) => x.id === body.requestId)) {
      const previous = state.completed.find((x) => x.id === body.requestId);
      return json({
        state: clientState(state),
        version,
        message: "This request was already completed.",
        result: previous!.result,
        today: today(),
      });
    }
    if (body.version !== version)
      return json(
        {
          error:
            "The library changed in another session. Your screen has been refreshed; review and try again.",
        },
        409,
      );
    let next: LibrarySnapshot,
      message: string,
      result: unknown = null;
    if (body.action === "addStaff") {
      if (actor.role !== "admin")
        return json(
          {
            error: "Administrator permission is required.",
          },
          403,
        );
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      const email =
        typeof payload.email === "string"
          ? payload.email.trim().toLowerCase()
          : "";
      const password =
        typeof payload.password === "string" ? payload.password : "";
      const role = payload.role;
      if (
        !name ||
        name.length > 100 ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        password.length < 12 ||
        password.length > 200 ||
        (role !== "admin" && role !== "librarian")
      )
        return json(
          {
            error:
              "Enter a name, valid email, role, and password of at least 12 characters.",
          },
          400,
        );
      if (state.staff.some((x) => x.email.toLowerCase() === email))
        return json(
          { error: "A staff account with this email already exists." },
          400,
        );
      next = structuredClone(state);
      const salt = crypto.randomUUID();
      next.staff.push({
        id: uid("STAFF"),
        name,
        email,
        role,
        salt,
        passwordHash: await passwordHash(password, salt),
      });
      message = "Staff account created.";
      next.activity.unshift({
        id: uid("EV"),
        actor: actor.name,
        action: "Staff account created",
        detail: email,
        at: new Date().toISOString(),
        date: today(),
      });
    } else {
      const out = mutate(state, body.action, payload, actor);
      next = out.state;
      message = out.message;
      result = out.result;
    }
    next.completed.push({
      id: body.requestId,
      result,
    });
    next.completed = next.completed.slice(-500);
    const saved = await db()
      .prepare(
        "UPDATE workspaces SET data=?,version=version+1 WHERE id=? AND version=?",
      )
      .bind(JSON.stringify(next), "library", version)
      .run();
    if (!saved.meta.changes)
      return json(
        {
          error:
            "Another staff member just changed this record. Refresh and review before retrying.",
        },
        409,
      );
    return json({
      state: clientState(next),
      version: version + 1,
      message,
      result,
      today: today(),
    });
  } catch (e) {
    if (e instanceof DomainError)
      return json(
        {
          error: e.message,
        },
        e.status,
      );
    console.error("Library mutation failed", e);
    return json(
      {
        error: "The change could not be saved. Please try again.",
      },
      500,
    );
  }
}
