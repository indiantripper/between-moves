import {Chess} from 'chess.js';
import {PIECE_NAMES,uciMove} from './coach.js';
import {moveInWords} from './move-language.js';
import {coachSuggestion} from './ask-coach.js';
import {pinBehind} from './opponent-coach.js';
const value={p:1,n:3,b:3,r:5,q:9,k:0};
const side=c=>c==='w'?'White':'Black';
const material=(board,color)=>board.board().flat().filter(Boolean).reduce((n,p)=>n+(p.color===color?1:-1)*value[p.type],0);
export function replayLesson(fen,pv,step,{punishment=false}={}){
 try{
  const root=new Chess(fen),board=new Chess(fen),count=Math.max(0,Math.min(pv.length,step));let move,previous,before;
  for(const uci of pv.slice(0,count)){before=board.fen();previous=move;move=board.move(uciMove(uci));}
  const attacker=root.turn(),defender=attacker==='w'?'b':'w',marks=[],lines=[];
  if(!move)return {heading:punishment?'After your mistake':'Starting position',words:'Before this continuation.',reason:punishment?'Look for the opponent’s checks, captures and attacks. Step forward to see one possible punishment.':'Step forward to see the move and its idea.',watch:'',impact:'',marks,lines};
  const actor=punishment?(move.color===attacker?'Opponent':'Your defence'):side(move.color);
  const mark=(square,role,label)=>marks.push({square,role,label});
  mark(move.from,'move','Move starts here');mark(move.to,'move','Piece moved here');
  if(move.flags.includes('k')||move.flags.includes('q')){const rank=move.to[1],kingSide=move.flags.includes('k');mark((kingSide?'h':'a')+rank,'move','Castling rook starts here');mark((kingSide?'f':'d')+rank,'move','Castling rook moves here');}
  let reason='',watch='';
  if(board.isCheckmate())reason=`${side(move.color)} gives checkmate. The king is attacked and has no legal escape.`;
  else if(move.captured){
   const recapture=previous?.captured&&previous.to===move.to;
   reason=`${side(move.color)} ${recapture?'takes back':'captures'} the ${PIECE_NAMES[move.captured]} on ${move.to}.`;
   if(punishment&&move.color===attacker)reason+=' Follow your reply to see whether you can take anything back.';
   if(move.flags.includes('e'))mark(move.to[0]+move.from[1],'threat','Pawn captured en passant');
   mark(move.to,'threat','Capture');
  }else if(board.isCheck())reason=`${side(move.color)} gives check. The king must be saved before any other plan.`;
  const targets=board.board().flat().filter(p=>p&&p.color!==move.color&&p.type!=='k'&&board.attackers(p.square,move.color).includes(move.to));
  targets.sort((a,b)=>value[b.type]-value[a.type]);
  const pin=pinBehind(board,move);
  if(pin){
   const pinText=pin.behind==='king'?`The ${PIECE_NAMES[pin.piece.type]} on ${pin.piece.square} is pinned: moving it would expose the king on ${pin.behindSquare}.`:`The ${PIECE_NAMES[pin.piece.type]} on ${pin.piece.square} shields the queen on ${pin.behindSquare}. Moving it could lose the queen.`;
   reason=reason?reason+' '+pinText:pinText;
   mark(pin.piece.square,'pin','Pinned or shielded piece');mark(pin.behindSquare,'pin',pin.behind==='king'?'King behind the pin':'Queen behind the piece');lines.push({from:move.to,to:pin.behindSquare,role:'pin',label:pinText});
  }else if(targets.length&&!board.isCheck()){
   const chosen=targets.slice(0,2),description=chosen.map(p=>`the ${PIECE_NAMES[p.type]} on ${p.square}`).join(' and ');
   const attack=`${side(move.color)} attacks ${description}${chosen.length>1?' at the same time':''}.`;
   reason=reason?reason+' '+attack:attack;
   for(const target of chosen){mark(target.square,'threat','Attacked piece');lines.push({from:move.to,to:target.square,role:'threat',label:'Attack on '+target.square});}
  }
  if(!reason){
   const idea=coachSuggestion(before,{pv:pv.slice(count-1)});
   reason=(idea?.idea||'Improve the position before the next reply.').split(/(?<=\.)\s+/).slice(0,2).join(' ');
   reason=reason.replace(/your /gi,`${side(move.color)}’s `);
   for(const square of new Set(reason.match(/\b[a-h][1-8]\b/g)||[]))if(!marks.some(m=>m.square===square))mark(square,'idea','Square discussed');
  }
  if(board.isCheck()){
   const king=board.board().flat().find(p=>p?.type==='k'&&p.color===board.turn());mark(king.square,'threat','King in check');
   for(const from of board.attackers(king.square,move.color))lines.push({from,to:king.square,role:'threat',label:'Check'});
  }
  if(!board.isGameOver()&&pv[count]){
   const future=new Chess(board.fen()),reply=future.move(uciMove(pv[count]));
   if(reply.captured||future.isCheck()){
    watch=`Next: ${side(reply.color)} can ${future.isCheckmate()?'give checkmate':reply.captured?`take the ${PIECE_NAMES[reply.captured]} on ${reply.to}`:'give check'}.`;
    mark(reply.from,'threat','Possible reply starts here');mark(reply.to,'threat','Possible next reply');lines.push({from:reply.from,to:reply.to,role:'threat',conditional:true,label:watch});
   }
  }
  const gain=material(board,attacker)-material(root,attacker);
  const impact=punishment&&gain>0?`${side(attacker)} is up ${gain} ${gain===1?'point':'points'} of material since the mistake.`:punishment&&move.color===defender&&!board.isGameOver()?'Your side is trying to limit the damage in this line.':'';
  return {heading:`${actor} · ${move.san}`,words:moveInWords(move),reason,watch,impact,marks,lines};
 }catch{return null;}
}
