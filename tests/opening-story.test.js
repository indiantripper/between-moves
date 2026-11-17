import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {openingStory} from '../src/opening-story.js';
import {identifyOpening,OPENINGS} from '../src/openings.js';
test('the actual Marshall defence gets its own note instead of the selected practice opening',()=>{
 const game=new Chess();for(const move of ['d4','d5','c4','Nf6'])game.move(move);const opening=identifyOpening(game),note=openingStory(opening);
 assert.equal(opening.eco,'D06');assert.equal(note.id,'marshall');assert.match(note.trivia,/Frank Marshall/);assert.match(note.idea,/knight/);assert.equal(note.sourceTitle,'Marshall Defense');
});
test('family facts follow recognised names and normalise apostrophes and defence spellings',()=>{
 assert.equal(openingStory({name:'Queen’s Gambit Declined: Marshall Defence',eco:'D06'}).id,'marshall');
 assert.equal(openingStory({name:'Caro–Kann Defence: Advance Variation',eco:'B12'}).id,'caro');
 assert.equal(openingStory({name:'Ruy Lopez: Marshall Attack',eco:'C89'}).id,'ruy');
 assert.equal(openingStory({name:'Nimzo-Indian Defense: Rubinstein Variation',eco:'E40'}).id,'nimzo');
});
test('unknown variations get honest code information, while unnamed positions show no story',()=>{
 assert.equal(openingStory(null),null);assert.equal(openingStory({name:'Unknown'}),null);
 const note=openingStory({name:'Rare opening',eco:'A00'});assert.equal(note.id,'eco');assert.match(note.trivia,/500 codes/);assert.doesNotMatch(note.trivia,/named after/);
});
test('all practice families have short, sourced notes after their characteristic moves',()=>{
 for(const opening of OPENINGS.filter(o=>o.lines)){
  const game=new Chess();for(const move of opening.lines[0])game.move(move);
  const note=openingStory(identifyOpening(game));assert.ok(note,opening.id);assert.notEqual(note.id,'eco',opening.id);assert.ok(note.idea.length<105);assert.ok(note.trivia.length<100);assert.ok(note.sourceUrl.startsWith('https://en.wikipedia.org/wiki/'));
 }
});
