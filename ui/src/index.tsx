import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { MapFightLayer } from './components/battle/FightStage';
import type { Fight } from './components/battle/FightStage';

// TEMP dev fixture: ?fighttest renders the in-map fight layer over a fake
// clash line so the choreography can be eyeballed without running a battle.
const fightTest = new URLSearchParams(location.search).get('fighttest');
const FIGHT_CASES: Record<string, { label: string; fights: Fight[] }> = {
  duel: {
    label: 'melee duel',
    fights: [{ attacker: { kind: 'soldier', color: '#dc2626', roll: 5 }, defender: { kind: 'soldier', color: '#1d4ed8', roll: 2 }, outcome: 'killDefender', rowY: 600 }],
  },
  round3: {
    label: 'three rows sequential',
    fights: [
      { attacker: { kind: 'soldier', color: '#dc2626', roll: 6 }, defender: { kind: 'soldier', color: '#1d4ed8', roll: 4 }, outcome: 'killDefender', rowY: 566 },
      { attacker: { kind: 'soldier', color: '#dc2626', roll: 3 }, defender: { kind: 'soldier', color: '#1d4ed8', roll: 5 }, outcome: 'killAttacker', rowY: 600 },
      { attacker: { kind: 'cannonStationed', color: '#dc2626', roll: 2 }, defender: { kind: 'soldier', color: '#1d4ed8', roll: 1 }, outcome: 'killDefender', rowY: 634 },
    ],
  },
};
const fixture = fightTest ? FIGHT_CASES[fightTest] : undefined;
const FightTestApp = fixture
  ? () => (
      <svg viewBox="370 480 340 240" style={{ width: 900, height: 640, background: '#1d3a5f' }}>
        <line x1={540} y1={560} x2={540} y2={640} stroke="#dc2626" strokeWidth={2} strokeDasharray="6 5" opacity={0.6} />
        <MapFightLayer fights={fixture.fights} x={540} />
      </svg>
    )
  : null;

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode>{FightTestApp ? <FightTestApp /> : <App />}</React.StrictMode>);

// Stop Safari/Chrome pinch-zooming the *page*: a zoomed page is wider than the
// screen, so the layout's left/right get cut off. The board's own pinch-zoom
// lives inside the SVG (touch-action:none there), which these do not affect.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener(
    'touchmove',
    (e) => {
        // Two fingers on ordinary UI (not the board) => a pinch: block it.
        if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
);
