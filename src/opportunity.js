import {Chess} from 'chess.js';
import {PIECE_NAMES,uciMove} from './coach.js';
const value={p:1,n:3,b:3,r:5,q:9,k:0};
function lineEvidence(fen,pv){
 const board=new Chess(fen),moves=[];let gain=0;const side=board.turn();
 for(const uci of pv.slice(0,12)){
  if(board.isGameOver())break;
  const move=board.move(uciMove(uci));moves.push(move);
  const swing=(move.captured?value[move.captured]:0)+(move.promotion?value[move.promotion]-1:0);
  gain+=(move.color===side?1:-1)*swing;
 }
 const last=moves.at(-1),quietEnd=moves.length>=3&&moves.slice(-2).every(m=>!m.captured&&!m.promotion);
 // Don't call an unfinished exchange a win. A directly safe capture is also useful evidence.
 const first=moves[0],firstBoard=first?new Chess(first.after):null;
 const safeCapture=first?.captured&&!firstBoard.isAttacked(first.to,first.color==='w'?'b':'w');
 return {moves,gain,settled:board.isGameOver()||quietEnd||safeCapture,last};
}
function attackedTargets(move){
 const board=new Chess(move.after);
 return board.board().flat().filter(p=>p&&p.color!==move.color&&p.type!=='p'&&board.attackers(p.square,move.color).includes(move.to));
}
export function missedOpportunity(attempt){
 try{
  if(!(attempt.grade?.severity>0)||attempt.actual.mate<0)return null;
  const best=attempt.lines[0],strong=lineEvidence(attempt.before,best.pv),played=lineEvidence(attempt.before,attempt.actual.pv);
  const move=strong.moves[0],actual=played.moves[0];
  if(!move||!actual||move.lan===actual.lan)return null;
  const targets=attackedTargets(move),actualTargets=attackedTargets(actual);
  const materialWin=strong.settled&&strong.gain>0&&strong.gain>played.gain;
  if(targets.length>=2&&actualTargets.length<2){
   const descriptions=targets.slice(0,2).map(p=>`the ${PIECE_NAMES[p.type]} on ${p.square}`).join(' and ');
   return {kind:'fork',title:'You missed a fork',description:`${actual.san} misses a double attack. ${move.san} attacks ${descriptions} at the same time. ${materialWin?'The shown line wins material.':'Follow the better line to see how the fork could work.'}`,materialGain:materialWin?strong.gain:0,targets:targets.map(p=>p.square)};
  }
  if(materialWin){
   const direct=move.captured&&strong.gain>=value[move.captured];
   return {kind:'material',title:'You missed a material win',description:direct?`${move.san} wins the ${PIECE_NAMES[move.captured]} on ${move.to} in this line. ${actual.san} misses that chance.`:`${move.san} leads to a material gain in the shown line. Follow the captures and replies to see what you missed.`,materialGain:strong.gain,targets:move.captured?[move.to]:[]};
  }
  return null;
 }catch{return null;}
}
