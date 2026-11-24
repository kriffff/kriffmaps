import { describe, expect, test } from "bun:test";

import { FogHistory, type FogSnapshot } from "../fogHistory";

const snap = (n: number) => new Uint8ClampedArray([n]);

describe("FogHistory", () => {
  test("undo returns the state before the last change, redo brings it back", () => {
    const h = new FogHistory();
    h.record("a", snap(0)); // painted: 0 -> 1
    h.record("a", snap(1)); // painted: 1 -> 2
    expect(h.undo("a", snap(2))).toEqual(snap(1));
    expect(h.undo("a", snap(1))).toEqual(snap(0));
    expect(h.undo("a", snap(0))).toBeUndefined();
    expect(h.redo("a", snap(0))).toEqual(snap(1));
    expect(h.redo("a", snap(1))).toEqual(snap(2));
    expect(h.canRedo("a")).toBe(false);
  });

  test("a new change after undoing clears redo", () => {
    const h = new FogHistory();
    h.record("a", snap(0));
    h.undo("a", snap(1));
    expect(h.canRedo("a")).toBe(true);
    h.record("a", snap(0));
    expect(h.canRedo("a")).toBe(false);
  });

  test("each map has its own history", () => {
    const h = new FogHistory();
    h.record("a", snap(0));
    expect(h.canUndo("a")).toBe(true);
    expect(h.canUndo("b")).toBe(false);
    expect(h.undo("b", snap(9))).toBeUndefined();
  });

  test("keeps only the most recent steps", () => {
    const h = new FogHistory(3);
    for (let i = 0; i < 5; i++) h.record("a", snap(i));
    const restored: number[] = [];
    let current: FogSnapshot = snap(5);
    for (let s = h.undo("a", current); s; s = h.undo("a", current)) {
      restored.push(s[0]!);
      current = s;
    }
    expect(restored).toEqual([4, 3, 2]);
  });
});
