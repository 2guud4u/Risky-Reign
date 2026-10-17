import React from 'react';
import {
  DEFAULT_POINTS_TO_WIN,
  MAX_SETUP_CITIES,
  MIN_TURN_TIMER_S,
  MAX_TURN_TIMER_S,
  TURN_MODE_PRESETS,
  TurnMode,
  PublicGameRoom,
} from 'common';
import { useSocket } from '../contexts/SocketContext';
import GameIcon from './ui/GameIcon';
import Button from './ui/Button';

const inputClass =
  'w-full px-3 py-2 border border-ink-faint/40 rounded-md text-[15px] bg-white text-ink placeholder:text-ink-faint focus:border-gold focus:outline-none disabled:opacity-60';

/** Segmented option button (turn-structure presets, setup-cities counts). */
const segClass = (active: boolean) =>
  `flex-1 py-1.5 px-1 rounded-md text-[13px] font-semibold border cursor-pointer transition-colors disabled:opacity-60 ${
    active ? 'border-gold bg-gold-pale text-ink' : 'border-ink-faint/40 bg-white text-ink-soft hover:bg-canvas-sunken'
  }`;

/**
 * The editable game rules: points to win, turn structure, setup cities, and
 * the turn timer. Lives on the Customize Game "General Rules" tab — the only
 * place rules may change (the waiting room shows a read-only summary).
 * Each group is a page-width panel; on wide screens they tile two-across so
 * the tab uses the page instead of a cramped card column.
 * `disabled` greys every control: used when the customization lock is on and
 * the viewer isn't the host. All emits are live (no staging).
 */
const GameRulesForm: React.FC<{ room: PublicGameRoom; disabled: boolean }> = ({ room, disabled }) => {
  const {
    updatePointsToWin,
    setTurnMode,
    setSetupCities,
    setTurnTimer,
  } = useSocket();
  const mode = room.turnMode;

  const panel = 'bg-canvas-raised rounded-xl shadow-card p-5';
  const heading = 'block text-[15px] font-bold mb-3 text-ink';

  const scopeSelect = (
    key: 'build' | 'action',
    label: string,
    hint: string,
  ) => (
    <div>
      <label className="block text-[13px] font-semibold mb-1.5 text-ink">{label}</label>
      <select
        value={mode[key]}
        disabled={disabled}
        onChange={(e) =>
          setTurnMode({ ...mode, [key]: e.target.value as TurnMode['build'] })
        }
        className={inputClass}
      >
        <option value="around">Around the table</option>
        <option value="single">Single (one turn)</option>
      </select>
      <p className="mt-1 text-[11px] text-ink-faint">{hint}</p>
    </div>
  );
  const presetBtn = (label: string, preset: TurnMode, active: boolean) => (
    <button
      onClick={() => !disabled && setTurnMode({ ...preset })}
      disabled={disabled}
      className={segClass(active)}
    >
      {label}
    </button>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      <div className={panel}>
        <span className={heading}>Points to Win</span>
        <input
          type="number"
          min={1}
          value={room.pointsToWin}
          disabled={disabled}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!Number.isNaN(value) && value >= 1) {
              updatePointsToWin(value);
            }
          }}
          className={inputClass}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => updatePointsToWin(DEFAULT_POINTS_TO_WIN)}
          disabled={disabled}
          className="mt-3 w-full"
        >
          Reset to Default
        </Button>
      </div>


      {/* Turn structure: which phases act once per round vs go around the
          whole table. */}
      <div className={`${panel} md:row-span-2`}>
        <span className={heading}>Turn Structure</span>
        <div className="flex gap-1.5">
          {presetBtn(
            'Regular',
            TURN_MODE_PRESETS.catan,
            mode.build === 'single' && mode.action === 'single',
          )}
          {presetBtn(
            'Expanded',
            TURN_MODE_PRESETS.expanded,
            mode.build === 'around' && mode.action === 'around' && !mode.secondRoll,
          )}
        </div>
        {scopeSelect('build', 'Build phase', 'around = every player builds; single = only the dice roller')}
        {/* The second roll only exists after an around-the-table Build. */}
        {mode.build === 'around' && (
          <label className="flex items-start gap-2 text-[13px] cursor-pointer text-ink">
            <input
              type="checkbox"
              checked={mode.secondRoll}
              disabled={disabled}
              onChange={(e) => setTurnMode({ ...mode, secondRoll: e.target.checked })}
              className="mt-0.5 accent-gold"
            />
            <span>
              <span className="font-semibold text-ink">Second roll</span>
              <span className="block text-[11px] text-ink-faint">
                After everyone builds, the same player rolls again before the Action phase.
              </span>
            </span>
          </label>
        )}
        {scopeSelect('action', 'Action phase', 'around = every player acts; single = only the dice roller')}
      </div>

      {/* Setup cities: how many of each player's two setup placements may
          be a city (the player chooses which). */}
      <div className={panel}>
        <span className={heading}>Setup Cities</span>
        <div className="flex gap-1.5">
          {Array.from({ length: MAX_SETUP_CITIES + 1 }, (_, n) => (
            <button
              key={n}
              onClick={() => setSetupCities(n)}
              disabled={disabled}
              className={segClass(room.setupCities === n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-ink-faint">
          How many setup placements each player may make a city instead of a settlement.
        </p>
      </div>

      {/* Turn timer: a per-phase clock for Build and Action (seconds;
          0/off = no limit). Fights pause it. */}
      <div className={panel}>
        {(() => {
          const on = room.turnTimerMs > 0;
          return (
            <>
              <label className="flex items-center gap-2 text-[15px] font-bold cursor-pointer text-ink">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={(e) =>
                    setTurnTimer(e.target.checked ? MIN_TURN_TIMER_S * 1000 : 0)
                  }
                />
                <span className="font-semibold text-ink">Turn Timer</span>
              </label>
              {on && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={MIN_TURN_TIMER_S}
                    max={MAX_TURN_TIMER_S}
                    step={5}
                    value={Math.round(room.turnTimerMs / 1000)}
                    disabled={disabled}
                    onChange={(e) => {
                      const s = parseInt(e.target.value, 10);
                      if (
                        !Number.isNaN(s) &&
                        s >= MIN_TURN_TIMER_S &&
                        s <= MAX_TURN_TIMER_S
                      ) {
                        setTurnTimer(s * 1000);
                      }
                    }}
                    className="w-24 px-2 py-1.5 border border-ink-faint/40 rounded-md text-[13px] bg-white text-ink disabled:opacity-60 focus:border-gold focus:outline-none"
                  />
                  <span className="text-[13px] text-ink-soft">seconds per phase</span>
                </div>
              )}
              <p className="mt-1 text-[11px] text-ink-faint">
                Build and Action phases auto-end when the clock runs out. Pauses during fights.
              </p>
            </>
          );
        })()}
      </div>

      {disabled && (
        <p className="md:col-span-2 text-[12px] text-ink-faint flex items-center gap-1.5">
          <GameIcon name="lock" size={12} /> The host locked game customization — view only.
        </p>
      )}
    </div>
  );
};

export default GameRulesForm;
