import React from 'react';
import {
  BONUS_VP,
  GREAT_WALL_MIN,
  GREAT_WALL_VP,
  CityPrice,
  DevelopmentCardPrice,
  HealSoldierAmount,
  HealSoldierResources,
  LARGEST_ARMY_MIN,
  LONGEST_ROAD_MIN,
  Price,
  RESOURCES,
  RoadPrice,
  SettlementPrice,
  SoldierPrice,
  ShipPrice,
  WallPrice,
  CannonUpgradePrice,
  SplashPrice,
  ShipSettlePrice,
  CONQUEROR_MIN,
  ADMIRAL_MIN,
  ADMIRAL_VP,
  WIN_VP,
  DEVELOPMENT_CARD_META,
  DEVELOPMENT_CARD_DISTRIBUTION,
  DevelopmentCardType,
  TurnMode,
} from 'common';
import { RESOURCE_ICONS, DEV_CARD_ICONS } from '../../utils/resourceIcons';
import GameIcon, { IconName } from '../ui/GameIcon';
import Button from '../ui/Button';

/** The room's piece toggles — 'soldier' and 'robber' are always in play. */
export type PieceFlag = 'cannons' | 'walls' | 'ships';

/* ── Shared bits ─────────────────────────────────────────────────────── */

/** The cost as one icon chip per card (e.g. 2 wheat, 3 ore). */
const CostChips: React.FC<{ price: Price }> = ({ price }) => (
  <span className="flex flex-wrap gap-1">
    {RESOURCES.filter((k) => price[k] > 0).map((k) => (
      <span
        key={k}
        title={`${price[k]} ${k}`}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-canvas-sunken border border-ink-faint/40 text-[13px]"
      >
        {price[k]} <GameIcon name={RESOURCE_ICONS[k]} size={14} />
      </span>
    ))}
  </span>
);

const cardClass = 'border border-ink-faint/40 rounded-md p-2 bg-canvas-raised';

