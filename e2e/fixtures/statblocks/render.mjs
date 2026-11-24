// Renders recreations of real Draw Steel stat blocks (layout, sizes and text
// copied from the owner's screenshots) to PNG fixtures for OCR tests.
// Usage: node e2e/fixtures/statblocks/render.mjs
//
// To test a real screenshot instead, add it to this folder and add an entry to
// blocks.json with "real": true, "file" and "expect" (no render fields needed).
// e2e/statblocks.spec.ts pastes every entry into the app and checks the result.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const blocks = JSON.parse(readFileSync(join(here, "blocks.json"), "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const LABELS = ["Size", "Speed", "Stamina", "Stability", "Free Strike"];
const CHARS = ["Might", "Agility", "Reason", "Intuition", "Presence"];

function card(b) {
  const title = [`Level ${b.level}`, b.organization, b.role].filter(Boolean).join(" ");
  const rows = (pairs) =>
    pairs
      .map(([l, r]) => `<div class="row"><span>${esc(l)}</span><span>${esc(r)}</span></div>`)
      .join("");
  return `
  <div class="card">
    <div class="head" style="background:linear-gradient(90deg,${b.header},#fff8)">
      <div class="row"><b class="name">${esc(b.name)}</b><b>${esc(title)}</b></div>
      <div class="row"><span>${esc(b.keywords)}</span><span>${esc(b.ev)}</span></div>
    </div>
    <div class="stats">${b.stats.map((v, i) => `<div><div class="v">${esc(v)}</div><b>${LABELS[i]}</b></div>`).join("")}</div>
    <div class="row"><span><b>Immunity:</b> ${esc(b.immunity ?? "—")}</span><span><b>Weakness:</b> ${esc(b.weakness ?? "—")}</span></div>
    <div class="row"><span><b>Movement:</b> ${esc(b.movement ?? "—")}</span>${b.captain ? `<span><b>With Captain:</b> ${esc(b.captain)}</span>` : "<span></span>"}</div>
    <div class="chars">${CHARS.map((c, i) => `<span><i>${c[0]}</i>${c.slice(1)} ${esc(b.chars[i])}</span>`).join("")}</div>
    <div class="abil">${rows(b.abilities)}</div>
  </div>`;
}

const css = `
  body { margin: 0; background: #fff; font-family: "Bitstream Charter", "Caladea", serif; color: #111; }
  .wrap { display: inline-flex; gap: 16px; padding: 4px; align-items: flex-start; }
  .card { width: 392px; font-size: 13px; border-bottom: 1px solid #999; }
  .head { padding: 4px 6px; border-radius: 4px 4px 0 0; }
  .row { display: flex; justify-content: space-between; padding: 1px 6px; }
  .name { font-size: 16px; }
  .stats { display: flex; justify-content: space-around; text-align: center; border-top: 1px solid #999; border-bottom: 1px solid #999; padding: 6px 0; margin: 4px 0; }
  .v { font-size: 18px; }
  .chars { display: flex; justify-content: space-around; border: 1px solid #999; margin: 4px 6px; padding: 2px; font-size: 12px; }
  .chars i { font-style: normal; background: #111; color: #fff; padding: 0 2px; margin-right: 1px; font-weight: bold; }
  .abil { border-top: 1px solid #999; margin-top: 4px; padding-top: 4px; }
  .col { width: 392px; font-size: 13px; }
`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const b of blocks) {
  // real screenshots are committed as-is; only recreations are rendered
  if (b.real) continue;
  let body = card(b);
  if (b.pair) body += card({ header: b.header, ...b.second });
  if (b.columns === 2) {
    body += `<div class="col abil">${b.right.map(([l, r]) => `<div class="row"><span>${esc(l)}</span><span>${esc(r)}</span></div>`).join("")}</div>`;
  }
  await page.setContent(`<style>${css}</style><div class="wrap">${body}</div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".wrap").screenshot({ path: join(here, b.file) });
  console.log("rendered", b.file);
}
await browser.close();
