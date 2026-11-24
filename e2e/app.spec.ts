import { expect, test } from "@playwright/test";

import {
  displayMap,
  idbKeys,
  openInitiative,
  pasteStatBlock,
  pickMapFolder,
  watchErrors,
} from "./helpers";

test("both views load cleanly, including a deep link", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByText("Director View")).toBeVisible();
  await page.goto("/table");
  await expect(page.getByText(/waiting for the director/i)).toBeVisible();
  await page.goto("/no/such/page");
  await expect(page.getByText("Page not found")).toBeVisible();
  expect(errors).toEqual([]);
});

test("maps load from a folder and sync to the Map View", async ({ page, context }) => {
  const errors = watchErrors(page, "director");
  await page.goto("/");
  await pickMapFolder(page);
  const table = await context.newPage();
  errors.push(...watchErrors(table, "table"));
  await table.goto("/table");
  await displayMap(page, "City", "market.png");
  await expect(table.getByText(/waiting for the director/i)).toHaveCount(0);
  // the video in the same folder gets a thumbnail too
  await page.getByRole("button", { name: /^library$/i }).click();
  await expect(page.locator('img[alt="harbour.mp4"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("initiative syncs, OCR reads a stat block, and both persist", async ({ page, context }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const table = await context.newPage();
  await table.goto("/table");
  await openInitiative(page);
  const input = page.getByPlaceholder(/Goblins x4 40|Kris 62/);
  await input.fill("Goblins x4 40");
  await input.press("Enter");
  await expect(table.getByText("Goblins")).toBeVisible();

  await pasteStatBlock(page);
  await expect(page.getByText("Marsh Hag Chanter").first()).toBeVisible({ timeout: 60_000 });

  await page.reload();
  await openInitiative(page);
  await expect(page.getByText("Goblins").first()).toBeVisible();
  await expect(page.getByText("Marsh Hag Chanter").first()).toBeVisible();
  const keys = await idbKeys(page);
  expect(keys["statblocks"]).toEqual(["marsh hag chanter"]);
  expect(keys["state"]).toContain("initiative");
  expect(errors).toEqual([]);
});
