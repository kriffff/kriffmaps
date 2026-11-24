import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { fixture, openInitiative, pasteStatBlock, watchErrors } from "./helpers";

interface Block {
  file: string;
  expect: {
    name: string;
    stamina: number;
    level: number;
    organization: string;
    role?: string;
    ev: number;
    minions?: number;
  };
}
const blocks = JSON.parse(readFileSync(fixture("statblocks/blocks.json"), "utf8")) as Block[];

// The full pipeline in a real browser: paste → canvas preprocessing → Tesseract
// (self-hosted WASM) → Draw Steel parser → initiative panel.
for (const block of blocks) {
  test(`reads ${block.file}`, async ({ page }) => {
    const errors = watchErrors(page);
    const want = block.expect;
    await page.goto("/");
    await openInitiative(page);
    await pasteStatBlock(page, `statblocks/${block.file}`);

    const card = page.getByTestId("initiative-group").filter({ hasText: want.name });
    await expect(card).toBeVisible({ timeout: 60_000 });
    const title = [`Level ${want.level}`, want.organization, want.role].filter(Boolean).join(" ");
    await expect(card.getByText(title, { exact: false })).toBeVisible();

    if (want.minions) {
      await expect(card.getByText(`0 of ${want.minions} left`)).toHaveCount(0);
      await expect(card.getByText(`${want.minions} of ${want.minions} left`)).toBeVisible();
      await expect(card.getByLabel("Stamina per minion")).toHaveValue(String(want.stamina));
      await expect(card.getByLabel("Squad pool", { exact: true })).toHaveValue(
        String(want.stamina * want.minions),
      );
    } else {
      await expect(card.getByLabel("Max Stamina")).toHaveValue(String(want.stamina));
    }
    expect(errors).toEqual([]);
  });
}
