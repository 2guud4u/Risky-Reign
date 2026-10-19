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
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[13px]"
      >
        {price[k]} <GameIcon name={RESOURCE_ICONS[k]} size={14} />
      </span>
    ))}
  </span>
);

const cardClass = 'border border-gray-200 rounded-md p-2 bg-white';

const CardHead: React.FC<{ icon: IconName; name: string; price?: Price; right?: React.ReactNode }> = ({
  icon,
  name,
  price,
  right,
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[14px] font-semibold text-gray-800">
      <GameIcon name={icon} size={14} className="inline -mt-0.5" /> {name}
    </span>
    {price ? <CostChips price={price} /> : right}
  </div>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="m-0 mt-1 pl-4 list-disc text-[12px] text-gray-500 flex flex-col gap-0.5">
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
      <button
        key={s.key}
        type="button"
        onClick={() => document.getElementById(`info-${s.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="shrink-0 px-2 py-1 rounded border border-gray-200 bg-gray-50 text-[12px] font-semibold text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-left cursor-pointer"
      >
        <GameIcon name={s.icon} size={13} className="inline -mt-0.5" /> {s.label}
      </button>
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
      'Recruit on your settlement or city during the Action phase.',
      'Each soldier spends one action per phase: move along your roads, attack, or heal.',
      'Fresh recruits and freshly healed soldiers can’t move the same turn.',
      'Losing a fight by 1 injures; by 2 or more kills. Injured soldiers can’t attack until healed (double the recruit cost).',
      'Fight the robber beside your troops; capture the enemy settlement you stand on.',
    ],
  },
  {
    key: 'robber',
    icon: 'robber',
    name: 'Robber',
    bullets: [
      'A hex the robber sits on produces into the robber’s bag instead of your hand.',
      'Rolling a 7: anyone holding 8+ cards discards half (rounded down) into the bag before the robber moves.',
      'Beat it with a soldier to steal from the bag and move it one hex.',
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
      'Upgrade a healthy soldier standing on your settlement or city; it starts unstationed.',
      'Station to fire: aim a direction at an adjacent vertex. Margin 2+ kills, 1 injures — cannons win ties and never get injured: a lost roll is fatal.',
      'Chain shot (1 ore, toggle in Fire): rolls once against every soldier on the target vertex — even your own.',
      'Stationed beside a wall: roll 4+ to break it back into a road.',
      'Unstation to move; downgrade back to a soldier anywhere for its action. Shots are final — no undo.',
      'Aboard a ship it becomes naval artillery, firing 1 intersection out.',
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
      'Blocks enemy soldiers only — your own troops cross freely.',
      'A crossing enemy opens the gate: they pick 1–6, you roll. Match = they cross; either way their action is spent.',
      'A stationed cannon can break it on a 4+ — 5+ if the owner holds The Great Wall (the road survives). A captured settlement keeps the wall.',
    ],
  },
  {
    key: 'ship',
    icon: 'ship',
    name: 'Ship',
    price: ShipPrice,
    flag: 'ships',
    bullets: [
      'Build on a coast vertex your road or settlement touches.',
      'Sails ⌈roll ÷ 2⌉ steps each of your Action phases — free, and doesn’t spend troop actions.',
      'Board and land troops only on its coast vertex; each costs the troop’s action. Open sea can’t load or unload.',
      'An empty ship can be sailed by anyone; a crewed ship answers only to its owner.',
      'Convert it into a settlement on its own or an adjacent coast vertex (distance rule applies, no free garrison).',
      'Troops aboard can be attacked but can’t capture or start fights until they land.',
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
    ? 'Every player takes a Build phase in turn order — the dice player first.'
    : 'Only the dice player builds; the phase ends when they pass.';
  const actionBody = actionAround
    ? 'Every player takes an Action phase in turn order.'
    : 'Only the dice player acts; the phase ends when they pass.';
  const phases: { icon: IconName; name: string; bullets: string[] }[] = [
    {
      icon: 'dice',
      name: 'Dice',
      bullets: [
        'Click each die to roll. Settlements and cities beside a hex matching the total collect that hex’s resource.',
        'Rolling a 7 activates the robber instead of paying out (see the Robber card).',
        ...(turnMode?.secondRoll ? ['This game rolls a second time after everyone builds — with its own payouts.'] : []),
      ],
    },
    { icon: 'build', name: 'Build', bullets: [buildBody, 'Spend resources on roads, settlements, cities, ships — or buy a development card.'] },
    {
      icon: 'attack',
      name: 'Action',
      bullets: [actionBody, 'Each soldier spends one action: move, attack, capture, heal, or its piece-specific action. Ships sail too.'],
    },
    {
      icon: 'move',
      name: 'End turn',
      bullets: ['Pass with the phase button when you’re done — actions you didn’t take don’t carry over.'],
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
              'Pick your soldier(s) on a vertex with enemy troops, then Attack — or Fight the robber beside them.',
              'Nothing else happens while a battle runs: the board freezes until it resolves.',
              'Attacker retreats first when they can’t continue; fleeing counts as a loss.',
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
              'Only the first 3 standing troops per side fight each round — the rest are reserves that step up as the front falls.',
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
              'Each side sorts its rolls high→low and pairs highest-vs-highest; cannons always pair as their side’s lowest roll.',
              'Defender wins ties — except a cannon in the pair, which wins its own ties.',
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
              'Cannons are never injured — any lost roll kills them.',
              'Injured defenders get an injured fight: they flee on a win, die on a loss or tie.',
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
          'Trade any 4 of one resource for 1 of another — the default rate, always available on your turn.',
        ]}
      />
    </section>
    <section className={cardClass}>
      <CardHead icon="ship" name="Ports" />
      <Bullets
        items={[
          'The 2:1 / 3:1 medallions on the coast are ports. Settle on a port’s vertex to earn its rate.',
          'A 2:1 port gives its resource cheaper; a 3:1 port works for any resource.',
        ]}
      />
    </section>
    <section className={cardClass}>
      <CardHead icon="heal" name="Players" />
      <Bullets
        items={[
          'Offer trades to the table or accept a standing offer — the trade pop-ups ride the top notice rail.',
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
        <p className="text-[12px] text-gray-500 m-0 mt-1">{DEVELOPMENT_CARD_META[type].description}</p>
        <p className="text-[11px] text-gray-400 m-0 mt-1">×{DEVELOPMENT_CARD_DISTRIBUTION[type]} in the deck</p>
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
          'Captured buildings keep their level; capture costs the soldier’s action.',
        ]}
      />
    </section>
    <section className={cardClass}>
      <CardHead icon="road" name="Road chains" />
      <Bullets
        items={[
          'Roads recolor with the capture: each road chain reachable through empty vertices becomes yours — unless it ends at another player’s building.',
          'A chain stops at any building, a junction (an empty vertex with 3+ roads), or a dead end. Walls are roads too and change hands with them.',
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
  { icon: 'settlement', name: 'Settlement', price: SettlementPrice, note: '1 VP. Collects resources from adjacent hexes.' },
  { icon: 'city', name: 'City', price: CityPrice, note: 'Upgrade a settlement. 2 VP; collects double resources.' },
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
  { icon: 'ship', name: 'Ship', price: ShipPrice, flag: 'ships', note: 'Sails coast and open water; ferries troops, can settle on a coast.' },
  { icon: 'wall', name: 'Wall', price: WallPrice, flag: 'walls', note: 'Upgrades one of your roads; blocks enemy soldiers, yours cross freely.' },
  { icon: 'cannon', name: 'Cannon', price: CannonUpgradePrice, flag: 'cannons', note: 'Upgrades a healthy soldier on your settlement; station it to fire.' },
  { icon: 'cannon', name: 'Chain shot', price: SplashPrice, flag: 'cannons', note: 'A cannon shot hitting every soldier on the vertex — yours included.' },
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
          <p className="text-[12px] text-gray-500 m-0 mt-1">{r.note}</p>
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
  { icon: 'road', name: 'Longest Road', vp: BONUS_VP, note: `Longest unbroken road chain, at least ${LONGEST_ROAD_MIN} roads.` },
  { icon: 'knight', name: 'Largest Army', vp: BONUS_VP, note: `Most soldiers on the board, at least ${LARGEST_ARMY_MIN}.` },
  { icon: 'crown', name: 'Conqueror', vp: BONUS_VP, note: `Most battles won against players, at least ${CONQUEROR_MIN}.` },
  { icon: 'ship', name: 'The Admiral', vp: ADMIRAL_VP, flag: 'ships', note: `Largest fleet, at least ${ADMIRAL_MIN} ships; each of your ships gains +1 sail step.` },
  { icon: 'wall', name: 'The Great Wall', vp: GREAT_WALL_VP, flag: 'walls', note: `Longest connected wall run, at least ${GREAT_WALL_MIN}; holder's walls need a 5+ cannon roll to breach.` },
];

export const AchievementsPanel: React.FC<{ enabled: (flag?: PieceFlag) => boolean }> = ({ enabled }) => {
  const achievements = ACHIEVEMENTS.filter((a) => enabled(a.flag));
  return (
    <div>
      <p className="text-[12px] text-gray-500 m-0 mb-2">
        First to {WIN_VP} VP wins. Bonuses go to one player; a tie keeps the current holder.
      </p>
      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {achievements.map((a) => (
          <li key={a.name} className={cardClass}>
            <CardHead
              icon={a.icon}
              name={a.name}
              right={
                <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-[12px] font-bold text-amber-800">
                  +{a.vp} VP
                </span>
              }
            />
            <p className="text-[12px] text-gray-500 m-0 mt-1">{a.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
