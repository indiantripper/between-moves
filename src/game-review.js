import { positionAt,historyRows } from './timeline.js';
export function reviewModel(record){
  const history=positionAt(record,record.moves.length).history({verbose:true}),entries=new Map();
  for(const attempt of [...(record.attempts||[]),...(record.reviewAttempts||[])]){
    const move=history[attempt.ply];
    if(move&&move.lan===attempt.uci&&move.before===attempt.before&&attempt.actual?.pv?.[0]===move.lan&&attempt.lines?.[0]?.pv?.length&&attempt.grade&&attempt.grade.label!=='Unrated')entries.set(attempt.ply,attempt);
  }
  const sides={w:{total:0,analysed:0,best:0,good:0,inaccuracy:0,mistake:0,blunder:0},b:{total:0,analysed:0,best:0,good:0,inaccuracy:0,mistake:0,blunder:0}},points=[],keyPlies=[];
  history.forEach((move,ply)=>{
    const side=sides[move.color],entry=entries.get(ply);side.total++;
    if(!entry){points.push(null);return;}
    side.analysed++;
    const grade=entry.grade;
    const category=grade.severity>=3?'blunder':grade.severity>=2?'mistake':grade.severity===1?'inaccuracy':grade.label==='Best move'?'best':'good';
    side[category]++;if(grade.severity>0)keyPlies.push(ply);
    const score=entry.actual,sign=move.color==='w'?1:-1;
    points.push(Number.isFinite(score.mate)?Math.sign(score.mate||1)*sign*10:Number.isFinite(score.cp)?score.cp*sign/100:null);
  });
  return {history,rows:historyRows(record),entries,sides,points,keyPlies,analysed:entries.size,total:history.length};
}
