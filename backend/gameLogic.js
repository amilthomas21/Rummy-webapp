const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RANK_VAL = {A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};
const HIGH_CARDS = ['A','K','Q','J','10'];

function buildDeck() {
  let deck = [];
  for (let i = 0; i < 3; i++) {
    for (let suit of SUITS)
      for (let rank of RANKS)
        deck.push({ rank, suit, id: `${rank}${suit}${i}`, isJoker: false });
    deck.push({ rank: 'JK', suit: '*', id: `joker${i}`, isJoker: true });
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealCards(numPlayers) {
  let deck = shuffle(buildDeck());
  let cutCard = deck.find(c => !c.isJoker);
  deck = deck.filter(c => c.id !== cutCard.id);
  let hands = [];
  for (let i = 0; i < numPlayers; i++) hands.push(deck.splice(0, 13));
  let discardPile = [deck.splice(0, 1)[0]];
  return { deck, hands, discardPile, cutRank: cutCard.rank, cutCard };
}

function isJoker(card, cutRank) {
  return card.isJoker || card.rank === cutRank;
}

function cardPoints(card, cutRank) {
  if (isJoker(card, cutRank)) return 0;
  if (HIGH_CARDS.includes(card.rank)) return 10;
  return RANK_VAL[card.rank];
}

// Check if cards form a valid pure sequence (no jokers)
// Supports: A-2-3, 2-3-4...Q-K, J-Q-K-A (wrap around with Ace)
// Also supports Thennali: 3 or 4 same rank same suit
function validatePureSequence(cards) {
  if (!cards || cards.length < 3) return false;
  if (cards.some(c => c.isJoker)) return false;

  // Check Thennali: all same rank AND same suit
  if (isThennali(cards)) return true;

  // All must be same suit
  const suits = [...new Set(cards.map(c => c.suit))];
  if (suits.length > 1) return false;

  const vals = cards.map(c => RANK_VAL[c.rank]).sort((a, b) => a - b);

  // Check for duplicate values
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] === vals[i-1]) return false;
  }

  // Normal consecutive check
  let isConsec = true;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] - vals[i-1] !== 1) { isConsec = false; break; }
  }
  if (isConsec) return true;

  // Wrap-around: J-Q-K-A (J=11,Q=12,K=13,A=1)
  // If contains A(1) and K(13), treat A as 14
  if (vals.includes(1) && vals.includes(13)) {
    const adjusted = vals.map(v => v === 1 ? 14 : v).sort((a, b) => a - b);
    let ok = true;
    for (let i = 1; i < adjusted.length; i++) {
      if (adjusted[i] - adjusted[i-1] !== 1) { ok = false; break; }
    }
    if (ok) return true;
  }

  return false;
}

// Thennali: 3 or 4 cards of same rank AND same suit
function isThennali(cards) {
  if (cards.length < 3 || cards.length > 4) return false;
  if (cards.some(c => c.isJoker)) return false;
  const ranks = [...new Set(cards.map(c => c.rank))];
  const suits = [...new Set(cards.map(c => c.suit))];
  return ranks.length === 1 && suits.length === 1;
}

// Validate sequence with jokers allowed
function validateSequenceWithJoker(cards, cutRank) {
  if (!cards || cards.length < 3) return false;

  const nonJokers = cards.filter(c => !isJoker(c, cutRank));
  const jokerCount = cards.filter(c => isJoker(c, cutRank)).length;

  if (nonJokers.length === 0) return false;

  // Check Thennali (same rank same suit, joker can fill missing)
  if (nonJokers.length >= 2) {
    const ranks = [...new Set(nonJokers.map(c => c.rank))];
    const suits = [...new Set(nonJokers.map(c => c.suit))];
    if (ranks.length === 1 && suits.length === 1) {
      // Thennali with joker fill
      return (nonJokers.length + jokerCount) >= 3 && (nonJokers.length + jokerCount) <= 4;
    }
  }

  // Check set: same rank, ALL different suits
  if (isValidSet(nonJokers, jokerCount)) return true;

  // Check sequence: same suit, consecutive
  const suits = [...new Set(nonJokers.map(c => c.suit))];
  if (suits.length > 1) return false;

  const vals = nonJokers.map(c => RANK_VAL[c.rank]).sort((a, b) => a - b);

  // No duplicate values
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] === vals[i-1]) return false;
  }

  // Normal sequence with gaps filled by jokers
  let gaps = 0;
  for (let i = 1; i < vals.length; i++) gaps += vals[i] - vals[i-1] - 1;
  if (gaps <= jokerCount) return true;

  // Wrap-around A-K sequence
  if (vals.includes(1) && vals.includes(13)) {
    const adjusted = vals.map(v => v === 1 ? 14 : v).sort((a, b) => a - b);
    let wgaps = 0;
    for (let i = 1; i < adjusted.length; i++) wgaps += adjusted[i] - adjusted[i-1] - 1;
    if (wgaps <= jokerCount) return true;
  }

  return false;
}

// Valid set: same rank, all different suits (no duplicate suits)
// Max 4 cards (one per suit)
function isValidSet(nonJokers, jokerCount) {
  if (!nonJokers || nonJokers.length === 0) return false;
  const total = nonJokers.length + jokerCount;
  if (total < 3 || total > 4) return false;

  // All same rank
  const ranks = [...new Set(nonJokers.map(c => c.rank))];
  if (ranks.length > 1) return false;

  // All different suits (no duplicate suits)
  const suits = nonJokers.map(c => c.suit);
  const uniqueSuits = new Set(suits);
  if (uniqueSuits.size !== suits.length) return false; // duplicate suit found

  return true;
}

// Win validation:
// 1. Total 13 cards across all groups
// 2. At least one pure sequence (Main Rummy)
// 3. Must have at least one group with 4 cards
// 4. All groups valid (sequence or set)
// 5. Each group min 3 cards
function validateWin(groups, cutRank) {
  if (!groups || groups.length < 2) return false;
  const nonEmpty = groups.filter(g => g && g.length > 0);
  if (nonEmpty.length < 2) return false;

  const total = nonEmpty.reduce((s, g) => s + g.length, 0);
  if (total !== 13) return false;

  if (nonEmpty.some(g => g.length < 3)) return false;

  // Must have at least one 4-card group
  if (!nonEmpty.some(g => g.length >= 4)) return false;

  // Must have at least one pure sequence
  if (!nonEmpty.some(g => validatePureSequence(g))) return false;

  // All groups must be valid
  if (!nonEmpty.every(g => validateSequenceWithJoker(g, cutRank))) return false;

  return true;
}

function calcRoundScore(playerState, cutRank, isWinner) {
  if (isWinner) return 0;
  const { groups, hand, hasMainRummy, hasSecondRummy } = playerState;
  if (!hasMainRummy) return 80;
  const ungrouped = [...hand];
  if (!hasSecondRummy) {
    const nonEmpty = (groups || []).filter(g => g && g.length > 0);
    for (let i = 0; i < nonEmpty.length; i++) {
      if (!validatePureSequence(nonEmpty[i])) ungrouped.push(...nonEmpty[i]);
    }
  }
  return ungrouped.reduce((sum, c) => sum + cardPoints(c, cutRank), 0);
}

module.exports = {
  buildDeck, shuffle, dealCards, isJoker,
  cardPoints, validatePureSequence, validateSequenceWithJoker,
  validateWin, calcRoundScore, isValidSet, isThennali
};