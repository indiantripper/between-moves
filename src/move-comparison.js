import { Chess } from 'chess.js';
import { uciMove,PIECE_NAMES,explainCandidate,displayScore } from './coach.js';
import { coachSuggestion } from './ask-coach.js';
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
  const after=new Chess(played.after),bestAfter=new Chess(bestMove.after),reply=actualMoves[1],bad=attempt.grade?.severity>0;
  let cause='',cost='';
  if(!bad)cause=explainCandidate(attempt.before,actual,level);
  else if(actual.mate<0 && !(best.mate<0))cause=reply?.san.endsWith('#')?`${played.san} allows ${reply.san}: your king has no legal escape. ${bestMove.san} avoids that immediate mate.`:`${played.san} allows a mating attack${reply?` starting with ${reply.san}`:''}. The engine finds mate against you in ${Math.abs(actual.mate)} moves; ${bestMove.san} avoids that line.`;
  else if(best.mate>0 && !(actual.mate>0))cause=`There is a mating continuation starting with ${bestMove.san}; ${played.san} misses that finish in the engine’s search.`;
  else if(reply?.captured && reply.to===played.to)cause=`${played.san} puts your ${PIECE_NAMES[played.piece]} on ${played.to}, where ${reply.san} can capture it. Compare the continuation to see whether you recover material.`;
  else if(reply?.captured && before.attackers(reply.to,played.color).includes(played.from) && !after.attackers(reply.to,played.color).length)cause=`Moving your ${PIECE_NAMES[played.piece]} from ${played.from} removes its defence of ${reply.to}. ${reply.san} can then capture your ${PIECE_NAMES[reply.captured]} there.`;
  else if(reply?.captured && !after.attackers(reply.to,played.color).length && bestAfter.get(reply.to)?.color===played.color && bestAfter.attackers(reply.to,played.color).includes(bestMove.to))cause=`${played.san} leaves your ${PIECE_NAMES[reply.captured]} on ${reply.to} without a defender; ${reply.san} can capture it. ${bestMove.san} adds a defender to that piece.`;
  else if(played.piece==='p'&&!played.captured&&bestMove.captured&&bestMove.from===played.from)cause=`${played.san} advances your pawn and leaves the opponent’s ${PIECE_NAMES[bestMove.captured]} on ${bestMove.to}. ${bestMove.san} captures it instead.`;
  // Explain missed opportunities even when the opponent's first reply is quiet.
  if(bad&&!cause){
    const targets=bestAfter.board().flat().filter(p=>p&&p.color!==played.color&&['n','b','r','q'].includes(p.type)&&bestAfter.attackers(p.square,played.color).includes(bestMove.to));
    const playedTargets=after.board().flat().filter(p=>p&&p.color!==played.color&&['n','b','r','q'].includes(p.type)&&after.attackers(p.square,played.color).includes(played.to));
    if(targets.length>=2&&playedTargets.length<2)cause=`${played.san} misses a double attack. ${bestMove.san} attacks ${targets.slice(0,2).map(p=>`the ${PIECE_NAMES[p.type]} on ${p.square}`).join(' and ')} at the same time. The continuation shows how the opponent can defend.`;
    else if(bestMove.captured&&!played.captured)cause=`${played.san} misses the capture on ${bestMove.to}. ${bestMove.san} takes the opponent’s ${PIECE_NAMES[bestMove.captured]}; compare the reply before assuming the capture wins material.`;
    else {
      const values={p:1,n:3,b:3,r:5,q:9,k:0};
      let balance=0,loss=null;
      for(const move of actualMoves){if(move.captured){balance+=(move.color===played.color?1:-1)*values[move.captured];if(move.color!==played.color)loss=move;}}
      if(balance<0&&loss&&actualMoves.slice(-2).every(move=>!move.captured))cause=`After ${played.san}, this continuation includes ${loss.san}, capturing your ${PIECE_NAMES[loss.captured]} on ${loss.to}. You lose more material than you recover in the shown line.`;
    }
  }
  const uncertain=!cause||cause.includes('No specific positional explanation');
  if(bad&&!cause)cause=reply?`${played.san} is weaker than ${bestMove.san} in the engine’s analysis. The opponent can answer ${reply.san}. The short line does not reveal a clear material loss or tactical reason, so replay it before deciding what was missed.`:`The engine prefers ${bestMove.san} to ${played.san}. A concrete reason is not available from the saved continuation.`;
  if(Number.isFinite(best.cp)&&Number.isFinite(actual.cp)){
    const loss=Math.max(0,best.cp-actual.cp)/100;
    cost=bad?`Against best defence, this gives up about ${loss.toFixed(2)} pawns of engine evaluation compared with ${bestMove.san}.`:best.pv[0]===attempt.uci?'This matches the engine’s first choice in the saved search.':`The saved evaluation is within ${loss.toFixed(2)} pawns of ${bestMove.san}.`;
  }else if(actual.mate<0)cost=`The engine reports a forced mate against you in ${Math.abs(actual.mate)} moves in this line.`;
  else if(best.mate>0)cost=`The engine reports a mate in ${best.mate} starting with ${bestMove.san}.`;
  const replyIdea=reply?explainOpponentMove({before:played.after,uci:reply.lan,previousMove:played,level}):null;
  return {cause,cost,uncertain,reply:replyIdea?`${reply.san}: ${replyIdea.reason}`:'',bestSAN:bestMove.san,bestIdea:coachSuggestion(attempt.before,best,level)?.idea||explainCandidate(attempt.before,best,level),playedSAN:played.san,playedLine:actualMoves.map(m=>m.san),bestLine:bestMoves.map(m=>m.san),playedScore:displayScore(actual,before.turn()),bestScore:displayScore(best,before.turn()),depth:attempt.depth||best.depth||0};
}