const CardHead: React.FC<{ icon: IconName; name: string; price?: Price; right?: React.ReactNode }> = ({
  icon,
  name,
  price,
  right,
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[14px] font-semibold text-ink">
      <GameIcon name={icon} size={14} className="inline -mt-0.5" /> {name}
    </span>
    {price ? <CostChips price={price} /> : right}
  </div>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="m-0 mt-1 pl-4 list-disc text-[12px] text-ink-faint flex flex-col gap-0.5">
    {items.map((b) => (
      <li key={b}>{b}</li>
    ))}
  </ul>
);

/**
 * The piece/section jump rail shared by the sidebar tabs: a vertical column
 * on wide screens, a scrollable chip row on narrow ones. Each item scrolls
 * the named section into view.
 */
const JumpNav: React.FC<{ items: { key: string; icon: IconName; label: string }[] }> = ({ items }) => (
  <nav
    aria-label="Sections"
    className="flex gap-1 mb-3 overflow-x-auto md:mb-0 md:flex-col md:shrink-0 md:w-28 md:overflow-visible md:sticky md:top-0 md:self-start"
  >
    {items.map((s) => (
      <Button
        key={s.key}
        variant="unstyled"
        onClick={() => document.getElementById(`info-${s.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="shrink-0 px-2 py-1 rounded border border-ink-faint/40 bg-canvas-sunken text-[12px] font-semibold text-ink-soft hover:bg-sky-pale hover:border-sky hover:text-sky text-left"
      >
        <GameIcon name={s.icon} size={13} className="inline -mt-0.5" /> {s.label}
      </Button>
    ))}
  </nav>
);

const SectionedPanel: React.FC<{
  items: { key: string; icon: IconName; label: string; body: React.ReactNode }[];
}> = ({ items }) => (
  <div className="md:flex md:gap-3">
    <JumpNav items={items} />
    <div className="flex flex-col gap-2 min-w-0">
      {items.map((s) => (
        <section key={s.key} id={`info-${s.key}`} className={`scroll-mt-2 ${cardClass}`}>
          <CardHead icon={s.icon} name={s.label} />
          {s.body}
        </section>
      ))}
    </div>
  </div>
);

/* ── Pieces ──────────────────────────────────────────────────────────── */

interface PieceCard {
  key: 'soldier' | 'robber' | 'cannon' | 'wall' | 'ship';
  icon: IconName;
  name: string;
  price?: Price;
  bullets: string[];
  flag?: PieceFlag;
}

const PIECES: PieceCard[] = [
  {
    key: 'soldier',
    icon: 'attack',
    name: 'Soldier',
    price: SoldierPrice,
    bullets: [
      'Recruit soldiers on your settlement or city during the Action phase.',
      'Each soldier takes one action per turn: move along your roads, attack, or heal.',
      'Soldiers recruited or healed this turn can’t move yet.',
      'Losing a fight by 1 injures your soldier; losing by 2 or more kills it. An injured soldier can’t attack until you heal it, which costs double the recruit price.',
      'Fight the robber standing next to your troops, or capture the enemy settlement you’re standing on.',
    ],
  },
  {
    key: 'robber',
    icon: 'robber',
    name: 'Robber',
    bullets: [
      'A hex with the robber produces nothing for its owners — its resources go into the robber’s bag instead of your hand.',
      'When a 7 is rolled, anyone holding 8 or more cards discards half (rounded down) into the bag before the robber moves.',
      'Beat it with a soldier to steal from the bag and move it to another hex.',
      'The robber wins ties.',
    ],
  },
  {
    key: 'cannon',
    icon: 'cannon',
    name: 'Cannon',
    price: CannonUpgradePrice,
    flag: 'cannons',
    bullets: [
      'Upgrade a healthy soldier standing on your settlement or city; it starts out unstationed.',
      'Station it to fire: pick a direction to shoot at an adjacent vertex. A margin of 2 or more kills, a margin of 1 injures. Cannons win ties and are never injured — a lost roll is fatal.',
      'Chain shot (1 ore, toggled in Fire): rolls once against every soldier on the target vertex — including your own.',
      'Stationed beside a wall, it rolls 4+ to breach the wall back into a road.',
      'Unstation it to move, or downgrade it back to a soldier anywhere — that spends its action. Shots are final and can’t be undone.',
      'Aboard a ship, it becomes naval artillery and can fire 1 intersection away.',
    ],
  },
  {
    key: 'wall',
    icon: 'wall',
    name: 'Wall',
    price: WallPrice,
    flag: 'walls',
    bullets: [
      'Upgrade one of your roads during the Build phase.',
      'Walls only block enemy soldiers — your own troops cross freely.',
      'An enemy who tries to cross plays the gate: they guess a number from 1 to 6 and you roll a die. A match lets them through; either way, their action is spent.',
      'A stationed cannon breaches it on a 4+ — or a 5+ if the owner holds The Great Wall. (The road survives.) A captured settlement keeps its wall.',
    ],
  },
  {
    key: 'ship',
    icon: 'ship',
    name: 'Ship',
    price: ShipPrice,
    flag: 'ships',
    bullets: [
      'Build on a coast vertex touched by one of your roads or settlements.',
      'Sails ⌈roll ÷ 2⌉ steps during each of your Action phases — for free, and it doesn’t spend troop actions.',
      'Troops can only board or land at the ship’s coast vertex, and each boarding or landing costs that troop its action. At open sea they can’t move.',
      'Anyone can sail an empty ship; a crewed ship answers only to its owner.',
      'Convert the ship into a settlement on its own or an adjacent coast vertex (the distance rule applies, and no free garrison).',
      'Troops aboard can be attacked but can’t capture anything or start fights until they land.',
    ],
  },
];

export const PiecesPanel: React.FC<{ enabled: (flag?: PieceFlag) => boolean }> = ({ enabled }) => {
  const pieces = PIECES.filter((p) => enabled(p.flag));
  return (
    <div className="md:flex md:gap-3">
      <JumpNav items={pieces.map((p) => ({ key: p.key, icon: p.icon, label: p.name }))} />
      <div className="flex flex-col gap-2 min-w-0">
        {pieces.map((p) => (
          <section key={p.key} id={`info-${p.key}`} className={`scroll-mt-2 ${cardClass}`}>
            <CardHead icon={p.icon} name={p.name} price={p.price} />
            <Bullets items={p.bullets} />
          </section>
        ))}
      </div>
    </div>
  );
};

/* ── Turns ───────────────────────────────────────────────────────────── */

/**
 * How the room's chosen turn mode plays out. Reads `room.turnMode` (build
 * scope, action scope, second roll) so it describes this game, not every
 * variant.
 */
export const TurnsPanel: React.FC<{ turnMode: TurnMode | undefined }> = ({ turnMode }) => {
  const buildAround = turnMode?.build === 'around';
  const actionAround = turnMode?.action === 'around';
  const buildBody = buildAround
    ? 'Every player takes a Build phase in turn order, starting with the player who rolled.'
    : 'Only the player who rolled may build, and the phase ends when they pass.';
  const actionBody = actionAround
    ? 'Every player takes an Action phase in turn order.'
    : 'Only the player who rolled may act, and the phase ends when they pass.';
  const phases: { icon: IconName; name: string; bullets: string[] }[] = [
    {
      icon: 'dice',
      name: 'Dice',
      bullets: [
        'Click each die to roll. Settlements and cities touching a hex whose number matches the total collect that hex’s resource.',
        'Rolling a 7 activates the robber instead of paying out (see the Robber card).',
        ...(turnMode?.secondRoll ? ['This game rolls a second time after everyone builds, with its own payouts.'] : []),
      ],
    },
    { icon: 'build', name: 'Build', bullets: [buildBody, 'Spend resources on roads, settlements, cities and ships, or buy a development card.'] },
    {
      icon: 'attack',
      name: 'Action',
      bullets: [actionBody, 'Each soldier spends one action: move, attack, capture, heal, or a piece-specific action. Ships can also sail.'],
    },
    {
      icon: 'move',
      name: 'End turn',
      bullets: ['Click the phase button to pass when you’re done — unused actions don’t carry over.'],
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      {phases.map((p, i) => (
        <section key={p.name} className={cardClass}>
          <CardHead icon={p.icon} name={`${i + 1}. ${p.name}`} />
          <Bullets items={p.bullets} />
        </section>
      ))}
    </div>
  );
};

/* ── Battles ─────────────────────────────────────────────────────────── */

export const BattlesPanel: React.FC = () => (
  <SectionedPanel
    items={[
      {
        key: 'battle-start',
        icon: 'attack',
        label: 'Starting a fight',
        body: (
          <Bullets
            items={[
              'Pick your soldier(s) on a vertex that has enemy troops, then Attack — or Fight the robber standing next to them.',
              'Nothing else happens while a battle is running: the board freezes until it resolves.',
              'The attacker retreats first when they can’t continue, and fleeing counts as a loss.',
            ]}
          />
        ),
      },
      {
        key: 'battle-line',
        icon: 'knight',
        label: 'The front line',
        body: (
          <Bullets
            items={[
              'Only the first 3 standing troops on each side fight in a round — the rest are reserves who step up as the front line falls.',
              'Each fighter clicks their own die to roll it.',
            ]}
          />
        ),
      },
      {
        key: 'battle-pairing',
        icon: 'dice',
        label: 'Pairing & rolls',
        body: (
          <Bullets
            items={[
              'Each side sorts its rolls from highest to lowest and pairs highest against highest; cannons always pair as their side’s lowest roll.',
              'The defender wins ties — except a cannon in the pair, which always wins its own ties.',
            ]}
          />
        ),
      },
      {
        key: 'battle-outcome',
        icon: 'capture',
        label: 'Winning pairs',
        body: (
          <Bullets
            items={[
              'Win by 2 or more: the loser dies. Win by 1: the loser is injured.',
              'Cannons are never injured — any lost roll destroys them.',
              'Injured defenders fight their next round as an injured fighter: they flee on a win and die on a loss or a tie.',
            ]}
          />
        ),
      },
    ]}
  />
);

/* ── Trade ───────────────────────────────────────────────────────────── */

export const TradePanel: React.FC = () => (
  <div className="flex flex-col gap-2">
    <section className={cardClass}>
      <CardHead icon="cards" name="Bank" />
      <Bullets
        items={[
          'Trade any 4 cards of one resource for 1 of another — the default rate, always available on your turn.',
        ]}
      />
    </section>
    <section className={cardClass}>
      <CardHead icon="ship" name="Ports" />
      <Bullets
        items={[
          'The 2:1 and 3:1 medallions on the coast are ports. Settle on a port’s vertex to unlock its rate.',
          'A 2:1 port trades only its own resource at the cheaper rate; a 3:1 port trades any resource.',
        ]}
      />
    </section>
    <section className={cardClass}>
      <CardHead icon="heal" name="Players" />
      <Bullets
        items={[
          'Offer trades to the whole table or accept a standing offer — trade pop-ups appear in the notice rail at the top.',
          'Only the player whose turn it is can trade.',
        ]}
      />
    </section>
  </div>
);

/* ── Cards ───────────────────────────────────────────────────────────── */

export const CardsPanel: React.FC = () => {
  const items = (Object.keys(DEVELOPMENT_CARD_META) as DevelopmentCardType[]).map((type) => ({
    key: `card-${type}`,
    icon: DEV_CARD_ICONS[type],
    label: DEVELOPMENT_CARD_META[type].label,
    body: (
      <>
        <p className="text-[12px] text-ink-faint m-0 mt-1">{DEVELOPMENT_CARD_META[type].description}</p>
        <p className="text-[11px] text-ink-faint m-0 mt-1">×{DEVELOPMENT_CARD_DISTRIBUTION[type]} in the deck</p>
      </>
    ),
  }));
  return <SectionedPanel items={items} />;
};

/* ── Capture ─────────────────────────────────────────────────────────── */

export const CapturePanel: React.FC = () => (
  <div className="flex flex-col gap-2">
    <section className={cardClass}>
      <CardHead icon="capture" name="Capturing" />
      <Bullets
        items={[
          'A healthy soldier standing on an enemy settlement or city can capture it for its action — it becomes yours.',
          'Captured buildings keep their level; capturing costs the soldier its action.',
        ]}
      />
    </section>
    <section className={cardClass}>
      <CardHead icon="road" name="Road chains" />
      <Bullets
        items={[
          'Roads recolor with the capture: every road chain reachable through empty vertices becomes yours — unless it ends at another player’s building.',
          'A chain stops at any building, at a junction (an empty vertex with 3 or more roads), or at a dead end. Walls count as roads and change hands along with them.',
        ]}
      />
    </section>
    <section className={cardClass}>
      <CardHead icon="crown" name="Knock-out" />
      <Bullets
        items={[
          'A player with no settlements, no cities and no soldiers is eliminated — they spectate for the rest of the game.',
          'Last player standing wins on the spot.',
        ]}
      />
    </section>
  </div>
);

/* ── Recipes ─────────────────────────────────────────────────────────── */

interface Recipe {
  icon: IconName;
  name: string;
  price?: Price;
  cost?: React.ReactNode;
  note: string;
  flag?: PieceFlag;
}

const RECIPES: Recipe[] = [
  { icon: 'road', name: 'Road', price: RoadPrice, note: 'Connects your settlements; counts toward Longest Road.' },
  { icon: 'settlement', name: 'Settlement', price: SettlementPrice, note: 'Worth 1 VP. Collects resources from adjacent hexes.' },
  { icon: 'city', name: 'City', price: CityPrice, note: 'Upgrades a settlement. Worth 2 VP; collects double resources.' },
  { icon: 'attack', name: 'Soldier', price: SoldierPrice, note: 'Garrisons a vertex; fights battles and the robber.' },
  {
    icon: 'heal',
    name: 'Heal soldier',
    cost: (
      <>
        {HealSoldierResources.map((r, i) => (
          <React.Fragment key={r}>
            {i > 0 && ' or '}
            {HealSoldierAmount} <GameIcon name={RESOURCE_ICONS[r]} size={13} className="inline -mt-0.5" />
          </React.Fragment>
        ))}
      </>
    ),
    note: 'Restores one injured soldier.',
  },
  { icon: 'cards', name: 'Development card', price: DevelopmentCardPrice, note: 'Draw a random development card.' },
];

const GATED_RECIPES: Recipe[] = [
  { icon: 'ship', name: 'Ship', price: ShipPrice, flag: 'ships', note: 'Sails coast and open water; ferries troops and can become a settlement on a coast.' },
  { icon: 'wall', name: 'Wall', price: WallPrice, flag: 'walls', note: 'Upgrades one of your roads; blocks enemy soldiers while yours cross freely.' },
  { icon: 'cannon', name: 'Cannon', price: CannonUpgradePrice, flag: 'cannons', note: 'Upgrades a healthy soldier on your settlement; station it to fire.' },
  { icon: 'cannon', name: 'Chain shot', price: SplashPrice, flag: 'cannons', note: 'A cannon shot that hits every soldier on the vertex — including yours.' },
  { icon: 'settlement', name: 'Settle ship', price: ShipSettlePrice, flag: 'ships', note: 'Converts your ship into a settlement on its coast.' },
];

export const RecipesPanel: React.FC<{ enabled: (flag?: PieceFlag) => boolean }> = ({ enabled }) => {
  const recipes = [...RECIPES, ...GATED_RECIPES].filter((r) => enabled(r.flag));
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-2">
      {recipes.map((r) => (
        <li key={r.name} className={cardClass}>
          <CardHead
            icon={r.icon}
            name={r.name}
            price={r.price}
            right={r.price ? undefined : <span className="text-[13px]">{r.cost}</span>}
          />
          <p className="text-[12px] text-ink-faint m-0 mt-1">{r.note}</p>
        </li>
      ))}
    </ul>
  );
};

/* ── Achievements ────────────────────────────────────────────────────── */

const ACHIEVEMENTS: { icon: IconName; name: string; vp: number; note: string; flag?: PieceFlag }[] = [
  { icon: 'settlement', name: 'Settlement', vp: 1, note: 'Each settlement you own.' },
  { icon: 'city', name: 'City', vp: 2, note: 'Each city you own.' },
  { icon: 'star', name: 'Victory Point card', vp: 1, note: 'Counted as soon as you draw it.' },
  { icon: 'road', name: 'Longest Road', vp: BONUS_VP, note: `The longest unbroken road chain, at least ${LONGEST_ROAD_MIN} roads.` },
  { icon: 'knight', name: 'Largest Army', vp: BONUS_VP, note: `The most soldiers on the board, at least ${LARGEST_ARMY_MIN}.` },
  { icon: 'crown', name: 'Conqueror', vp: BONUS_VP, note: `The most battles won against players, at least ${CONQUEROR_MIN}.` },
  { icon: 'ship', name: 'The Admiral', vp: ADMIRAL_VP, flag: 'ships', note: `The largest fleet, at least ${ADMIRAL_MIN} ships; each of your ships gains +1 sail step.` },
  { icon: 'wall', name: 'The Great Wall', vp: GREAT_WALL_VP, flag: 'walls', note: `The longest connected wall run, at least ${GREAT_WALL_MIN}; the holder's walls need a 5+ cannon roll to breach.` },
];

export const AchievementsPanel: React.FC<{ enabled: (flag?: PieceFlag) => boolean }> = ({ enabled }) => {
  const achievements = ACHIEVEMENTS.filter((a) => enabled(a.flag));
  return (
    <div>
      <p className="text-[12px] text-ink-faint m-0 mb-2">
        First to {WIN_VP} VP wins. Each bonus goes to a single player; on a tie the current holder keeps it.
      </p>
      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {achievements.map((a) => (
          <li key={a.name} className={cardClass}>
            <CardHead
              icon={a.icon}
              name={a.name}
              right={
                <span className="px-1.5 py-0.5 rounded bg-gold-pale border border-gold text-[12px] font-bold text-gold-deep">
                  +{a.vp} VP
                </span>
              }
            />
            <p className="text-[12px] text-ink-faint m-0 mt-1">{a.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
