/**
 * Reads a Draw Steel monster stat block from OCR word boxes.
 *
 * Draw Steel stat blocks share one layout:
 *
 *   Rat King                                    Level 2 Leader         <- header line 1
 *   Beast, Ratfolk                                      EV 14          <- header line 2
 *   ───────────────────────────────────────────────────────────
 *     1S      5       90        1          4                           <- values
 *    Size   Speed   Stamina  Stability  Free Strike                    <- labels
 *
 * The parser anchors on the label row, which fixes the block's horizontal
 * extent. That's what makes a side-by-side screenshot read the left block and
 * a solo's second column get ignored. Values come from the line just above
 * each label; the header comes from the "Level" line above that. Minions say
 * "EV 6 for four minions", which gives the squad size.
 *
 * Pure: no OCR engine here, so it's unit-tested on recorded OCR output.
 */

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Organization = "Minion" | "Horde" | "Platoon" | "Elite" | "Leader" | "Solo";

export interface StatBlockRead {
  name?: string | undefined;
  stamina?: number | undefined;
  level?: number | undefined;
  organization?: Organization | undefined;
  /** e.g. "Artillery"; leaders and solos have none */
  role?: string | undefined;
  ev?: number | undefined;
  /** minions only: how many the EV is for ("EV 6 for four minions") */
  squadSize?: number | undefined;
  keywords?: string[] | undefined;
}

const ORGANIZATIONS: Organization[] = ["Minion", "Horde", "Platoon", "Elite", "Leader", "Solo"];
const ROLES = [
  "Ambusher",
  "Artillery",
  "Brute",
  "Controller",
  "Defender",
  "Harrier",
  "Hexer",
  "Mount",
  "Support",
];
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const centreX = (w: OcrWord) => (w.x0 + w.x1) / 2;
const centreY = (w: OcrWord) => (w.y0 + w.y1) / 2;

