import { moveInWords } from './move-language.js';
import { Chess } from 'chess.js';
import { positionAt } from './timeline.js';
import { uciMove } from './coach.js';
const label=move=>`${move.before.split(' ')[5]}${move.color==='w'?'.':'…'} ${move.san}`;
export function moveCaption(record,view=null) {
  if(!record)return 'Start a practice to play';
  if(view?.opponentEdit){
    const side=new Chess(view.fen).turn()==='w'?'White':'Black';
    return `Instead of ${view.fen.split(' ')[5]}${side==='White'?'.':'…'} ${view.opponentEdit.san} · Drag a ${side} piece`;
  }
  if(view?.line){
    const shown=new Chess(view.base);
    for(const uci of view.line.slice(0,view.step))shown.move(uciMove(uci));
    const history=shown.history({verbose:true});
    if(!history.length){const next=shown.move(uciMove(view.line[0]));return `Preview · before ${label(next)}`;}
    return `Preview · ${history.slice(-2).map(label).join('  ·  ')}`;
  }
  const shown=positionAt(record,view?.historyPly ?? record.moves.length),history=shown.history({verbose:true});
  return history.length?history.slice(-2).map(label).join('  ·  '):`Starting position · ${shown.turn()==='w'?'White':'Black'} to move`;
}

export function moveTranslation(record,view=null) {
  if(!record||view?.opponentEdit)return '';
  try{
    const shown=view?.line?new Chess(view.base):positionAt(record,view?.historyPly??record.moves.length);
    if(view?.line)for(const uci of view.line.slice(0,view.step))shown.move(uciMove(uci));
    const last=shown.history({verbose:true}).at(-1);
    return last?`${last.color==='w'?'White':'Black'}: ${moveInWords(last)}`:'';
  }catch{return '';}
}
