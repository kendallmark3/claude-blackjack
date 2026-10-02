import { useEffect, useState } from 'react';
import {
  BET_SIZES,
  BONUS_THRESHOLD,
  BONUS_TOKENS,
  canAffordDouble,
  canAffordSplit,
  dealHand,
  doubleHand,
  isBroke,
  newBank,
  payOut,
  splitHand,
} from './bank.js';
import { canHit, canStand, handValue, hit, isBlackjack, roundNet, stand } from './game.js';

function money(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function signed(n) {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;
}

const RANK_NAMES = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };

function Card({ card, hidden, sideways, delay = 0 }) {
  const red = card.suit === '♥' || card.suit === '♦';
  const label = hidden
    ? 'Face-down card'
    : `${RANK_NAMES[card.rank] ?? card.rank} of ${SUIT_NAMES[card.suit]}`;
  return (
    <div
      className={`card${hidden ? ' is-hidden' : ''}${sideways ? ' is-sideways' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
      role="img"
      aria-label={label}
    >
      <div className="card-inner">
        <div className={`card-face card-front${red ? ' red' : ''}`}>
          {!hidden && (
            <>
              <span className="corner top">
                {card.rank}
                <br />
                {card.suit}
              </span>
              <span className="pip">{card.suit}</span>
              <span className="corner bottom">
                {card.rank}
                <br />
                {card.suit}
              </span>
            </>
          )}
        </div>
        <div className="card-face card-back" />
      </div>
    </div>
  );
}

function scoreLabel(hand) {
  const { total, soft } = handValue(hand.cards);
  if (isBlackjack(hand)) return 'Blackjack';
  if (total > 21) return `Bust · ${total}`;
  return soft && total < 21 ? `Soft ${total}` : String(total);
}

// Opening cards animate in deal order (player, dealer, player, dealer);
// later cards stagger after the ones already on the table.
function dealDelay(index, who) {
  if (index < 2) return index * 300 + (who === 'dealer' ? 150 : 0);
  return who === 'dealer' ? (index - 1) * 350 : 0;
}

const OUTCOME_TEXT = { win: 'Win', lose: 'Lose', push: 'Push' };

function PlayerHand({ hand, index, count, active, round }) {
  const title = count > 1 ? `Hand ${index + 1}` : 'Your hand';
  return (
    <section
      className={`hand player-hand${active ? ' is-active' : ''}${hand.outcome ? ` is-${hand.outcome.result}` : ''}`}
      aria-label={title}
    >
      <header className="hand-header">
        <span className="hand-title">
          {title}
          {active && <span className="turn-tag">Your turn</span>}
        </span>
        <span className="score">{scoreLabel(hand)}</span>
        <span className="bet-tag">
          {hand.doubled ? 'Doubled' : 'Bet'} {money(hand.bet)}
        </span>
      </header>
      <div className="cards">
        {hand.cards.map((card, i) => (
          <Card
            key={`${round}-${card.id}`}
            card={card}
            sideways={hand.doubled && i === hand.cards.length - 1}
            delay={count > 1 ? 0 : dealDelay(i, 'player')}
          />
        ))}
      </div>
      {hand.outcome && (
        <div className={`outcome outcome-${hand.outcome.result}`}>
          <strong>{OUTCOME_TEXT[hand.outcome.result]}</strong>
          <b>{signed(hand.outcome.net)}</b>
          <span>{hand.outcome.reason}</span>
        </div>
      )}
    </section>
  );
}

function summary(game, broke) {
  if (broke && game?.phase !== 'player') return "You're out of money. Start over?";
  if (!game) return 'Pick a bet and deal.';
  if (game.phase === 'player') {
    return game.hands.length > 1
      ? `Playing hand ${game.active + 1} of ${game.hands.length}`
      : 'Hit, stand, or double?';
  }
  const net = roundNet(game);
  if (game.hands.length === 1) {
    const { result } = game.hands[0].outcome;
    if (isBlackjack(game.hands[0]) && result === 'win') return `Blackjack! You win ${money(net)}.`;
    if (result === 'win') return `You win ${money(net)}!`;
    if (result === 'lose') return `You lose ${money(-net)}.`;
    return 'Push. Your bet is returned.';
  }
  return net === 0 ? 'Split hands break even.' : `Split hands ${net > 0 ? 'win' : 'lose'} ${money(Math.abs(net))}.`;
}

export default function App() {
  const [bank, setBank] = useState(newBank);
  const [bet, setBet] = useState(10);
  const [game, setGame] = useState(null);
  const [round, setRound] = useState(0);
  const [bonus, setBonus] = useState(0);

  const inPlay = game?.phase === 'player';
  const broke = !inPlay && isBroke(bank);
  // If the chosen bet is more than the bankroll, fall back to the largest affordable one.
  const activeBet = bank.bankroll >= bet ? bet : BET_SIZES.filter((b) => b <= bank.bankroll).at(-1);
  const canDeal = !inPlay && !broke;

  // Every action that finishes a round pays it out exactly once.
  function commit(nextGame, nextBank) {
    if (nextGame.phase === 'done') {
      const paid = payOut(nextBank, nextGame);
      setBank(paid.bank);
      setBonus(paid.bonus);
    } else {
      setBank(nextBank);
    }
    setGame(nextGame);
  }

  function deal() {
    if (!canDeal) return;
    const dealt = dealHand(bank, activeBet);
    setRound((r) => r + 1);
    setBonus(0);
    commit(dealt.game, dealt.bank);
  }

  function restart() {
    setBank(newBank());
    setGame(null);
    setBonus(0);
  }

  const actions = {
    hit: () => canHit(game) && commit(hit(game), bank),
    stand: () => canStand(game) && commit(stand(game), bank),
    double: () => {
      const r = doubleHand(bank, game);
      if (r) commit(r.game, r.bank);
    },
    split: () => {
      const r = splitHand(bank, game);
      if (r) commit(r.game, r.bank);
    },
    deal: () => (broke ? restart() : deal()),
  };

  useEffect(() => {
    const keys = { h: actions.hit, s: actions.stand, d: actions.double, p: actions.split, n: actions.deal, Enter: actions.deal };
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const fn = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const dealerHidden = game?.phase === 'player';
  const dealerScore = game
    ? dealerHidden
      ? String(handValue([game.dealer[0]]).total)
      : isBlackjack({ cards: game.dealer })
        ? 'Blackjack'
        : handValue(game.dealer).total > 21
          ? `Bust · ${handValue(game.dealer).total}`
          : String(handValue(game.dealer).total)
    : null;

  const status = summary(game, broke);
  const net = game?.phase === 'done' ? roundNet(game) : 0;
  const tone = game?.phase === 'done' ? (net > 0 ? 'win' : net < 0 ? 'lose' : 'push') : '';

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="suit-mark">♠</span> Blackjack
        </h1>
        <dl className="tally" aria-label="Your money">
          <div>
            <dt>Bankroll</dt>
            <dd>{money(bank.bankroll)}</dd>
          </div>
          <div>
            <dt>Winnings</dt>
            <dd className={bank.winnings > 0 ? 'up' : bank.winnings < 0 ? 'down' : ''}>{signed(bank.winnings)}</dd>
          </div>
          {bank.bonusAwarded && (
            <div>
              <dt>Bonus</dt>
              <dd className="gold">{money(BONUS_TOKENS)}</dd>
            </div>
          )}
        </dl>
      </header>

      <main className="table">
        <section className="hand dealer-hand" aria-label="Dealer">
          <header className="hand-header">
            <span className="hand-title">Dealer</span>
            {dealerScore && (
              <span className="score" title={dealerHidden ? 'Showing card only' : undefined}>
                {dealerHidden ? `Showing ${dealerScore}` : dealerScore}
              </span>
            )}
          </header>
          <div className="cards">
            {game ? (
              game.dealer.map((card, i) => (
                <Card
                  key={`${round}-${card.id}`}
                  card={card}
                  hidden={dealerHidden && i === 1}
                  delay={dealDelay(i, 'dealer')}
                />
              ))
            ) : (
              <>
                <div className="card-slot" />
                <div className="card-slot" />
              </>
            )}
          </div>
        </section>

        <div className="rail">
          <p className="rule-text">Dealer stands on all 17s</p>
          <div className="rail-center">
            <p className={`status${tone ? ` status-${tone}` : ''}`} role="status" aria-live="polite">
              {status}
            </p>
            {bonus > 0 && (
              <p className="bonus-banner" role="alert">
                Bonus! You reached {money(BONUS_THRESHOLD)}. Here's {money(bonus)} in tokens.
              </p>
            )}
          </div>
          <p className="rule-text">
            Blackjack pays 3 to 2
            <br />
            {money(BONUS_THRESHOLD)} earns a {money(BONUS_TOKENS)} bonus
          </p>
        </div>

        <div className={`player-area${game?.hands.length > 1 ? ' is-split' : ''}`}>
          {game ? (
            game.hands.map((hand, i) => (
              <PlayerHand
                key={`${round}-${i}-${game.hands.length}`}
                hand={hand}
                index={i}
                count={game.hands.length}
                active={game.phase === 'player' && game.hands.length > 1 && i === game.active}
                round={round}
              />
            ))
          ) : (
            <section className="hand player-hand" aria-label="Your hand">
              <header className="hand-header">
                <span className="hand-title">Your hand</span>
              </header>
              <div className="cards">
                <div className="card-slot" />
                <div className="card-slot" />
              </div>
            </section>
          )}
        </div>
      </main>

      <div className="betting" role="group" aria-label="Bet size">
        <span className="bet-label">Your bet</span>
        {BET_SIZES.map((b) => (
          <button
            key={b}
            className={`chip chip-${b}${b === activeBet ? ' is-selected' : ''}`}
            onClick={() => setBet(b)}
            disabled={inPlay || b > bank.bankroll}
            aria-pressed={b === activeBet}
          >
            {money(b)}
          </button>
        ))}
      </div>

      <nav className="controls" aria-label="Actions">
        <button className="btn btn-hit" onClick={actions.hit} disabled={!canHit(game)}>
          Hit <kbd>H</kbd>
        </button>
        <button className="btn btn-stand" onClick={actions.stand} disabled={!canStand(game)}>
          Stand <kbd>S</kbd>
        </button>
        <button className="btn btn-double" onClick={actions.double} disabled={!inPlay || !canAffordDouble(bank, game)}>
          Double <kbd>D</kbd>
        </button>
        <button className="btn btn-split" onClick={actions.split} disabled={!inPlay || !canAffordSplit(bank, game)}>
          Split <kbd>P</kbd>
        </button>
        <button className="btn btn-deal" onClick={actions.deal} disabled={inPlay}>
          {broke ? 'Start Over' : `Deal ${activeBet ? money(activeBet) : ''}`} <kbd>N</kbd>
        </button>
      </nav>
    </div>
  );
}
