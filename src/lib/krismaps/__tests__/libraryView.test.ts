import { describe, expect, test } from "bun:test";

import { FAVOURITES_PATH, LAST_USED_PATH, buildLibrary } from "../library";
import { LAST_USED_LIMIT, libraryView, toggleTagPatch } from "../libraryView";
import { TAG_PREFIX, UNTAGGED_PATH, defaultTagRules } from "../tags";
import { defaultSettings, type MapSettings } from "../types";

/** a File as a webkitdirectory picker would hand it over */
const file = (relativePath: string) => {
  const f = new File([new Uint8Array([1])], relativePath.split("/").pop()!, { lastModified: 1 });
  Object.defineProperty(f, "webkitRelativePath", { value: relativePath });
  return f;
};

const { root, entries } = buildLibrary([
  file("Maps/Towns/market.png"),
  file("Maps/Towns/Docks/harbour.mp4"),
  file("Maps/Dungeons/crypt.jpg"),
  file("Maps/Misc/thing.png"),
]);
const view = (selected: string, settings: Record<string, MapSettings> = {}) =>
  libraryView({ root, entries, settings, rules: defaultTagRules, selected });
const names = (v: ReturnType<typeof view>) => v.visibleMaps.map((e) => e.name);

describe("libraryView", () => {
  test("a folder shows its own maps and its name", () => {
    const v = view("Towns");
    expect(names(v)).toEqual(["market.png"]);
    expect(v.label).toBe("Towns");
  });

  test("root folder label is the picked folder's name", () => {
    expect(view("").label).toBe("Maps");
  });

  test("favourites and last used", () => {
    const settings = {
      "Towns/market.png": { ...defaultSettings, favourite: true, lastUsed: 5 },
      "Dungeons/crypt.jpg": { ...defaultSettings, lastUsed: 9 },
    };
    expect(names(view(FAVOURITES_PATH, settings))).toEqual(["market.png"]);
    const last = view(LAST_USED_PATH, settings);
    expect(names(last)).toEqual(["crypt.jpg", "market.png"]);
    expect(last.label).toBe("Last Used");
  });

  test("last used is capped", () => {
    const many = Array.from({ length: LAST_USED_LIMIT + 5 }, (_, i) => file(`Maps/m${i}.png`));
    const lib = buildLibrary(many);
    const settings = Object.fromEntries(
      lib.entries.map((e, i) => [e.path, { ...defaultSettings, lastUsed: i + 1 }]),
    );
    const v = libraryView({ ...lib, settings, rules: defaultTagRules, selected: LAST_USED_PATH });
    expect(v.visibleMaps).toHaveLength(LAST_USED_LIMIT);
  });

  test("a tag shows tagged maps from anywhere; a folder inside it narrows", () => {
    const city = view(`${TAG_PREFIX}city`);
    expect(names(city).sort()).toEqual(["harbour.mp4", "market.png"]);
    expect(city.label).toBe("City");
    const docks = view(`${TAG_PREFIX}city::Towns/Docks`);
    expect(names(docks)).toEqual(["harbour.mp4"]);
    expect(docks.label).toBe("City / Docks");
  });

  test("untagged maps are listed under Untagged", () => {
    const v = view(UNTAGGED_PATH);
    expect(names(v)).toEqual(["thing.png"]);
    expect(v.label).toBe("Untagged");
  });

  test("empty messages depend on the selection", () => {
    expect(view(FAVOURITES_PATH).emptyMessage).toMatch(/No favourites/);
    expect(view(`${TAG_PREFIX}nope`).emptyMessage).toMatch(/tag/);
    expect(view("Nowhere").emptyMessage).toMatch(/folder/);
  });
});

describe("toggleTagPatch", () => {
  const market = entries.find((e) => e.name === "market.png")!;

  test("removing an automatic tag records a removal", () => {
    expect(toggleTagPatch(market, defaultTagRules, undefined, "city")).toEqual({
      tagsAdd: [],
      tagsRemove: ["city"],
    });
  });

  test("adding a non-automatic tag records an addition", () => {
    expect(toggleTagPatch(market, defaultTagRules, undefined, "dungeon")).toEqual({
      tagsAdd: ["dungeon"],
      tagsRemove: [],
    });
  });

  test("toggling twice returns to no overrides", () => {
    const once = {
      ...defaultSettings,
      ...toggleTagPatch(market, defaultTagRules, undefined, "city"),
    };
    expect(toggleTagPatch(market, defaultTagRules, once, "city")).toEqual({
      tagsAdd: [],
      tagsRemove: [],
    });
  });
});
