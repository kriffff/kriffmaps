import { expect, test } from "@playwright/test";

test("both views ask to keep the screen awake, and ask again after being hidden", async ({
  page,
}) => {
  // count wake lock requests through a stub (headless browsers never sleep)
  await page.addInitScript(() => {
    const w = window as unknown as { __wakeRequests: number };
    w.__wakeRequests = 0;
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: () => {
          w.__wakeRequests++;
          return Promise.resolve({ release: () => Promise.resolve() });
        },
      },
    });
  });
  const requests = () =>
    page.evaluate(() => (window as unknown as { __wakeRequests: number }).__wakeRequests);

  for (const path of ["/", "/table"]) {
    await page.goto(path);
    await expect.poll(requests).toBe(1);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(requests).toBe(2);
  }
});

test("double-clicking the Map View toggles fullscreen", async ({ page }) => {
  await page.goto("/table");
  await expect(page.getByText("Double-click for fullscreen")).toBeVisible();
  await page.mouse.dblclick(400, 300);
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.mouse.dblclick(400, 300);
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});
