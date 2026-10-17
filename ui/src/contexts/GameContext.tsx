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
  const [toast, setToast] = useState<string | null>(null);

  const roomState = useMemo(() => ({ gameRoom, currentPlayer }), [gameRoom, currentPlayer]);
  const selection = useMemo(
    () => ({ selectedObject, selectedSoldierIds }),
    [selectedObject, selectedSoldierIds]
  );
  const chrome = useMemo(() => ({ toast }), [toast]);
  const actions = useMemo<GameActionsValue>(
    () => ({
      setGameRoom,
      setCurrentPlayer,
      setSelectedObject,
      setSelectedSoldierIds,
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
