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
    overrides:structuredClone((record.overrides||[]).filter(move=>move.ply<moves.length)),
    finished:false,result:null,pending:null,retrying:true
  };
}

export function opponentMoveAt(record,visiblePly=record.moves.length) {
  const game=positionAt(record,visiblePly),history=game.history({verbose:true});
  for(let ply=history.length-1;ply>=0;ply--)if(history[ply].color!==record.color)return {ply,...history[ply]};
  return null;
}

export function replaceOpponentLine(record,ply,uci,id,created=new Date().toISOString()) {
  if(!Number.isInteger(ply)||ply<0||ply>=record.moves.length)throw Error('Choose an existing opponent move to replace.');
  const game=positionAt(record,ply);
  if(game.turn()===record.color)throw Error('This is your move, not your opponent’s.');
  const original=positionAt(record,ply+1).history({verbose:true}).at(-1);
  const replacement=game.move(uciMove(uci));
  const branch=forkSession(record,ply,id,created);
  branch.moves.push(replacement.lan);
  branch.overrides.push({ply,before:replacement.before,after:replacement.after,uci:replacement.lan,san:replacement.san,replacedUci:original.lan,replacedSan:original.san});
  return branch;
}
