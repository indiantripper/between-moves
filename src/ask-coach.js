import { Chess } from 'chess.js';
import { PIECE_NAMES, uciMove, explainCandidate, sanLine } from './coach.js';

// Every concrete claim comes from the legal move or its supplied engine line.
export function coachSuggestion(fen,line,level=1350) {
  const before=new Chess(fen),after=new Chess(fen);
  if(before.isGameOver() || !line?.pv?.[0])return null;
  let move;
  try { move=after.move(uciMove(line.pv[0])); } catch { return null; }
  let idea=explainCandidate(fen,line,level);
  const targets=after.board().flat().filter(p=>p && p.color!==move.color && p.type!=='k' && after.attackers(p.square,move.color).includes(move.to));
  if(!move.captured && !after.isCheck() && targets.length)idea+=` From ${move.to}, your ${PIECE_NAMES[move.piece]} attacks ${targets.map(p=>`the ${PIECE_NAMES[p.type]} on ${p.square}`).join(' and ')}.`;
  const controlled=['d4','e4','d5','e5'].filter(square=>after.attackers(square,move.color).includes(move.to));
  if(controlled.length && !move.captured && !after.isCheck())idea+=` It controls ${controlled.join(' and ')} in the centre.`;
  const hint=before.isCheck()?'Your king is in check. Look for a legal way to escape, block the check or capture the checking piece.':after.isCheckmate()?'Look for a checking move that leaves the king no escape.':move.captured?`Look for a capture of an opponent’s ${PIECE_NAMES[move.captured]}. Check how they can reply.`:move.flags.includes('k')||move.flags.includes('q')?'Can you improve your king’s position and activate a rook in one move?':targets.length?`Can you activate a ${PIECE_NAMES[move.piece]} while putting pressure on an opponent’s piece or pawn?`:controlled.length?'Look for a move that improves your control of the centre.':'Look for a piece whose activity you can improve, and check the opponent’s forcing replies.';
  return {fen,uci:move.lan,san:move.san,from:move.from,to:move.to,piece:PIECE_NAMES[move.piece],hint,idea,line:sanLine(fen,line.pv,8)};
}
export function usedCoachHelp(record,fen,ply) { return (record?.hints||[]).some(h=>h.fen===fen && h.ply===ply); }
