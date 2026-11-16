import { Chess } from 'chess.js';
import { previewSuggestion, previewLesson } from './ask-coach.js';
import { pinBehind } from './opponent-coach.js';
import { uciMove } from './coach.js';

// Highlights use the displayed position and verified geometry. Square references
// select the facts being discussed; future destinations are not treated as occupied.
export function previewHighlights(suggestion,step,level=1350) {
  const result=previewSuggestion(suggestion,step),lesson=previewLesson(suggestion,step,level);
  const marks=new Map(),lines=[];
  if(!result || !lesson || !result.last)return {marks:[],lines:[]};
  const game=new Chess(result.fen),move=result.last;
  const mark=(square,role,label)=>{
    if(!/^[a-h][1-8]$/.test(square))return;
    const old=marks.get(square),priority={move:0,idea:1,support:2,threat:3,pin:4};
    if(!old || priority[role]>=priority[old.role])marks.set(square,{square,role,label});
  };
  mark(move.from,'move','Move started here');mark(move.to,'move','Piece just moved here');
  if(move.flags.includes('k')||move.flags.includes('q')){
    const rank=move.to[1],kingSide=move.flags.includes('k');
    mark((kingSide?'h':'a')+rank,'move','Castling rook started here');
    mark((kingSide?'f':'d')+rank,'move','Castling rook moved here');
  }
  if(move.flags.includes('e'))mark(move.to[0]+move.from[1],'threat','En passant pawn was captured here');
  const references=new Set((lesson.reason+' '+lesson.plan+' '+lesson.watch).match(/\b[a-h][1-8]\b/g)||[]);
  for(const square of references){
    const piece=game.get(square),attacked=game.attackers(square,move.color).includes(move.to);
    if(piece && piece.color!==move.color && attacked){
      mark(square,'threat','Attacked piece discussed by the coach');
      lines.push({from:move.to,to:square,role:'threat',label:'Attack on '+square});
    }else if(piece && piece.color===move.color && square!==move.to && attacked){
      mark(square,'support','Piece supported by the move');
      lines.push({from:move.to,to:square,role:'support',label:'Support for '+square});
    }else if(!marks.has(square))mark(square,'idea','Square discussed by the coach');
  }
  const pin=pinBehind(game,move);
  if(lesson.actor==='opponent' && pin && references.has(pin.piece.square)){
    const label=pin.behind==='king'?'Pin to the king':'Line to the queen';
    mark(move.to,'pin','Piece creating the '+(pin.behind==='king'?'pin':'line'));
    mark(pin.piece.square,'pin',pin.behind==='king'?'Piece pinned to its king':'Piece in front of its queen');
    mark(pin.behindSquare,'pin',pin.behind==='king'?'King behind the pinned piece':'Queen behind the piece');
    lines.push({from:move.to,to:pin.behindSquare,role:'pin',label});
  }
  if(game.isCheck()){
    const king=game.board().flat().find(p=>p?.type==='k' && p.color===game.turn());
    mark(king.square,'threat','King is in check');
    for(const attacker of game.attackers(king.square,move.color)){
      mark(attacker,'threat','Checking piece');
      lines.push({from:attacker,to:king.square,role:'threat',label:'Check'});
    }
  }
  // The watch text for a future capture/check is conditional, so its line is dashed.
  if(lesson.actor==='you' && result.next){
    const replyGame=new Chess(result.fen);let reply;
    try{reply=replyGame.move(uciMove(result.next));}catch{return {marks:[...marks.values()],lines};}
    if(reply.captured || reply.san.includes('+') || reply.san.includes('#')){
      mark(reply.from,'threat','Opponent’s possible reply starts here');
      if(reply.captured){
        const target=reply.flags.includes('e')?reply.to[0]+reply.from[1]:reply.to;
        mark(target,'threat','Piece could be captured in the next reply');
      }
      mark(reply.to,'threat','Destination of the possible reply');
      lines.push({from:reply.from,to:reply.to,role:'threat',conditional:true,label:'Possible next reply'});
    }
  }
  const unique=[...new Map(lines.map(l=>[l.from+l.to+l.role,l])).values()];
  return {marks:[...marks.values()],lines:unique};
}
