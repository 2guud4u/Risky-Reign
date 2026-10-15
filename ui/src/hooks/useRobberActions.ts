import { adjacentHexIds, Board, BuildCheck, canMoveRobberAdjacent, ResourceKey } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { useBuildRules } from './useBuildRules';
import { actableSoldierIds } from '../utils/soldierActions';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import { hexDirectionOf } from '../utils/direction';
import { SoldierAction, SoldierActionChoice } from './useSoldierActions';

const ALLOWED: BuildCheck = { allowed: true, reason: null };

/** A short label for a vertex next to the robber: its other hex tokens. */
const vertexLabel = (board: Board, vertexId: string, robberHexId: string): string => {
  const tokens =
    board.vertices[vertexId]?.hexIds
      .filter((id) => id !== robberHexId)
      .map((id) => board.hexes[id])
      .map((h) =>
        h && h.rollNumber != null ? `${h.rollNumber}${RESOURCE_ICONS[h.terrain as ResourceKey] ?? ''}` : null
      )
      .filter(Boolean) ?? [];
  return tokens.length > 0 ? tokens.join(' ') : 'this vertex';
};

/**
 * The robber's own action bubbles (click the robber on the map):
 * - Attack: a 1v1 robber fight, expanded as a column — one chip per vertex
 *   next to the robber where one of your soldiers can fight. Greyed with the
 *   backend's reason when nobody can.
 * - Move: with a pending move (rolled 7, played Knight, won fight) one click
 *   zooms the board out so every highlighted target hex fits; otherwise it
 *   confirms spending a Knight card for the same move. Greyed when neither
 *   applies.
 */
export function useRobberActions(board: Board, robberHexId: string): SoldierAction[] {
  const { gameRoom, currentPlayer, requestBoardFit } = useGameRoom();
  const { fightRobber, playDevelopmentCard, chooseKnightEffect, moveRobberAfterWin } = useSocket();
  const { fightRobberCheck } = useBuildRules(board);

  const actions: SoldierAction[] = [];
  if (!gameRoom || !currentPlayer) return actions;

  const name = currentPlayer.name;
  const turn = gameRoom.turnState;
  const isMyTurn = turn.player === name;
  const robberPending = gameRoom.robberMove?.player === name;
  const winPending = gameRoom.robberDefeatedBy?.playerName === name;

  // ---- Attack (1v1 robber fight) ----
  // Candidates: my soldiers on any vertex touching the robber's hex.
  const adjacentVertexIds = Object.values(board.vertices)
    .filter((v) => v.hexIds.includes(robberHexId))
    .map((v) => v.id);
  const perVertex = adjacentVertexIds
    .map((vertexId) => {
      const ids = actableSoldierIds(gameRoom, name, vertexId);
      const fighter = ids.find((id) => fightRobberCheck(id, vertexId).allowed);
      return { vertexId, fighter, firstCheck: ids.length > 0 ? fightRobberCheck(ids[0], vertexId) : null };
    })
    .filter((v) => v.fighter || v.firstCheck);
  const choices: SoldierActionChoice[] = perVertex
    .filter((v) => v.fighter)
    .map((v) => ({
      key: `attack-${v.vertexId}`,
      icon: '⚔️',
      label: vertexLabel(board, v.vertexId, robberHexId),
      costText: '1 soldier',
      check: ALLOWED,
      run: () => fightRobber(v.fighter!, v.vertexId, gameRoom.id),
      eligible: true,
    }));
  const attackCheck: BuildCheck = choices.length
    ? ALLOWED
    : winPending
      ? { allowed: false, reason: 'You won — move the robber one hex over' }
      : gameRoom.battleState
        ? { allowed: false, reason: 'A battle is already in progress' }
        : turn.phase !== 'Action'
          ? { allowed: false, reason: 'Can only fight the robber during Action phase' }
          : !isMyTurn
            ? { allowed: false, reason: 'Not your turn to act' }
            : adjacentVertexIds.every((v) => actableSoldierIds(gameRoom, name, v).length === 0)
              ? { allowed: false, reason: 'None of your soldiers is next to the robber' }
              : perVertex.find((v) => v.firstCheck)?.firstCheck ??
                { allowed: false, reason: 'No soldier can fight the robber' };
  actions.push({
    key: 'attack',
    kind: 'attack',
    label: 'Attack',
    costText: 'Pick a soldier to fight',
    check: attackCheck,
    run: () => {}, // expanded bubble: a soldier is picked instead
    choices,
    // choices pop leftward — see ActionBubbles.
  });

  // ---- Move ----
  if (winPending) {
    // After defeating the robber it can only move ONE hex over (Rule:
    // "move robber 1 tile away of their choosing") — so the bubble expands
    // into direction-arrow chips like a soldier move, one per legal target.
    const choice = gameRoom.robberDefeatedBy!;
    const moveChoices: SoldierActionChoice[] = adjacentHexIds(board, choice.fromHexId)
      .filter((hexId) => canMoveRobberAdjacent(board, choice.fromHexId, hexId).allowed)
      .map((hexId) => {
        const hex = board.hexes[hexId];
        const { direction, angle } = hexDirectionOf(
          board.hexes[choice.fromHexId].coord,
          hex.coord
        );
        const where = `${hex.terrain}${hex.rollNumber !== null ? ` ${hex.rollNumber}` : ''}`;
        return {
          key: `robber-move-${hexId}`,
          icon: '', // direction arrows are SVG, not emoji
          label: `Move robber ${direction} to ${where}`,
          costText: `${direction} · ${where}`,
          check: ALLOWED,
          run: () => moveRobberAfterWin(hexId, gameRoom.id),
          eligible: true,
          direction,
          angle,
        };
      });
    actions.push({
      key: 'move',
      kind: 'move',
      label: 'Move',
      costText: 'Pick a direction',
      check: moveChoices.length ? ALLOWED : { allowed: false, reason: 'No legal hex next to the robber' },
      run: requestBoardFit,
      choices: moveChoices,
    });
  } else if (robberPending) {
    // Rolled 7 or played Knight: any hex is legal — no direction list can
    // cover that, so the bubble just zooms out to the highlighted targets.
    actions.push({
      key: 'move',
      kind: 'move',
      label: 'Move',
      costText: 'Pick a highlighted hex',
      check: ALLOWED,
      run: requestBoardFit,
    });
  } else {
    const cards = currentPlayer.developmentCards;
    const knightIndex = cards.findIndex(
      (card, i) => card === 'knight' && i < cards.length - currentPlayer.devCardsBoughtThisTurn
    );
    const moveCheck: BuildCheck =
      !isMyTurn
        ? { allowed: false, reason: 'Only on your turn' }
        : gameRoom.battleState
          ? { allowed: false, reason: 'A battle is already in progress' }
          : gameRoom.devCardChoice
            ? { allowed: false, reason: 'Resolve your card choice first' }
            : knightIndex === -1
              ? { allowed: false, reason: 'You need a Knight card to move the robber' }
              : ALLOWED;
    actions.push({
      key: 'move',
      kind: 'move',
      label: 'Move',
      costText: knightIndex !== -1 ? '🛡️ Knight card' : 'Knight card',
      check: moveCheck,
      run: () => {
        if (knightIndex === -1) return;
        // Play the Knight, pick its robber effect, then zoom out to the
        // highlighted targets (server ordering makes the choice legal).
        playDevelopmentCard(gameRoom.id, knightIndex);
        chooseKnightEffect(gameRoom.id, 'robber');
        requestBoardFit();
      },
    });
  }

  return actions;
}


