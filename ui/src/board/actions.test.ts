import { describe, expect, it } from 'vitest';
import { boardActions, type BoardActionEmit } from './actions';
import type { Board, PublicGameRoom, PublicPlayer, SoldierObj } from 'common';

/**
 * Minimal sea board: a ship sits on sea vertex S, next to coast vertex C
 * (one land hex → a legal landing). Everything the catalog reads for the
 * ship selection lives here; extra fields fall back to the cast.
 */
const board = {
  vertices: {
    S: { id: 'S', position: { x: 0, y: 0 }, roadIds: ['SC'], hexIds: [], settlementId: null },
    C: { id: 'C', position: { x: 60, y: 0 }, roadIds: ['SC'], hexIds: ['H'], settlementId: null },
  },
  edges: {
    SC: { id: 'SC', vertexAId: 'S', vertexBId: 'C', roadId: null },
  },
  hexes: {
    H: { id: 'H', terrain: 'Hills', token: 6, robber: false },
  },
  soldiers: {} as Record<string, SoldierObj>,
  ships: {
    ship1: { id: 'ship1', vertexId: 'S', ownerId: 'me' },
  },
  settlements: {},
  roads: {},
} as unknown as Board;

const troop = (id: string, opts: Partial<SoldierObj> = {}): SoldierObj => ({
  id,
  owner: 'me',
  injured: false,
  type: 'infantry',
  stationed: false,
  vertexId: 'S',
  aboardShipId: 'ship1',
  ...opts,
});

const room = {
  board,
  shipsEnabled: true,
  cannonsEnabled: true,
  wallsEnabled: false,
  battleState: null,
  devCardChoice: null,
  turnState: {
    phase: 'Action',
    player: 'me',
    soldiersActedThisTurn: [],
    soldiersCreatedThisTurn: [],
    soldiersHealedThisTurn: [],
    robberFoughtThisPhase: [],
    shipSteps: { ship1: 2 },
    undoLog: [],
  },
} as unknown as PublicGameRoom;

const me = { name: 'me', resources: {}, freeRoadsLeft: 0 } as unknown as PublicPlayer;

const emit = new Proxy({} as BoardActionEmit, {
  get: () => () => {},
});

const shipActions = () =>
  boardActions({
    board,
    room,
    me,
    selection: { type: 'ship', id: 'ship1' },
    selectedSoldierIds: [],
    chainShot: false,
    coachKey: null,
    emit,
  });

describe('disembark bubble', () => {
  it('groups identical troops into one counted chip', () => {
    board.soldiers = {
      s1: troop('s1'),
      s2: troop('s2'),
      s3: troop('s3'),
    };
    const disembark = shipActions().find((a) => a.key === 'disembark');
    expect(disembark?.label).toBe('Disembark 3');
    // Two identical soldiers would render as two indistinguishable "Land
    // soldier" chips — one chip per kind with a count instead.
    expect(disembark?.choices?.map((c) => c.label)).toEqual(['Land soldier (3)']);
    expect(disembark?.choices?.[0].eligible).toBe(true);
  });

  it('keeps different kinds as separate chips', () => {
    board.soldiers = {
      s1: troop('s1'),
      s2: troop('s2', { injured: true }),
      s3: troop('s3', { type: 'cannon' }),
    };
    const disembark = shipActions().find((a) => a.key === 'disembark');
    expect(disembark?.choices?.map((c) => c.label)).toEqual([
      'Land soldier',
      'Land injured soldier',
      'Land cannon',
    ]);
  });

  it('names the kind it actually lands', () => {
    // First of the kind is spent → the chip runs the next eligible one.
    room.turnState.soldiersActedThisTurn = ['s1'];
    board.soldiers = { s1: troop('s1'), s2: troop('s2') };
    const disembark = shipActions().find((a) => a.key === 'disembark');
    expect(disembark?.choices).toHaveLength(1);
    let landed: string | null = null;
    const spy = { ...emit, setDisembarkingSoldierId: (id: string) => (landed = id) };
    boardActions({
      board,
      room,
      me,
      selection: { type: 'ship', id: 'ship1' },
      selectedSoldierIds: [],
      chainShot: false,
      coachKey: null,
      emit: spy as BoardActionEmit,
    })
      .find((a) => a.key === 'disembark')
      ?.choices?.[0].run();
    expect(landed).toBe('s2');
    room.turnState.soldiersActedThisTurn = [];
  });
});
