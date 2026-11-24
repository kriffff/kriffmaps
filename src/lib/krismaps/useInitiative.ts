import { useCallback, useEffect, useRef, useState } from "react";

import { createChannel } from "./channel";
import { STORE_STATE, idbGet, idbSet } from "./db";
import {
  emptyInitiative,
  initiativeReducer,
  normalizeInitiative,
  type InitiativeAction,
  type InitiativeState,
} from "./initiative";

const KEY = "initiative";

/**
 * Director-side initiative state: changed only through `dispatch`, persisted
 * to IndexedDB and broadcast to the Map View on every change.
 */
export function useInitiative() {
  const [state, setState] = useState<InitiativeState>(emptyInitiative);
  const stateRef = useRef(state);
  stateRef.current = state;
  const channelRef = useRef<ReturnType<typeof createChannel> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    idbGet<unknown>(STORE_STATE, KEY)
      .then((stored) => {
        if (stored !== undefined) setState(normalizeInitiative(stored));
      })
      .catch(() => undefined)
      .finally(() => {
        loadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    const channel = createChannel((msg) => {
      if (msg.type === "hello") channel.post({ type: "initiative", state: stateRef.current });
    });
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    channelRef.current?.post({ type: "initiative", state });
    if (loadedRef.current) void idbSet(STORE_STATE, KEY, state).catch(() => undefined);
  }, [state]);

  const dispatch = useCallback(
    (action: InitiativeAction) => setState((prev) => initiativeReducer(prev, action)),
    [],
  );

  return { state, dispatch };
}
