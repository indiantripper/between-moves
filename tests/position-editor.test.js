import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { moveDraftPiece,resumePositionFen,editedSession } from '../src/position-editor.js';
import { positionAt,forkSession,replaceOpponentLine,historyRows } from '../src/timeline.js';
import { moveCaption } from '../src/move-caption.js';
function source(){const g=new Chess();g.move('d4');return {id:'original',color:'b',moves:['d2d4'],attempts:[],level:1350,opponent:1500,coach:true};}
function e4Draft(record){let fen=positionAt(record,record.moves.length).fen();fen=moveDraftPiece(fen,'d4','d2');return moveDraftPiece(fen,'e2','e4');}
test('pieces can be freely rearranged and resumed as either side without changing the source game',()=>{
  const record=source(),before=structuredClone(record),fen=e4Draft(record);
  for(const turn of ['w','b']){
    const branch=editedSession(record,fen,turn,'new-'+turn),game=positionAt(branch,0);
    assert.equal(game.get('d2').type,'p');assert.equal(game.get('d4'),undefined);assert.equal(game.get('e4').type,'p');
    assert.equal(game.turn(),turn);assert.equal(branch.color,turn);assert.equal(branch.parentId,'original');assert.equal(branch.retrying,true);assert.equal(branch.opponent,1500);assert.deepEqual(branch.moves,[]);
  }
  assert.deepEqual(record,before);
});
test('custom roots survive moves, rewind, branching and opponent replacement, including Black-first games',()=>{
  const root=editedSession(source(),e4Draft(source()),'b','study'),game=positionAt(root,0);
  root.moves.push(game.move('c5').lan);root.moves.push(game.move('Nf3').lan);
  assert.equal(positionAt(root,1).get('c5').color,'b');assert.equal(positionAt(root,0).get('c7').color,'b');
  assert.deepEqual(historyRows(root),[{number:1,w:null,b:0},{number:2,w:1,b:null}]);
  assert.equal(moveCaption(root),'1… c5  ·  2. Nf3');
  const fork=forkSession(root,1,'fork');assert.equal(positionAt(fork,1).fen(),positionAt(root,1).fen());
  const alternate=replaceOpponentLine(root,1,'d2d4','different');assert.equal(positionAt(alternate,2).get('d4').color,'w');assert.equal(root.moves[1],'g1f3');
});
test('setup validation rejects unsafe kings, back-rank pawns and removing a king',()=>{
  const start=new Chess().fen();assert.throws(()=>moveDraftPiece(start,'d1','e8'),/king/);
  assert.throws(()=>moveDraftPiece(start,'d1','e1'),/king/);
  assert.throws(()=>moveDraftPiece(start,'d2','e2'),/friendly/);
  const pawn=moveDraftPiece(start,'a2','a8');assert.throws(()=>resumePositionFen(pawn,'w'),/pawns off/);
  assert.throws(()=>resumePositionFen('8/8/8/8/8/4k3/4K3/8 w - - 0 1','w'),/not moving.*check/);
  assert.throws(()=>resumePositionFen(start,'x'),/White or Black/);
});
test('moving a rook revokes castling rights and edited positions clear stale en passant',()=>{
  let fen=moveDraftPiece(new Chess().fen(),'h1','h3');fen=moveDraftPiece(fen,'h3','h1');
  assert.equal(resumePositionFen(fen,'w').split(' ')[2].includes('K'),false);
  const ep='4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2';assert.equal(resumePositionFen(ep,'w').split(' ')[3],'-');
});
test('custom position PGNs preserve the setup and can be replayed after export',()=>{
  const study=editedSession(source(),e4Draft(source()),'b','study'),game=positionAt(study,0);
  study.moves.push(game.move('c5').lan);study.moves.push(game.move('Nf3').lan);
  const pgn=positionAt(study,2).pgn();assert.match(pgn,/\[FEN "/);assert.match(pgn,/1\. \.\.\. c5/);
  const imported=new Chess();imported.loadPgn(pgn);assert.equal(imported.fen(),positionAt(study,2).fen());
});
