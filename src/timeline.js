import { Chess } from 'chess.js';
import { uciMove } from './coach.js';

export function positionAt(record,ply) {
  const count=Math.max(0,Math.min(record.moves.length,Math.trunc(ply)));
  const game=new Chess();
  for(const move of record.moves.slice(0,count))game.move(uciMove(move));
  return game;
}

export function forkSession(record,ply,id,created=new Date().toISOString()) {
  const game=positionAt(record,ply), moves=game.history({verbose:true});
  return {
    ...structuredClone(record),id,created,parentId:record.id,branchPly:moves.length,
    moves:moves.map(m=>m.lan),
    attempts:structuredClone(record.attempts.filter(a=>a.ply<moves.length && a.before===moves[a.ply]?.before)).map(a=>({...a,inherited:true})),
    finished:false,result:null,pending:null,retrying:true
  };
}
