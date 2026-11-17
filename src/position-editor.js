import { Chess } from 'chess.js';

export function moveDraftPiece(fen,from,to) {
  if(from===to)return fen;
  const board=new Chess(fen,{skipValidation:true}),piece=board.get(from),target=board.get(to);
  if(!piece)throw Error('Pick up a piece first.');
  if(target?.type==='k')throw Error('Move the king to an empty square; it cannot be removed.');
  if(target?.color===piece.color)throw Error('That square already has a friendly piece.');
  board.remove(from);if(target)board.remove(to);
  if(!board.put(piece,to))throw Error('That piece cannot be placed there.');
  return board.fen();
}
export function resumePositionFen(fen,turn) {
  if(!['w','b'].includes(turn))throw Error('Choose White or Black to play.');
  const draft=new Chess(fen,{skipValidation:true});
  if(draft.board().flat().some(p=>p?.type==='p'&&['1','8'].includes(p.square[1])))throw Error('Move pawns off the first and eighth ranks before resuming.');
  const fields=fen.split(' ');fields[1]=turn;fields[3]='-';fields[4]='0';
  const board=new Chess(fields.join(' '));
  const nonMoving=turn==='w'?'b':'w',king=board.board().flat().find(p=>p?.type==='k'&&p.color===nonMoving);
  if(board.isAttacked(king.square,turn))throw Error('The side not moving cannot already be in check. Change whose turn it is, or adjust the position.');
  return board.fen();
}
export function editedSession(record,fen,turn,id,created=new Date().toISOString()) {
  const startFen=resumePositionFen(fen,turn);
  return {id,created,parentId:record.id,editedPosition:true,startFen,mode:record.mode,coachingIntensity:record.coachingIntensity,color:record.color,opening:'custom',level:record.level||1350,opponent:record.opponent,assess:false,coach:record.coach??true,moves:[],attempts:[],finished:false,retrying:true};
}
