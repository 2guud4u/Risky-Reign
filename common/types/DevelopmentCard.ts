/**
 * Development Card types for Catan-style gameplay.
 * 
 * Standard Catan deck distribution (25 cards total):
 * - Knights: 4 - move robber, steal from player with most resource cards
 * - Road Building: 1 - build up to 2 roads at no cost
 * - Year of Plenty: 1 - take any 2 resources from the bank
 * - Monopoly: 1 - name a resource type, all other players give you their cards of that type
 * - Victory Points: 3 - each worth 1 victory point
 */

export type DevelopmentCardType =
  | 'knight'
  | 'road_building'
  | 'year_of_plenty'
  | 'monopoly'
  | 'victory_point';

/** Standard distribution of development cards in the deck. */
export const DEVELOPMENT_CARD_DISTRIBUTION: Record<DevelopmentCardType, number> = {
  knight: 4,
  road_building: 1,
  year_of_plenty: 1,
  monopoly: 1,
  victory_point: 3,
};

/** Total number of development cards in the deck. */
export const TOTAL_DEVELOPMENT_CARDS = Object.values(DEVELOPMENT_CARD_DISTRIBUTION).reduce(
  (sum, count) => sum + count,
  0
);

/** Display metadata for each development card type. */
export const DEVELOPMENT_CARD_META: Record<DevelopmentCardType, { label: string; icon: string; description: string }> = {
  knight: {
    label: 'Knight',
    icon: '⚔️',
    description: 'Move the robber to a new hex and steal a random resource card from a player next to that hex.',
  },
  road_building: {
    label: 'Road Building',
    icon: '🛤️',
    description: 'Build up to 2 roads at no cost immediately.',
  },
  year_of_plenty: {
    label: 'Year of Plenty',
    icon: '🎁',
    description: 'Take any 2 resources from the bank.',
  },
  monopoly: {
    label: 'Monopoly',
    icon: '💰',
    description: 'Name one resource type. All other players must give you all their cards of that type.',
  },
  victory_point: {
    label: 'Victory Point',
    icon: '⭐',
    description: 'Worth 1 victory point.',
  },
};

/** Generate a shuffled deck of development cards based on the standard distribution. */
export function generateDevelopmentCardDeck(): DevelopmentCardType[] {
  const deck: DevelopmentCardType[] = [];
  
  for (const [cardType, count] of Object.entries(DEVELOPMENT_CARD_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      deck.push(cardType as DevelopmentCardType);
    }
  }
  
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}
