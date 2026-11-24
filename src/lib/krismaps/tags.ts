import { useCallback, useEffect, useRef, useState } from "react";

import { STORE_STATE, idbGet, idbSet } from "./db";
import type { FolderNode, MapEntry, MapSettings } from "./types";

export interface TagRule {
  id: string;
  label: string;
  keywords: string[];
}

export const TAG_PREFIX = "__tag__:";
export const UNTAGGED_PATH = "__untagged__";

export const defaultTagRules: TagRule[] = [
  {
    id: "city",
    label: "City",
    keywords: [
      "city",
      "cities",
      "town",
      "township",
      "village",
      "market",
      "marketplace",
      "street",
      "streets",
      "urban",
      "tavern",
      "inn",
      "shop",
      "shops",
      "alley",
      "alleyway",
      "plaza",
      "square",
      "docks",
      "dock",
      "harbour",
      "harbor",
      "slum",
      "slums",
      "district",
    ],
  },
  {
    id: "wilderness",
    label: "Wilderness",
    keywords: [
      "forest",
      "wood",
      "woods",
      "woodland",
      "jungle",
      "plains",
      "grassland",
      "hills",
      "hill",
      "swamp",
      "marsh",
      "bog",
      "desert",
      "dunes",
      "tundra",
      "snow",
      "snowy",
      "ice",
      "glacier",
      "mountain",
      "mountains",
      "river",
      "lake",
      "coast",
      "beach",
      "shore",
      "road",
      "path",
      "camp",
      "campsite",
      "meadow",
      "field",
      "farm",
      "valley",
      "canyon",
      "oasis",
    ],
  },
  {
    id: "dungeon",
    label: "Dungeon",
    keywords: [
      "dungeon",
      "crypt",
      "tomb",
      "catacomb",
      "catacombs",
      "cave",
      "caves",
      "cavern",
      "caverns",
      "mine",
      "mines",
      "lair",
      "sewer",
      "sewers",
      "vault",
      "prison",
      "jail",
      "labyrinth",
      "maze",
      "burrow",
      "warren",
    ],
  },
  {
    id: "interior",
    label: "Interior",
    keywords: [
      "room",
      "hall",
      "hallway",
      "chamber",
      "library",
      "throne",
      "kitchen",
      "cellar",
      "basement",
      "attic",
      "temple",
      "chapel",
      "church",
      "shrine",
      "cathedral",
      "manor",
      "mansion",
      "house",
      "cottage",
      "barracks",
      "study",
      "laboratory",
      "lab",
      "forge",
      "smithy",
      "warehouse",
    ],
  },
  {
    id: "fortification",
    label: "Fortification",
    keywords: [
      "castle",
      "fort",
      "fortress",
      "keep",
      "tower",
      "wall",
      "walls",
      "gate",
      "gatehouse",
      "battlement",
      "battlements",
      "siege",
      "citadel",
      "stronghold",
      "outpost",
      "watchtower",
    ],
  },
  {
    id: "water",
    label: "Water & Sea",
    keywords: [
      "ship",
      "ships",
      "boat",
      "galleon",
      "sea",
      "ocean",
      "island",
      "isle",
      "port",
      "deck",
      "bridge",
      "ford",
      "waterfall",
      "swim",
      "reef",
      "pirate",
      "shipwreck",
      "wreck",
    ],
  },
  {
    id: "underdark",
    label: "Underdark",
    keywords: ["underdark", "abyss", "chasm", "pit", "tunnel", "tunnels", "depths", "underground"],
  },
  {
    id: "planar",
    label: "Planar & Special",
    keywords: [
      "planar",
      "plane",
      "hell",
      "hells",
      "heaven",
      "feywild",
      "fey",
      "astral",
      "shadowfell",
      "void",
      "volcano",
      "volcanic",
      "lava",
      "ruin",
      "ruins",
      "arena",
      "colosseum",
      "coliseum",
      "dream",
      "clockwork",
      "airship",
    ],
  },
];

/** splits a relative path into lowercase words (separators, camelCase, digits stripped) */
export function tokenise(path: string): string[] {
  return path
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 2);
}

/** tags derived purely from the file name and folder path */
export function autoTagsFor(entry: MapEntry, rules: TagRule[]): string[] {
  const words = new Set(tokenise(entry.path));
  return rules.filter((rule) => rule.keywords.some((kw) => words.has(kw))).map((rule) => rule.id);
}

/** auto tags plus per-map overrides */
export function tagsForEntry(entry: MapEntry, rules: TagRule[], settings?: MapSettings): string[] {
  const auto = autoTagsFor(entry, rules);
  const removed = new Set(settings?.tagsRemove ?? []);
  const out = auto.filter((id) => !removed.has(id));
  for (const id of settings?.tagsAdd ?? []) if (!out.includes(id)) out.push(id);
  return out;
}

