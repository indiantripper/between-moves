import { Chess } from 'chess.js';
import { PIECE_NAMES, uciMove } from './coach.js';
import { previewHighlights } from './coach-highlights.js';
import { explainOpponentMove, pinBehind } from './opponent-coach.js';
const names={w:'White',b:'Black'},value={p:1,n:3,b:3,r:5,q:9,k:100};
export const COACH_QUESTIONS=[{id:'threat',label:'The threat',question:'What’s the threat?'},{id:'why',label:'Why this move?',question:'Why this move?'},{id:'plan',label:'Their plan',question:'What’s their plan?'}];
export function coachQuestion(suggestion,kind='why',level=1350) {
  if(!suggestion?.fen)return null;
  let game;try{game=new Chess(suggestion.fen);}catch{return null;}
  const us=game.turn(),them=us==='w'?'b':'w',side=names[them],marks=[],lines=[];
  const mark=(square,role,label)=>marks.push({square,role,label});
  const pieces=game.board().flat().filter(Boolean);
  if(kind==='threat'){
    const king=pieces.find(p=>p.color===us&&p.type==='k');
    if(game.isCheck()){
      mark(king.square,'threat','Your king is in check');
      for(const from of game.attackers(king.square,them)){mark(from,'threat','Checking piece');lines.push({from,to:king.square,role:'threat',label:'Check'});}
      return {text:`${side} is checking your king on ${king.square}. Your next move must escape, block the check, or capture the checking piece.`,marks,lines};
    }
    for(const p of pieces.filter(p=>p.color===them&&'brq'.includes(p.type))){
      const pin=pinBehind(game,{to:p.square,piece:p.type,color:them});
      if(pin?.behind==='king'){
        for(const square of [p.square,pin.piece.square,pin.behindSquare])mark(square,'pin','Pin to your king');
        lines.push({from:p.square,to:pin.behindSquare,role:'pin',label:'Pin to the king'});
        return {text:`${side}’s ${PIECE_NAMES[p.type]} on ${p.square} pins your ${PIECE_NAMES[pin.piece.type]} on ${pin.piece.square} to your king on ${pin.behindSquare}. Moving it off that line would expose check.`,marks,lines};
      }
    }
    const attacked=pieces.filter(p=>p.color===us&&p.type!=='k'&&game.attackers(p.square,them).length).sort((a,b)=>(game.attackers(b.square,us).length===0?10:0)+value[b.type]-(game.attackers(a.square,us).length===0?10:0)-value[a.type]);
    const target=attacked[0];
    if(target){
      const from=game.attackers(target.square,them)[0],attacker=game.get(from),defended=game.attackers(target.square,us).length>0;
      mark(from,'threat','Attacking piece');mark(target.square,'threat','Attacked piece');lines.push({from,to:target.square,role:'threat',label:'Current attack'});
      return {text:`${side}’s ${PIECE_NAMES[attacker.type]} on ${from} attacks your ${PIECE_NAMES[target.type]} on ${target.square}. ${defended?'It has a defender; compare the exchange before moving it.':'It has no defender. Consider protecting it, moving it, or finding a forcing reply.'} An attack alone does not prove a winning capture.`,marks,lines};
    }
    return {text:`No direct check, absolute pin, or attack on your pieces is visible in the current position. That doesn’t rule out a deeper tactic. Use “Their plan” to inspect a possible reply.`,marks,lines};
  }
  let move;try{move=game.move(uciMove(suggestion.uci));}catch{return null;}
  if(kind==='why'){
    const highlight=previewHighlights(suggestion,1,level);
    return {text:`${suggestion.san}: ${suggestion.idea}`,marks:highlight.marks.map(m=>({...m,label:'Possible line: '+m.label})),lines:[{from:move.from,to:move.to,role:'move',conditional:true,label:'Suggested move'},...highlight.lines.map(l=>({...l,conditional:true}))],future:true};
  }
  const replyUci=suggestion.pv?.[1];
  if(!replyUci)return {text:game.isGameOver()?`${suggestion.san} ends this line; there is no opponent reply.`:'The engine supplied no legal reply in this line. Try another alternative.',marks,lines};
  const before=game.fen(),idea=explainOpponentMove({before,uci:replyUci,previousMove:move,level});
  let reply;try{reply=game.move(uciMove(replyUci));}catch{return null;}
  if(!idea)return null;
  const highlight=previewHighlights(suggestion,2,level);
  return {text:`If you play ${suggestion.san}, ${side} could reply ${reply.san}. ${idea.reason} ${idea.plan}`,marks:highlight.marks.map(m=>({...m,label:'Possible line: '+m.label})),lines:[{from:move.from,to:move.to,role:'move',conditional:true,label:'Your suggested move'}, {from:reply.from,to:reply.to,role:'threat',conditional:true,label:'Possible opponent reply'},...highlight.lines.map(l=>({...l,conditional:true}))],future:true};
}
