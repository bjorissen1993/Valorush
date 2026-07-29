import { useSyncExternalStore } from "react";
import {
  boardLayout,
  getBoardLayoutEpoch,
  subscribeBoardLayout,
  type BoardNode,
} from "../game/boardLayout";

/** Re-render when the live boardLayout is mutated by the editor / storage. */
export function useBoardLayout(): BoardNode[] {
  useSyncExternalStore(
    subscribeBoardLayout,
    getBoardLayoutEpoch,
    getBoardLayoutEpoch
  );
  return boardLayout;
}

export function useBoardLayoutEpoch(): number {
  return useSyncExternalStore(
    subscribeBoardLayout,
    getBoardLayoutEpoch,
    getBoardLayoutEpoch
  );
}
