/**
 * Undo/redo history for painted fog, one history per map. A snapshot is the
 * fog mask's alpha channel only (~0.8 MB at the mask's 1024px long edge), so a
 * deep history stays cheap. Pure: the stage reads and writes the mask pixels.
 */
export type FogSnapshot = Uint8ClampedArray;

/** how many steps back each map keeps */
export const FOG_HISTORY_LIMIT = 30;

interface Stacks {
  undo: FogSnapshot[];
  redo: FogSnapshot[];
}

export class FogHistory {
  private maps = new Map<string, Stacks>();

  constructor(private limit = FOG_HISTORY_LIMIT) {}

  private stacks(key: string): Stacks {
    let s = this.maps.get(key);
    if (!s) {
      s = { undo: [], redo: [] };
      this.maps.set(key, s);
    }
    return s;
  }

  /** call with the mask as it is *before* a change; clears the redo stack */
  record(key: string, before: FogSnapshot) {
    const s = this.stacks(key);
    s.undo.push(before);
    if (s.undo.length > this.limit) s.undo.shift();
    s.redo = [];
  }

  /** returns the snapshot to restore, given the mask as it is now */
  undo(key: string, current: FogSnapshot): FogSnapshot | undefined {
    const s = this.stacks(key);
    const previous = s.undo.pop();
    if (previous) s.redo.push(current);
    return previous;
  }

  redo(key: string, current: FogSnapshot): FogSnapshot | undefined {
    const s = this.stacks(key);
    const next = s.redo.pop();
    if (next) s.undo.push(current);
    return next;
  }

  canUndo(key: string) {
    return (this.maps.get(key)?.undo.length ?? 0) > 0;
  }

  canRedo(key: string) {
    return (this.maps.get(key)?.redo.length ?? 0) > 0;
  }
}
