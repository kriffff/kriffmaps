import { describe, expect, test } from "bun:test";

import { cleanupTotal, staleKeys } from "../cleanup";

const map = (path: string, lastModified = 1, size = 100) => ({ path, lastModified, size });

describe("staleKeys", () => {
  const entries = [map("City/market.png"), map("Dungeons/crypt.png", 5, 200)];

  test("keeps everything that belongs to a current map", () => {
    const plan = staleKeys(entries, {
      settings: ["City/market.png", "Dungeons/crypt.png"],
      fog: ["City/market.png"],
      thumbs: ["City/market.png|1|100", "Dungeons/crypt.png|5|200"],
    });
    expect(cleanupTotal(plan)).toBe(0);
  });

  test("flags data for maps that are gone", () => {
    const plan = staleKeys(entries, {
      settings: ["City/market.png", "Old/gone.png"],
      fog: ["Old/gone.png"],
      thumbs: ["Old/gone.png|1|100"],
    });
    expect(plan).toEqual({
      settings: ["Old/gone.png"],
      fog: ["Old/gone.png"],
      thumbs: ["Old/gone.png|1|100"],
    });
  });

  test("flags thumbnails of an older version of a file that still exists", () => {
    const plan = staleKeys(entries, {
      settings: [],
      fog: [],
      thumbs: ["Dungeons/crypt.png|4|180", "Dungeons/crypt.png|5|200"],
    });
    expect(plan.thumbs).toEqual(["Dungeons/crypt.png|4|180"]);
  });

  test("an empty folder flags everything", () => {
    const plan = staleKeys([], { settings: ["a"], fog: ["a"], thumbs: ["a|1|1"] });
    expect(cleanupTotal(plan)).toBe(3);
  });
});
