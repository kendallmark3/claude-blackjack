import { describe, expect, it } from 'vitest';
import { canAffordDouble, canAffordSplit, dealHand, doubleHand, isBroke, newBank, payOut, splitHand } from './bank.js';
import { hit, stand } from './game.js';

const deck = (...ranks) => ranks.map((rank, i) => ({ rank, suit: '♠', id: `${rank}-${i}` }));
const bank = (bankroll, extra = {}) => ({ ...newBank(), bankroll, ...extra });

describe('bankroll', () => {
  it('starts at $1,000 with no winnings and no bonus', () => {
    expect(newBank()).toEqual({ bankroll: 1000, winnings: 0, bonusAwarded: false });
  });

  it('takes the bet off the bankroll when the hand is dealt', () => {
    const r = dealHand(newBank(), 10, deck('10', '10', '9', '7'));
    expect(r.bank.bankroll).toBe(990);
    expect(r.game.hands[0].bet).toBe(10);
  });

  it('only accepts $1, $5 or $10 bets the bankroll can cover', () => {
    expect(dealHand(newBank(), 25)).toBeNull();
    expect(dealHand(newBank(), 0)).toBeNull();
    expect(dealHand(bank(4), 5)).toBeNull();
    expect(dealHand(bank(4), 1)).not.toBeNull();
  });

  it('a win returns the stake plus winnings', () => {
    let { bank: b, game } = dealHand(newBank(), 10, deck('10', '10', '9', '7'));
    game = stand(game);
    const r = payOut(b, game);
    expect(r.net).toBe(10);
    expect(r.bank).toMatchObject({ bankroll: 1010, winnings: 10 });
  });

  it('a loss keeps the stake', () => {
    let { bank: b, game } = dealHand(newBank(), 5, deck('10', '10', '6', '6', 'K'));
    game = hit(game);
    expect(payOut(b, game).bank).toMatchObject({ bankroll: 995, winnings: -5 });
  });

  it('a push returns just the stake', () => {
    let { bank: b, game } = dealHand(newBank(), 5, deck('10', '10', '8', '8'));
    game = stand(game);
    expect(payOut(b, game).bank).toMatchObject({ bankroll: 1000, winnings: 0 });
  });

  it('blackjack pays 3:2', () => {
    const { bank: b, game } = dealHand(newBank(), 10, deck('A', '10', 'K', '5'));
    expect(payOut(b, game).bank).toMatchObject({ bankroll: 1015, winnings: 15 });
  });

  it('is broke below the smallest bet', () => {
    expect(isBroke(bank(0.5))).toBe(true);
    expect(isBroke(bank(1))).toBe(false);
  });
});

describe('splitting with money', () => {
  it('puts a second bet on the new hand', () => {
    const dealt = dealHand(newBank(), 10, deck('8', '10', '8', '7', '3', '2'));
    const r = splitHand(dealt.bank, dealt.game);
    expect(r.bank.bankroll).toBe(980);
    expect(r.game.hands.map((h) => h.bet)).toEqual([10, 10]);
  });

  it('is not allowed when the bankroll cannot cover the second bet', () => {
    const dealt = dealHand(bank(15), 10, deck('8', '10', '8', '7', '3', '2'));
    expect(dealt.bank.bankroll).toBe(5);
    expect(canAffordSplit(dealt.bank, dealt.game)).toBe(false);
    expect(splitHand(dealt.bank, dealt.game)).toBeNull();
  });

  it('settles each split bet separately', () => {
    // Hand 1: 8+3+K = 21 wins $10. Hand 2: 8+2+6 = 16 loses $10 to 17.
    let { bank: b, game } = dealHand(newBank(), 10, deck('8', '10', '8', '7', '3', '2', 'K', '6'));
    ({ bank: b, game } = splitHand(b, game));
    game = stand(hit(hit(game)));
    const r = payOut(b, game);
    expect(r.net).toBe(0);
    expect(r.bank).toMatchObject({ bankroll: 1000, winnings: 0 });
  });
});

describe('token bonus', () => {
  it('adds $500 the first time the bankroll reaches $1,500', () => {
    let { bank: b, game } = dealHand(bank(1490, { winnings: 490 }), 10, deck('10', '10', '9', '7'));
    game = stand(game);
    const r = payOut(b, game);
    expect(r.bonus).toBe(500);
    expect(r.bank).toEqual({ bankroll: 2000, winnings: 500, bonusAwarded: true });
  });

  it('is not paid below $1,500', () => {
    let { bank: b, game } = dealHand(bank(1489), 10, deck('10', '10', '9', '7'));
    game = stand(game);
    const r = payOut(b, game);
    expect(r.bonus).toBe(0);
    expect(r.bank.bankroll).toBe(1499);
  });

  it('is paid only once', () => {
    let { bank: b, game } = dealHand(bank(1600, { bonusAwarded: true }), 10, deck('10', '10', '9', '7'));
    game = stand(game);
    const r = payOut(b, game);
    expect(r.bonus).toBe(0);
    expect(r.bank.bankroll).toBe(1610);
  });

  it('does not count as winnings', () => {
    let { bank: b, game } = dealHand(bank(1495, { winnings: 495 }), 5, deck('10', '10', '9', '7'));
    game = stand(game);
    expect(payOut(b, game).bank.winnings).toBe(500);
  });
});

describe('doubling down with money', () => {
  it('takes a second bet and pays on the doubled amount', () => {
    let { bank: b, game } = dealHand(newBank(), 10, deck('6', '10', '5', '7', '9'));
    ({ bank: b, game } = doubleHand(b, game));
    expect(b.bankroll).toBe(980);
    expect(payOut(b, game).bank).toMatchObject({ bankroll: 1020, winnings: 20 });
  });

  it('a doubled loss costs twice the bet', () => {
    let { bank: b, game } = dealHand(newBank(), 10, deck('6', '10', '4', '7', '2'));
    ({ bank: b, game } = doubleHand(b, game));
    expect(payOut(b, game).bank).toMatchObject({ bankroll: 980, winnings: -20 });
  });

  it('is not allowed when the bankroll cannot cover the second bet', () => {
    const dealt = dealHand(bank(15), 10, deck('6', '10', '5', '7', '9'));
    expect(canAffordDouble(dealt.bank, dealt.game)).toBe(false);
    expect(doubleHand(dealt.bank, dealt.game)).toBeNull();
  });
});
