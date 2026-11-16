import { Chess } from 'chess.js';
import { explainOpponentMove } from './opponent-coach.js';
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
  const continuation=new Chess(fen),pv=[];
  for(const uci of line.pv.slice(0,8)){try{pv.push(continuation.move(uciMove(uci)).lan);}catch{break;}}
  return {pv,fen,uci:move.lan,san:move.san,from:move.from,to:move.to,piece:PIECE_NAMES[move.piece],hint,idea,line:sanLine(fen,line.pv,8)};
}
export function usedCoachHelp(record,fen,ply) { return (record?.hints||[]).some(h=>h.fen===fen && h.ply===ply); }

// Replay a preview on a separate board; never change the practice game.
export function previewSuggestion(suggestion,step=1) {
  if(!suggestion?.pv?.length)return null;
  const position=new Chess(suggestion.fen),count=Math.max(0,Math.min(suggestion.pv.length,Math.trunc(step)));
  let last=null;
  try{for(const uci of suggestion.pv.slice(0,count))last=position.move(uciMove(uci));}catch{return null;}
  return {fen:position.fen(),step:count,last,next:suggestion.pv[count]||null};
}

export function previewLesson(suggestion,step,level=1350) {
  const result=previewSuggestion(suggestion,step);if(!result)return null;
  const count=result.step,position=new Chess(result.fen),user=new Chess(suggestion.fen).turn();
  if(count===0)return {step:0,total:suggestion.pv.length,actor:'start',heading:'Your starting position',reason:suggestion.hint,plan:'Step forward to see the suggested move and how the opponent could respond.',watch:position.isCheck()?'Your king is in check. Your move must answer the check.':'Before deciding, compare the opponent’s checks, captures and direct threats.',next:suggestion.line[0]||''};
  const before=new Chess(suggestion.fen);let previousMove=null;
  for(const uci of suggestion.pv.slice(0,count-1))previousMove=before.move(uciMove(uci));
  const move=result.last,own=move.color===user,side=move.color==='w'?'White':'Black';
  const opponent=own?null:explainOpponentMove({before:before.fen(),uci:move.lan,previousMove,level});
  const ownIdea=own?coachSuggestion(before.fen(),{pv:suggestion.pv.slice(count-1)},level):null;
  let reason=own?ownIdea.idea:opponent.reason;
  if(!own && move.captured && !/captures|recaptures/.test(reason)){
    const recapture=previousMove?.captured && previousMove.to===move.to;
    reason=`${side} ${recapture?'recaptures':'captures'} on ${move.to}, taking your ${PIECE_NAMES[move.captured]}. ${reason}`;
  }
  let watch=opponent?.watch||'',next='';
  if(result.next){
    const reply=position.move(uciMove(result.next)),replySide=reply.color==='w'?'White':'Black';
    next=`${replySide}: ${reply.san}. ${reply.captured?`The ${PIECE_NAMES[reply.piece]} captures ${own?'your':'the opponent’s'} ${PIECE_NAMES[reply.captured]} on ${reply.to}.`:reply.flags.includes('k')||reply.flags.includes('q')?'The king and rook castle.':`The ${PIECE_NAMES[reply.piece]} moves from ${reply.from} to ${reply.to}.`}`;
    if(own && reply.san.includes('#'))watch=`Watch for ${reply.san}: in this line, your opponent gives checkmate.`;
    else if(own && reply.san.includes('+'))watch=`Your opponent’s ${reply.san} gives check. You would have to answer that check.`;
    else if(own && reply.captured)watch=`Your opponent can reply ${reply.san}, capturing your ${PIECE_NAMES[reply.captured]} on ${reply.to}. Check the continuation for a recapture before judging the exchange.`;
  }
  const after=new Chess(result.fen);
  if(after.isCheckmate())watch=own?'You have delivered checkmate; this line is finished.':'Your king has no legal escape from check; this line ends in checkmate.';
  else if(after.isDraw())watch=after.isStalemate()?'This position is stalemate, so the line ends in a draw.':'This preview position is drawn; there is no move to continue here.';
  else if(after.isCheck())watch=own?'Your move gives check. The opponent must answer it before carrying out another plan.':'Your king is in check. Your next move must capture the checker, block the check or move the king legally.';
  if(!watch)watch=own?'Check the opponent’s forcing replies—checks, captures and direct threats—before assuming your idea will work.':'Look for your own checks and captures, and check which pieces the reply attacks before choosing your response.';
  return {step:count,total:suggestion.pv.length,actor:own?'you':'opponent',heading:`${own?'Your move':'Opponent’s reply'} · ${side} ${move.san}`,reason,plan:own?'Compare the next reply to see how this idea holds up.':opponent.plan,watch,next};
}
