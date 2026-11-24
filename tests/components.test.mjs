import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { createHarness } from "./support/route-harness.mjs";

test("real React interface components against the real API route", async (t) => {
  const h = await createHarness();
  t.after(() => h.close());
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    { url: "https://folio.test/", pretendToBeVisual: true },
  );
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "HTMLDialogElement",
    "Node",
    "Event",
    "KeyboardEvent",
    "MouseEvent",
    "FormData",
  ])
    Object.defineProperty(globalThis, key, {
      value:
        key === "window"
          ? dom.window
          : key === "document"
            ? dom.window.document
            : dom.window[key],
      configurable: true,
      writable: true,
    });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  let prints = 0;
  dom.window.print = () => prints++;
  let cookie = "",
    loseResponse = false,
    pauseNext = false,
    release;
  const posts = [];
  globalThis.fetch = async (_url, opts = {}) => {
    const body = opts.method === "POST" ? JSON.parse(opts.body) : undefined;
    if (body) posts.push(body);
    if (body && pauseNext) {
      pauseNext = false;
      await new Promise((resolve) => {
        release = resolve;
      });
    }
    const out = await h.request(body, cookie);
    if (out.headers.get("set-cookie"))
      cookie = out.headers.get("set-cookie").split(";")[0];
    if (body && loseResponse) {
      loseResponse = false;
      throw new TypeError("Connection interrupted after commit.");
    }
    return new Response(JSON.stringify(out.data), {
      status: out.status,
      headers: out.headers,
    });
  };
  const React = await import("react"),
    { createRoot } = await import("react-dom/client");
  const bundle = await build({
    entryPoints: [new URL("../app/page.tsx", import.meta.url).pathname],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    jsx: "automatic",
    external: ["react", "react/jsx-runtime"],
    logLevel: "silent",
  });
  const dir = new URL("../work/component-tests/", import.meta.url);
  await mkdir(dir, { recursive: true });
  const file = new URL("app.mjs", dir);
  await writeFile(file, bundle.outputFiles[0].text);
  const App = (await import(file.href + "?v=" + Date.now())).default;
  const root = createRoot(document.getElementById("root"));
  t.after(async () => {
    await React.act(async () => root.unmount());
    dom.window.close();
  });
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const dialog = () => document.querySelector("dialog[open]");
  function button(name, scope = document) {
    const result = [...scope.querySelectorAll("button")].find(
      (b) =>
        (b.getAttribute("aria-label") || norm(b.textContent)) === name ||
        (b.classList.contains("nav-item") &&
          norm(b.querySelector("span")?.textContent || b.textContent) === name),
    );
    assert.ok(result, "Button exists: " + name);
    return result;
  }
  function field(label, scope = document) {
    const lab = [...scope.querySelectorAll("label")].find(
      (l) => norm(l.textContent) === label,
    );
    assert.ok(lab, "Label exists: " + label);
    const input = lab.htmlFor
      ? document.getElementById(lab.htmlFor)
      : lab.querySelector("input,select,textarea");
    assert.ok(input, "Associated control: " + label);
    return input;
  }
  async function flushUntil(predicate, description = "UI updated") {
    for (let i = 0; i < 150; i++) {
      if (predicate()) return;
      await React.act(async () => {
        await delay(10);
      });
    }
    assert.ok(predicate(), description);
  }
  async function click(name, scope = document) {
    await React.act(async () => button(name, scope).click());
  }
  async function fill(label, value, scope = document) {
    const el = field(label, scope),
      proto =
        el.tagName === "SELECT"
          ? dom.window.HTMLSelectElement.prototype
          : el.tagName === "TEXTAREA"
            ? dom.window.HTMLTextAreaElement.prototype
            : dom.window.HTMLInputElement.prototype;
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(
        new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", {
          bubbles: true,
        }),
      );
    });
  }
  async function submit(scope = dialog()) {
    const f = scope.querySelector("form");
    assert.ok(f);
    await React.act(async () =>
      f.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  }
  await React.act(async () => root.render(React.createElement(App)));
  await flushUntil(() => document.querySelector('input[name="email"]'));
  await t.test(
    "sign-in form has accessible labels and successful sign-in opens the workspace",
    async () => {
      await fill("Email address", "admin@folio.local");
      await fill("Password", "FolioAdmin!2026");
      await submit(document.querySelector(".login-form"));
      await flushUntil(() => document.querySelector(".sidebar"));
      assert.match(document.querySelector("h1").textContent, /good day/);
    },
  );
  await t.test(
    "all workspace navigation components render their intended page",
    async () => {
      for (const [name, heading] of [
        ["Catalogue", "The collection"],
        ["Circulation", "The circulation desk"],
        ["Members", "Your reading community"],
        ["Reservations", "Next in line"],
        ["Fines & payments", "A balanced account"],
        ["Inventory", "Every copy accounted for"],
        ["Activity", "The library log"],
        ["Settings", "Make it your library"],
      ]) {
        await click(name);
        assert.equal(document.querySelector("h1").textContent, heading);
      }
    },
  );
  await t.test(
    "catalogue search remains focused while typing and recovers from an empty result",
    async () => {
      await click("Catalogue");
      const el = document.querySelector(".search-box input");
      await React.act(async () => {
        el.focus();
        Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        ).set.call(el, "NO SUCH TITLE");
        el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      assert.equal(document.activeElement, el);
      assert.match(document.body.textContent, /No matching books/);
      await click("Clear filters");
      assert.equal(document.querySelector(".search-box input").value, "");
    },
  );
  await t.test(
    "empty search states are visible across reservations, accounts, inventory and activity",
    async () => {
      for (const [page, title] of [
        ["Reservations", "No reservations to show"],
        ["Fines & payments", "No charges to show"],
        ["Inventory", "No copies to show"],
        ["Activity", "No activity to show"],
      ]) {
        await click(page);
        const input = document.querySelector(".search-box input");
        await React.act(async () => {
          Object.getOwnPropertyDescriptor(
            dom.window.HTMLInputElement.prototype,
            "value",
          ).set.call(input, "NO-MATCH-XYZ");
          input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        });
        assert.ok(document.body.textContent.includes(title), title);
      }
      await click("Catalogue");
    },
  );
  await t.test(
    "global search shortcut, mobile menu and Escape have functioning controls",
    async () => {
      await React.act(async () =>
        dom.window.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", {
            key: "k",
            ctrlKey: true,
            bubbles: true,
          }),
        ),
      );
      assert.equal(
        document.activeElement,
        document.querySelector(".global-search input"),
      );
      await click("Open navigation");
      assert.ok(document.querySelector(".sidebar.mobile-open"));
      await click("Close navigation");
      assert.equal(document.querySelector(".sidebar.mobile-open"), null);
      await click("Open navigation");
      await React.act(async () =>
        dom.window.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
          }),
        ),
      );
      assert.equal(document.querySelector(".sidebar.mobile-open"), null);
    },
  );
  let qaTitleId;
  await t.test(
    "title form, labels, validation and save update the catalogue",
    async () => {
      await click("Add title");
      assert.equal(
        dialog().getAttribute("aria-labelledby"),
        dialog().querySelector("h2").id,
      );
      for (const [name, value] of [
        ["Book title", "UI QA Book"],
        ["Author(s)", "UI QA Author"],
        ["Edition", "First edition"],
      ])
        await fill(name, value, dialog());
      await submit();
      await flushUntil(() => !dialog());
      assert.match(document.body.textContent, /UI QA Book/);
      qaTitleId = (await h.state(cookie)).state.titles.at(-1).id;
    },
  );
  await t.test(
    "a lost response is retried with the same request ID and creates one copy",
    async () => {
      await click("View UI QA Book");
      await click("Add copies", dialog());
      loseResponse = true;
      await submit();
      await flushUntil(() => dialog()?.querySelector('[role="alert"]'));
      const first = posts.at(-1);
      assert.match(dialog().textContent, /Connection interrupted/);
      await submit();
      await flushUntil(() => !dialog());
      const second = posts.at(-1);
      assert.equal(first.requestId, second.requestId);
      const st = await h.state(cookie);
      assert.equal(
        st.state.copies.filter((c) => c.titleId === qaTitleId).length,
        1,
      );
    },
  );
  await t.test(
    "save locks prevent duplicate submission and escape cannot dismiss a pending dialog",
    async () => {
      await click("View UI QA Book");
      await click("Add copies", dialog());
      pauseNext = true;
      const before = posts.length;
      await submit();
      assert.ok(button("Saving…", dialog()).disabled);
      await React.act(async () =>
        dialog().dispatchEvent(
          new dom.window.Event("cancel", { cancelable: true }),
        ),
      );
      assert.ok(dialog());
      await submit();
      assert.equal(posts.length, before + 1);
      await React.act(async () => release());
      await flushUntil(() => !dialog());
    },
  );
  await t.test(
    "new member form persists validated identity and status",
    async () => {
      await click("Members");
      await click("Add member");
      for (const [name, value] of [
        ["Full name", "UI QA Reader"],
        ["Member ID", "UI-QA-MEMBER"],
        ["Department", "Quality assurance"],
        ["Email", "ui.qa@example.test"],
      ])
        await fill(name, value, dialog());
      await submit();
      await flushUntil(() => !dialog());
      assert.match(document.body.textContent, /UI QA Reader/);
    },
  );
  let qaCopyId;
  await t.test(
    "issue desk and receipt work with selected member and physical barcode",
    async () => {
      await click("Circulation");
      await fill("Find a member", "UI-QA-MEMBER");
      qaCopyId = (await h.state(cookie)).state.copies.find(
        (c) => c.titleId === qaTitleId,
      ).id;
      const scan = document.querySelector(".input-action input");
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        ).set.call(scan, qaCopyId);
        scan.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      await click("Add");
      await click("Issue 1 book");
      await flushUntil(() => dialog()?.textContent.includes("Issue receipt"));
      assert.match(dialog().textContent, /UI QA Reader/);
      assert.match(dialog().textContent, /Return by/);
      await click("Print receipt", dialog());
      assert.equal(prints, 1);
      await click("Done", dialog());
    },
  );
  await t.test(
    "return form and receipt complete a loan independently of payment",
    async () => {
      await click("Return books");
      await fill("Or select an active loan", qaCopyId);
      await click("Review & return book");
      await submit();
      await flushUntil(() => dialog()?.textContent.includes("Return receipt"));
      assert.match(dialog().textContent, /Returned successfully/);
      await click("Done", dialog());
    },
  );
  await t.test(
    "reservation, cancel, payment, waiver, stocktaking and staff dialogs have associated controls",
    async () => {
      for (const [page, openName, labels] of [
        ["Reservations", "Place reservation", ["Title / edition", "Member"]],
        [
          "Inventory",
          "Verify a shelf",
          ["Shelf to verify", "Scanned / observed copy barcodes"],
        ],
        [
          "Settings",
          "Add staff account",
          ["Full name", "Email", "Role", "Temporary password"],
        ],
      ]) {
        await click(page);
        await click(openName);
        for (const label of labels) field(label, dialog());
        await click("Close dialog");
      }
      await click("Fines & payments");
      const pay = [...document.querySelectorAll("button")].find(
        (b) => norm(b.textContent) === "Record payment",
      );
      await React.act(async () => pay.click());
      for (const label of [
        "Amount received (₹)",
        "Payment method",
        "External reference / note",
      ])
        field(label, dialog());
      await click("Close dialog");
      const waive = [...document.querySelectorAll("button")].find(
        (b) => norm(b.textContent) === "Waive",
      );
      await React.act(async () => waive.click());
      field("Reason (required)", dialog());
      await click("Close dialog");
    },
  );
  await t.test(
    "CSV exports provide usable member, catalogue and charge records",
    async () => {
      const blobs = [],
        downloads = [];
      const make = URL.createObjectURL,
        revoke = URL.revokeObjectURL,
        anchor = dom.window.HTMLAnchorElement.prototype.click;
      URL.createObjectURL = (blob) => {
        blobs.push(blob);
        return "blob:https://folio.test/test-export";
      };
      URL.revokeObjectURL = () => {};
      dom.window.HTMLAnchorElement.prototype.click = function () {
        downloads.push(this.download);
      };
      try {
        for (const [page, header] of [
          ["Members", "Name"],
          ["Catalogue", "Barcode"],
          ["Fines & payments", "Charge"],
        ]) {
          await click(page);
          await click(page === "Fines & payments" ? "Export ledger" : "Export");
          const text = await blobs.at(-1).text();
          assert.ok(text.includes(header));
          assert.ok(text.includes('"'));
        }
        assert.equal(downloads.length, 3);
      } finally {
        URL.createObjectURL = make;
        URL.revokeObjectURL = revoke;
        dom.window.HTMLAnchorElement.prototype.click = anchor;
      }
    },
  );
  await t.test(
    "expired staff session closes the modal and returns to an interactive sign-in form",
    async () => {
      await click("Catalogue");
      await click("Add title");
      await fill("Book title", "Will require sign-in", dialog());
      await fill("Author(s)", "UI QA", dialog());
      h.sqlite.exec("UPDATE sessions SET expires=0");
      await submit();
      await flushUntil(() => document.querySelector(".login-page"));
      assert.equal(document.querySelector("dialog"), null);
      assert.ok(field("Email address"));
      assert.match(document.body.textContent, /session expired/i);
    },
  );
  await t.test(
    "librarian interface disables policy changes and omits waiver/reversal controls",
    async () => {
      await fill("Email address", "desk@folio.local");
      await fill("Password", "FolioDesk!2026");
      await submit(document.querySelector(".login-form"));
      await flushUntil(() => document.querySelector(".sidebar"));
      await click("Settings");
      assert.ok(button("Save policy").matches(":disabled"));
      assert.ok(
        [...document.querySelectorAll('input[name="maxLoans"]')].every((x) =>
          x.matches(":disabled"),
        ),
      );
      assert.ok(
        ![...document.querySelectorAll("button")].some(
          (b) => b.getAttribute("aria-label") === "Add staff account",
        ),
      );
      await click("Fines & payments");
      assert.ok(
        ![...document.querySelectorAll("button")].some(
          (b) => norm(b.textContent) === "Waive",
        ),
      );
      await click("Transactions");
      assert.ok(
        ![...document.querySelectorAll("button")].some((b) =>
          b.getAttribute("aria-label")?.startsWith("Reverse "),
        ),
      );
    },
  );
});
