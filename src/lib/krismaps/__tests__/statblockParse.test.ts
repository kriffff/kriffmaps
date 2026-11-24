/**
 * Stat block parsing against recorded OCR output of recreations of real Draw
 * Steel stat blocks (e2e/fixtures/statblocks), read through two different
 * preprocessing pipelines so the parser isn't tuned to one engine's quirks.
 */
import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import blocks from "../../../../e2e/fixtures/statblocks/blocks.json";
import { parseStatBlock, readNumber, type OcrWord } from "../statblockParse";

const words = (pipeline: string, file: string): OcrWord[] =>
  JSON.parse(
    readFileSync(
      new URL(
        `fixtures/statblock-words/${pipeline}-${file.replace(".png", ".words.json")}`,
        import.meta.url,
      ),
      "utf8",
    ),
  );

describe.each(["threshold", "grey"])("%s pipeline", (pipeline) => {
  test.each(blocks.map((b) => [b.file, b.expect] as const))("%s", (file, expected) => {
    const read = parseStatBlock(words(pipeline, file));
    expect(read.name).toBe(expected.name);
    expect(read.stamina).toBe(expected.stamina);
    expect(read.level).toBe(expected.level);
    expect(read.organization).toBe(expected.organization as never);
    if ("role" in expected) expect(read.role).toBe(expected.role);
    if ("minions" in expected) expect(read.squadSize).toBe(expected.minions);
    else expect(read.squadSize).toBeUndefined();
  });
});

describe("readNumber", () => {
  test.each([
    ["30", 30],
    ["I2", 12],
    ["2O0", 200],
    ["5)", 5],
    ["1M", undefined],
    ["Size", undefined],
  ])("%s", (raw, value) => expect(readNumber(raw)).toBe(value));
});

test("no words, no read", () => {
  expect(parseStatBlock([])).toEqual({});
});
