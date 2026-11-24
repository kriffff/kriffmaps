export interface ParsedEntry {
  name: string;
  count: number;
  stamina: number;
}

/**
 * Parses fast-entry shorthand: "Goblins x4 40", "4x Goblins 40", "Kris 62".
 * Count and Stamina are both optional and order tolerant; with two bare
 * numbers the first is the count.
 */
export function parseEntry(input: string): ParsedEntry | null {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  let count = 1;
  let stamina = 0;
  const words: string[] = [];
  const numbers: number[] = [];

  for (const token of tokens) {
    const mult = /^(?:x(\d+)|(\d+)x)$/i.exec(token);
    if (mult) {
      count = Number(mult[1] ?? mult[2]) || 1;
      continue;
    }
    if (/^\d+$/.test(token)) {
      numbers.push(Number(token));
      continue;
    }
    words.push(token);
  }

  if (numbers.length === 1) stamina = numbers[0]!;
  else if (numbers.length >= 2) {
    count = numbers[0]!;
    stamina = numbers[1]!;
  }

  const name = words.join(" ").trim();
  if (!name) return null;
  return { name, count: Math.max(1, count), stamina: Math.max(0, stamina) };
}
