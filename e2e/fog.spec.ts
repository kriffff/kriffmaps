import { expect, test, type Page } from "@playwright/test";

import { displayMap, idbKeys, pickMapFolder, watchErrors } from "./helpers";

/** RGB of the Map View canvas a little off-centre (the centre can sit on a grid line) */
const tablePixel = (table: Page) =>
  table.evaluate(() => {
    // null while the page is still loading, so expect.poll keeps retrying
    const c = document.querySelector("canvas");
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return null;
    const d = ctx.getImageData(c.width / 2 + 20, c.height / 2 + 20, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
const MAP_GREEN = [60, 110, 80];
const FOG_BLACK = [0, 0, 0];

/** drags the reveal brush across the middle of the Director's stage */
async function paintCentre(page: Page) {
  const box = (await page.locator("main canvas").first().boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 60, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 20, { steps: 8 });
  await page.mouse.up();
}

test("fog painting reaches the Map View, and undo/redo keep both screens in step", async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await pickMapFolder(page);
  const table = await context.newPage();
  await table.goto("/table");
  await displayMap(page, "City", "market.png");
  await page.getByRole("switch", { name: "Fog of war" }).click();

  // a new map starts fully fogged on the table
  await expect.poll(() => tablePixel(table)).toEqual(FOG_BLACK);
  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await expect(undo).toBeDisabled();

  await paintCentre(page);
  await expect.poll(() => tablePixel(table)).toEqual(MAP_GREEN);
  await expect(undo).toBeEnabled();

  // Ctrl+Z puts the fog back on the table; Ctrl+Shift+Z reveals it again
  await page.keyboard.press("Control+z");
  await expect.poll(() => tablePixel(table)).toEqual(FOG_BLACK);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => tablePixel(table)).toEqual(MAP_GREEN);

  // changes are saved as soon as they're made: reloading a moment later keeps them
  await page.waitForTimeout(300);
  await page.reload();
  await pickMapFolder(page);
  await page.getByRole("button", { name: /^stage$/i }).click();
  await page.getByRole("button", { name: "market.png" }).click();
  await table.reload();
  await expect.poll(() => tablePixel(table)).toEqual(MAP_GREEN);

  // Hide all is undoable too
  await page.getByRole("button", { name: "Hide all" }).click();
  await expect.poll(() => tablePixel(table)).toEqual(FOG_BLACK);
  await undo.click();
  await expect.poll(() => tablePixel(table)).toEqual(MAP_GREEN);
  expect(errors).toEqual([]);
});

test("combat shortcuts end turns and start rounds, but not while typing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^stage$/i }).click();
  await page.getByRole("button", { name: /^initiative$/i }).click();
  const input = page.getByPlaceholder(/Goblins x4 40|Kris 62/);
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await input.fill("Kris 30");
  await input.press("Enter");
  // typing "e" and "n" into the box must not trigger anything
  await input.fill("Ogre en 40");
  await expect(input).toHaveValue("Ogre en 40");
  await page.getByRole("button", { name: "Enemies", exact: true }).click();
  await input.fill("Ogre 40");
  await input.press("Enter");
  await page.getByRole("button", { name: "Heroes first" }).click();

  await page
    .getByTestId("initiative-group")
    .filter({ hasText: "Kris" })
    .getByRole("button", { name: /Kris/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Active" })).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("e");
  await expect(page.getByRole("heading", { name: "Active" })).toHaveCount(0);
  await page
    .getByTestId("initiative-group")
    .filter({ hasText: "Ogre" })
    .getByRole("button", { name: /Ogre/ })
    .first()
    .click();
  await page.keyboard.press("e");
  await expect(page.getByRole("button", { name: "Start round 2" })).toBeVisible();
  await page.keyboard.press("n");
  await expect(
    page.getByText("Round", { exact: true }).locator("xpath=following-sibling::span[1]"),
  ).toHaveText("2");

  await page.keyboard.press("?");
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
});

test("painting and switching map tab at once saves the fog to the right map (regression)", async ({
  page,
}) => {
  await page.goto("/");
  await pickMapFolder(page);
  await displayMap(page, "City", "market.png");
  await page.getByRole("button", { name: /^library$/i }).click();
  await page.getByText("Dungeons", { exact: true }).first().click();
  await page.locator('img[alt="crypt.png"]').first().click();
  await page.getByRole("button", { name: /Preview on Stage/ }).click();
  await page.getByRole("button", { name: "market.png" }).click();

  // paint, then switch tab well inside the 0.7 s save delay
  await paintCentre(page);
  await page.getByRole("button", { name: "crypt.png" }).click();
  await page.waitForTimeout(1500);
  await expect.poll(async () => (await idbKeys(page))["fog"]).toEqual(["City/market.png"]);
});
