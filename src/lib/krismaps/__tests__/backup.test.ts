import { describe, expect, test } from "bun:test";

import { backupStatus } from "../backup";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 24, 12);

describe("backupStatus", () => {
  test("never backed up: nudge only if there's something to lose", () => {
    expect(backupStatus(undefined, now, true)).toEqual({ stale: true, label: "Never backed up" });
    expect(backupStatus(undefined, now, false).stale).toBe(false);
  });
  test.each([
    [0, "Backed up today", false],
    [1, "Backed up yesterday", false],
    [13, "Backed up 13 days ago", false],
    [14, "Backed up 14 days ago", true],
    [40, "Backed up 40 days ago", true],
  ])("%i days ago", (days, label, stale) => {
    expect(backupStatus(now - days * DAY, now, true)).toEqual({ stale, label });
  });
});
