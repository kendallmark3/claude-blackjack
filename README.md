# Blackjack

A browser-based blackjack game built with React, driven by an Intent-Driven Engineering (IDE) specification.

> **Status:** Playable. The game in [src/](src/) implements the intent in [intent/intent.md](intent/intent.md).

## What this repo is

This project tests the intent-driven approach: a human writes down the outcome, rules, boundaries, and success criteria, and the agent makes the implementation decisions (component structure, state management, styling, project layout, testing tools).

[intent/intent.md](intent/intent.md) is the source of truth. It covers:

- **Business outcome:** a polished, easy-to-understand blackjack game that feels like a real table, not a technical prototype.
- **Gameplay:** new hand, hit, stand, split, correct Ace handling, blackjack, bust, win/loss/push, visible scores, hidden dealer card, and per-hand results.
- **Rules:** fixed rule decisions that affect correctness.
- **Boundaries:** what the game must not include.
- **Success criteria:** the checks the finished application must pass.

## Blackjack rules (as specified)

| Rule | Decision |
| --- | --- |
| Dealer | Stands on all 17s, including soft 17 |
| Blackjack | An initial two-card 21 only |
| 21 after a split | Not treated as blackjack |
| Splitting | Allowed on an eligible starting hand; one split into two hands |
| Split play | Each split hand is played separately before the dealer finishes the round |
| Betting | Play money: start with $1,000, bet $1, $5 or $10 per hand |
| Bonus | Reaching $1,500 adds $500 in tokens |
| Double down | On the first two cards: double the bet, take exactly one card, hand ends |
| Not included | Insurance, surrender, real money |

### Implementation assumptions

The intent leaves these choices to the implementation:

- **Deck:** a single 52-card deck, freshly shuffled for every hand.
- **Deal order:** player, dealer, player, dealer. The dealer's second card is the face-down hole card.
- **Dealer peek:** if either the player or the dealer has blackjack on the opening deal, the hand ends at once. Both having blackjack is a push.
- **Blackjack beats 21:** a player blackjack beats a dealer 21 made with three or more cards. A dealer blackjack beats any player 21 that isn't blackjack.
- **Split eligibility:** only two cards of the same rank can be split (8-8, K-K). Different ten-value cards (K-Q) can't be split.
- **Split dealing:** each split hand gets its second card right away, and the hands are played left to right.
- **Split Aces:** played like any other split hand. You may hit them.
- **Automatic stand on 21:** any hand that reaches 21 stands automatically, because no action can improve it.
- **Dealer draws only when needed:** if every player hand has busted, the dealer reveals the hole card but doesn't draw.
- **Payouts:** a win pays 1:1 and blackjack pays 3:2, so a $1 blackjack wins $1.50. A 21 on a split hand pays 1:1. A push returns the bet.
- **Placing bets:** the bet comes off the bankroll when the hand is dealt. The bet size can't change during a hand. If the chosen bet is more than the bankroll, the game uses the largest bet you can cover.
- **Split bets:** splitting places a second bet equal to the first, and each hand is paid separately. Split is unavailable if the bankroll can't cover the second bet.
- **Double down:** allowed on any first two cards, not only 10 or 11, and on split hands too. It needs enough bankroll to cover the second bet. The extra card is dealt sideways, as at a casino table. A doubled hand can still bust, and a doubled loss costs twice the bet.
- **Token bonus:** the $500 bonus is paid once per game, the first time the bankroll reaches $1,500 after a hand settles. It's added to the bankroll but not counted in "Winnings", which shows only what you've won or lost at the table.
- **Out of money:** when the bankroll is below $1, a Start Over button resets it to $1,000. Everything also resets when the page reloads.

## Boundaries

- React, running in the browser
- No real-money wagering, payments, or gambling services
- No backend or database unless a real requirement comes up
- No AI or LLM features
- No unnecessary dependencies, services, or infrastructure

## Getting started

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev        # start the game at the URL Vite prints
npm test           # run the blackjack rules tests
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Keyboard shortcuts: **H** hit, **S** stand, **D** double down, **P** split, **N** or **Enter** deals at the selected bet.

## How it's built

- [src/game.js](src/game.js) holds all the blackjack rules as pure functions: deal, hit, stand, split, dealer play and settlement. Every action (deal, hit, stand, double down, split) takes a game state and returns a new one.
- [src/game.test.js](src/game.test.js) uses stacked decks to test those rules.
- [src/bank.js](src/bank.js) is the play-money bankroll: placing bets, paying out and the token bonus. It's tested in [src/bank.test.js](src/bank.test.js).
- [src/App.jsx](src/App.jsx) and [src/App.css](src/App.css) are the table UI. They render the game state and call the rule functions.

The only runtime dependencies are React and React DOM. The dev tools are Vite and Vitest.

## Definition of done

The intent is complete only when a playable React blackjack app exists and there is evidence it works: the app builds successfully, automated tests cover the key blackjack rules, and every success criterion in [intent/intent.md](intent/intent.md) is met. An architecture or plan alone does not count.
