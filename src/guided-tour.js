export const GUIDE_STEPS=[
 {id:'start',target:'#new-game',title:'Start a game',text:'Tap + to choose a side and opening.',action:'Start game'},
 {id:'best',target:'#mobile-best-move',title:'Need a move?',text:'Tap ✦ to see the best move.'},
 {id:'feedback',target:'.best-move-lesson',title:'Best move for your last turn',text:'See what you could have played. Tap the small board to replay it.'},
 {id:'alternatives',target:'[data-previous-options] > summary',title:'Other good moves',text:'Open this section to compare your other choices.'},
 {id:'opponent',target:'.opponent-context > summary',title:'Their last move',text:'Open this section to see their idea.'},
 {id:'next',target:'[data-next-options] > summary',title:'Your next move',text:'Open this section for five moves you can play now.'},
 {id:'punishment',target:'.consequence-replay',title:'How they can punish you',text:'Tap Enlarge. Use the arrows to see how your mistake can be punished.'}
];
export function nextGuideStep(context,seen={}){
 if(seen.skipped)return null;
 const eligible={start:!context.hasGame&&!context.hasGames,best:context.hasGame&&!context.finished&&context.ready!==false,feedback:context.feedback,alternatives:context.alternatives,opponent:context.opponent,next:context.next,punishment:context.bad};
 return GUIDE_STEPS.find(step=>!seen[step.id]&&eligible[step.id])||null;
}
