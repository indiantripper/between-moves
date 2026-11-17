export const COACHING_MODES = [
  {id:'coached',label:'Coached',description:'Move grades, clear ideas and five suggestions for your next move.'},
  {id:'silent',label:'Silent',description:'Play without suggestions or grades. Review your moves afterward.'},
];
export function coachingIntensity(record) {
  if(record?.coachingIntensity==='silent')return 'silent';
  if(['coached','gentle','honest'].includes(record?.coachingIntensity))return 'coached';
  return record?.coach===false?'silent':'coached';
}
export function feedbackPolicy(record,finished=false) {
  const mode=coachingIntensity(record),live=mode!=='silent';
  return {mode,guidance:finished||live,grades:finished||live,alternatives:finished||live,evaluation:finished||live};
}
