import { expect, test } from "@playwright/test";

import { displayMap, openInitiative, pasteStatBlock, pickMapFolder, watchErrors } from "./helpers";

test("after one visit the whole app works offline, including OCR", async ({ page, context }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  // `ready` resolves once a worker is active, i.e. after the precache installed
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Director View")).toBeVisible();
  const table = await context.newPage();
  await table.goto("/table");
  await expect(table.getByText(/waiting for the director/i)).toBeVisible();
  const other = await context.newPage();
  await other.goto("/no/such/page");
  await expect(other.getByText("Page not found")).toBeVisible();
  await other.close();

  await pickMapFolder(page);
  await displayMap(page, "City", "market.png");
  await expect(table.getByText(/waiting for the director/i)).toHaveCount(0);

  await openInitiative(page);
  await pasteStatBlock(page);
  await expect(page.getByText("Marsh Hag Chanter").first()).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});
