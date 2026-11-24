import { readFileSync, writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { displayMap, idbKeys, openInitiative, pickMapFolder, watchErrors } from "./helpers";

test("export, wipe and import restores identical data", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await pickMapFolder(page);
  await displayMap(page, "City", "market.png");
  await openInitiative(page);
  const input = page.getByPlaceholder(/Goblins x4 40|Kris 62/);
  await input.fill("Ogre 40");
  await input.press("Enter");
  await page.waitForTimeout(500);
  const before = await idbKeys(page);

  await page.getByRole("button", { name: /Backup/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Export data/ }).click(),
  ]);
  const file = testInfo.outputPath("backup.json");
  await download.saveAs(file);
  expect(JSON.parse(readFileSync(file, "utf8")).format).toBe("kriffmaps-backup");

  await page.goto("/robots.txt");
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("krismaps");
        req.onsuccess = req.onblocked = resolve;
      }),
  );
  await page.goto("/");
  await page.getByTestId("backup-import-input").setInputFiles(file);
  await expect(page.getByText("Replace all saved data?")).toBeVisible();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: /Replace and import/ }).click(),
  ]);
  expect(await idbKeys(page)).toEqual(before);

  const bad = testInfo.outputPath("bad.json");
  writeFileSync(bad, '{"hello":1}');
  await page.getByTestId("backup-import-input").setInputFiles(bad);
  await expect(page.getByText("That file isn't a KriffMaps backup.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a v2 database is upgraded: stat blocks move to their own store", async ({ page }) => {
  await page.goto("/robots.txt");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("krismaps", 2);
        req.onupgradeneeded = () => {
          for (const s of ["settings", "fog", "thumbs", "state"]) req.result.createObjectStore(s);
        };
        req.onsuccess = () => {
          const t = req.result.transaction("state", "readwrite");
          t.objectStore("state").put(
            { ogre: new Blob([new Uint8Array([1])], { type: "image/png" }) },
            "monsterPortraits",
          );
          t.oncomplete = () => {
            req.result.close();
            resolve();
          };
        };
      }),
  );
  await page.goto("/");
  await openInitiative(page);
  await expect(page.getByText("Ogre")).toBeVisible();
  const keys = await idbKeys(page);
  expect(keys["statblocks"]).toEqual(["ogre"]);
  expect(keys["state"]).not.toContain("monsterPortraits");
});

test("clean-up removes data only for maps missing from the folder", async ({ page }) => {
  await page.goto("/");
  await pickMapFolder(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("krismaps");
        req.onsuccess = () => {
          const t = req.result.transaction(["settings", "fog"], "readwrite");
          t.objectStore("settings").put({ favourite: true }, "City/market.png");
          t.objectStore("settings").put({ favourite: true }, "Gone/old.png");
          t.objectStore("fog").put(new Blob([new Uint8Array([1])]), "Gone/old.png");
          t.oncomplete = () => {
            req.result.close();
            resolve();
          };
        };
      }),
  );
  await page.getByRole("button", { name: /Backup/ }).click();
  await page.getByRole("menuitem", { name: /Clean up saved data/ }).click();
  await expect(page.getByText("Delete data for missing maps?")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toContainText("1 map setting, 1 fog mask");
  await page.getByRole("button", { name: /Delete unused data/ }).click();
  await expect(page.getByText(/Removed \d+ unused record/)).toBeVisible();
  const keys = await idbKeys(page);
  expect(keys["settings"]).toEqual(["City/market.png"]);
  expect(keys["fog"]).toEqual([]);
});

test("a backup nudge appears once there's data to lose, and clears after exporting", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("backup-nudge")).toHaveCount(0);
  // let the app create its database before touching it
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await indexedDB.databases()).some((d) => d.name === "krismaps" && d.version === 3),
      ),
    )
    .toBe(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("krismaps");
        req.onsuccess = () => {
          const t = req.result.transaction("settings", "readwrite");
          t.objectStore("settings").put({ favourite: true }, "City/market.png");
          t.oncomplete = () => {
            req.result.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.getByTestId("backup-nudge")).toBeVisible();
  await page.getByRole("button", { name: /Backup/ }).click();
  await expect(page.getByText("Never backed up")).toBeVisible();
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Export data/ }).click(),
  ]);
  await expect(page.getByTestId("backup-nudge")).toHaveCount(0);
  await page.getByRole("button", { name: /Backup/ }).click();
  await expect(page.getByText("Backed up today")).toBeVisible();
});
