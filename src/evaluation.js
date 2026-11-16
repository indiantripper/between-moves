import { Chess } from 'chess.js';
import { displayScore, PIECE_NAMES, sanLine, uciMove } from './coach.js';

const VALUES={p:1,n:3,b:3,r:5,q:9,k:0};
const sideName=color=>color==='w'?'White':'Black';

export function materialBalance(game) {
  const total={w:0,b:0};
  for(const piece of game.board().flat())if(piece)total[piece.color]+=VALUES[piece.type];
  const difference=total.w-total.b;
  return { ...total,difference,text:difference===0?'Material is level.':`${difference>0?'White':'Black'} is ahead by ${Math.abs(difference)} material ${Math.abs(difference)===1?'point':'points'} (pawn = 1, knight or bishop = 3, rook = 5, queen = 9).` };
}

export function positionEvaluation(game,analysis=null) {
  const material=materialBalance(game),facts=[material.text];
  if(game.isCheckmate()){
    const winner=game.turn()==='w'?'Black':'White';
    return {terminal:true,headline:`${winner} wins by checkmate`,score:winner==='White'?'1–0':'0–1',whiteShare:winner==='White'?100:0,whiteCp:winner==='White'?10000:-10000,facts:[`${sideName(game.turn())} is in check and has no legal escape.`,...facts],line:[]};
  }
  if(game.isDraw()){
    const reason=game.isStalemate()?'stalemate':game.isThreefoldRepetition()?'threefold repetition':game.isInsufficientMaterial()?'insufficient material':'the fifty-move rule';
    return {terminal:true,headline:`Draw · ${reason}`,score:'½–½',whiteShare:50,whiteCp:0,facts:[`The game is drawn by ${reason}.`,...facts],line:[]};
  }
  const line=analysis?.line;
  if(!line)return {terminal:false,headline:'Analysing position…',score:'—',whiteShare:50,whiteCp:0,facts,line:[]};
  const sign=game.turn()==='w'?1:-1;
  const whiteCp=line.mate!=null ? (line.mate>=0?1:-1)*sign*10000 : line.cp*sign;
  const side=whiteCp>=0?'White':'Black',absolute=Math.abs(whiteCp);
  let headline=absolute<50?'Position is balanced':absolute<150?`${side} has a slight edge`:absolute<350?`${side} has the advantage`:`${side} has a large advantage`;
  if(line.mate!=null){headline=`${side} has a forced mate in ${Math.abs(line.mate)}`;facts.unshift(`At this search depth, the engine finds a forced mate for ${side} in ${Math.abs(line.mate)} ${Math.abs(line.mate)===1?'move':'moves'}.`);}
  if(game.isCheck())facts.push(`${sideName(game.turn())} is in check and must answer it.`);
  const moves=sanLine(game.fen(),line.pv,8);
  if(line.pv?.length){
    const copy=new Chess(game.fen());
    try {
      const move=copy.move(uciMove(line.pv[0]));
      if(move.captured)facts.push(`The engine’s preferred move, ${move.san}, captures ${sideName(move.color==='w'?'b':'w')}’s ${PIECE_NAMES[move.captured]} on ${move.to}. The continuation shows the reply.`);
      else if(move.san.includes('+'))facts.push(`The engine’s preferred move, ${move.san}, gives check.`);
      else facts.push(`The engine’s preferred move for ${sideName(game.turn())} is ${move.san}.`);
    }catch{/* Never invent a claim from an invalid continuation. */}
  }
  if(absolute>=50 && material.difference!==0 && Math.sign(material.difference)!==Math.sign(whiteCp))facts.push(`The engine favours ${side} despite the material count. Compare the continuation rather than judging by material alone.`);
  else if(material.difference===0 && absolute>=50)facts.push('With material level, the difference comes from the position and its tactical possibilities. The continuation below shows the engine’s preferred play.');
  return {terminal:false,headline,score:displayScore(line,game.turn()),whiteShare:line.mate!=null?(whiteCp>0?100:0):50+45*Math.tanh(whiteCp/400),whiteCp,facts,line:moves,depth:analysis.depth};
}

// Coalesce rapid navigation: finish an in-flight search, then analyse only the latest position.
export class LatestPositionAnalysis {
  constructor(analyse,onUpdate,limit=200){this.analyse=analyse;this.onUpdate=onUpdate;this.limit=limit;this.cache=new Map();this.target=null;this.running=false;this.state=null;}
  request(fen){
    if(this.target===fen)return;
    this.target=fen;this.state=this.cache.has(fen)?{fen,...this.cache.get(fen)}:{fen,loading:true};
    this.onUpdate(this.state);this.drain();
  }
  pause(){this.target=null;}
  retry(fen){this.cache.delete(fen);this.target=null;this.request(fen);}
  async drain(){
    if(this.running)return;this.running=true;
    try {
      while(this.target && !this.cache.has(this.target)){
        const fen=this.target;let result;
        try { result={analysis:await this.analyse(fen)};if(!result.analysis?.line)throw Error('No evaluation was returned.'); }
        catch(error){result={error:error.message || 'Evaluation unavailable'};}
        this.cache.set(fen,result);
        if(this.cache.size>this.limit)this.cache.delete(this.cache.keys().next().value);
        if(this.target===fen){this.state={fen,...result};this.onUpdate(this.state);}
      }
    } finally {this.running=false;}
  }
}
