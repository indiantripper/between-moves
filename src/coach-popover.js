export function placeCoachPopover(anchor,size,viewport) {
  const pad=12,gap=10,width=Math.min(size.width,viewport.width-2*pad),height=Math.min(size.height,viewport.height-2*pad);
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(n,Math.max(lo,hi)));
  let left,top,side;
  if(viewport.width-anchor.right-gap-pad>=width){side='right';left=anchor.right+gap;top=anchor.top-12;}
  else if(anchor.left-gap-pad>=width){side='left';left=anchor.left-width-gap;top=anchor.top-12;}
  else if(viewport.height-anchor.bottom-gap-pad>=height){side='bottom';left=(anchor.left+anchor.right-width)/2;top=anchor.bottom+gap;}
  else {side='top';left=(anchor.left+anchor.right-width)/2;top=anchor.top-height-gap;}
  return {left:clamp(left,pad,viewport.width-width-pad),top:clamp(top,pad,viewport.height-height-pad),maxHeight:viewport.height-2*pad,side};
}
