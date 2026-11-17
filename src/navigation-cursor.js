// A variation has its own cursor; game history must not disable its arrows.
export function navigationCursor(total,preview){
  const position=preview?.line?preview.step:preview?.historyPly??total;
  const length=preview?.line?preview.line.length:total;
  return {position,length,back:position>0,next:position<length};
}
