import { useCallback, useEffect, useRef, useState } from "react";

import { STORE_STATE, idbGet, idbSet } from "./db";

const KEY = "heroRoster";

export interface RosterHero {
  name: string;
  hp: number;
}

/**
 * Remembered heroes: every hero typed into initiative is kept here so it can be
 * re-added with one click in later sessions.
 */
export function useHeroRoster() {
  const [heroes, setHeroes] = useState<RosterHero[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    idbGet<RosterHero[]>(STORE_STATE, KEY)
      .then((stored) => {
        if (Array.isArray(stored)) setHeroes(stored);
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
  }, []);

  const persist = useCallback((next: RosterHero[]) => {
    setHeroes(next);
    if (loaded.current) void idbSet(STORE_STATE, KEY, next).catch(() => undefined);
  }, []);

  const remember = useCallback((name: string, hp: number) => {
    const clean = name.trim();
    if (!clean) return;
    setHeroes((prev) => {
      const index = prev.findIndex((h) => h.name.toLowerCase() === clean.toLowerCase());
      const next =
        index >= 0
          ? prev.map((h, i) => (i === index ? { name: clean, hp } : h))
          : [...prev, { name: clean, hp }].sort((a, b) => a.name.localeCompare(b.name));
      if (loaded.current) void idbSet(STORE_STATE, KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  const forget = useCallback((name: string) => {
    setHeroes((prev) => {
      const next = prev.filter((h) => h.name !== name);
      if (loaded.current) void idbSet(STORE_STATE, KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  return { heroes, remember, forget, persist };
}

const MONSTER_KEY = "monsterStamina";

/**
 * Remembered monster Stamina: every enemy whose max Stamina is typed or read by
 * OCR is kept here, so re-adding that monster later starts at full health.
 */
export function useMonsterMemory() {
  const [monsters, setMonsters] = useState<Record<string, number>>({});
  const ref = useRef<Record<string, number>>({});
  const loaded = useRef(false);

  useEffect(() => {
    idbGet<Record<string, number>>(STORE_STATE, MONSTER_KEY)
      .then((stored) => {
        if (stored && typeof stored === "object") {
          ref.current = stored;
          setMonsters(stored);
        }
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
  }, []);

  const remember = useCallback((name: string, maxHp: number) => {
    const key = name.trim().toLowerCase();
    if (!key || maxHp <= 0 || ref.current[key] === maxHp) return;
    const next = { ...ref.current, [key]: maxHp };
    ref.current = next;
    setMonsters(next);
    if (loaded.current) void idbSet(STORE_STATE, MONSTER_KEY, next).catch(() => undefined);
  }, []);

  const lookup = useCallback((name: string) => ref.current[name.trim().toLowerCase()] ?? 0, []);

  /** moves remembered Stamina to a new name, e.g. when the user renames a monster */
  const rename = useCallback((from: string, to: string) => {
    const a = from.trim().toLowerCase();
    const b = to.trim().toLowerCase();
    if (!a || !b || a === b || !(a in ref.current)) return;
    const next = { ...ref.current, [b]: ref.current[a]! };
    delete next[a];
    ref.current = next;
    setMonsters(next);
    if (loaded.current) void idbSet(STORE_STATE, MONSTER_KEY, next).catch(() => undefined);
  }, []);

  const forget = useCallback((name: string) => {
    const key = name.trim().toLowerCase();
    if (!(key in ref.current)) return;
    const next = { ...ref.current };
    delete next[key];
    ref.current = next;
    setMonsters(next);
    if (loaded.current) void idbSet(STORE_STATE, MONSTER_KEY, next).catch(() => undefined);
  }, []);

  return { monsters, remember, lookup, rename, forget };
}
