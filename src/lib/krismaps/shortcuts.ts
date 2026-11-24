/** Director View keyboard shortcuts. The mapping is pure so it can be tested. */

export type ShortcutAction =
  | "undoFog"
  | "redoFog"
  | "endTurn"
  | "nextRound"
  | "toolReveal"
  | "toolHide"
  | "toolPan"
  | "brushSmaller"
  | "brushBigger"
  | "help";

export const SHORTCUTS: Array<{ keys: string; action: ShortcutAction; label: string }> = [
  { keys: "Ctrl + Z", action: "undoFog", label: "Undo fog" },
  { keys: "Ctrl + Shift + Z  /  Ctrl + Y", action: "redoFog", label: "Redo fog" },
  { keys: "E", action: "endTurn", label: "End the active turn" },
  { keys: "N", action: "nextRound", label: "Start the next round (when everyone has acted)" },
  { keys: "R", action: "toolReveal", label: "Reveal brush" },
  { keys: "H", action: "toolHide", label: "Hide brush" },
  { keys: "V", action: "toolPan", label: "Pan / zoom" },
  { keys: "[  /  ]", action: "brushSmaller", label: "Smaller / bigger brush" },
  { keys: "?", action: "help", label: "Show these shortcuts" },
];

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** the element with focus when the key was pressed */
  target: unknown;
}

/** true while the user is typing into a field, where shortcuts must not fire */
export function isTyping(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean; type?: string };
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? "").toUpperCase();
  return tag === "TEXTAREA" || tag === "SELECT" || (tag === "INPUT" && el.type !== "checkbox");
}

export function shortcutFor(e: KeyLike): ShortcutAction | null {
  if (isTyping(e.target) || e.altKey) return null;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod) {
    if (key === "z") return e.shiftKey ? "redoFog" : "undoFog";
    if (key === "y") return "redoFog";
    return null;
  }
  switch (e.key) {
    case "e":
    case "E":
      return "endTurn";
    case "n":
    case "N":
      return "nextRound";
    case "r":
    case "R":
      return "toolReveal";
    case "h":
    case "H":
      return "toolHide";
    case "v":
    case "V":
      return "toolPan";
    case "[":
      return "brushSmaller";
    case "]":
      return "brushBigger";
    case "?":
      return "help";
  }
  return null;
}
