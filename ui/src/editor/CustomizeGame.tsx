import React, { useMemo, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { boardToLayouts, presetFromRoom, useGamePresets, GamePreset } from '../hooks/useGamePresets';
import GameRulesForm from '../components/GameRulesForm';
import BoardEditorPage from './BoardEditor';
import BoardView from '../containers/BoardView';
import GameIcon from '../components/ui/GameIcon';
import Button from '../components/ui/Button';

/**
 * Customize Game: the room's pre-game configuration page (waiting-room only).
 * Two tabs — General Rules (points/turn/setup/timer, live-applied) and Board
 * (the map editor). The only place game rules may change. Who may change them
 * is gated by the room's customization lock (header toggle, host only):
 * unlocked = anyone; locked = host only (others get a view-only board).
 *
 * Game presets live in the header: named rules+map bundles saved to
 * localStorage, loadable in one click.
 */
const CustomizeGamePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const {
    setRulesLock,
    setTurnMode,
    setSetupCities,
    setTurnTimer,
    updatePointsToWin,
    editBoard,
    refreshMap,
  } = useSocket();
  const { presets, save, remove } = useGamePresets();
  const [tab, setTab] = useState<'rules' | 'board'>('rules');
  const [presetName, setPresetName] = useState('');

  const room = gameRoom;
  const isHost = !!room && room.players[0]?.id === currentPlayer?.id;
  const canEdit = !!room && (!room.rulesLocked || isHost);
  const board = room?.board ?? null;

  // Remount the editor when the server board changes (refresh, another
  // player's save, a preset load) — the draft is the room's board, so a new
  // board identity means the draft is stale.
  const boardKey = useMemo(
    () =>
      board
        ? JSON.stringify(boardToLayouts(board)) +
          JSON.stringify(Object.values(board.vertices ?? {}).map((v) => v.port))
        : 'none',
    [board]
  );

  if (!room || room.gameStatus !== 'waiting') {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="bg-canvas-raised rounded-xl shadow-card p-6 text-center flex flex-col gap-3">
          <p className="text-ink">Customize Game is only available before the game starts.</p>
          <Button variant="secondary" onClick={onBack}>Back</Button>
        </div>
      </div>
    );
  }

  const loadPreset = (p: GamePreset) => {
    if (!canEdit || !room) return;
    updatePointsToWin(room.id, p.rules.pointsToWin);
    setTurnMode(room.id, p.rules.turnMode);
    setSetupCities(room.id, p.rules.setupCities);
    setTurnTimer(room.id, p.rules.turnTimerMs);
    editBoard(room.id, p.map, p.docks);
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name || !room) return;
    if (presets.some((p) => p.name === name) && !window.confirm(`Overwrite preset "${name}"?`)) {
      return;
    }
    const preset = presetFromRoom(room, name);
    if (!preset) return;
    save(preset);
    setPresetName('');
  };

  return (
    <div className="min-h-dvh w-full flex flex-col items-center p-4 gap-4">
      {/* Header: back, lock toggle, presets, tabs. */}
      <div className="w-full max-w-[1200px] flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-ink">Customize Game</h1>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <GameIcon name="arrowLeft" size={14} className="inline -mt-0.5" /> Back to waiting room
        </Button>

        {/* Customization lock: host flips it; everyone sees the state. */}
        <button
          type="button"
          onClick={() => isHost && setRulesLock(room.id, !room.rulesLocked)}
          disabled={!isHost}
          title={
            isHost
              ? room.rulesLocked
                ? 'Unlock: let everyone change rules and board'
                : 'Lock: only you can change rules and board'
              : room.rulesLocked
                ? 'Locked by the host — rules and board are view only'
                : 'Unlocked — anyone may change rules and board'
          }
          className="px-3 py-1.5 border border-ink-faint/40 rounded-md bg-canvas-raised text-sm text-ink disabled:opacity-70"
        >
          <GameIcon name="lock" size={13} className="inline -mt-0.5" />{' '}
          {room.rulesLocked ? 'Host only' : 'Anyone can edit'}
        </button>

        {/* Presets: named rules+map bundles, browser-local. */}
        <div className="flex items-center gap-1.5 ml-auto">
          <select
            aria-label="Saved presets"
            value=""
            disabled={presets.length === 0}
            onChange={(e) => {
              const p = presets.find((x) => x.name === e.target.value);
              if (p) loadPreset(p);
            }}
            className="px-2 py-1.5 border border-ink-faint/40 rounded-md text-[13px] bg-white text-ink disabled:opacity-60"
          >
            <option value="">{presets.length ? 'Load preset…' : 'No presets saved'}</option>
            {presets.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          {presets.length > 0 && (
            <select
              aria-label="Delete a preset"
              value=""
              onChange={(e) => {
                const name = e.target.value;
                if (name && window.confirm(`Delete preset "${name}"?`)) remove(name);
              }}
              className="px-2 py-1.5 border border-ink-faint/40 rounded-md text-[13px] bg-white text-ink-soft"
            >
              <option value="">Delete…</option>
              {presets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            maxLength={40}
            className="w-32 px-2 py-1.5 border border-ink-faint/40 rounded-md text-[13px] bg-white text-ink placeholder:text-ink-faint"
          />
          <Button variant="secondary" size="sm" onClick={savePreset} disabled={!presetName.trim()}>
            Save as preset
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full max-w-[1200px] flex gap-1 border-b border-ink-faint/30">
        {(
          [
            ['rules', 'General Rules'],
            ['board', 'Board'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-selected={tab === key}
            className={`px-4 py-2 text-[14px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-gold text-ink'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'rules' ? (
        // Page-wide panels, not a card: the rules are the content of the
        // General Rules tab, so they take the full width like the board does.
        <div className="w-full max-w-[1200px]">
          <GameRulesForm room={room} disabled={!canEdit} />
        </div>
      ) : canEdit && board ? (
        <BoardEditorPage
          key={boardKey}
          roomId={room.id}
          initialBoard={board}
          onRefreshMap={() => refreshMap(room.id)}
        />
      ) : (
        // Locked out or no board yet: the room's board as a static preview.
        <div className="w-full max-w-[1200px] flex flex-col items-center gap-2">
          {!canEdit && (
            <p className="text-[12px] text-ink-faint flex items-center gap-1.5">
              <GameIcon name="lock" size={12} /> Locked by the host — view only.
            </p>
          )}
          <div className="w-full max-w-[900px]">
            <BoardView hexSize={60} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomizeGamePage;
