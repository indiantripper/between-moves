import { positionAt } from './timeline.js';
import { coachSuggestion, previewSuggestion } from './ask-coach.js';

// Build an isolated two-ply demonstration from the position BEFORE the decision.
// The record and attempt are never modified and no replacement move is committed.
export function bestMovePreview(record,attempt,level=1350) {
  if(!record || !attempt || record.moves[attempt.ply]!==attempt.uci)return null;
  try {
    if(positionAt(record,attempt.ply).fen()!==attempt.before)return null;
    const best=attempt.lines?.[0];
    if(!best?.pv?.length)return null;
    const suggestion=coachSuggestion(attempt.before,{...best,pv:best.pv.slice(0,2)},level);
    const result=previewSuggestion(suggestion,1);
    if(!result)return null;
    return {bestAlternative:true,fen:result.fen,base:attempt.before,line:suggestion.pv,step:1,suggestion,label:`Best move · ${suggestion.san}`};
  }catch{return null;}
}
