import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {extendReplayLine} from '../src/replay-line.js';
import {miniLineFrames} from '../src/mini-line.js';
import {navigationCursor} from '../src/navigation-cursor.js';
test('punishment replay extends six full moves legally without changing its source',async()=>{
 const fen=new Chess().fen(),pv=['e2e4','e7e5'],saved=[...pv];
 const rest=['g1f3','b8c6','f1b5','a7a6','b5a4','g8f6','e1g1','f8e7','f1e1','b7b5'];
 const line=await extendReplayLine(fen,pv,async()=>({lines:[{pv:rest}]}));
 assert.equal(line.length,12);assert.equal(miniLineFrames(fen,line,12).length,13);assert.deepEqual(pv,saved);
});
test('replays stop at mate and do not invent an unavailable or illegal move',async()=>{
 let searches=0;const fen='7k/5Q2/6K1/8/8/8/8/8 w - - 0 1';
 assert.deepEqual(await extendReplayLine(fen,['f7g7'],async()=>{searches++;return {};}),['f7g7']);assert.equal(searches,0);
 assert.deepEqual(await extendReplayLine(new Chess().fen(),['e2e4'],async()=>({lines:[{pv:['e7e4']}]})),['e2e4']);
});
test('closing a replay cancels continuation work before the next request',async()=>{
 let searches=0;const line=await extendReplayLine(new Chess().fen(),['e2e4'],async()=>{searches++;return {};},{active:()=>false});assert.equal(searches,0);assert.equal(line.length,1);
});
test('preview arrows use the preview cursor even at the end of the actual game',()=>{
 assert.deepEqual(navigationCursor(40,{line:['e2e4','e7e5'],step:1}),{position:1,length:2,back:true,next:true});
 assert.equal(navigationCursor(40,{line:['e2e4','e7e5'],step:2}).next,false);
 assert.equal(navigationCursor(40,{historyPly:10}).next,true);assert.equal(navigationCursor(40,null).next,false);
});

test('a truncated mating PV is filled through the defence to actual checkmate',async()=>{
 const fen='7k/8/5K2/4Q3/8/8/8/8 w - - 0 1',saved=['e5c7'];let searches=0;
 const full=await extendReplayLine(fen,saved,async position=>{
   searches++;const board=new Chess(position);assert.equal(board.turn(),'b');
   return {lines:[{mate:-1,pv:['h8g8','c7g7']}]};
 });
 assert.equal(searches,1);assert.deepEqual(full,['e5c7','h8g8','c7g7']);
 assert.equal(new Chess(miniLineFrames(fen,full,12).at(-1).fen).isCheckmate(),true);
 assert.deepEqual(saved,['e5c7']);
});