/** fixes the usual OCR digit confusions in something that should be a number */
export function readNumber(raw: string): number | undefined {
  const s = raw
    .trim()
    .replace(/[)(\].,:;'"|]+$/g, "")
    .replace(/^[([|]+/, "")
    .replace(/[Il|!]/g, "1")
    .replace(/[Oo]/g, "0")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/Z/g, "2");
  return /^\d{1,4}$/.test(s) ? Number(s) : undefined;
}

/** groups words into lines (by vertical centre), each sorted left to right */
export function toLines(words: OcrWord[]): OcrWord[][] {
  const lines: OcrWord[][] = [];
  for (const w of [...words].sort((a, b) => centreY(a) - centreY(b))) {
    const line = lines.find((l) => {
      const ref = l[0]!;
      const h = Math.max(ref.y1 - ref.y0, w.y1 - w.y0);
      return Math.abs(centreY(ref) - centreY(w)) <= h * 0.5;
    });
    if (line) line.push(w);
    else lines.push([w]);
  }
  for (const l of lines) l.sort((a, b) => a.x0 - b.x0);
  return lines.sort((a, b) => centreY(a[0]!) - centreY(b[0]!));
}

interface LabelRow {
  index: number;
  /** horizontal extent of the chosen stat block */
  x0: number;
  x1: number;
  labels: Record<"size" | "speed" | "stamina" | "stability" | "free", OcrWord | undefined>;
}

/** the leftmost stat block's Size … Free Strike label row */
function findLabelRow(lines: OcrWord[][]): LabelRow | undefined {
  for (const [index, line] of lines.entries()) {
    const staminas = line.filter((w) => letters(w.text) === "stamina");
    if (staminas.length === 0) continue;
    const known = line.filter((w) =>
      ["size", "speed", "stability", "free", "strike"].includes(letters(w.text)),
    );
    if (known.length < 2) continue;

    // side-by-side blocks: keep only the leftmost block's labels
    const stamina = staminas[0]!;
    const sizes = line.filter((w) => letters(w.text) === "size");
    const nextSize = sizes.find((w) => w.x0 > stamina.x1);
    const limit = nextSize ? nextSize.x0 : Infinity;
    const inBlock = line.filter((w) => w.x1 < limit);
    const pick = (name: string) => inBlock.find((w) => letters(w.text) === name);
    const labels = {
      size: pick("size"),
      speed: pick("speed"),
      stamina,
      stability: pick("stability"),
      free: pick("free") ?? pick("strike"),
    };
    const first = labels.size ?? labels.speed ?? stamina;
    const last = pick("strike") ?? labels.free ?? labels.stability ?? stamina;
    // the labels span most of the block; allow a margin for the header text
    const margin = (last.x1 - first.x0) * 0.12;
    return {
      index,
      x0: first.x0 - margin,
      x1: Math.min(last.x1 + margin, nextSize ? nextSize.x0 - margin / 2 : Infinity),
      labels,
    };
  }
  return undefined;
}

const within = (row: LabelRow) => (w: OcrWord) => centreX(w) >= row.x0 && centreX(w) <= row.x1;

/** the value printed above a label: nearest word above it, horizontally aligned */
function valueAbove(lines: OcrWord[][], row: LabelRow, label: OcrWord | undefined) {
  if (!label) return undefined;
  const width = Math.max(label.x1 - label.x0, (label.y1 - label.y0) * 2);
  for (let i = row.index - 1; i >= Math.max(0, row.index - 2); i--) {
    const hit = lines[i]!.filter((w) => Math.abs(centreX(w) - centreX(label)) <= width).sort(
      (a, b) => Math.abs(centreX(a) - centreX(label)) - Math.abs(centreX(b) - centreX(label)),
    )[0];
    if (hit) return hit;
  }
  return undefined;
}

const cleanName = (words: OcrWord[]) =>
  words
    .map((w) => w.text)
    .join(" ")
    .replace(/[^A-Za-z'’ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || undefined;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** "Level 4 Minion Artillery", tolerating "Level4", "Level1Solo" and similar */
function readTitle(tokens: string[]) {
  const text = tokens.join(" ");
  const m = /level\s*([0-9Il|]{1,2})/i.exec(text);
  const level = m ? readNumber(m[1]!) : undefined;
  const rest = letters(text.slice(m ? m.index + m[0].length : 0));
  const organization = ORGANIZATIONS.find((o) => rest.includes(o.toLowerCase()));
  const role = ROLES.find((r) => rest.includes(r.toLowerCase()));
  return { level, organization, role };
}

/** "EV 6", "EV12", "EVI2", "EV 6 for four minions" */
function readEv(tokens: string[]) {
  const text = tokens.join(" ");
  const m = /\bEV\s*([0-9Il|OoSB]{1,3})\b/.exec(text);
  const ev = m ? readNumber(m[1]!) : undefined;
  const squad = /for\s+(\w+)\s+minions?/i.exec(text);
  const squadSize = squad
    ? (NUMBER_WORDS[squad[1]!.toLowerCase()] ?? readNumber(squad[1]!))
    : undefined;
  return { ev, squadSize };
}

export function parseStatBlock(words: OcrWord[]): StatBlockRead {
  const clean = words.filter((w) => w.text.trim().length > 0);
  if (clean.length === 0) return {};
  const lines = toLines(clean);
  const row = findLabelRow(lines);
  const read: StatBlockRead = {};

  if (row) {
    const staminaWord = valueAbove(lines, row, row.labels.stamina);
    read.stamina = staminaWord ? readNumber(staminaWord.text) : undefined;
  }

  // header: the "Level …" line above the values, inside the block
  const inBlock = row ? within(row) : () => true;
  const above = row ? lines.slice(0, Math.max(0, row.index - 1)) : lines.slice(0, 4);
  const levelIndex = above.findIndex((l) => l.some((w) => inBlock(w) && /^level/i.test(w.text)));

  if (levelIndex >= 0) {
    const line = above[levelIndex]!.filter(inBlock);
    const levelWord = line.find((w) => /^level/i.test(w.text))!;
    read.name = cleanName(line.filter((w) => w.x1 <= levelWord.x0));
    const title = readTitle(line.filter((w) => w.x0 >= levelWord.x0).map((w) => w.text));
    Object.assign(read, title);

    const second = above[levelIndex + 1]?.filter(inBlock) ?? [];
    const evIndex = second.findIndex((w) => /^EV/.test(w.text));
    const { ev, squadSize } = readEv(second.slice(Math.max(0, evIndex)).map((w) => w.text));
    read.ev = evIndex >= 0 ? ev : undefined;
    read.squadSize = read.organization === "Minion" ? (squadSize ?? 4) : undefined;
    const keywordWords = evIndex >= 0 ? second.slice(0, evIndex) : second;
    const keywords = keywordWords
      .map((w) => w.text)
      .join(" ")
      .split(",")
      .map((k) => k.replace(/[^A-Za-z' -]/g, "").trim())
      .filter(Boolean)
      .map(titleCase);
    read.keywords = keywords.length ? keywords : undefined;
  } else {
    // no title line found: fall back to the tallest text near the top of the block
    const top = above
      .slice(0, 3)
      .map((l) => l.filter(inBlock))
      .filter((l) => l.length > 0)
      .sort((a, b) => b[0]!.y1 - b[0]!.y0 - (a[0]!.y1 - a[0]!.y0))[0];
    read.name = top ? cleanName(top) : undefined;
  }

  return read;
}
