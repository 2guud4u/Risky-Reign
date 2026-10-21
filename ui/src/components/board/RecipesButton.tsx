import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import MapIconButton from '../ui/MapIconButton';
import TabBar from '../ui/TabBar';
import { Info } from 'lucide-react';
import { useGameState } from '../../contexts/GameContext';
import {
  AchievementsPanel,
  BattlesPanel,
  CardsPanel,
  CapturePanel,
  PieceFlag,
  PiecesPanel,
  RecipesPanel,
  TradePanel,
  TurnsPanel,
} from './infoContent';

/** Info modal tabs, in display order (learn → reference). */
const TABS = [
  { key: 'pieces', label: 'Pieces' },
  { key: 'turns', label: 'Turns' },
  { key: 'battles', label: 'Battles' },
  { key: 'trade', label: 'Trade' },
  { key: 'cards', label: 'Cards' },
  { key: 'capture', label: 'Capture' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'achievements', label: 'Achievements' },
] as const;

/**
 * ⓘ button on the map (under the 🔄 trade button). Opens a tabbed info modal:
 * how each piece works, how a turn runs, battle and capture rules, trade
 * rates, the dev-card deck, every build recipe, and every way to earn
 * victory points. Flagged content hides when the room disables that piece.
 */
const RecipesButton: React.FC = () => {
  const { gameRoom } = useGameState();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('pieces');
  const enabled = (flag?: PieceFlag) =>
    !flag ||
    (flag === 'cannons' ? gameRoom?.cannonsEnabled : flag === 'walls' ? gameRoom?.wallsEnabled : gameRoom?.shipsEnabled) === true;

  // Escape closes the window (stopPropagation keeps the board's Escape
  // handler from also clearing the map selection).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open]);

  return (
    <>
      <MapIconButton
        icon={<Info size={22} />}
        onClick={() => setOpen(true)}
        onMouseDown={(e) => e.stopPropagation()}
        title="Info"
        aria-label="Show game info"
        className="top-16 left-[max(0.5rem,env(safe-area-inset-left))]"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Info"
        aria-label="Game info"
        width="max-w-[640px]"
      >
        <TabBar
          className="flex-wrap mb-3"
          tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
          active={tab}
          onChange={setTab}
        />
        <div role="tabpanel">
          {tab === 'pieces' && <PiecesPanel enabled={enabled} />}
          {tab === 'turns' && <TurnsPanel turnMode={gameRoom?.turnMode} />}
          {tab === 'battles' && <BattlesPanel />}
          {tab === 'trade' && <TradePanel />}
          {tab === 'cards' && <CardsPanel />}
          {tab === 'capture' && <CapturePanel />}
          {tab === 'recipes' && <RecipesPanel enabled={enabled} />}
          {tab === 'achievements' && <AchievementsPanel enabled={enabled} />}
        </div>
      </Modal>
    </>
  );
};

export default RecipesButton;
