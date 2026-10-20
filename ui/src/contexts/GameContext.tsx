import React, { createContext, useContext, useMemo, useState } from 'react';
import { PublicGameRoom, PublicPlayer } from 'common';
import { SelectableObject } from '../types';

/**
 * The game state, split so a room broadcast only re-renders what reads it:
 *  - RoomState  — the server-mirrored room + this socket's seat (the common case).
 *  - Selection  — the board click state; its churn stays off the room readers.
 *  - Chrome     — the transient toast text.
 *  - Actions    — the setters (stable identities; subscribers never re-render).
 * Commands that don't need a render at all (refit the board, open the trade
 * window, fly spent resources) go through `effects.ts` instead of context.
 */

interface RoomStateValue {
  gameRoom: PublicGameRoom | null;
  currentPlayer: PublicPlayer | null;
}

interface SelectionValue {
  selectedObject: SelectableObject | null;
  /** Soldiers picked (by tapping them on the map) for a group action on the selected vertex. */
  selectedSoldierIds: string[];
  /** Sail pick-mode: this ship is waiting for a highlighted water vertex click. */
  sailingShipId: string | null;
}

interface ChromeValue {
  /** Transient red error toast (bottom-center), same one server errors use. */
  toast: string | null;
}

interface GameActionsValue {
  setGameRoom: React.Dispatch<React.SetStateAction<PublicGameRoom | null>>;
  setCurrentPlayer: React.Dispatch<React.SetStateAction<PublicPlayer | null>>;
  setSelectedObject: React.Dispatch<React.SetStateAction<SelectableObject | null>>;
  setSelectedSoldierIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSailingShipId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (message: string | null) => void;
  /** Drop the room + seat locally (leaving the game or a server "not in room" push). */
  clearRoomState: () => void;
}

const RoomStateContext = createContext<RoomStateValue | undefined>(undefined);
const SelectionContext = createContext<SelectionValue | undefined>(undefined);
const ChromeContext = createContext<ChromeValue | undefined>(undefined);
const GameActionsContext = createContext<GameActionsValue | undefined>(undefined);

export const GameRoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameRoom, setGameRoom] = useState<PublicGameRoom | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<PublicPlayer | null>(null);
  const [selectedObject, setSelectedObject] = useState<SelectableObject | null>(null);
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<string[]>([]);
  const [sailingShipId, setSailingShipId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const roomState = useMemo(() => ({ gameRoom, currentPlayer }), [gameRoom, currentPlayer]);
  const selection = useMemo(
    () => ({ selectedObject, selectedSoldierIds, sailingShipId }),
    [selectedObject, selectedSoldierIds, sailingShipId]
  );
  const chrome = useMemo(() => ({ toast }), [toast]);
  const actions = useMemo<GameActionsValue>(
    () => ({
      setGameRoom,
      setCurrentPlayer,
      setSelectedObject: (next) => {
        // A new selection cancels sail pick mode.
        setSailingShipId(null);
        setSelectedObject(next);
      },
      setSelectedSoldierIds,
      setSailingShipId,
      showToast: setToast,
      clearRoomState: () => {
        setGameRoom(null);
        setCurrentPlayer(null);
      },
    }),
    []
  );

  return (
    <RoomStateContext.Provider value={roomState}>
      <SelectionContext.Provider value={selection}>
        <ChromeContext.Provider value={chrome}>
          <GameActionsContext.Provider value={actions}>{children}</GameActionsContext.Provider>
        </ChromeContext.Provider>
      </SelectionContext.Provider>
    </RoomStateContext.Provider>
  );
};

/** The room + this seat: the read model every room subscriber needs. */
export const useGameState = (): RoomStateValue => {
  const ctx = useContext(RoomStateContext);
  if (!ctx) throw new Error('useGameState must be used within a GameRoomProvider');
  return ctx;
};

/** The board click state: the selected object and soldier picks. */
export const useSelection = (): SelectionValue => {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a GameRoomProvider');
  return ctx;
};

/** Chrome state: the transient toast text. */
export const useChrome = (): ChromeValue => {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error('useChrome must be used within a GameRoomProvider');
  return ctx;
};

/** The setters: stable identities, so action-only callers never re-render. */
export const useGameActions = (): GameActionsValue => {
  const ctx = useContext(GameActionsContext);
  if (!ctx) throw new Error('useGameActions must be used within a GameRoomProvider');
  return ctx;
};

/**
 * Memoized player lookups — the single seam for "who is X". Replaces both
 * `players.find(p => p.name === n)` scans and `playerColorMap(room)` calls.
 * Returns stable helpers; `playerByName`/`colorOf` never re-render a caller
 * that only reads them inside callbacks… they do re-render on room change
 * (same as useGameState, which they wrap).
 */
export const usePlayers = (): {
  playerByName: (name: string | null | undefined) => PublicPlayer | undefined;
  colorOf: (name: string | null | undefined) => string | undefined;
} => {
  const { gameRoom } = useGameState();
  return useMemo(() => {
    const byName: Record<string, PublicPlayer> = Object.fromEntries(
      (gameRoom?.players ?? []).map((p) => [p.name, p])
    );
    return {
      playerByName: (name) => (name == null ? undefined : byName[name]),
      colorOf: (name) => (name == null ? undefined : byName[name]?.color),
    };
  }, [gameRoom]);
};
