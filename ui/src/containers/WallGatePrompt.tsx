import React from 'react';
import { useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Dice from '../components/Dice';
import GameIcon from '../components/ui/GameIcon';
import { playerColorMap } from '../utils/soldierPlacement';
import { TintedImg } from '../components/TintedSprite';
import { CANNON_UNSTATIONED_ART, INJURED_SOLDIER_ART, SOLDIER_ART } from '../utils/tintedArt';

/**
 * Wall-gate prompt: while `room.wallGate` is pending, a soldier crossing an
 * enemy wall is held at it. The crosser guesses 1-6 (`wallGuess`), then the
 * wall owner resolves the gate with a d6 (`rollWallGate`) — a match lets the
 * soldier through, a miss leaves it in place. The action is spent either way.
 *
 * Unlike most pending prompts this opens for EVERYONE — a contested crossing
 * is table drama. Only the side that owes the next input sees controls;
 * spectators get the same HUD minus the buttons. After the roll lands the
 * state lingers a few seconds (server-cleared) so everyone sees CROSSED/HELD.
 */
const WallGatePrompt: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const { wallGuess, rollWallGate } = useSocket();

  const gate = gameRoom?.wallGate ?? null;
  const open = !!gate;
  const colors = gameRoom ? playerColorMap(gameRoom) : {};

  const me = currentPlayer?.name;
  const isCrosser = gate?.crosserName === me;
  const isOwner = gate?.wallOwnerName === me;
  const soldier = gate ? gameRoom?.board?.soldiers[gate.soldierId] : undefined;

  const NameChip: React.FC<{ name: string }> = ({ name }) => (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold text-white"
      style={{ backgroundColor: colors[name] ?? '#64748b' }}
    >
      {name}{name === me ? ' (you)' : ''}
    </span>
  );

  return (
    <Modal open={open} aria-label="Wall gate" title="Wall gate" width="max-w-[440px]">
      {gate && (
        <div className="flex flex-col gap-3">
          {/* Versus header, battle-HUD style: crosser vs wall owner. */}
          <div className="flex items-center justify-center gap-2">
            <NameChip name={gate.crosserName} />
            <GameIcon name="wall" size={18} className="text-gray-500" />
            <NameChip name={gate.wallOwnerName} />
          </div>

          {/* The piece under dispute: the crossing soldier in its owner's
              color, held at the extracted wall sprite. */}
          <div className="flex items-center justify-center gap-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <div className="flex flex-col items-center gap-1">
              {soldier?.type === 'cannon' ? (
                // Only an unstationed cannon can move, so it crosses as the
                // gunner carrying its ammo crate.
                <TintedImg art={CANNON_UNSTATIONED_ART} color={colors[gate.crosserName] ?? '#64748b'} width={86} height={72} />
              ) : (
                <TintedImg
                  art={soldier?.injured ? INJURED_SOLDIER_ART : SOLDIER_ART}
                  color={colors[gate.crosserName] ?? '#64748b'}
                  width={56}
                  height={72}
                />
              )}
              <span className="text-[11px] font-semibold text-gray-600">
                {soldier?.type === 'cannon' ? 'Cannon' : 'Soldier'}
              </span>
            </div>
            <img
              src="/art/pieces/wall_90.png"
              alt=""
              aria-hidden
              className="h-14 object-contain opacity-90"
            />
          </div>

          {/* Dice line: guess on the left, resolving roll on the right. */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                Guess
              </span>
              {gate.guess !== null ? (
                <Dice value={gate.guess} size={40} circle />
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 grid place-items-center text-gray-300 text-lg font-bold">
                  ?
                </div>
              )}
            </div>
            <span className="text-gray-400 text-lg font-bold">vs</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                Roll
              </span>
              {gate.roll !== null ? (
                <Dice value={gate.roll} size={40} circle />
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 grid place-items-center text-gray-300 text-lg font-bold">
                  ?
                </div>
              )}
            </div>
          </div>

          {/* Outcome banner once the roll lands. */}
          {gate.roll !== null && (
            <div
              className={`text-center rounded-md py-1.5 font-extrabold text-[15px] ${
                gate.guess === gate.roll
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {gate.guess === gate.roll ? 'CROSSED — the soldier slips through' : 'HELD — the wall stands'}
            </div>
          )}

          {/* Controls — only the side that owes the next input sees them. */}
          {gate.roll === null && gate.guess === null && (
            isCrosser ? (
              <>
                <p className="m-0 text-[13px] text-gray-600 text-center">
                  Guess {gate.wallOwnerName}&rsquo;s roll — match and your soldier crosses;
                  miss and its action is spent anyway.
                </p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => wallGuess(n)}
                      className="cursor-pointer hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 transition-transform"
                      title={`Guess ${n}`}
                    >
                      <Dice value={n} size={44} circle />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="m-0 text-[13px] text-gray-500 text-center italic">
                Waiting for {gate.crosserName} to guess the roll…
              </p>
            )
          )}
          {gate.roll === null && gate.guess !== null && (
            isOwner ? (
              <>
                <p className="m-0 text-[13px] text-gray-600 text-center">
                  {gate.crosserName} guessed — roll the gate die to see if your wall holds.
                </p>
                <Button
                  onClick={() => rollWallGate()}
                  className="w-full !bg-blue-600 !text-white !font-semibold hover:!bg-blue-700"
                >
                  Roll the gate die
                </Button>
              </>
            ) : (
              <p className="m-0 text-[13px] text-gray-500 text-center italic">
                Waiting for {gate.wallOwnerName} to roll the gate die…
              </p>
            )
          )}
        </div>
      )}
    </Modal>
  );
};

export default WallGatePrompt;
