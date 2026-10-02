import { describe, expect, it } from 'vitest';
import {
  canHit,
  canDouble,
  canSplit,
  canStand,
  createDeck,
  doubleDown,
  handValue,
  hit,
  isBlackjack,
  roundNet,
  shuffle,
  split,
  stand,
  startRound,
} from './game.js';

// Build a stacked deck from ranks. Deal order is player, dealer, player, dealer, then draws.
const deck = (...ranks) => ranks.map((rank, i) => ({ rank, suit: '♠', id: `${rank}-${i}` }));
const cards = (...ranks) => deck(...ranks);
const ranksOf = (cs) => cs.map((c) => c.rank);

describe('deck', () => {
  it('has 52 unique cards', () => {
    const d = createDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d.map((c) => c.id)).size).toBe(52);
  });

  it('shuffling keeps the same cards', () => {
    const d = createDeck();
    const s = shuffle(d);
    expect(s).toHaveLength(52);
    expect(new Set(s.map((c) => c.id))).toEqual(new Set(d.map((c) => c.id)));
  });
});

describe('hand values and Aces', () => {
  it.each([
    [['A', 'K'], 21, true],
    [['A', 'A'], 12, true],
    [['A', 'A', '9'], 21, true],
    [['A', '6', '10'], 17, false],
    [['A', '6'], 17, true],
    [['K', 'Q', '5'], 25, false],
    [['7', '8'], 15, false],
    [['A', 'A', 'A', 'A'], 14, true],
  ])('%j totals %i (soft: %s)', (ranks, total, soft) => {
    expect(handValue(cards(...ranks))).toEqual({ total, soft });
  });
});

describe('dealing', () => {
  it('deals player, dealer, player, dealer from the top of the deck', () => {
    const s = startRound(deck('9', '10', '7', '8', '2'));
    expect(ranksOf(s.hands[0].cards)).toEqual(['9', '7']);
    expect(ranksOf(s.dealer)).toEqual(['10', '8']);
    expect(s.phase).toBe('player');
    expect(s.deck).toHaveLength(1);
  });
});

describe('blackjack', () => {
  it('player blackjack wins immediately and dealer does not draw', () => {
    const s = startRound(deck('A', '10', 'K', '5', '9'));
    expect(s.phase).toBe('done');
    expect(s.dealer).toHaveLength(2);
    expect(s.hands[0].outcome).toMatchObject({ result: 'win', reason: 'Blackjack!' });
  });

  it('both blackjack is a push', () => {
    const s = startRound(deck('A', 'A', 'K', 'Q'));
    expect(s.hands[0].outcome.result).toBe('push');
  });

  it('dealer blackjack ends the round as a loss', () => {
    const s = startRound(deck('10', 'A', '9', 'K'));
    expect(s.phase).toBe('done');
    expect(s.hands[0].outcome).toMatchObject({ result: 'lose', reason: 'Dealer has blackjack' });
  });

  it('a three-card 21 is not blackjack, so it only pushes against a dealer 21', () => {
    // Player 7+4, hits 10 = 21. Dealer 10+6, draws 5 = 21.
    let s = startRound(deck('7', '10', '4', '6', '10', '5'));
    s = hit(s);
    expect(isBlackjack(s.hands[0])).toBe(false);
    expect(s.hands[0].outcome).toMatchObject({ result: 'push', reason: 'Push at 21' });
  });
});

describe('hit and stand', () => {
  it('hit adds a card to the active hand', () => {
    let s = startRound(deck('5', '10', '3', '7', '2'));
    s = hit(s);
    expect(ranksOf(s.hands[0].cards)).toEqual(['5', '3', '2']);
    expect(s.phase).toBe('player');
  });

  it('busting loses and the dealer does not draw', () => {
    let s = startRound(deck('10', '10', '6', '6', 'K', '5'));
    s = hit(s);
    expect(s.phase).toBe('done');
    expect(s.hands[0].outcome).toMatchObject({ result: 'lose', reason: 'Bust' });
    expect(s.dealer).toHaveLength(2);
  });

  it('reaching 21 by hitting ends the hand automatically', () => {
    let s = startRound(deck('5', '10', '6', '8', 'K'));
    s = hit(s);
    expect(s.phase).toBe('done');
    expect(handValue(s.hands[0].cards).total).toBe(21);
  });

  it('stand hands play to the dealer', () => {
    let s = startRound(deck('10', '10', '9', '7'));
    s = stand(s);
    expect(s.phase).toBe('done');
    expect(s.hands[0].outcome).toMatchObject({ result: 'win', reason: '19 beats 17' });
  });

  it('actions do nothing once the round is over', () => {
    let s = startRound(deck('10', '10', '9', '7'));
    s = stand(s);
    expect(canHit(s)).toBe(false);
    expect(canStand(s)).toBe(false);
    expect(hit(s)).toBe(s);
    expect(stand(s)).toBe(s);
  });
});

