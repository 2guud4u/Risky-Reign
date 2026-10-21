import React from 'react';
import { useGameState, usePlayers } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Dice from '../components/ui/Dice';
import GameIcon from '../components/ui/GameIcon';
import { TintedImg } from '../components/TintedSprite';
import { CANNON_STATIONED_ART, INJURED_SOLDIER_ART, SOLDIER_ART, TROOP_SPRITES } from '../utils/tintedArt';
import { FightStage } from '../components/battle/FightStage';
import type { CannonWallShot } from 'common';

/**
 * Cannon-shot panel: while `room.cannonShot` is set, a shot is on the table
 * for EVERYONE.
 *  - Duel (Single or Chain shot): firing opens it pending — the board
 *    freezes like a battle while the cannon's die waits on the shooter and
 *    each victim's die waits on that soldier's owner. Everyone clicks their
 *    own dice (the server rolls them after the deadline); once every die is
 *    in, margin outcomes land and the reveal lingers ~3s.
 *  - Wall (GLOSSARY "Wall" breach): a Single shot shows the shooter an
 *    unrolled breach die (rollWallShot; the server rolls at 10s or on
 *    disconnect) while the board freezes — then everyone sees the die and
 *    BREACHED / HELD. An Explosive shot never rolls: it lands straight on
 *    the reveal with its guaranteed breach.
 */
