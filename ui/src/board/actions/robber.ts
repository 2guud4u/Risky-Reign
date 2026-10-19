import type { Board, BuildCheck } from 'common';
import { BubbleAction } from '../../components/board/ActionBubbles';
import { actableSoldierIds, robberTargets } from '../selectors';
import { hexDirectionOf } from '../../utils/direction';
import { emitEffect } from '../../effects';
import { BoardActionsInput, ALLOWED } from './types';
import { BoardRules } from './rules';

/** A short label for a vertex next to the robber: its other hex tokens. */
const vertexLabel = (board: Board, vertexId: string, robberHexId: string): string => {
  const tokens =
    board.vertices[vertexId]?.hexIds
      .filter((id) => id !== robberHexId)
      .map((id) => board.hexes[id])
      .map((h) => (h && h.rollNumber != null ? `${h.rollNumber} ${h.terrain}` : null))
      .filter(Boolean) ?? [];
  return tokens.length > 0 ? tokens.join(' ') : 'this vertex';
};

/**
 * The robber's own bubbles (click the robber on the map):
 * - Attack: a 1v1 robber fight, expanded as a column — one chip per vertex
 *   next to the robber where one of your soldiers can fight. Greyed with the
 *   backend's reason when nobody can.
 * - Move: with a pending move (rolled 7, played Knight, won fight) one click
 *   zooms the board out so every highlighted target hex fits; after a won
 *   fight the move is one-hex-only, so it expands into direction chips like
 *   a soldier move; otherwise it confirms spending a Knight card for the
 *   same move. Greyed when neither applies.
 */
export const robberActions = (
  input: BoardActionsInput,
  robberHexId: string,
  rules: BoardRules
): BubbleAction[] => {
  const { room, board, me, emit } = input;
  const actions: BubbleAction[] = [];

  const name = me.name;
  const turn = room.turnState;
  const isMyTurn = turn.player === name;
  const robberPending = room.robberMove?.player === name;
  const winPending = room.robberDefeatedBy?.playerName === name;

  // ---- Attack (1v1 robber fight) ----
  // Candidates: my soldiers on any vertex touching the robber's hex.
  const adjacentVertexIds = Object.values(board.vertices)
    .filter((v) => v.hexIds.includes(robberHexId))
    .map((v) => v.id);
  const perVertex = adjacentVertexIds
    .map((vertexId) => {
      const ids = actableSoldierIds(room, name, vertexId);
      const fighter = ids.find((id) => rules.fightRobberCheck(id, vertexId).allowed);
      return {
        vertexId,
        fighter,
        firstCheck: ids.length > 0 ? rules.fightRobberCheck(ids[0], vertexId) : null,
      };
    })
    .filter((v) => v.fighter || v.firstCheck);
  const fightChoices: BubbleAction[] = perVertex
    .filter((v) => v.fighter)
    .map((v) => ({
      key: `attack-${v.vertexId}`,
      icon: 'attack',
      label: vertexLabel(board, v.vertexId, robberHexId),
      costText: '1 soldier',
      check: ALLOWED,
      run: () => emit.fightRobber(v.fighter!, v.vertexId),
      eligible: true,
    }));
  const fightCheck: BuildCheck = fightChoices.length
    ? ALLOWED
    : winPending
      ? { allowed: false, reason: 'You won — move the robber one hex over' }
      : room.battleState
        ? { allowed: false, reason: 'A battle is already in progress' }
        : turn.phase !== 'Action'
          ? { allowed: false, reason: 'Can only fight the robber during Action phase' }
          : !isMyTurn
            ? { allowed: false, reason: 'Not your turn to act' }
            : adjacentVertexIds.every((v) => actableSoldierIds(room, name, v).length === 0)
              ? { allowed: false, reason: 'None of your soldiers is next to the robber' }
              : perVertex.find((v) => v.firstCheck)?.firstCheck ??
                { allowed: false, reason: 'No soldier can fight the robber' };
  actions.push({
    key: 'attack',
    icon: 'attack',
    label: 'Attack',
    costText: 'Pick a soldier to fight',
    check: fightCheck,
    run: () => {}, // expanded bubble: a soldier is picked instead
    choices: fightChoices,
    family: 'combat',
  });

  // ---- Move ----
  if (winPending) {
    // After defeating the robber it can only move ONE hex over (Rule:
    // "move robber 1 tile away of their choosing") — so the bubble expands
    // into direction-arrow chips like a soldier move, one per legal target.
    const defeated = room.robberDefeatedBy!;
    const moveChoices: BubbleAction[] = robberTargets(board, defeated.fromHexId)
      .map((hexId) => {
        const hex = board.hexes[hexId];
        const { direction, angle } = hexDirectionOf(
          board.hexes[defeated.fromHexId].coord,
          hex.coord
        );
        const where = `${hex.terrain}${hex.rollNumber !== null ? ` ${hex.rollNumber}` : ''}`;
        return {
          key: `robber-move-${hexId}`,
          icon: 'robber', // direction arrows are SVG, not emoji
          label: `Move robber ${direction} to ${where}`,
          costText: `${direction} · ${where}`,
          check: ALLOWED,
          run: () => emit.moveRobberAfterWin(hexId),
          eligible: true,
          direction,
          angle,
        };
      });
    actions.push({
      key: 'move',
      icon: 'robber',
      label: 'Move',
      costText: 'Pick a direction',
      check: moveChoices.length ? ALLOWED : { allowed: false, reason: 'No legal hex next to the robber' },
      run: () => emitEffect('boardFit'),
      choices: moveChoices,
      family: 'combat',
    });
  } else if (robberPending) {
    // Rolled 7 or played Knight: any hex is legal — no direction list can
    // cover that, so the bubble just zooms out to the highlighted targets.
    actions.push({
      key: 'move',
      icon: 'robber',
      label: 'Move',
      costText: 'Pick a highlighted hex',
      check: ALLOWED,
      run: () => emitEffect('boardFit'),
      family: 'combat',
    });
  } else {
    const cards = me.developmentCards;
    const knightIndex = cards.findIndex(
      (card, i) => card === 'knight' && i < cards.length - me.devCardsBoughtThisTurn
    );
    const moveCheck: BuildCheck =
      !isMyTurn
        ? { allowed: false, reason: 'Only on your turn' }
        : room.battleState
          ? { allowed: false, reason: 'A battle is already in progress' }
          : room.devCardChoice
            ? { allowed: false, reason: 'Resolve your card choice first' }
            : knightIndex === -1
              ? { allowed: false, reason: 'You need a Knight card to move the robber' }
              : ALLOWED;
    actions.push({
      key: 'move',
      icon: 'robber',
      label: 'Move',
      costText: 'Knight card',
      check: moveCheck,
      run: () => {
        if (knightIndex === -1) return;
        // Play the Knight, pick its robber effect, then zoom out to the
        // highlighted targets (server ordering makes the choice legal).
        emit.playDevelopmentCard(knightIndex);
        emit.chooseKnightEffect('robber');
        emitEffect('boardFit');
      },
      family: 'combat',
    });
  }

  return actions;
};
