import {
  Board,
  CityPrice,
  DevelopmentCardPrice,
  HealSoldierAmount,
  HealSoldierResources,
  Player,
  Price,
  RESOURCES,
  ResourceCount,
  RoadPrice,
  SettlementPrice,
  SoldierPrice,
  TurnState,
  bestBankTradeRatio,
  canAfford,
} from 'common';
import { RESOURCE_ICONS } from './resourceIcons';

/** One line of the "what can my cards buy" tip. */
export interface AffordLine {
  icon: string;
  text: string;
}

/** What each phase can spend cards on (from the shared price constants). */
const PHASE_BUYS: Partial<Record<TurnState['phase'], { icon: string; name: string; price: Price }[]>> = {
  Build: [
    { icon: '🛤️', name: 'Road', price: RoadPrice },
    { icon: '🏠', name: 'Settlement', price: SettlementPrice },
    { icon: '🏰', name: 'City', price: CityPrice },
    { icon: '🎴', name: 'Development card', price: DevelopmentCardPrice },
  ],
  Action: [{ icon: '🫵', name: 'Soldier', price: SoldierPrice }],
};

/** Cards still missing for `price`, as icons (e.g. "1 🧱, 2 🪨"). */
function missingText(resources: ResourceCount, price: Price): string {
  return RESOURCES.filter((r) => price[r] > resources[r])
    .map((r) => `${price[r] - resources[r]} ${RESOURCE_ICONS[r]}`)
    .join(', ');
}

/**
 * What the player's current hand can do this phase: every buy they can
 * afford now (with how many times), healing in the Action phase, and bank
 * trades their surplus allows at their best port ratio. When nothing is
 * affordable, the closest buy and what it still needs. Prices and ratios come
 * from `common`, so the advice matches what the server allows; placement
 * rules (where you may build) are left to the on-map bubbles.
 */
export function affordableSummary(board: Board, player: Player, phase: TurnState['phase']): AffordLine[] {
  const res = player.resources;
  const lines: AffordLine[] = [];
  const buys = PHASE_BUYS[phase] ?? [];
  for (const b of buys) {
    if (!canAfford(res, b.price)) continue;
    const times = Math.min(...RESOURCES.filter((r) => b.price[r] > 0).map((r) => Math.floor(res[r] / b.price[r])));
    lines.push({ icon: b.icon, text: `Buy a ${b.name}${times > 1 ? ` (up to ${times})` : ''}` });
  }
  if (phase === 'Action') {
    const healWith = HealSoldierResources.filter((r) => res[r] >= HealSoldierAmount);
    if (healWith.length > 0) {
      lines.push({ icon: '❤️‍🩹', text: `Heal an injured soldier (${healWith.map((r) => RESOURCE_ICONS[r]).join(' or ')})` });
    }
  }
  if (phase !== 'SetUp') {
    for (const r of RESOURCES) {
      const ratio = bestBankTradeRatio(board, player, r);
      if (res[r] >= ratio) {
        lines.push({ icon: '🤝', text: `Trade ${ratio} ${RESOURCE_ICONS[r]} with the bank for any 1 card` });
      }
    }
  }
  const affordable = buys.some((b) => canAfford(res, b.price));
  if (!affordable && buys.length > 0) {
    // Nothing affordable outright: name the buy needing the fewest extra
    // cards (a bank trade above may cover it).
    const short = (p: Price) => RESOURCES.reduce((n, r) => n + Math.max(0, p[r] - res[r]), 0);
    const closest = [...buys].sort((a, b) => short(a.price) - short(b.price))[0];
    lines.push({ icon: closest.icon, text: `A ${closest.name} needs ${missingText(res, closest.price)} more` });
  }
  return lines;
}
