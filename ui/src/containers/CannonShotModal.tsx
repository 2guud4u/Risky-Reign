import React from 'react';
import { useGameState } from '../contexts/GameContext';
import Modal from '../components/ui/Modal';
import Dice from '../components/Dice';
import GameIcon from '../components/ui/GameIcon';
import { playerColorMap } from '../utils/soldierPlacement';
import { TintedImg } from '../components/TintedSprite';
import { CANNON_STATIONED_ART, INJURED_SOLDIER_ART, SOLDIER_ART } from '../utils/tintedArt';

/**
 * Cannon-shot reveal: while `room.cannonShot` is set, a resolved single-target
 * ranged attack is on the table for EVERYONE — shooter vs victim chips, both
 * dice, and the outcome banner (DESTROYED / INJURED / DODGED). The record is
 * cosmetic only; the server clears it ~3s after the shot (the same linger
 * pattern the wall gate uses). Splash shots and wall breaches don't open it.
 */

const CannonShotModal: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();

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

export default CannonShotModal;
