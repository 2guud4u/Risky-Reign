import React from 'react';
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
import GameIcon, { IconName } from '../components/ui/GameIcon';
import { PriceText } from './price';

/** One line of the "what can my cards buy" tip. */
export interface AffordLine {
  key: string;
  icon: IconName;
  text: React.ReactNode;
}

/** What each phase can spend cards on (from the shared price constants). */
const PHASE_BUYS: Partial<Record<TurnState['phase'], { icon: IconName; name: string; price: Price }[]>> = {
  Build: [
    { icon: 'road', name: 'Road', price: RoadPrice },
    { icon: 'settlement', name: 'Settlement', price: SettlementPrice },
    { icon: 'city', name: 'City', price: CityPrice },
    { icon: 'cards', name: 'Development card', price: DevelopmentCardPrice },
  ],
  Action: [{ icon: 'recruit', name: 'Soldier', price: SoldierPrice }],
};

/** Cards still missing for `price`, as counts + icons. */
function missingText(resources: ResourceCount, price: Price): React.ReactNode {
  const missing = {} as Price;
  for (const r of RESOURCES) missing[r] = Math.max(0, price[r] - resources[r]);
  return <PriceText price={missing} size={12} />;
}

/** A resource inline in a line of text. */
const res = (r: (typeof RESOURCES)[number], size = 12) => (
  <GameIcon name={RESOURCE_ICONS[r]} size={size} className="inline -mt-0.5" />
);

/**
 * What the player's current hand can do this phase: every buy they can
 * afford now (with how many times), healing in the Action phase, and bank
 * trades their surplus allows at their best port ratio. When nothing is
 * affordable, the closest buy and what it still needs. Prices and ratios come
 * from `common`, so the advice matches what the server allows; placement
 * rules (where you may build) are left to the on-map bubbles.
 */
export function affordableSummary(board: Board, player: Player, phase: TurnState['phase']): AffordLine[] {
  const res_ = player.resources;
  const lines: AffordLine[] = [];
  const buys = PHASE_BUYS[phase] ?? [];
  for (const b of buys) {
    if (!canAfford(res_, b.price)) continue;
    const times = Math.min(...RESOURCES.filter((r) => b.price[r] > 0).map((r) => Math.floor(res_[r] / b.price[r])));
    lines.push({
      key: `buy-${b.name}`,
      icon: b.icon,
      text: `Buy a ${b.name}${times > 1 ? ` (up to ${times})` : ''}`,
    });
  }
  if (phase === 'Action') {
    const healWith = HealSoldierResources.filter((r) => res_[r] >= HealSoldierAmount);
    if (healWith.length > 0) {
      lines.push({
        key: 'heal',
        icon: 'heal',
        text: (
          <>
            Heal an injured soldier (
            {healWith.map((r, i) => (
              <React.Fragment key={r}>
                {i > 0 && ' or '}
                {res(r)}
              </React.Fragment>
            ))}
            )
          </>
        ),
      });
    }
  }
  if (phase !== 'SetUp') {
    for (const r of RESOURCES) {
      const ratio = bestBankTradeRatio(board, player, r);
      if (res_[r] >= ratio) {
        lines.push({
          key: `trade-${r}`,
          icon: 'trade',
          text: <>Trade {ratio} {res(r)} with the bank for any 1 card</>,
        });
      }
    }
  }
  const affordable = buys.some((b) => canAfford(res_, b.price));
  if (!affordable && buys.length > 0) {
    // Nothing affordable outright: name the buy needing the fewest extra
    // cards (a bank trade above may cover it).
    const short = (p: Price) => RESOURCES.reduce((n, r) => n + Math.max(0, p[r] - res_[r]), 0);
    const closest = [...buys].sort((a, b) => short(a.price) - short(b.price))[0];
    lines.push({
      key: 'closest',
      icon: closest.icon,
      text: <>A {closest.name} needs {missingText(res_, closest.price)} more</>,
    });
  }
  return lines;
}
