// Pure blackjack rules. Every action takes a game state and returns a new one;
// the React UI only renders state and calls these functions.

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit, id: `${rank}${suit}` });
  }
  return deck;
}

export function shuffle(cards, random = Math.random) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

// Aces count as 11 until that would bust the hand, then as 1.
// `soft` means an Ace is still being counted as 11.
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isNatural(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

// A 21 made on a split hand is never blackjack.
export function isBlackjack(hand) {
  return !hand.fromSplit && isNatural(hand.cards);
}

export function isBust(hand) {
  return handValue(hand.cards).total > 21;
}

function newHand(cards, bet, fromSplit = false) {
  return { cards, bet, fromSplit, doubled: false, done: false, outcome: null };
}

function clone(state) {
  return {
    ...state,
    deck: [...state.deck],
    dealer: [...state.dealer],
    hands: state.hands.map((h) => ({ ...h, cards: [...h.cards] })),
  };
}

function draw(state) {
  return state.deck.shift();
}

// Deal order: player, dealer, player, dealer. The dealer's second card is the hole card.
export function startRound(deck = shuffle(createDeck()), bet = 1) {
  const state = { deck: [...deck], dealer: [], hands: [], active: 0, phase: 'player' };
  const p1 = draw(state);
  const d1 = draw(state);
  const p2 = draw(state);
  const d2 = draw(state);
  state.dealer = [d1, d2];
  state.hands = [newHand([p1, p2], bet)];

  // Either side holding blackjack ends the round immediately.
  if (isBlackjack(state.hands[0]) || isNatural(state.dealer)) return finishRound(state);
  return advance(state);
}

export function canHit(state) {
  return state?.phase === 'player';
}

export function canStand(state) {
  return state?.phase === 'player';
}

// One split per round, only on the opening two cards, only when both cards share a rank.
export function canSplit(state) {
  if (state?.phase !== 'player' || state.hands.length !== 1) return false;
  const [a, b, ...rest] = state.hands[0].cards;
  return rest.length === 0 && a.rank === b.rank;
}

// Double down: allowed on any first two cards, including a split hand.
export function canDouble(state) {
  return state?.phase === 'player' && state.hands[state.active].cards.length === 2;
}

export function hit(state) {
  if (!canHit(state)) return state;
  const next = clone(state);
  next.hands[next.active].cards.push(draw(next));
  return advance(next);
}

export function stand(state) {
  if (!canStand(state)) return state;
  const next = clone(state);
  next.hands[next.active].done = true;
  return advance(next);
}

// Doubles the hand's bet, deals exactly one more card, and ends the hand.
export function doubleDown(state) {
  if (!canDouble(state)) return state;
  const next = clone(state);
  const hand = next.hands[next.active];
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(draw(next));
  hand.done = true;
  return advance(next);
}

// Each split hand gets its second card right away and carries the original bet;
// hands are then played in order.
export function split(state) {
  if (!canSplit(state)) return state;
  const next = clone(state);
  const [a, b] = next.hands[0].cards;
  const { bet } = next.hands[0];
  next.hands = [newHand([a, draw(next)], bet, true), newHand([b, draw(next)], bet, true)];
  next.active = 0;
  return advance(next);
}

// Close out any hand that has reached 21 or busted, then move to the next
// unfinished hand. When none are left, the dealer plays.
function advance(state) {
  for (const hand of state.hands) {
    if (handValue(hand.cards).total >= 21) hand.done = true;
  }
  while (state.active < state.hands.length && state.hands[state.active].done) state.active++;
  if (state.active >= state.hands.length) return finishRound(state);
  return state;
}

// The dealer only draws when some player hand still needs to be beaten.
// Dealer stands on all 17s, including soft 17.
function finishRound(state) {
  const needsDealer =
    !isNatural(state.dealer) && state.hands.some((h) => !isBust(h) && !isBlackjack(h));
  if (needsDealer) {
    while (handValue(state.dealer).total < 17) state.dealer.push(draw(state));
  }
  for (const hand of state.hands) {
    hand.done = true;
    hand.outcome = settle(hand, state.dealer);
  }
  state.active = -1;
  state.phase = 'done';
  return state;
}

// `net` is what the hand's bet won or lost: wins pay 1:1, blackjack pays 3:2.
export function settle(hand, dealerCards) {
  const outcome = judge(hand, dealerCards);
  const multiplier =
    outcome.result === 'win' ? (isBlackjack(hand) ? 1.5 : 1) : outcome.result === 'lose' ? -1 : 0;
  return { ...outcome, net: hand.bet * multiplier };
}

export function roundNet(state) {
  return state.hands.reduce((sum, h) => sum + h.outcome.net, 0);
}

function judge(hand, dealerCards) {
  const player = handValue(hand.cards).total;
  const dealer = handValue(dealerCards).total;
  const playerBJ = isBlackjack(hand);
  const dealerBJ = isNatural(dealerCards);

  if (player > 21) return { result: 'lose', reason: 'Bust' };
  if (playerBJ && dealerBJ) return { result: 'push', reason: 'Both have blackjack' };
  if (playerBJ) return { result: 'win', reason: 'Blackjack!' };
  if (dealerBJ) return { result: 'lose', reason: 'Dealer has blackjack' };
  if (dealer > 21) return { result: 'win', reason: 'Dealer busts' };
  if (player > dealer) return { result: 'win', reason: `${player} beats ${dealer}` };
  if (player < dealer) return { result: 'lose', reason: `${dealer} beats ${player}` };
  return { result: 'push', reason: `Push at ${player}` };
}