describe('dealer rule', () => {
  it('dealer hits 16', () => {
    let s = startRound(deck('10', '10', '8', '6', '5'));
    s = stand(s);
    expect(ranksOf(s.dealer)).toEqual(['10', '6', '5']);
    expect(s.hands[0].outcome.result).toBe('lose');
  });

  it('dealer stands on soft 17', () => {
    let s = startRound(deck('10', 'A', '8', '6', '5'));
    s = stand(s);
    expect(ranksOf(s.dealer)).toEqual(['A', '6']);
    expect(s.hands[0].outcome).toMatchObject({ result: 'win', reason: '18 beats 17' });
  });

  it('dealer keeps hitting soft totals below 17', () => {
    // Dealer A+5 = soft 16, draws 10 -> hard 16, draws 3 -> 19.
    let s = startRound(deck('10', 'A', '8', '5', '10', '3'));
    s = stand(s);
    expect(ranksOf(s.dealer)).toEqual(['A', '5', '10', '3']);
    expect(s.hands[0].outcome.result).toBe('lose');
  });

  it('dealer bust means player wins', () => {
    let s = startRound(deck('10', '10', '7', '6', 'K'));
    s = stand(s);
    expect(s.hands[0].outcome).toMatchObject({ result: 'win', reason: 'Dealer busts' });
  });

  it('equal totals push', () => {
    let s = startRound(deck('10', '10', '8', '8'));
    s = stand(s);
    expect(s.hands[0].outcome).toMatchObject({ result: 'push', reason: 'Push at 18' });
  });
});

describe('split', () => {
  it('is available for a pair of the same rank', () => {
    expect(canSplit(startRound(deck('8', '10', '8', '7')))).toBe(true);
  });

  it('is not available for different ranks, even both worth 10', () => {
    expect(canSplit(startRound(deck('K', '10', 'Q', '7')))).toBe(false);
    expect(canSplit(startRound(deck('8', '10', '9', '7')))).toBe(false);
  });

  it('is not available after hitting', () => {
    let s = startRound(deck('2', '10', '2', '7', '3'));
    s = hit(s);
    expect(canSplit(s)).toBe(false);
  });

  it('creates two hands, each with a second card, playing the first hand', () => {
    let s = startRound(deck('8', '10', '8', '7', '3', '2'));
    s = split(s);
    expect(s.hands).toHaveLength(2);
    expect(ranksOf(s.hands[0].cards)).toEqual(['8', '3']);
    expect(ranksOf(s.hands[1].cards)).toEqual(['8', '2']);
    expect(s.active).toBe(0);
    expect(canSplit(s)).toBe(false);
  });

  it('plays hands in order before the dealer', () => {
    let s = startRound(deck('8', '10', '8', '7', '3', '2'));
    s = split(s);
    s = stand(s);
    expect(s.active).toBe(1);
    expect(s.phase).toBe('player');
    s = stand(s);
    expect(s.phase).toBe('done');
  });

  it('resolves each hand independently', () => {
    // Hand 1: 8+3, hit K = 21. Hand 2: 8+2, hit 6 = 16. Dealer 10+7 = 17.
    let s = startRound(deck('8', '10', '8', '7', '3', '2', 'K', '6'));
    s = split(s);
    s = hit(s); // hand 1 -> 21, auto-advances
    expect(s.active).toBe(1);
    s = hit(s); // hand 2 -> 16
    s = stand(s);
    expect(s.hands[0].outcome).toMatchObject({ result: 'win', reason: '21 beats 17' });
    expect(s.hands[1].outcome).toMatchObject({ result: 'lose', reason: '17 beats 16' });
  });

  it('one hand busting does not decide the other', () => {
    let s = startRound(deck('8', '10', '8', '9', '6', 'K', 'Q'));
    s = split(s);
    s = hit(s); // hand 1: 8+6+Q = 24 bust
    expect(s.active).toBe(1);
    s = stand(s); // hand 2: 8+K = 18 vs 19
    expect(s.hands[0].outcome.result).toBe('lose');
    expect(s.hands[1].outcome).toMatchObject({ result: 'lose', reason: '19 beats 18' });
  });

  it('dealer does not draw when every split hand busts', () => {
    let s = startRound(deck('8', '10', '8', '6', '6', '6', 'K', 'K', '5'));
    s = split(s);
    s = hit(s);
    s = hit(s);
    expect(s.phase).toBe('done');
    expect(s.dealer).toHaveLength(2);
  });

  it('a two-card 21 after splitting is not blackjack', () => {
    // Split Aces, each receives a 10-value card. Dealer has 10+10 = 20.
    let s = startRound(deck('A', '10', 'A', 'K', 'Q', 'J'));
    s = split(s);
    expect(s.phase).toBe('done');
    for (const hand of s.hands) {
      expect(isBlackjack(hand)).toBe(false);
      expect(hand.outcome).toMatchObject({ result: 'win', reason: '21 beats 20' });
    }
  });

  it('a split 21 only pushes against a dealer 21', () => {
    let s = startRound(deck('A', '10', 'A', '6', 'K', '2', '5'));
    s = split(s); // hand 1: A+K = 21 (auto stands), hand 2: A+2
    s = stand(s); // dealer 10+6 draws 5 = 21
    expect(ranksOf(s.dealer)).toEqual(['10', '6', '5']);
    expect(s.hands[0].outcome).toMatchObject({ result: 'push', reason: 'Push at 21' });
  });
});

