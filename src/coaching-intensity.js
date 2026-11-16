export const COACHING_MODES = [
  {id:'gentle',label:'Gentle',description:'Alternatives and light guidance, without move grades.'},
  {id:'honest',label:'Honest',description:'Move grades and short explanations. Explore alternatives when you want.'},
  {id:'silent',label:'Silent',description:'Play without automatic feedback. Review afterward, or Ask coach anytime.'},
];
export function coachingIntensity(record) {
  return COACHING_MODES.some(mode=>mode.id===record?.coachingIntensity)?record.coachingIntensity:record?.coach===false?'silent':'honest';
}
export function feedbackPolicy(record,finished=false) {
  const mode=coachingIntensity(record),live=mode!=='silent';
  return {mode,guidance:finished||live,grades:finished||mode==='honest',alternatives:finished||live,evaluation:finished||live};
}
