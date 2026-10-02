// Play-money bankroll. Bets come off the bankroll when placed and are paid
// back with winnings when the round settles. No real money is involved.
import { canDouble, canSplit, doubleDown, roundNet, split, startRound } from './game.js';

export const STARTING_BANKROLL = 1000;
export const BET_SIZES = [1, 5, 10];
export const BONUS_THRESHOLD = 1500;
export const BONUS_TOKENS = 500;

export function newBank() {
  return { bankroll: STARTING_BANKROLL, winnings: 0, bonusAwarded: false };
}

export function isBroke(bank) {
  return bank.bankroll < Math.min(...BET_SIZES);
}

// Returns null when the bet isn't one of the offered sizes or can't be covered.
export function dealHand(bank, bet, deck) {
  if (!BET_SIZES.includes(bet) || bank.bankroll < bet) return null;
  return { bank: { ...bank, bankroll: bank.bankroll - bet }, game: startRound(deck, bet) };
}

// Splitting puts a second bet, equal to the first, on the new hand.
export function canAffordSplit(bank, game) {
  return canSplit(game) && bank.bankroll >= game.hands[0].bet;
}

export function splitHand(bank, game) {
  if (!canAffordSplit(bank, game)) return null;
  return { bank: { ...bank, bankroll: bank.bankroll - game.hands[0].bet }, game: split(game) };
}

// Doubling down puts a second bet, equal to the hand's bet, on the active hand.
export function canAffordDouble(bank, game) {
  return canDouble(game) && bank.bankroll >= game.hands[game.active].bet;
}

export function doubleHand(bank, game) {
  if (!canAffordDouble(bank, game)) return null;
  const extra = game.hands[game.active].bet;
  return { bank: { ...bank, bankroll: bank.bankroll - extra }, game: doubleDown(game) };
}

// Returns stakes plus winnings to the bankroll. The first time the bankroll
// reaches the threshold, a one-time token bonus is added.
export function payOut(bank, game) {
  const net = roundNet(game);
  const staked = game.hands.reduce((sum, h) => sum + h.bet, 0);
  const next = { ...bank, bankroll: bank.bankroll + staked + net, winnings: bank.winnings + net };
  let bonus = 0;
  if (!next.bonusAwarded && next.bankroll >= BONUS_THRESHOLD) {
    bonus = BONUS_TOKENS;
    next.bankroll += bonus;
    next.bonusAwarded = true;
  }
  return { bank: next, net, bonus };
}
