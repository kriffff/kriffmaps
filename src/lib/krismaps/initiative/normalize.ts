/**
 * Turns anything loaded from storage, a backup or the BroadcastChannel into a
 * valid InitiativeState. Unknown or older shapes fall back to an empty
 * encounter, keeping the overlay layout and mode where they can be read.
 */
import {
  STATE_VERSION,
  defaultLayout,
  emptyInitiative,
  type Condition,
  type Group,
  type InitiativeState,
  type Member,
  type OverlayLayout,
  type Side,
} from "./model";
import { repair } from "./reducer";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const nat = (v: unknown, fallback = 0) => Math.max(0, Math.floor(num(v, fallback)));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const side = (v: unknown): Side | null => (v === "hero" || v === "enemy" ? v : null);

function layout(v: unknown): OverlayLayout {
  if (!isRec(v)) return defaultLayout;
  const rotation = [0, 90, 180, 270].includes(v["rotation"] as number)
    ? (v["rotation"] as OverlayLayout["rotation"])
    : defaultLayout.rotation;
  return {
    visible: typeof v["visible"] === "boolean" ? v["visible"] : defaultLayout.visible,
    orientation: v["orientation"] === "horizontal" ? "horizontal" : "vertical",
    scale: Math.min(2, Math.max(0.5, num(v["scale"], 1))),
    rotation,
    x: Math.min(1, Math.max(0, num(v["x"], defaultLayout.x))),
    y: Math.min(1, Math.max(0, num(v["y"], defaultLayout.y))),
  };
}

function member(v: unknown): Member | null {
  if (!isRec(v) || !str(v["id"]) || !str(v["name"]).trim()) return null;
  const info = str(v["info"]).trim();
  const conditions = Array.isArray(v["conditions"])
    ? v["conditions"].flatMap((c): Condition[] => {
        if (!isRec(c) || !str(c["id"]) || !str(c["name"]).trim()) return [];
        const duration =
          c["duration"] === "eot" || c["duration"] === "save" ? c["duration"] : "manual";
        return [
          {
            id: str(c["id"]),
            name: str(c["name"]).trim(),
            duration,
            ...(duration === "save" && c["saveDue"] === true ? { saveDue: true } : {}),
          },
        ];
      })
    : [];
  const base = {
    id: str(v["id"]),
    name: str(v["name"]).trim(),
    maxStamina: nat(v["maxStamina"]),
    ...(info ? { info } : {}),
    ...(conditions.length ? { conditions } : {}),
  };
  if (v["kind"] === "minions") {
    const count = Math.max(1, nat(v["count"], 1));
    const pool = nat(v["pool"]);
    return {
      ...base,
      kind: "minions",
      count,
      pool: base.maxStamina > 0 ? Math.min(pool, count * base.maxStamina) : pool,
    };
  }
  if (v["kind"] === "creatures" && Array.isArray(v["stamina"]) && v["stamina"].length > 0) {
    const stamina = v["stamina"].map((s) =>
      base.maxStamina > 0 ? Math.min(nat(s), base.maxStamina) : nat(s),
    );
    return { ...base, kind: "creatures", stamina };
  }
  return null;
}

function groupOf(v: unknown): Group | null {
  if (!isRec(v) || !str(v["id"])) return null;
  const s = side(v["side"]);
  const members = Array.isArray(v["members"])
    ? v["members"].map(member).filter((m): m is Member => m !== null)
    : [];
  if (!s || members.length === 0) return null;
  const turns = Math.max(1, nat(v["turns"], 1));
  // states saved before solo turns existed only have "acted"
  const taken = v["turnsTaken"] === undefined && v["acted"] === true ? turns : nat(v["turnsTaken"]);
  return {
    id: str(v["id"]),
    side: s,
    members,
    acted: v["acted"] === true,
    ...(turns > 1 ? { turns } : {}),
    ...(taken > 0 ? { turnsTaken: taken } : {}),
  };
}

export function normalizeInitiative(raw: unknown): InitiativeState {
  if (!isRec(raw)) return emptyInitiative;
  const mode = raw["mode"] === "dnd" ? "dnd" : "drawsteel";
  const base: InitiativeState = { ...emptyInitiative, mode, layout: layout(raw["layout"]) };
  // older saved shapes (version 1, from the Lovable build) start a fresh encounter
  if (raw["version"] !== STATE_VERSION) return base;

  const seen = new Set<string>();
  const groups = (Array.isArray(raw["groups"]) ? raw["groups"] : [])
    .map(groupOf)
    .filter((g): g is Group => g !== null && !seen.has(g.id) && (seen.add(g.id), true));
  const id = (v: unknown) => (typeof v === "string" ? v : null);
  return repair({
    ...base,
    groups,
    round: Math.max(1, nat(raw["round"], 1)),
    firstSide: side(raw["firstSide"]),
    activeId: id(raw["activeId"]),
    lastSide: side(raw["lastSide"]),
    lastGroupId: id(raw["lastGroupId"]),
    goNextId: id(raw["goNextId"]),
    malice: nat(raw["malice"]),
    victories: nat(raw["victories"]),
  });
}