export interface TagIndex {
  byTag: Record<string, MapEntry[]>;
  untagged: MapEntry[];
}

export function buildTagIndex(
  entries: MapEntry[],
  rules: TagRule[],
  settingsMap: Record<string, MapSettings>,
): TagIndex {
  const byTag: Record<string, MapEntry[]> = {};
  for (const rule of rules) byTag[rule.id] = [];
  const untagged: MapEntry[] = [];
  for (const entry of entries) {
    const tags = tagsForEntry(entry, rules, settingsMap[entry.path]);
    if (tags.length === 0) {
      untagged.push(entry);
      continue;
    }
    for (const id of tags) (byTag[id] ??= []).push(entry);
  }
  return { byTag, untagged };
}

export function tagSelectionId(path: string): string | null {
  return path.startsWith(TAG_PREFIX) ? path.slice(TAG_PREFIX.length) : null;
}

export function slugifyTag(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `tag-${Date.now()}`
  );
}

/** locally persisted, user-editable tag rules */
export function useTagRules() {
  const [rules, setRules] = useState<TagRule[]>(defaultTagRules);
  const loaded = useRef(false);

  useEffect(() => {
    idbGet<TagRule[]>(STORE_STATE, "tagRules")
      .then((stored) => {
        if (Array.isArray(stored) && stored.length > 0) setRules(stored);
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
  }, []);

  const persist = useCallback((next: TagRule[]) => {
    setRules(next);
    void idbSet(STORE_STATE, "tagRules", next).catch(() => undefined);
  }, []);

  const addTag = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = slugifyTag(trimmed);
    setRules((prev) => {
      if (prev.some((r) => r.id === id)) return prev;
      const next = [...prev, { id, label: trimmed, keywords: [] }];
      void idbSet(STORE_STATE, "tagRules", next).catch(() => undefined);
      return next;
    });
  }, []);

  const updateTag = useCallback((id: string, patch: Partial<Omit<TagRule, "id">>) => {
    setRules((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      void idbSet(STORE_STATE, "tagRules", next).catch(() => undefined);
      return next;
    });
  }, []);

  const removeTag = useCallback((id: string) => {
    setRules((prev) => {
      const next = prev.filter((r) => r.id !== id);
      void idbSet(STORE_STATE, "tagRules", next).catch(() => undefined);
      return next;
    });
  }, []);

  const resetRules = useCallback(() => persist(defaultTagRules), [persist]);

  return { rules, addTag, updateTag, removeTag, resetRules };
}

export const TAG_FOLDER_SEP = "::";

export interface TagSelection {
  tagId: string | null;
  untagged: boolean;
  folderPath: string | null;
}

/** parses "__tag__:city::Battlemaps/Towns" or "__untagged__::Scenes" */
export function parseTagSelection(path: string): TagSelection | null {
  const parts = path.split(TAG_FOLDER_SEP);
  const head = parts[0] ?? "";
  const rest = parts.slice(1);
  const folderPath = rest.length > 0 ? rest.join(TAG_FOLDER_SEP) : null;
  if (head === UNTAGGED_PATH) return { tagId: null, untagged: true, folderPath };
  if (head.startsWith(TAG_PREFIX)) {
    return { tagId: head.slice(TAG_PREFIX.length), untagged: false, folderPath };
  }
  return null;
}

/** rebuilds a folder tree containing only the given entries, pruning empty folders */
export function buildTagFolderTree(entries: MapEntry[], rootName: string): FolderNode {
  const root: FolderNode = { path: "", name: rootName, folders: [], maps: [] };
  const byPath = new Map<string, FolderNode>([["", root]]);

  for (const entry of entries) {
    const parts = entry.path.split("/");
    parts.pop();
    let current = root;
    let acc = "";
    for (const segment of parts) {
      acc = acc ? `${acc}/${segment}` : segment;
      let next = byPath.get(acc);
      if (!next) {
        next = { path: acc, name: segment, folders: [], maps: [] };
        byPath.set(acc, next);
        current.folders.push(next);
      }
      current = next;
    }
    current.maps.push(entry);
  }

  const sortNode = (node: FolderNode) => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    node.maps.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    node.folders.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

/** finds a node by path inside a tree */
export function findNode(node: FolderNode, path: string): FolderNode | null {
  if (node.path === path) return node;
  for (const child of node.folders) {
    const hit = findNode(child, path);
    if (hit) return hit;
  }
  return null;
}
