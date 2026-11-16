import test from 'node:test';
import assert from 'node:assert/strict';
import { placeCoachPopover } from '../src/coach-popover.js';
test('coach popovers stay next to the badge when desktop has room',()=>{
  const right=placeCoachPopover({left:400,right:432,top:250,bottom:282},{width:322,height:230},{width:1512,height:827});
  assert.equal(right.side,'right');assert.equal(right.left,442);
  const left=placeCoachPopover({left:1400,right:1432,top:250,bottom:282},{width:322,height:230},{width:1512,height:827});assert.equal(left.side,'left');
});
test('mobile popovers stay within the viewport near board edges without page scrolling',()=>{
  for(const anchor of [{left:1,right:33,top:40,bottom:72},{left:283,right:315,top:420,bottom:452}]){
    const p=placeCoachPopover(anchor,{width:296,height:240},{width:320,height:507});
    assert.ok(p.left>=12&&p.left+296<=308);assert.ok(p.top>=12&&p.top+240<=495);
  }
});
