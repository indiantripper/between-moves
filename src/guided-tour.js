export const GUIDE_STEPS=[
 {id:'start',target:'#new-game',title:'Your first game starts here',text:'Choose a side and an opening. Your coach will guide you as you play.',action:'Start a game'},
 {id:'best',target:'#mobile-best-move',title:'Stuck? See a good move',text:'Tap the sparkle to draw the best next move on the board.'},
 {id:'feedback',target:'.best-move-lesson',title:'See what was best',text:'After your move, compare it with the best choice. Tap its thumbnail to see why.'},
 {id:'alternatives',target:'[data-previous-options] > summary',title:'There’s more than one good move',text:'Open this section to compare the next-best choices for the move you just played.'},
 {id:'opponent',target:'.opponent-context > summary',title:'What was their idea?',text:'Your opponent has played. Open their last move to see the plan and what to watch for.'},
 {id:'next',target:'[data-next-options] > summary',title:'Look ahead before you move',text:'Open this section for your next five choices, each with a simple idea and replay.'},
 {id:'punishment',target:'.consequence-replay',title:'See how this can hurt',text:'For an inaccuracy, mistake or blunder, enlarge this replay. Step through the replies to see how the opponent can punish it.'}
];
export function nextGuideStep(context,seen={}){
 if(seen.skipped)return null;
 const eligible={start:!context.hasGame&&!context.hasGames,best:context.hasGame&&!context.finished&&context.ready!==false,feedback:context.feedback,alternatives:context.alternatives,opponent:context.opponent,next:context.next,punishment:context.bad};
 return GUIDE_STEPS.find(step=>!seen[step.id]&&eligible[step.id])||null;
}
