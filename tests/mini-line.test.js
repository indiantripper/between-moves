import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { miniLineFrames, miniLineMarkup } from '../src/mini-line.js';
test('thumbnail replays before, best move and reply without touching the supplied line',()=>{
  const g=new Chess();for(const m of ['e4','e5','Nf3'])g.move(m);const fen=g.fen(),pv=['b8c6','f1b5','a7a6'],saved=JSON.stringify(pv);
  const frames=miniLineFrames(fen,pv);
  assert.equal(frames.length,3);assert.equal(frames[0].fen,fen);assert.equal(new Chess(frames[1].fen).get('c6').type,'n');assert.equal(new Chess(frames[2].fen).get('b5').type,'b');assert.deepEqual(frames.map(f=>f.label),['Before','Nc6','Bb5']);assert.match(frames[1].words,/b8 to c6/);assert.equal(JSON.stringify(pv),saved);assert.equal(g.fen(),fen);
});
test('a capture thumbnail removes the captured piece and handles castling',()=>{
  const g=new Chess();g.move('e4');g.move('d5');const frames=miniLineFrames(g.fen(),['e4d5','d8d5']);
  assert.equal(new Chess(frames[1].fen).get('d5').color,'w');assert.equal(new Chess(frames[2].fen).get('d5').type,'q');
  const castle=miniLineFrames('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',['e1g1','e8c8']);
  assert.equal(new Chess(castle[1].fen).get('f1').type,'r');assert.equal(new Chess(castle[2].fen).get('c8').type,'k');
});
test('terminal and malformed lines never invent a reply',()=>{
  const mate=miniLineFrames('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',['f7g7','h8h7']);assert.equal(mate.length,2);assert.equal(new Chess(mate[1].fen).isCheckmate(),true);
  assert.deepEqual(miniLineFrames(new Chess().fen(),['e2e5']),[]);assert.deepEqual(miniLineFrames('broken',[]),[]);
});
test('opponent plan thumbnails can start on the follow-up and include direction arrows',()=>{
  const g=new Chess();g.move('e4');g.move('e5');
  const markup=miniLineMarkup(g.fen(),['g1f3','b8c6'],false,{initial:2,arrows:true});
  assert.match(markup,/data-mini-index="2"/);assert.match(markup,/mini-caption">Nc6/);assert.match(markup,/<polygon/);
});
