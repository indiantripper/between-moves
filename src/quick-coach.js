import { Chess } from 'chess.js';
import { coachSuggestion } from './ask-coach.js';
import { gradeMove } from './coach.js';

export function moveBadge(grade) {
  if(!grade || grade.label==='Unrated')return {tone:'neutral',symbol:'·',label:'Not rated'};
  if(grade.label==='Best move')return {tone:'excellent',symbol:'✓✓',label:'Excellent',detail:'The engine’s best move at this search depth.'};
  if(grade.severity>=3)return {tone:'blunder',symbol:'!!',label:'Blunder'};
  if(grade.severity>=2)return {tone:'mistake',symbol:'!',label:grade.label==='Missed mate'?'Missed mate':'Mistake'};
  if(grade.severity===1)return {tone:'medium',symbol:'?!',label:'Inaccuracy'};
  return grade.label==='Playable'?{tone:'ok',symbol:'✓',label:'OK'}:{tone:'good',symbol:'✓',label:'Good'};
}

// Only call alternatives playable when their engine loss passes the same grading
// used for the user's moves. Weak top-five entries are deliberately omitted.
export function playableChoices(fen,lines,level=1350) {
  const best=lines?.[0];if(!best)return [];
  const seen=new Set(),choices=[];
  for(const line of lines){
    const suggestion=coachSuggestion(fen,line,level);if(!suggestion || seen.has(suggestion.uci))continue;
    seen.add(suggestion.uci);
    const grade=gradeMove(best,line,line.pv[0]===best.pv[0]);
    if(grade.severity!==0)continue;
    choices.push({suggestion,grade,best:line.pv[0]===best.pv[0]});
  }
  return choices;
}

// A reply can capture the moved piece. Never put its grade on an opponent's
// replacement piece; callers can show a small fallback chip in that case.
export function pieceQualityTarget(record,game,attempt) {
  if(!record || !attempt || record.moves[attempt.ply]!==attempt.uci)return null;
  const from=attempt.uci.slice(0,2),to=attempt.uci.slice(2,4);
  let original;
  try{original=new Chess(attempt.before).get(from);}catch{return null;}
  const piece=game.get(to),type=attempt.uci[4]||original?.type;
  const mover=record.mode==='free'?original?.color:record.color;
  return original?.color===mover && piece?.color===mover && piece?.type===type?to:null;
}
