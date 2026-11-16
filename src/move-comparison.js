import { Chess } from 'chess.js';
import { uciMove,PIECE_NAMES,explainCandidate,displayScore } from './coach.js';
import { explainOpponentMove } from './opponent-coach.js';
function replay(fen,pv) {
  const game=new Chess(fen),moves=[];
  for(const uci of (pv||[]).slice(0,6)){try{moves.push(game.move(uciMove(uci)));}catch{break;}}
  return moves;
}
export function compareMove(attempt,level=1350) {
  const best=attempt?.lines?.[0],actual=attempt?.actual;
  if(!best?.pv?.length || !actual?.pv?.length || actual.pv[0]!==attempt.uci)return null;
  let before,played,bestMove,actualMoves,bestMoves;
  try{
    before=new Chess(attempt.before);actualMoves=replay(attempt.before,actual.pv);bestMoves=replay(attempt.before,best.pv);
    played=actualMoves[0];bestMove=bestMoves[0];if(!played||!bestMove)return null;
  }catch{return null;}
  const after=new Chess(played.after),reply=actualMoves[1],bad=attempt.grade?.severity>0;
  let cause='',cost='';
  if(!bad)cause=explainCandidate(attempt.before,actual,level);
  else if(actual.mate<0 && !(best.mate<0))cause=`${played.san} allows a mating attack. The engine finds a defence starting with ${bestMove.san} instead.`;
  else if(best.mate>0 && !(actual.mate>0))cause=`There is a mating continuation starting with ${bestMove.san}; ${played.san} misses that finish in the engine’s search.`;
  else if(reply?.captured && reply.to===played.to)cause=`${played.san} puts your ${PIECE_NAMES[played.piece]} on ${played.to}, where ${reply.san} can capture it. Compare the continuation to see whether you recover material.`;
  else if(reply?.captured && before.attackers(reply.to,played.color).includes(played.from) && !after.attackers(reply.to,played.color).length)cause=`Moving your ${PIECE_NAMES[played.piece]} from ${played.from} removes its defence of ${reply.to}. ${reply.san} can then capture your ${PIECE_NAMES[reply.captured]} there.`;
  else if(played.piece==='p'&&!played.captured&&bestMove.captured&&bestMove.from===played.from)cause=`${played.san} advances your pawn and leaves the opponent’s ${PIECE_NAMES[bestMove.captured]} on ${bestMove.to}. ${bestMove.san} captures it instead.`;
  if(Number.isFinite(best.cp)&&Number.isFinite(actual.cp)){
    const loss=Math.max(0,best.cp-actual.cp)/100;
    cost=bad?`Against best defence, this gives up about ${loss.toFixed(2)} pawns of engine evaluation compared with ${bestMove.san}.`:best.pv[0]===attempt.uci?'This matches the engine’s first choice in the saved search.':`The saved evaluation is within ${loss.toFixed(2)} pawns of ${bestMove.san}.`;
  }else if(actual.mate<0)cost=`The engine reports a forced mate against you in ${Math.abs(actual.mate)} moves in this line.`;
  else if(best.mate>0)cost=`The engine reports a mate in ${best.mate} starting with ${bestMove.san}.`;
  const replyIdea=reply?explainOpponentMove({before:played.after,uci:reply.lan,previousMove:played,level}):null;
  return {cause,cost,uncertain:!cause||cause.includes('No specific positional explanation'),reply:replyIdea?`${reply.san}: ${replyIdea.reason}`:'',bestSAN:bestMove.san,playedSAN:played.san,playedLine:actualMoves.map(m=>m.san),bestLine:bestMoves.map(m=>m.san),playedScore:displayScore(actual,before.turn()),bestScore:displayScore(best,before.turn()),depth:attempt.depth||best.depth||0};
}
