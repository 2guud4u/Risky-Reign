import React from 'react';
import { useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Dice from '../components/Dice';
import GameIcon from '../components/ui/GameIcon';
import { playerColorMap } from '../utils/soldierPlacement';
import { TintedImg } from '../components/TintedSprite';
import { CANNON_STATIONED_ART, INJURED_SOLDIER_ART, SOLDIER_ART } from '../utils/tintedArt';
import type { CannonWallShot } from 'common';

/**
 * Cannon-shot reveal: while `room.cannonShot` is set, a shot is on the table
 * for EVERYONE.
 *  - Duel: shooter vs victim chips, both dice, outcome banner (DESTROYED /
 *    INJURED / DODGED). Cosmetic only; the server clears it ~3s after.
 *  - Wall (GLOSSARY "Wall" breach): a Single shot first shows the shooter an
 *    unrolled die to click (rollWallShot; the server rolls at 10s or on
 *    disconnect) while the board freezes — then everyone sees the breach die
 *    and BREACHED / HELD. An Explosive shot never rolls: it lands straight
 *    on the reveal with its guaranteed breach. Splash shots don't open it.
 */
const CannonShotModal: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const { rollWallShot } = useSocket();

  const shot = gameRoom?.cannonShot ?? null;
  const open = !!shot;
  const colors = gameRoom ? playerColorMap(gameRoom) : {};
  const me = currentPlayer?.name;

  const NameChip: React.FC<{ name: string }> = ({ name }) => (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold text-white"
      style={{ backgroundColor: colors[name] ?? '#64748b' }}
    >
      {name}{name === me ? ' (you)' : ''}
    </span>
  );

  if (shot?.kind === 'wall') {
    return <Modal open aria-label="Wall breach" title="Wall breach" width="max-w-[440px]"><WallShot shot={shot} me={me} NameChip={NameChip} colors={colors} onRoll={rollWallShot} /></Modal>;
  }

  const banner =
    shot?.outcome === 'kill'
      ? { text: 'DESTROYED', cls: 'bg-red-100 text-red-800' }
      : shot?.outcome === 'injure'
        ? { text: 'INJURED', cls: 'bg-amber-100 text-amber-800' }
        : { text: 'DODGED — the defender rolled higher', cls: 'bg-green-100 text-green-800' };

  return (
    <Modal open={open} aria-label="Cannon fire" title="Cannon fire" width="max-w-[440px]">
      {shot && (
        <div className="flex flex-col gap-3">
          {/* Versus header, battle-HUD style: shooter vs victim. */}
          <div className="flex items-center justify-center gap-2">
            <NameChip name={shot.shooterName} />
            <GameIcon name="cannon" size={18} className="text-gray-500" />
            <NameChip name={shot.targetOwnerName} />
          </div>

          {/* The duel: the firing cannon against the victim's sprite — the
              cannon art for cannon targets, the soldier (or injured-soldier)
              art for infantry. A hit/killed target shows the injured art. */}
          <div className="flex items-center justify-center gap-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <div className="flex flex-col items-center gap-1">
              <TintedImg art={CANNON_STATIONED_ART} color={colors[shot.shooterName] ?? '#64748b'} width={72} height={70} />
              <span className="text-[11px] font-semibold text-gray-600">Cannon</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              {shot.targetType === 'cannon' ? (
                // The target cannon's stationed state isn't recorded on the
                // shot, so it shows the mounted art like the shooter.
                <TintedImg art={CANNON_STATIONED_ART} color={colors[shot.targetOwnerName] ?? '#64748b'} width={72} height={70} />
              ) : (
                <TintedImg
                  art={shot.outcome === 'miss' ? SOLDIER_ART : INJURED_SOLDIER_ART}
                  color={colors[shot.targetOwnerName] ?? '#64748b'}
                  width={44}
                  height={56}
                />
              )}
              <span className="text-[11px] font-semibold text-gray-600">
                {shot.targetType === 'cannon' ? 'Cannon' : 'Soldier'}
              </span>
            </div>
          </div>

          {/* Dice line: cannon roll vs the defender's roll (ties go to the
              cannon). */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                Cannon
              </span>
              <Dice value={shot.cannonRoll} size={40} circle />
            </div>
            <span className="text-gray-400 text-lg font-bold">vs</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                Defender
              </span>
              <Dice value={shot.targetRoll} size={40} circle />
            </div>
          </div>

          <div className={`text-center rounded-md py-1.5 font-extrabold text-[15px] ${banner.cls}`}>
            {banner.text}
          </div>
        </div>
      )}
    </Modal>
  );
};

/** The wall-shot body: pending die for a Single shot, banners once resolved. */
const WallShot: React.FC<{
  shot: CannonWallShot;
  me: string | undefined;
  NameChip: React.FC<{ name: string }>;
  colors: Record<string, string>;
  onRoll: () => void;
}> = ({ shot, me, NameChip, colors, onRoll }) => {
  const pending = !shot.explosive && shot.roll === null;
  const isShooter = shot.shooterName === me;
  const resolved = shot.explosive || shot.roll !== null;
  const banner = shot.explosive
    ? { text: 'EXPLOSIVE SHOT — the wall falls', cls: 'bg-orange-100 text-orange-800' }
    : shot.breached
      ? { text: 'BREACHED — the wall falls', cls: 'bg-red-100 text-red-800' }
      : { text: 'HELD — the wall stands', cls: 'bg-green-100 text-green-800' };

  return (
    <div className="flex flex-col gap-3">
      {/* Versus header: shooter vs the wall's owner. */}
      <div className="flex items-center justify-center gap-2">
        <NameChip name={shot.shooterName} />
        <GameIcon name="wall" size={18} className="text-gray-500" />
        <NameChip name={shot.wallOwnerName} />
      </div>

      {/* Cannon vs wall panel. */}
      <div className="flex items-center justify-center gap-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
        <div className="flex flex-col items-center gap-1">
          <TintedImg art={CANNON_STATIONED_ART} color={colors[shot.shooterName] ?? '#64748b'} width={72} height={70} />
          <span className="text-[11px] font-semibold text-gray-600">Cannon</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <GameIcon name="wall" size={48} className={shot.breached ? 'text-red-400' : 'text-stone-500'} />
          <span className="text-[11px] font-semibold text-gray-600">Wall</span>
        </div>
      </div>

      {/* The breach die: unrolled while a Single shot is pending, the landed
          value once resolved. Explosive shots never show a die. */}
      {!shot.explosive && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
            Needs {shot.threshold}+
          </span>
          {shot.roll !== null ? (
            <Dice value={shot.roll} size={48} circle />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 grid place-items-center text-gray-300 text-xl font-bold">
              ?
            </div>
          )}
        </div>
      )}

      {resolved && (
        <div className={`text-center rounded-md py-1.5 font-extrabold text-[15px] ${banner.cls}`}>
          {banner.text}
        </div>
      )}

      {/* Controls — only the shooter owes the roll; everyone else just waits. */}
      {pending &&
        (isShooter ? (
          <>
            <p className="m-0 text-[13px] text-gray-600 text-center">
              Roll {shot.threshold}+ to breach {shot.wallOwnerName}&rsquo;s wall.
            </p>
            <Button
              onClick={onRoll}
              className="w-full !bg-blue-600 !text-white !font-semibold hover:!bg-blue-700"
            >
              Roll the breach die
            </Button>
          </>
        ) : (
          <p className="m-0 text-[13px] text-gray-500 text-center italic">
            Waiting for {shot.shooterName} to roll the breach die…
          </p>
        ))}
    </div>
  );
};

export default CannonShotModal;