const CannonShotModal: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const { rollWallShot, rollCannonShot } = useSocket();

  const shot = gameRoom?.cannonShot ?? null;
  const open = !!shot;
  const { colorOf } = usePlayers();
  const me = currentPlayer?.name;

  const NameChip: React.FC<{ name: string }> = ({ name }) => (
    <span
      className="px-2 py-0.5 rounded-md text-[12px] font-bold text-white"
      style={{ backgroundColor: colorOf(name) ?? '#9b9183' }}
    >
      {name}
    </span>
  );

  if (shot?.kind === 'wall') {
    return <Modal open aria-label="Wall breach" title="Wall breach" width="max-w-[440px]"><WallShot shot={shot} me={me} NameChip={NameChip} colorOf={colorOf} onRoll={rollWallShot} /></Modal>;
  }

  if (!shot) return null;

  const pending = shot.cannonRoll === null || shot.victims.some((v) => v.roll === null);
  // Every die owed by the current player: the cannon's die for the shooter,
  // one per victim for each owner (soldierId null = the cannon's die).
  const myDice: (string | null)[] = [];
  if (shot.shooterName === me && shot.cannonRoll === null) myDice.push(null);
  for (const v of shot.victims) if (v.ownerName === me && v.roll === null) myDice.push(v.soldierId);
  const waitingOn = [
    ...(shot.cannonRoll === null ? [shot.shooterName] : []),
    ...shot.victims.filter((v) => v.roll === null).map((v) => v.ownerName),
  ];
  const anyResolved = shot.victims.some((v) => v.outcome !== null);

  const banner =
    anyResolved && !pending
      ? shot.victims.every((v) => v.outcome === 'miss')
        ? { text: 'DODGED — the defenders rolled higher', cls: 'bg-moss-pale text-moss' }
        : shot.victims.every((v) => v.outcome === 'kill')
          ? { text: 'DESTROYED', cls: 'bg-clay-pale text-clay' }
          : shot.victims.length === 1
            ? shot.victims[0].outcome === 'kill'
              ? { text: 'DESTROYED', cls: 'bg-clay-pale text-clay' }
              : shot.victims[0].outcome === 'injure'
                ? { text: 'INJURED', cls: 'bg-gold-pale text-gold-deep' }
                : { text: 'DODGED — the defender rolled higher', cls: 'bg-moss-pale text-moss' }
            : { text: 'HIT — see each soldier', cls: 'bg-gold-pale text-gold-deep' }
      : null;

  return (
    <Modal open={open} aria-label="Cannon fire" title={shot.chained ? 'Chain shot' : 'Cannon fire'} width="max-w-[440px]">
      <div className="flex flex-col gap-3">
        {/* Versus header, battle-HUD style: shooter vs the victims' owners. */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <NameChip name={shot.shooterName} />
          <GameIcon name="cannon" size={18} className="text-ink-faint" />
          {[...new Set(shot.victims.map((v) => v.ownerName))].map((name) => (
            <NameChip key={name} name={name} />
          ))}
        </div>

        {/* The cannon and its die: the shooter's roll seat. */}
        <div className="flex items-center justify-center gap-6 rounded-lg bg-canvas-sunken border border-ink-faint/40 px-4 py-3">
          <div className="flex flex-col items-center gap-1">
            <TintedImg art={CANNON_STATIONED_ART} color={colorOf(shot.shooterName) ?? '#9b9183'} width={72} height={70} />
            <span className="text-[11px] font-semibold text-ink-soft">Cannon</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-faint font-semibold">
              {shot.shooterName === me && shot.cannonRoll === null ? 'Your die' : `${shot.shooterName}'s die`}
            </span>
            {shot.cannonRoll !== null ? (
              <Dice value={shot.cannonRoll} size={40} circle />
            ) : (
              <UnrolledDie active={shot.shooterName === me} onClick={() => rollCannonShot(null)} />
            )}
          </div>
        </div>

        {/* The resolved shot, replayed: fire, ball flight, each victim's fate. */}
        {!pending && anyResolved && (
          <div className="rounded-lg overflow-hidden bg-[#1a1916] h-[220px]">
            <FightStage
              fights={shot.victims.map((v) => ({
                attacker: {
                  kind: 'cannonStationed',
                  color: colorOf(shot.shooterName) ?? '#9b9183',
                  roll: shot.cannonRoll,
                },
                defender: {
                  kind:
                    v.type === 'cannon'
                      ? 'cannonStationed'
                      : gameRoom?.board?.soldiers[v.soldierId]?.injured
                        ? 'injured'
                        : 'soldier',
                  color: colorOf(v.ownerName) ?? '#9b9183',
                  roll: v.roll,
                },
                outcome:
                  v.outcome === 'kill' ? 'killDefender' : v.outcome === 'injure' ? 'injureDefender' : 'miss',
                ranged: true,
              }))}
            />
          </div>
        )}
        {/* One row per victim: their art, their die, their fate. */}
        <div className="flex flex-col gap-2 rounded-lg bg-canvas-sunken border border-ink-faint/40 px-4 py-3">
          {shot.victims.map((v) => (
            <div key={v.soldierId} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TintedImg
                  art={
                    v.type === 'cannon'
                      ? TROOP_SPRITES.cannonStationed
                      : v.outcome === 'injure'
                        ? INJURED_SOLDIER_ART
                        : SOLDIER_ART
                  }
                  color={colorOf(v.ownerName) ?? '#9b9183'}
                  width={v.type === 'cannon' ? 40 : 24}
                  height={v.type === 'cannon' ? 39 : 30}
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-ink-soft">
                    {v.type === 'cannon' ? 'Cannon' : 'Soldier'}
                  </span>
                  <NameChip name={v.ownerName} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {v.outcome && (
                  <span
                    className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      v.outcome === 'kill'
                        ? 'bg-clay-pale text-clay'
                        : v.outcome === 'injure'
                          ? 'bg-gold-pale text-gold-deep'
                          : 'bg-moss-pale text-moss'
                    }`}
                  >
                    {v.outcome}
                  </span>
                )}
                {v.roll !== null ? (
                  <Dice value={v.roll} size={32} circle />
                ) : (
                  <UnrolledDie active={v.ownerName === me} size={32} onClick={() => rollCannonShot(v.soldierId)} />
                )}
              </div>
            </div>
          ))}
        </div>

        {banner && (
          <div className={`text-center rounded-md py-1.5 font-extrabold text-[15px] ${banner.cls}`}>
            {banner.text}
          </div>
        )}

        {pending &&
          (myDice.length > 0 ? (
            <p className="m-0 text-[13px] text-ink-soft text-center">
              Click your glowing die{myDice.length > 1 ? 's' : ''} to roll. The cannon wins ties; a
              margin of 2+ destroys.
            </p>
          ) : (
            <p className="m-0 text-[13px] text-ink-faint text-center italic">
              Waiting for {[...new Set(waitingOn)].join(', ')} to roll…
            </p>
          ))}
      </div>
    </Modal>
  );
};

/** A die seat that hasn't rolled: dashed when someone else owes it, a glowing
 *  button when it's yours. */
const UnrolledDie: React.FC<{ active: boolean; size?: number; onClick: () => void }> = ({
  active,
  size = 40,
  onClick,
}) =>
  active ? (
    <Button
      variant="unstyled"
      onClick={onClick}
      className="rounded-full border-2 border-sky grid place-items-center text-sky font-bold animate-pulse hover:bg-sky-pale"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-label="Roll this die"
    >
      ?
    </Button>
  ) : (
    <div
      className="rounded-full border-2 border-dashed border-ink-faint/50 grid place-items-center text-ink-faint font-bold"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      ?
    </div>
  );

/** The wall-shot body: pending die for a Single shot, banners once resolved. */
const WallShot: React.FC<{
  shot: CannonWallShot;
  me: string | undefined;
  NameChip: React.FC<{ name: string }>;
  colorOf: (name: string) => string | undefined;
  onRoll: () => void;
}> = ({ shot, me, NameChip, colorOf, onRoll }) => {
  const pending = !shot.explosive && shot.roll === null;
  const isShooter = shot.shooterName === me;
  const resolved = shot.explosive || shot.roll !== null;
  const banner = shot.explosive
    ? { text: 'EXPLOSIVE SHOT — the wall falls', cls: 'bg-gold-pale text-gold-deep' }
    : shot.breached
      ? { text: 'BREACHED — the wall falls', cls: 'bg-clay-pale text-clay' }
      : { text: 'HELD — the wall stands', cls: 'bg-moss-pale text-moss' };

  return (
    <div className="flex flex-col gap-3">
      {/* Versus header: shooter vs the wall's owner. */}
      <div className="flex items-center justify-center gap-2">
        <NameChip name={shot.shooterName} />
        <GameIcon name="wall" size={18} className="text-ink-faint" />
        <NameChip name={shot.wallOwnerName} />
      </div>

      {/* Cannon vs wall panel. */}
      <div className="flex items-center justify-center gap-6 rounded-lg bg-canvas-sunken border border-ink-faint/40 px-4 py-3">
        <div className="flex flex-col items-center gap-1">
          <TintedImg art={CANNON_STATIONED_ART} color={colorOf(shot.shooterName) ?? '#9b9183'} width={72} height={70} />
          <span className="text-[11px] font-semibold text-ink-soft">Cannon</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <GameIcon name="wall" size={48} className={shot.breached ? 'text-clay-soft' : 'text-ink-faint'} />
          <span className="text-[11px] font-semibold text-ink-soft">Wall</span>
        </div>
      </div>

      {/* The breach die: unrolled while a Single shot is pending, the landed
          value once resolved. Explosive shots never show a die. */}
      {!shot.explosive && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-ink-faint font-semibold">
            Needs {shot.threshold}+
          </span>
          {shot.roll !== null ? (
            <Dice value={shot.roll} size={48} circle />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-ink-faint/50 grid place-items-center text-ink-faint text-xl font-bold">
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
            <p className="m-0 text-[13px] text-ink-soft text-center">
              Roll {shot.threshold}+ to breach {shot.wallOwnerName}&rsquo;s wall.
            </p>
            <Button
              onClick={onRoll}
              className="w-full !bg-sky !text-white !font-semibold hover:!bg-sky-soft"
            >
              Roll the breach die
            </Button>
          </>
        ) : (
          <p className="m-0 text-[13px] text-ink-faint text-center italic">
            Waiting for {shot.shooterName} to roll the breach die…
          </p>
        ))}
    </div>
  );
};

export default CannonShotModal;
