import { expect, test, type Page } from "@playwright/test";

import { displayMap, pickMapFolder, watchErrors } from "./helpers";

const headerLabel = (page: Page) =>
  page
    .locator("main")
    .getByText(/ · \d+ maps?$/)
    .first();

test("favourites, tags and Last Used drive the library views", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await pickMapFolder(page);
  await page.getByText("Dungeons", { exact: true }).first().click();
  await expect(headerLabel(page)).toHaveText("Dungeons · 1 map");

  // favourite + hand-added tag from the preview dialog
  await page.locator('img[alt="crypt.png"]').first().click();
  await page.getByRole("button", { name: "Add to favourites" }).click();
  await expect(page.getByRole("button", { name: "Remove favourite" })).toBeVisible();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "City", exact: true }).click();
  await page.keyboard.press("Escape");

  await page.getByText("Favourites", { exact: true }).click();
  await expect(headerLabel(page)).toHaveText("Favourites · 1 map");
  await expect(page.locator('img[alt="crypt.png"]')).toBeVisible();

  // City tag now includes the crypt (by hand) as well as City/ maps (automatic)
  // the Tags list is open by default and sits above the folders, so the first
  // "City" in the sidebar is the tag
  await page.getByText("City", { exact: true }).first().click();
  await expect(headerLabel(page)).toHaveText("City · 3 maps");
  await expect(page.locator('img[alt="crypt.png"]')).toBeVisible();

  await expect(page.getByText("Last Used", { exact: true })).toBeVisible();
  await displayMap(page, "City", "market.png");
  await page.getByRole("button", { name: /^library$/i }).click();
  await page.getByText("Last Used", { exact: true }).click();
  await expect(headerLabel(page)).toHaveText("Last Used · 1 map");
  expect(errors).toEqual([]);
});

test("stage tabs and column widths are remembered across reloads", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await pickMapFolder(page);
  await displayMap(page, "City", "market.png");
  await page.getByRole("button", { name: /^library$/i }).click();
  await page.getByText("Dungeons", { exact: true }).first().click();
  await page.locator('img[alt="crypt.png"]').first().click();
  await page.getByRole("button", { name: /Preview on Stage/ }).click();
  await expect(page.getByRole("button", { name: "Display in Map View" })).toBeEnabled();

  // widen the library column by dragging its handle
  await page.getByRole("button", { name: /^library$/i }).click();
  const handle = page.getByRole("separator").first();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 100, { steps: 5 });
  await page.mouse.up();
  const sidebar = page.locator("main div.bg-sidebar").first();
  const widened = (await sidebar.boundingBox())!.width;
  expect(widened).toBeGreaterThan(300);

  await page.reload();
  await pickMapFolder(page);
  expect(Math.abs((await sidebar.boundingBox())!.width - widened)).toBeLessThan(2);
  await page.getByRole("button", { name: /^stage$/i }).click();
  await expect(page.getByRole("button", { name: "market.png" })).toBeVisible();
  await expect(page.getByRole("button", { name: "crypt.png" })).toBeVisible();

  // closing the selected tab selects another; double-click resets the width
  await page.getByRole("button", { name: "Close tab" }).last().click();
  await expect(page.getByRole("button", { name: "crypt.png" })).toHaveCount(0);
  await page.getByRole("button", { name: /^library$/i }).click();
  await page.getByRole("separator").first().dblclick();
  expect((await sidebar.boundingBox())!.width).toBe(256);
  expect(errors).toEqual([]);
});
