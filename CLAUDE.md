# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev                              # Vite dev server
npm run build                            # production build
npm test                                 # all tests (Vitest, single run)
npx vitest run -t "dealer stands on soft 17"   # one test by name
```

There is no linter configured.

## Architecture

- `src/game.js` contains every blackjack rule as pure functions over a plain state object `{ deck, dealer, hands[], active, phase }`. `startRound`, `hit`, `stand`, `doubleDown` and `split` each return a new state. When an action isn't allowed, it returns the same state unchanged. The private `advance` function closes hands that reach 21 or bust, then moves to the next hand. `finishRound` runs the dealer and settles each hand into `hand.outcome`.
- Each hand carries its own `bet`, and `settle` records the `net` result (wins 1:1, blackjack 3:2). `src/bank.js` wraps the rules with the bankroll: `dealHand`, `doubleHand` and `splitHand` take bets off the bankroll, and `payOut` returns stakes plus winnings and applies the one-time bonus. Bankroll constants (starting amount, bet sizes, bonus threshold and amount) live at the top of `bank.js`.
- `src/App.jsx` only renders that state and calls the rule functions. `canHit`, `canStand`, `canAffordDouble` and `canAffordSplit` drive which buttons are enabled. `commit` pays out exactly once when an action finishes a round. The dealer's hole card is hidden while `phase === 'player'`.
- Tests use stacked decks dealt in the order player, dealer, player, dealer, then later draws. Rule changes belong in `game.js` with tests in `game.test.js`.

## Spec

- [intent/intent.md](intent/intent.md) is the source of truth for what to build: a polished, browser-based React blackjack game. Its first few lines and last few lines are pasted chat commentary, not part of the spec. The spec runs from `# Intent: Build a Polished React Blackjack Game` through the `## Completion` section.
- [README.md](README.md) lists the implementation's rule assumptions. Keep it in sync when a rule changes.

The repo also contains files from the `kendallmark3/intent-drive-starter` template: `.claude/CLAUDE.md`, `intent/`, `agents/`, `hooks/`, `context/`, `skills/`, `templates/`, `docs/`, and a CI workflow. These are mostly empty stubs. `.claude/CLAUDE.md` says to read `intent/current-feature.md` first, but until that template is filled in, the real spec is [intent/intent.md](intent/intent.md).

## Working model (Intent-Driven Engineering)

The project is a test of intent-driven development, so ownership is split on purpose:

- **Human-owned (do not change without asking):** React in the browser, the required gameplay, split-hand support, visible scoring, the rule decisions below, and the success criteria in intent.md.
- **Agent-owned:** component structure, state management, styling, animations, project layout, and testing tools. Pick the simplest choice that is easy to reverse and adds the fewest dependencies and assumptions. Don't add complexity just because it is a common best practice.

## Fixed blackjack rules

- Dealer stands on all 17s, including soft 17.
- Blackjack means an initial two-card 21 only. A 21 on a split hand is not blackjack.
- One split only, into two hands, allowed when the starting two cards are eligible. Each split hand is played to completion, in order, before the dealer plays.
- Play-money betting: start with $1,000, bet $1, $5 or $10 per hand, and get a $500 token bonus on reaching $1,500. The display shows money, not win counts.
- Double down on any first two cards (including split hands): double the bet, deal one card, end the hand.
- Out of scope: insurance, surrender, and any real-money feature.
- The dealer's hole card stays hidden until it should be revealed. Controls offer only the actions that are valid in the current state.

Any other minor rule choice you make (for example, which pairs can be split, deck count and reshuffle, or play after splitting Aces) must be written down in the README's "Implementation assumptions" section, not left implicit.

## Boundaries

No backend, database, AI/LLM features, external services, payments, or gambling services unless a real requirement comes up.

## Definition of done

The work is not done when you have a plan, an architecture, or a scaffold. It is done when a playable React app builds, automated tests cover the key rules (Ace values, blackjack vs. split 21, bust, dealer standing on soft 17, split eligibility, win/loss/push), and every success criterion in intent.md has been checked against the running app.
