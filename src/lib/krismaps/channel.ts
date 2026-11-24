import type { InitiativeState } from "./initiative";
import type { FogMode, MapSettings, MediaKind, StrokePoint } from "./types";

export const CHANNEL_NAME = "krismaps";

export type KrisMessage =
  | { type: "hello" }
  | {
      type: "scene";
      path: string;
      name: string;
      kind: MediaKind;
      blob: Blob;
      settings: MapSettings;
      fog: Blob | null;
    }
  | { type: "settings"; settings: MapSettings }
  | { type: "stroke"; points: StrokePoint[]; radius: number; mode: FogMode }
  | { type: "fill"; mode: FogMode }
  /** the whole fog mask, e.g. after an undo */
  | { type: "fogMask"; fog: Blob }
  | { type: "initiative"; state: InitiativeState }
  | { type: "clear" };

export function createChannel(onMessage: (msg: KrisMessage) => void) {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<KrisMessage>) => onMessage(event.data);
  return {
    post: (msg: KrisMessage) => channel.postMessage(msg),
    close: () => channel.close(),
  };
}
