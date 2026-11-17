export const GUIDE_STEPS=[
 {id:'start',target:'#new-game',title:'Start a game',text:'Tap + to choose a side and opening.',action:'Start game',after:0},
 {id:'badge',target:'#piece-move-grade',title:'Tap the move badge',text:'See your feedback and the best move.',after:1},
 {id:'punishment',target:'.consequence-replay',title:'How they can punish you',text:'Tap Enlarge to follow their replies.',after:2},
 {id:'best',target:'#mobile-best-move',title:'Need a move?',text:'Tap ✦ to see the best move.',after:4},
 {id:'next',target:'[data-next-options] > summary',title:'Your next move',text:'Open this section for five moves you can play now.',after:9},
 {id:'alternatives',target:'[data-previous-options] > summary',title:'Other good moves',text:'Compare the other choices for your last move.',after:14},
 {id:'opponent',target:'.opponent-context > summary',title:'Their last move',text:'Open this section to see their idea.',after:19},
 {id:'feedback',target:'.best-move-lesson',title:'See what you missed',text:'Tap the small board to replay the better move.',after:24}
];
export function guideDecisionCount(games){return games.reduce((n,g)=>n+(g.attempts||[]).filter(a=>!a.retry).length,0);}
export function nextGuideStep(context,seen={}){
 if(seen.skipped)return null;
 const decisions=context.decisions||0,now=context.now??Date.now();
 if((context.idleMs??Infinity)<2500)return null;
 if(!context.hasGame&&!context.hasGames)return !seen.start&&(context.pageAgeMs??0)>=3000?GUIDE_STEPS[0]:null;
 if(context.finished||!context.ready)return null;
 if(seen._lastDecision!=null&&decisions-seen._lastDecision<3)return null;
 if(seen._lastAt&&now-seen._lastAt<30000)return null;
 const eligible={badge:context.badge,best:context.ready,next:context.next,feedback:context.feedback,alternatives:context.alternatives,opponent:context.opponent,punishment:context.bad||context.opportunity};
 const step=GUIDE_STEPS.find(s=>s.id!=='start'&&!seen[s.id]&&decisions>=s.after&&decisions>=(seen._snoozed?.[s.id]||0)&&eligible[s.id]);
 return step?.id==='punishment'&&context.opportunity?{...step,target:'.missed-opportunity-lesson',title:'See what you missed',text:'Tap Enlarge to replay this chance.'}:step||null;
}
