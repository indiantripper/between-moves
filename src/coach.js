import { Chess } from 'chess.js';

export const PIECE_NAMES = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' };
const VALUES = { p:1, n:3, b:3, r:5, q:9, k:100 };
export function uciMove(uci) { return { from:uci.slice(0,2), to:uci.slice(2,4), ...(uci[4] ? { promotion:uci[4] } : {}) }; }
export function scoreValue(line) { return line?.mate != null ? Math.sign(line.mate || 1) * (100000 - Math.abs(line.mate) * 100) : line?.cp ?? 0; }
export function displayScore(line, turn = 'w') {
  if (!line) return '—';
  const sign = turn === 'w' ? 1 : -1;
  if (line.mate != null) return `${line.mate * sign < 0 ? '−' : ''}M${Math.abs(line.mate)}`;
  const value = line.cp * sign / 100;
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}
export function gradeMove(best, actual, isBest = false) {
  if (!best || !actual) return { label:'Unrated', loss:0, severity:0 };
  const loss = Math.max(0, scoreValue(best) - scoreValue(actual));
  // Winning-chance change avoids calling every small slip in a lost position a blunder.
  const chance = x => 1 / (1 + Math.exp(-x / 350));
  const drop = chance(scoreValue(best)) - chance(scoreValue(actual));
  if (isBest) return { label:'Best move', loss, severity:0 };
  if (best.mate > 0 && !(actual.mate > 0)) return { label:'Missed mate', loss, severity:2 };
  if (actual.mate < 0 && !(best.mate < 0)) return { label:'Blunder', loss, severity:3 };
  if (loss <= 25 || drop < .015) return { label:'Good move', loss, severity:0 };
  if (drop >= .20) return { label:'Blunder', loss, severity:3 };
  if (drop >= .09) return { label:'Mistake', loss, severity:2 };
  if (drop >= .035) return { label:'Inaccuracy', loss, severity:1 };
  return { label:'Playable', loss, severity:0 };
}
export function sanLine(fen, pv, limit = 8) {
  const game = new Chess(fen), result = [];
  for (const uci of (pv || []).slice(0,limit)) { try { result.push(game.move(uciMove(uci)).san); } catch { break; } }
  return result;
}
export function explainCandidate(fen, line, level = 1350) {
  const game = new Chess(fen); let move;
  try { move = game.move(uciMove(line.pv[0])); } catch { return 'Explore the engine continuation on the board.'; }
  const name = PIECE_NAMES[move.piece];
  if (game.isCheckmate()) return 'Checkmate. The king is in check with no legal escape.';
  if (line.mate > 0) return `The engine finds a forced mate in ${line.mate}. Follow the continuation to see the defence.`;
  if (move.flags.includes('k') || move.flags.includes('q')) return level < 1000 ? 'Castle: move your king to safety and bring a rook closer to the centre.' : 'Castle to reposition the king and activate the rook.';
  if (move.promotion) return `Promote your pawn to a ${PIECE_NAMES[move.promotion]}.`;
  if (move.captured) return `Capture the ${PIECE_NAMES[move.captured]} on ${move.to}${move.san.includes('+') ? ' with check' : ''}. Check the continuation for the reply.`;
  if (move.san.includes('+')) return `Give check with your ${name}. Your opponent must answer the check.`;
  const targets = game.board().flat().filter(p => p && p.color !== move.color && p.type !== 'p' && game.attackers(p.square, move.color).includes(move.to));
  if (targets.length >= 2) return `Your ${name} attacks ${targets.map(p => `the ${PIECE_NAMES[p.type]} on ${p.square}`).join(' and ')}. ${level < 1000 ? 'Attacking two pieces at once is called a fork.' : 'This creates a fork; the continuation shows whether it wins material.'}`;
  if (['n','b'].includes(move.piece) && ((move.color === 'w' && move.from[1] === '1') || (move.color === 'b' && move.from[1] === '8'))) return `Develop your ${name} from ${move.from} to ${move.to}. The engine continuation shows how play can follow.`;
  if (move.piece === 'p' && ['d4','e4','d5','e5'].includes(move.to)) return `Place a pawn in the centre on ${move.to}. Compare the replies before deciding how to support it.`;
  return `Move the ${name} to ${move.to}. No specific positional explanation is verified here; explore the engine’s continuation.`;
}
export function explainMove(fen, move, best, actual, grade, level, book = []) {
  const facts = [], tags = [];
  const after = new Chess(fen); after.move(uciMove(move.lan));
  if (book.length) facts.push(book.includes(move.san) ? `${move.san} follows this opening’s book. Book alternatives: ${book.join(', ')}.` : `This leaves our selected book line. That alone is not a mistake; ${book.join(', ')} ${book.length === 1 ? 'is' : 'are'} the book ${book.length === 1 ? 'move' : 'moves'} here.`);
  if (grade.label === 'Missed mate') { tags.push('missed-mate'); facts.push(`You had a forced mate starting with ${sanLine(fen,best.pv,1)[0]}. Explore the line to practise the finish.`); }
  if (actual?.mate < 0 && !(best?.mate < 0)) { tags.push('king-safety'); facts.push(`Your move allows a forced mate. The opponent’s engine line shows the threat.`); }
  // Only report a material loss when the engine's actual reply captures more than the recapture recovers.
  if (actual?.pv?.length > 1) {
    const g = new Chess(fen); let first, reply, recapture;
    try {
      first = g.move(uciMove(actual.pv[0])); reply = g.move(uciMove(actual.pv[1]));
      if (actual.pv[2]) recapture = g.move(uciMove(actual.pv[2]));
      const recovered = recapture?.captured ? VALUES[recapture.captured] : 0;
      if (reply.captured && VALUES[reply.captured] > recovered && grade.severity >= 1) {
        const originalAfter = new Chess(fen); originalAfter.move(uciMove(first.lan));
        const undefended = originalAfter.attackers(reply.to, first.color).length === 0;
        tags.push(undefended ? 'loose-pieces' : 'missed-capture');
        facts.push(`${reply.san} captures your ${PIECE_NAMES[reply.captured]} on ${reply.to}${undefended ? ', which has no defender' : ''}. The shown immediate reply does not recover equal material.`);
      }
    } catch { /* Incomplete engine lines are not evidence for a tactical claim. */ }
  }
  if (!tags.length && grade.severity >= 1) tags.push('calculation');
  if (grade.severity === 0) facts.push(grade.label === 'Best move' ? 'Your move matches the engine’s first choice at this search depth.' : 'Your move stays close in winning chances to the engine’s preferred choice.');
  if (grade.severity > 0 && !tags.includes('missed-mate')) facts.push(`Consider ${sanLine(fen,best?.pv,1)[0] || 'the top candidate'} instead. ${best ? explainCandidate(fen,best,level) : ''}`);
  if (!facts.length) facts.push('Compare your move with the engine candidates and explore the continuations.');
  const tip = level < 1000 ? 'Before moving, check: is your king safe, and can your opponent capture something for free?' : 'Before committing, check your opponent’s forcing replies: checks, captures, and direct threats.';
  return { facts, tags, tip };
}
export const PATTERNS = {
  'loose-pieces': { title:'Undefended pieces', tip:'Before moving, scan for your pieces that have no defenders.' },
  'missed-capture': { title:'Missed captures', tip:'Check what your opponent can capture after your intended move.' },
  'missed-mate': { title:'Missed mating chances', tip:'Look at forcing checks when the enemy king has few escape squares.' },
  'king-safety': { title:'King safety', tip:'Check your opponent’s forcing checks before starting your own plan.' },
  'calculation': { title:'Comparing candidate moves', tip:'Compare two or three candidates and calculate the opponent’s strongest reply.' }
};
export function learningSummary(games) {
  const originals = games.flatMap(g => g.attempts || []).filter(a => !a.retry && a.grade?.label !== 'Unrated');
  const unassisted = originals.filter(a => !a.assisted);
  const counts = {};
  originals.forEach(a => a.explanation?.tags?.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
  const patterns = Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([id,count]) => ({ id,count,...PATTERNS[id] }));
  // This is a provisional training difficulty, not a calibrated platform rating.
  const sample = unassisted.slice(-100);
  const avg = sample.reduce((s,a) => s + Math.min(a.grade.loss,1000),0) / (sample.length || 1);
  const suggested = Math.max(500,Math.min(2200,Math.round((2200 - avg * 8) / 100) * 100));
  return { originals:originals.length, unassisted:unassisted.length, patterns, suggested, ready:sample.length >= 20,
    good:originals.filter(a => a.grade.severity === 0).length };
}
