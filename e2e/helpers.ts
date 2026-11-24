import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, type Page } from "@playwright/test";

export const fixture = (name: string) =>
  fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));

/** collects console errors and page crashes so a test can assert there were none */
export function watchErrors(page: Page, label = "page") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on("console", (m) => {
    // ignore requests the browser cancelled itself (offline tests; Firefox's
    // NS_BINDING_ABORTED when a test navigates while fonts are still loading)
    if (m.type() === "error" && !/ERR_INTERNET_DISCONNECTED|status=2152398850/.test(m.text())) {
      errors.push(`${label} console: ${m.text()}`);
    }
  });
  return errors;
}

export async function pickMapFolder(page: Page, folder = "maps") {
  await page.locator("input[webkitdirectory]").setInputFiles(fixture(folder));
  await expect(page.getByText(/Loaded \d+ maps?/)).toBeVisible();
}

/** opens a map from the library and pushes it to the Map View */
export async function displayMap(page: Page, folder: string, file: string) {
  await page.getByRole("button", { name: /^library$/i }).click();
  await page.getByText(folder, { exact: true }).first().click();
  await page.locator(`img[alt="${file}"]`).first().click();
  await page.getByRole("button", { name: /Preview on Stage|Open on Stage/ }).click();
  await page.getByRole("button", { name: /Display in Map View/ }).click();
}

export async function openInitiative(page: Page) {
  await page.getByRole("button", { name: /^stage$/i }).click();
  await page.getByRole("button", { name: /^initiative$/i }).click();
}

/** simulates Ctrl+V of a stat block image onto the "add a monster" paste zone */
export async function pasteStatBlock(page: Page, file = "statblocks/marsh-hag-chanter.png") {
  const b64 = readFileSync(fixture(file)).toString("base64");
  await page.getByText(/Ctrl\+V a stat block to add a monster/).evaluate((el, data) => {
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bin], "statblock.png", { type: "image/png" }));
    // Firefox drops files from a constructed ClipboardEvent's clipboardData, so
    // attach the DataTransfer to a plain event; React reads it the same way.
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: dt });
    el.dispatchEvent(event);
  }, b64);
}

/** every IndexedDB store's keys, for asserting on persisted data */
export function idbKeys(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, string[]>>((resolve) => {
        const req = indexedDB.open("krismaps");
        req.onsuccess = () => {
          const db = req.result;
          const out: Record<string, string[]> = {};
          const stores = Array.from(db.objectStoreNames);
          let pending = stores.length;
          for (const s of stores) {
            const q = db.transaction(s).objectStore(s).getAllKeys();
            q.onsuccess = () => {
              out[s] = q.result.map(String).sort();
              if (--pending === 0) {
                db.close();
                resolve(out);
              }
            };
          }
        };
      }),
  );
}