describe('payouts', () => {
  it('a win pays the bet 1:1', () => {
    const s = stand(startRound(deck('10', '10', '9', '7'), 10));
    expect(s.hands[0].outcome.net).toBe(10);
  });

  it('blackjack pays 3:2', () => {
    expect(startRound(deck('A', '10', 'K', '5'), 10).hands[0].outcome.net).toBe(15);
    expect(startRound(deck('A', '10', 'K', '5'), 1).hands[0].outcome.net).toBe(1.5);
  });

  it('a loss costs the bet and a push costs nothing', () => {
    expect(startRound(deck('10', 'A', '9', 'K'), 5).hands[0].outcome.net).toBe(-5);
    expect(stand(startRound(deck('10', '10', '8', '8'), 5)).hands[0].outcome.net).toBe(0);
  });

  it('a split 21 pays 1:1, not 3:2', () => {
    const s = split(startRound(deck('A', '10', 'A', 'K', 'Q', 'J'), 10));
    expect(s.hands.map((h) => h.outcome.net)).toEqual([10, 10]);
    expect(roundNet(s)).toBe(20);
  });

  it('each split hand carries its own copy of the bet', () => {
    let s = startRound(deck('8', '10', '8', '9', '6', 'K', 'Q'), 5);
    s = split(s);
    expect(s.hands.map((h) => h.bet)).toEqual([5, 5]);
    s = hit(s); // hand 1 busts
    s = stand(s); // hand 2: 18 vs 19
    expect(roundNet(s)).toBe(-10);
  });
});

describe('double down', () => {
  it('is available on the first two cards only', () => {
    let s = startRound(deck('6', '10', '5', '7', '2', '9'));
    expect(canDouble(s)).toBe(true);
    s = hit(s);
    expect(canDouble(s)).toBe(false);
    expect(doubleDown(s)).toBe(s);
  });

  it('doubles the bet, deals exactly one card, and ends the hand', () => {
    // Player 6+5 = 11 doubles, draws 9 = 20. Dealer 10+7 = 17.
    let s = startRound(deck('6', '10', '5', '7', '9', '4'), 10);
    s = doubleDown(s);
    const [hand] = s.hands;
    expect(ranksOf(hand.cards)).toEqual(['6', '5', '9']);
    expect(hand.bet).toBe(20);
    expect(hand.doubled).toBe(true);
    expect(s.phase).toBe('done');
    expect(hand.outcome).toEqual({ result: 'win', reason: '20 beats 17', net: 20 });
  });

  it('stands after one card even on a low total', () => {
    // Player 6+4 = 10 doubles, draws 2 = 12. Dealer 10+7 = 17.
    let s = startRound(deck('6', '10', '4', '7', '2'), 5);
    s = doubleDown(s);
    expect(handValue(s.hands[0].cards).total).toBe(12);
    expect(s.hands[0].outcome).toMatchObject({ result: 'lose', net: -10 });
  });

  it('a doubled hand can still bust and loses the doubled bet', () => {
    let s = startRound(deck('10', '10', '6', '7', 'K'), 5);
    s = doubleDown(s);
    expect(s.hands[0].outcome).toEqual({ result: 'lose', reason: 'Bust', net: -10 });
    expect(s.dealer).toHaveLength(2);
  });

  it('a doubled push returns nothing extra', () => {
    let s = startRound(deck('6', '10', '4', '8', '8'), 5);
    s = doubleDown(s);
    expect(s.hands[0].outcome).toMatchObject({ result: 'push', net: 0 });
  });

  it('works on a split hand and only affects that hand', () => {
    // Split 5s: hand 1 = 5+6 = 11 doubles, draws 10 = 21. Hand 2 = 5+3, stands on 8. Dealer 10+8 = 18.
    let s = startRound(deck('5', '10', '5', '8', '6', '3', '10'), 10);
    s = split(s);
    expect(canDouble(s)).toBe(true);
    s = doubleDown(s);
    expect(s.active).toBe(1);
    expect(s.phase).toBe('player');
    s = stand(s);
    expect(s.hands.map((h) => h.bet)).toEqual([20, 10]);
    expect(s.hands.map((h) => h.outcome.net)).toEqual([20, -10]);
  });
});
