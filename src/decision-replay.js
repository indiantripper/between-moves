import {Chess} from 'chess.js';
import {uciMove} from './coach.js';
// A missed win is taught from the original position, not the opponent's reply.
export function decisionReplay(attempt){
 try{
  const best=attempt?.lines?.[0],actual=attempt?.actual;
  if(!best?.pv?.length||actual?.pv?.[0]!==attempt.uci)return null;
  const board=new Chess(attempt.before),played=board.move(uciMove(attempt.uci));
  if(best.mate>0&&!(actual.mate>0)&&best.pv[0]!==attempt.uci){
   new Chess(attempt.before).move(uciMove(best.pv[0]));
   return {mode:'missed-mate',fen:attempt.before,pv:[...best.pv],punishment:false,limit:Math.min(40,Math.max(12,2*best.mate-1)),mateIn:best.mate};
  }
  return actual.pv.length>1?{mode:'punishment',fen:played.after,pv:actual.pv.slice(1),punishment:true,limit:12}:null;
 }catch{return null;}
}
