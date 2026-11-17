import test from 'node:test';
import assert from 'node:assert/strict';
import {nextGuideStep,guideDecisionCount} from '../src/guided-tour.js';
const context=overrides=>({hasGame:true,hasGames:true,ready:true,decisions:1,idleMs:3000,now:100000,...overrides});
test('the welcome waits for three seconds and user activity delays it',()=>{
 const c={hasGame:false,hasGames:false,pageAgeMs:2999,idleMs:3000};assert.equal(nextGuideStep(c),null);assert.equal(nextGuideStep({...c,pageAgeMs:3000}).id,'start');assert.equal(nextGuideStep({...c,pageAgeMs:5000,idleMs:500}),null);
});
test('introduce the badge first, the best move around the fifth decision and choices around the tenth',()=>{
 assert.equal(nextGuideStep(context({badge:true})).id,'badge');
 const seen={badge:true};assert.equal(nextGuideStep(context({decisions:3}),seen),null);assert.equal(nextGuideStep(context({decisions:4}),seen).id,'best');
 assert.equal(nextGuideStep(context({decisions:8,next:true}),{...seen,best:true}),null);assert.equal(nextGuideStep(context({decisions:9,next:true}),{...seen,best:true}).id,'next');
});
test('trying or dismissing a tip cannot immediately bring up another',()=>{
 const seen={badge:true,_lastDecision:1,_lastAt:90000};assert.equal(nextGuideStep(context({decisions:4}),seen),null);assert.equal(nextGuideStep(context({decisions:4,now:120000}),seen).id,'best');assert.equal(nextGuideStep(context({decisions:2,now:200000,bad:true}),seen),null);
});
test('Not now leaves a feature learnable after five more decisions',()=>{
 const seen={_snoozed:{badge:6}};assert.equal(nextGuideStep(context({badge:true,decisions:3}),seen),null);assert.equal(nextGuideStep(context({badge:true,decisions:6}),seen).id,'badge');
});
test('contextual hints distinguish punishment from a missed chance',()=>{
 const seen={badge:true};assert.equal(nextGuideStep(context({decisions:2,bad:true}),seen).id,'punishment');const tip=nextGuideStep(context({decisions:2,opportunity:true}),seen);assert.match(tip.title,/missed/);assert.equal(tip.target,'.missed-opportunity-lesson');
});
test('tips respect natural learning, finished games, busy turns and explicit opt out',()=>{
 assert.equal(nextGuideStep(context({decisions:4}),{badge:true,best:true}),null);assert.equal(nextGuideStep(context({decisions:5,ready:false,badge:true})),null);assert.equal(nextGuideStep(context({finished:true,badge:true})),null);assert.equal(nextGuideStep(context({badge:true}),{skipped:true}),null);
});
test('experience spans games and excludes retries',()=>{
 assert.equal(guideDecisionCount([{attempts:[{retry:false},{retry:true}]},{attempts:[{},{}]}]),3);
});
