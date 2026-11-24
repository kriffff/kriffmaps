import { expect, test, type Page } from "@playwright/test";

import { openInitiative, pasteStatBlock, watchErrors } from "./helpers";

async function add(page: Page, side: "Enemies" | "Heroes", text: string, minion = false) {
  await page.getByRole("button", { name: side, exact: true }).click();
  const toggle = page.getByRole("button", { name: "Minions", exact: true }).first();
  if (side === "Enemies" && (await toggle.getAttribute("aria-pressed")) !== String(minion)) {
    await toggle.click();
  }
  const input = page.getByPlaceholder(/Goblins x4 40|Kris 62/);
  await input.fill(text);
  await input.press("Enter");
}

const group = (page: Page, label: RegExp | string) =>
  page.getByTestId("initiative-group").filter({ hasText: label });

test("a Draw Steel combat: first side, alternation, squads, captains and dead monsters", async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const table = await context.newPage();
  await table.goto("/table");
  const overlay = table.getByTestId("initiative-overlay");
  await openInitiative(page);

  await add(page, "Heroes", "Kris 30");
  await add(page, "Heroes", "Ana 24");
  await add(page, "Enemies", "Ogre 40");
  await add(page, "Enemies", "Bone Rattler x4 5", true);
  await add(page, "Enemies", "Grave Captain 20");

  // the captain joins the runners' turn
  await group(page, /^Grave Captain/)
    .getByTitle("Act together with…")
    .click();
  await page.getByRole("menuitem", { name: "Bone Rattler ×4" }).click();
  await expect(group(page, "Bone Rattler ×4 + Grave Captain")).toBeVisible();

  // nobody can act until the first side is chosen
  await expect(page.getByText("Who goes first?")).toBeVisible();
  await expect(group(page, "Kris").getByRole("button", { name: /Kris/ }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Enemies first" }).click();
  await expect(page.getByText("Enemies go first each round.")).toBeVisible();

  // enemies first: heroes can't start, enemies can
  await expect(group(page, "Kris").getByRole("button", { name: /Kris/ }).first()).toBeDisabled();
  await group(page, "Ogre").getByRole("button", { name: /Ogre/ }).first().click();
  await expect(page.getByRole("heading", { name: "Active" })).toBeVisible();
  await page.getByRole("button", { name: "End turn" }).click();

  // then a hero must go
  await expect(page.getByText("The heroes pick who acts next.")).toBeVisible();
  await group(page, /^Kris/).getByRole("button", { name: /Kris/ }).first().click();
  await page.getByRole("button", { name: "End turn" }).click();

  // the squad loses 6 Stamina from its 20 pool: one runner dies
  const squad = group(page, /Bone Rattler/);
  await squad.getByLabel("Squad pool", { exact: true }).fill("14");
  await expect(squad.getByText("3 of 4 left")).toBeVisible();
  await expect(overlay.getByText("×3")).toBeVisible();

  // the ogre dies and leaves the Map View; the round can still finish
  await group(page, "Ogre").getByLabel("Stamina", { exact: true }).fill("0");
  await expect(page.getByRole("heading", { name: "Dead" })).toBeVisible();
  await expect(overlay.getByText("Ogre")).toHaveCount(0);

  await squad
    .getByRole("button", { name: /Bone Rattler/ })
    .first()
    .click();
  await page.getByRole("button", { name: "End turn" }).click();
  await group(page, /^Ana/).getByRole("button", { name: /Ana/ }).first().click();
  await page.getByRole("button", { name: "End turn" }).click();

  await page.getByRole("button", { name: "Start round 2" }).click();
  await expect(overlay.getByText("Round 2")).toBeVisible();
  // enemies still go first in round 2
  await expect(group(page, /^Kris/).getByRole("button", { name: /Kris/ }).first()).toBeDisabled();
  await expect(squad.getByRole("button", { name: /Bone Rattler/ }).first()).toBeEnabled();

  // everything survives a reload
  await page.reload();
  await openInitiative(page);
  await expect(page.getByText("Enemies go first each round.")).toBeVisible();
  await expect(group(page, /Bone Rattler ×3 \+ Grave Captain/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a solo from a pasted stat block takes two turns a round, never back to back", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await openInitiative(page);
  await add(page, "Heroes", "Kris 30");
  await add(page, "Heroes", "Ana 24");
  await page.getByRole("button", { name: "Enemies", exact: true }).click();
  await pasteStatBlock(page, "statblocks/tunnel-wyrm.png");
  const wyrm = group(page, /Tunnel Wyrm/);
  await expect(wyrm.getByText("Solo · 0 of 2 turns")).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Heroes first" }).click();
  const start = (g: ReturnType<typeof group>, name: RegExp) =>
    g.getByRole("button", { name }).first().click();
  const end = () => page.getByRole("button", { name: "End turn" }).click();

  await start(group(page, /^Kris/), /Kris/);
  await end();
  await start(wyrm, /Tunnel Wyrm/);
  await end();
  await expect(wyrm.getByText("Solo · 1 of 2 turns")).toBeVisible();
  // the heroes go next; the solo can't follow itself
  await expect(wyrm.getByRole("button", { name: /Tunnel Wyrm/ }).first()).toBeDisabled();
  await start(group(page, /^Ana/), /Ana/);
  await end();
  await start(wyrm, /Tunnel Wyrm/);
  await end();
  await expect(page.getByRole("button", { name: "Start round 2" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Malice: Victories at the start, heroes + round each round, spent by hand", async ({
  page,
}) => {
  await page.goto("/");
  await openInitiative(page);
  await add(page, "Heroes", "Kris 30");
  await add(page, "Heroes", "Ana 24");
  await add(page, "Enemies", "Ogre 40");
  const malice = page.getByLabel("Malice", { exact: true });
  await page.getByLabel("Average Victories").fill("2");
  await expect(page.getByText("+5 when combat starts")).toBeVisible();

  await page.getByRole("button", { name: "Enemies first" }).click();
  await expect(malice).toHaveText("5"); // 2 Victories + 2 heroes + round 1
  await page.getByTestId("malice").getByRole("button", { name: "3", exact: true }).click();
  await expect(malice).toHaveText("2");
  await expect(page.getByText("+4 at round 2")).toBeVisible();

  await page.getByRole("button", { name: "Next round" }).click();
  await expect(malice).toHaveText("6"); // + 2 heroes + round 2

  await page.reload();
  await openInitiative(page);
  await expect(page.getByLabel("Malice", { exact: true })).toHaveText("6");
});

test("conditions: EoT ends with the turn, save ends asks for a save, both show on the Map View", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const table = await context.newPage();
  await table.goto("/table");
  const overlay = table.getByTestId("initiative-overlay");
  await openInitiative(page);
  await add(page, "Heroes", "Kris 30");
  await add(page, "Enemies", "Ogre 40");
  const ogre = group(page, /^Ogre/);

  const addCondition = async (name: string, duration: string) => {
    await ogre.getByRole("button", { name: "Condition" }).click();
    await ogre.getByLabel("Condition").selectOption(name);
    await ogre.getByLabel("Duration").selectOption({ label: duration });
    await ogre.getByRole("button", { name: "Add", exact: true }).click();
  };
  await addCondition("Slowed", "Until end of its turn (EoT)");
  await addCondition("Weakened", "Save ends");
  await expect(ogre.getByText("Slowed")).toBeVisible();
  await expect(overlay.getByText("Weakened")).toBeVisible();

  await page.getByRole("button", { name: "Enemies first" }).click();
  await ogre.getByRole("button", { name: /Ogre/ }).first().click();
  await page.getByRole("button", { name: "End turn" }).click();

  // EoT gone; the save is due
  await expect(ogre.getByText("Slowed")).toHaveCount(0);
  await expect(overlay.getByText("Slowed")).toHaveCount(0);
  await expect(ogre.getByText("Save vs Weakened?")).toBeVisible();
  await ogre.getByRole("button", { name: "Failed" }).click();
  await expect(ogre.getByText("Weakened (save)")).toBeVisible();
  await ogre.getByRole("button", { name: "Remove Weakened" }).click();
  await expect(overlay.getByText("Weakened")).toHaveCount(0);
});
