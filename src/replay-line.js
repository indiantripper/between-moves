import { Chess } from 'chess.js';
import { uciMove } from './coach.js';
// Extend only legal engine moves, stopping at mate/draw or when analysis has no line.
export async function extendReplayLine(fen,pv,search,{limit=12,active=()=>true}={}){
  const board=new Chess(fen),line=[];
  const append=moves=>{for(const uci of moves||[]){if(line.length>=limit||board.isGameOver())break;try{board.move(uciMove(uci));line.push(uci);}catch{break;}}};
  append(pv);
  while(line.length<limit&&!board.isGameOver()&&active()){
    const result=await search(board.fen());if(!active())break;
    const before=line.length;append(result.lines?.[0]?.pv);if(line.length===before)break;
  }
  return line;
}
