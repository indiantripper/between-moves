// Reset means a fresh standard game, never an edited FEN or a historical branch.
export function resetPractice(record,id,{opening=record.opening,coachingIntensity=record.coachingIntensity,coach=record.coach}={}) {
  const {color,level,opponent,mode}=record;
  return {id,created:new Date().toISOString(),color,opening,level,opponent,mode,assess:false,coachingIntensity,coach,moves:[],attempts:[],finished:false};
}
