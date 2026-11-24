import { describe, expect, test } from "bun:test";

import { shortcutFor, type KeyLike } from "../shortcuts";

const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: { tagName: "BODY" },
  ...extra,
});

describe("shortcutFor", () => {
  test.each([
    [key("z", { ctrlKey: true }), "undoFog"],
    [key("z", { metaKey: true }), "undoFog"],
    [key("Z", { ctrlKey: true, shiftKey: true }), "redoFog"],
    [key("y", { ctrlKey: true }), "redoFog"],
    [key("e"), "endTurn"],
    [key("N", { shiftKey: true }), "nextRound"],
    [key("r"), "toolReveal"],
    [key("h"), "toolHide"],
    [key("v"), "toolPan"],
    [key("["), "brushSmaller"],
    [key("]"), "brushBigger"],
    [key("?", { shiftKey: true }), "help"],
  ] as const)("%o -> %s", (event, action) => {
    expect(shortcutFor(event)).toBe(action);
  });

  test("never fires while typing in a field", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(shortcutFor(key("e", { target: { tagName, type: "text" } }))).toBeNull();
      expect(shortcutFor(key("z", { ctrlKey: true, target: { tagName } }))).toBeNull();
    }
    expect(
      shortcutFor(key("e", { target: { tagName: "DIV", isContentEditable: true } })),
    ).toBeNull();
  });

  test("ignores other keys and browser shortcuts", () => {
    expect(shortcutFor(key("x"))).toBeNull();
    expect(shortcutFor(key("r", { ctrlKey: true }))).toBeNull(); // Ctrl+R reloads
    expect(shortcutFor(key("e", { altKey: true }))).toBeNull();
  });
});
