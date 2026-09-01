import React, { useEffect, useMemo, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import BoardView from './BoardView';
import Sidebar from './SideBar/Index';
import EndTurnButton from './EndTurnButton';
import DiceView from './DiceView';
import ResourceCardsPanel from './ResourceCardsPanel';
import PlayersList from './PlayersList';
import RobberPrompt from './RobberPrompt';
import StealPrompt from './StealPrompt';
import BattleModal from './BattleModal';
import DraggablePanel, { DefaultRect } from '../components/DraggablePanel';
import { resetAllPanels } from '../components/DraggablePanel';
import { GAME_HEX_SIZE } from 'common';

const GAP = 8;
const RAIL_W = 280;
const SIDEBAR_W = 280;

/**
 * The game screen. Everything is floating: the board panel filling the
 * left area edge-to-edge, the sidebar in its own column, and a right
 * rail of panels (turn, players, dice, resources) stacked at cumulative
 * y-positions computed from their measured natural heights (default
 * height = natural content height, so nothing is ever clipped). The dice
 * card only appears while the current player needs to roll. Dragging a
 * panel moves only that panel — the others never reflow.
 */
const Game: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const [measured, setMeasured] = useState<Record<string, { w: number; h: number }>>({});
  const [vp, setVp] = useState({ vw: window.innerWidth, vh: window.innerHeight });

  useEffect(() => {
    const onResize = () => setVp({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleMeasure = (id: string) => (s: { w: number; h: number }) => {
    setMeasured((m) => (m[id] && m[id].w === s.w && m[id].h === s.h ? m : { ...m, [id]: s }));
  };
  // The dice card only appears while the current player needs to roll.
  const showDice =
    !!gameRoom &&
    gameRoom.turnState.phase === 'Dice' &&
    gameRoom.turnState.player === currentPlayer?.name &&
    (gameRoom.roll.die1 === null || gameRoom.roll.die2 === null);

  const layouts = useMemo(() => {
    const { vw, vh } = vp;
    const out: Record<string, DefaultRect | null> = {};
    // Board: fills the left area edge-to-edge (the board SVG scales to fit).
    out.board = { x: 0, y: 0, w: Math.max(200, vw - SIDEBAR_W - RAIL_W), h: vh };
    // Sidebar: its own column, full height.
    out.sidebar = { x: vw - RAIL_W - SIDEBAR_W, y: 0, w: SIDEBAR_W, h: vh };
    // Right rail: turn, players, dice (only while rolling), resources.
    // Cumulative y from the measured natural heights; a panel is placed
    // once every panel above it has reported its height.
    const railIds = ['turn', 'players', ...(showDice ? ['dice'] : []), 'resourceCards'];
    const railX = vw - RAIL_W;
    let y = 0;
    for (const id of railIds) {
      const h = measured[id]?.h;
      if (h == null) break;
      out[id] = { x: railX, y, w: RAIL_W, h };
      y += h + GAP;
    }
    return out;
  }, [vp, measured, showDice]);
  if (!gameRoom || !currentPlayer) {
    return <p className="text-center text-gray-500">Loading game...</p>;
  }

  const turn = gameRoom.turnState;
  const rollTotal =
    gameRoom.roll.die1 !== null && gameRoom.roll.die2 !== null
      ? gameRoom.roll.die1 + gameRoom.roll.die2
      : null;

  return (
    <div className="min-h-screen">

      <RobberPrompt />
      <button
        type="button"
        onClick={resetAllPanels}
        className="fixed top-3 right-3 z-40 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-gray-300 bg-white shadow cursor-pointer hover:bg-gray-100"
        title="Restore every panel to its default position"
      >
        {'⟲'} Reset displays
      </button>

      <DraggablePanel
        id="board"
        className="bg-white rounded-lg shadow"
        layout={layouts.board}
        onMeasure={handleMeasure('board')}
      >
        <BoardView hexSize={GAME_HEX_SIZE} />
      </DraggablePanel>

      <DraggablePanel id="turn" className="bg-white rounded-lg shadow p-3 z-30" layout={layouts.turn} onMeasure={handleMeasure('turn')} followContent>
        <div className="mb-2">
          <span className="text-[13px] font-semibold text-gray-700">
            {turn.phase} {'—'} {turn.player}
            {rollTotal !== null && (
              <span className="font-normal text-gray-400"> · roll {rollTotal}</span>
            )}
          </span>
        </div>
        <EndTurnButton />
      </DraggablePanel>
      {showDice && (
        <DraggablePanel id="dice" className="bg-white rounded-lg shadow p-3 z-30" layout={layouts.dice} onMeasure={handleMeasure('dice')} followContent>
          <DiceView />
        </DraggablePanel>
      )}
      <DraggablePanel
        id="players"
        className="bg-white rounded-lg shadow p-3 z-30"
        layout={layouts.players}
        onMeasure={handleMeasure('players')}
        followContent
      >
        <PlayersList
          players={gameRoom.players}
          board={gameRoom.board}
          bonuses={gameRoom.bonuses}
          currentPlayerId={currentPlayer.id}
        />
      </DraggablePanel>
      <Sidebar layout={layouts.sidebar} onMeasure={handleMeasure('sidebar')} />
      <DraggablePanel
        id="resourceCards"
        className="bg-white rounded-lg shadow p-3 z-30"
        layout={layouts.resourceCards}
        onMeasure={handleMeasure('resourceCards')}
        followContent
      >
        <ResourceCardsPanel />
      </DraggablePanel>

      {/* Steal prompt: the thief picks a face-down card from a victim. */}
      <StealPrompt />

      {/* Separate battle window that opens for all players while combat is active. */}
      <BattleModal />
    </div>
  );
};

export default Game;
