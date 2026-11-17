import { Chess } from 'chess.js';
import { PIECE_NAMES,uciMove } from './coach.js';

// Translate a legal verbose move, rather than guessing its origin from SAN.
export function moveInWords(move) {
  if(!move?.from || !move?.to || !PIECE_NAMES[move.piece])return '';
  const piece=PIECE_NAMES[move.piece],name=piece[0].toUpperCase()+piece.slice(1);
  let text;
  if(move.flags?.includes('k')||move.flags?.includes('q')){
    const kingSide=move.flags.includes('k'),rank=move.from[1];
    text=`King castles ${kingSide?'kingside':'queenside'}: ${move.from} to ${move.to}, rook ${kingSide?'h':'a'}${rank} to ${kingSide?'f':'d'}${rank}`;
  }else if(move.captured){
    const capturedSquare=move.flags?.includes('e')?move.to[0]+move.from[1]:move.to;
    text=`${name} from ${move.from} captures the ${PIECE_NAMES[move.captured]} on ${capturedSquare}`;
    if(move.flags?.includes('e'))text+=` and moves to ${move.to} (en passant)`;
  }else text=`${name} moves from ${move.from} to ${move.to}`;
  if(move.promotion)text+=` and promotes to a ${PIECE_NAMES[move.promotion]}`;
  if(move.san?.includes('#'))text+=' — checkmate';
  else if(move.san?.includes('+'))text+=' — check';
  return text+'.';
}
export function moveWords(fen,uci) {
  try{return moveInWords(new Chess(fen).move(uciMove(uci)));}catch{return '';}
}
