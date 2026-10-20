import React, { useEffect, useMemo, useState } from 'react';
import { useGameState } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import { nothingBuildable } from '../../board/actions';
import { actableSoldierIds } from '../../board/selectors';
import { useTutorialHints } from '../../utils/tutorial';
import GameIcon from '../../components/ui/GameIcon';
import Button from '../../components/ui/Button';

/**
 * Turn controls. SetUp and Dice phases advance automatically (setup once the
 * settlement + road are placed, dice once both dice are rolled), so they show
 * an info tip instead of an end-turn button.
 */
const EndTurnButton: React.FC<{ variant?: 'panel' | 'snackbar' }> = ({ variant = 'panel' }) => {
  const { gameRoom, currentPlayer } = useGameState();
  const { endTurn: onEndTurn } = useSocket();
  const snack = variant === 'snackbar';
  const hintsOn = useTutorialHints();
  const nothingToBuild = useMemo(
    () => (gameRoom && currentPlayer ? nothingBuildable(gameRoom, currentPlayer) : false),
    // Recomputed only when the broadcast room changes.
    [gameRoom, currentPlayer]
  );

  // Phase countdown: ticks once a second off the server-broadcast deadline.
  // The server clears `phaseTimerEndsAt` while a battle is open, so the chip
  // disappears during fights and resumes with the remaining time after.
  const endsAt = gameRoom?.phaseTimerEndsAt ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  const secsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  // Label for the manual-advance phases (derived at render time).
  const phaseText = (phase: string): string => {
    switch (phase) {
      case 'Build':
        return 'End Build Phase';
      case 'Action':
        return 'End Action Phase';
      default:
        return 'End Turn';
    }
  };

  const handleClick = () => {
    if (!gameRoom) return;
    // Rolling the dice is done in the DiceDisplay (one die per click);
    // only advances the phase. The server derives the acting player from the
    // socket, so no playerId is sent.
    onEndTurn();
  };

  const isMyTurn = !!(gameRoom && currentPlayer && gameRoom.turnState.player === currentPlayer.name);

  if (!gameRoom || !gameRoom.turnState || !currentPlayer) return null;

  // Soldiers of the current player who still have an unspent action this
  // Action phase (not yet acted, not just created). Shown as a warning when
  // ending the phase.
  const soldiersWithActionsLeft = actableSoldierIds(gameRoom, currentPlayer.name).length;

  // SetUp: show a hint of what's still needed instead of an end-turn button.
  if (gameRoom.turnState.phase === 'SetUp') {
    const needs = [
      gameRoom.turnState.placedSettlement ? null : 'settlement',
      gameRoom.turnState.placedRoad ? null : 'road',
    ].filter(Boolean);

    // Round 1 = offsets 0..N-1, round 2 = offsets N..2N-1 (the reverse pass).
    const playerCount = gameRoom.turnState.playerOrder.length || 1;
    const setupRound = Math.min(2, Math.floor(gameRoom.turnState.offset / playerCount) + 1);

    return (
      <div
        className={
          snack
            ? 'text-[13px] font-semibold'
            : 'px-4 py-2 text-sm rounded-md border border-sky-soft/60 bg-sky-pale text-sky'
        }
      >
        {isMyTurn ? (
          needs.length > 0 ? (
            <>
              Place ({setupRound}/2): {needs.join(' + ')}
              {!snack && (
                <span className="block text-xs text-sky mt-0.5">
                  Setup places two settlements + two roads per player
                  {setupRound === 2 ? ' — this is your last one.' : '.'}
                </span>
              )}
            </>
          ) : (
            'Setup complete — advancing...'
          )
        ) : (
          <>Waiting on {gameRoom.turnState.player} to place their settlement &amp; road</>
        )}
      </div>
    );
  }

  // Dice: rolling both dice advances the phase automatically — or, on a 7,
  // moving the robber does.
  if (gameRoom.turnState.phase === 'Dice') {
    const sevenPending = gameRoom.robberMove?.reason === 'seven';
    return (
      <div
        className={
          snack
            ? 'text-[13px] font-semibold'
            : 'px-4 py-2 text-sm rounded-md border border-sky-soft/60 bg-sky-pale text-sky'
        }
      >
        {isMyTurn ? (
          sevenPending ? (
            <>
              Move the robber to continue
              {!snack && (
                <span className="block text-xs text-sky mt-0.5">
                  You rolled a 7 — drag the black robber to a hex on the board.
                </span>
              )}
            </>
          ) : (
            <>
              {gameRoom.turnState.offset === 1 ? 'Second roll: roll both dice' : 'Roll both dice to continue'}
              {!snack && (
                <span className="block text-xs text-sky mt-0.5">
                  The phase ends automatically once both dice are rolled.
                </span>
              )}
            </>
          )
        ) : (
          <>
            Waiting on {gameRoom.turnState.player} to{' '}
            {sevenPending ? 'move the robber' : gameRoom.turnState.offset === 1 ? 'roll again' : 'roll the dice'}
          </>
        )}
      </div>
    );
  }

  const buttonClass =
    variant === 'snackbar'
      ? 'px-3 py-3 md:py-1.5 text-[13px] font-bold rounded-md bg-canvas-raised text-ink cursor-pointer hover:bg-canvas-sunken'
      : 'w-full px-4 py-2 text-sm text-center rounded-md border border-ink-faint/50 bg-sky text-white cursor-pointer';

  return (
    <div className="flex flex-col gap-1">
      {isMyTurn && gameRoom.turnState.phase === 'Build' && nothingToBuild && hintsOn && (
        // No legal build anywhere: point at the button so the player isn't
        // stuck hunting the board for a spot that doesn't exist.
        <div
          className={
            snack
              ? 'flex items-center justify-center gap-1.5 text-[13px] font-bold text-gold-soft'
              : 'flex items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] font-bold rounded-md border border-gold bg-gold-pale text-gold-deep'
          }
        >
          <span className="pointer-finger inline-flex" aria-hidden="true">
            <GameIcon name="pointer" size={15} style={{ transform: 'scaleY(-1)' }} />
          </span>
          Nothing left to build — end your turn
        </div>
      )}
      {isMyTurn && gameRoom.turnState.phase === 'Action' && gameRoom.robberDefeatedBy?.playerName === currentPlayer.name ? (
        <div
          className={
            snack
              ? 'text-[13px] font-bold'
              : 'w-full px-4 py-2 text-sm text-center rounded-md border border-ink-faint/50 bg-canvas-sunken text-ink-faint'
          }
        >
          Move the robber to an adjacent hex first
        </div>
      ) : isMyTurn ? (
        <Button variant="unstyled" onClick={handleClick} className={buttonClass}>
          {phaseText(gameRoom.turnState.phase)}
        </Button>
      ) : (
        <div
          className={
            snack
              ? 'text-[13px] font-semibold'
              : 'px-4 py-2 text-sm text-center rounded-md border border-ink-faint/50 bg-canvas-sunken text-ink-faint'
          }
        >
          Waiting on {gameRoom.turnState.player}
        </div>
      )}
      {gameRoom.turnState.phase === 'Action' && isMyTurn && soldiersWithActionsLeft > 0 && (
        <div
          className={
            snack
              ? 'text-[11px] font-semibold text-gold-soft'
              : 'px-2 py-1 text-xs text-center rounded border border-gold-soft bg-gold-pale text-gold-deep'
          }
        >
          <GameIcon name="warning" size={11} className="inline -mt-0.5" /> {soldiersWithActionsLeft} soldier{soldiersWithActionsLeft > 1 ? 's' : ''} can still act
        </div>
      )}
      {secsLeft !== null && (
        <div
          className={
            snack
              ? 'text-[11px] font-semibold'
              : 'px-2 py-1 text-xs text-center rounded border border-ink-faint/40 bg-canvas-sunken text-ink-soft'
          }
        >
          ⏱ {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')} left this phase
        </div>
      )}
    </div>
  );
};

export default EndTurnButton;
