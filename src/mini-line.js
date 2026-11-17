import { Chess } from 'chess.js';
import { uciMove } from './coach.js';
import { moveInWords } from './move-language.js';
const glyphs={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function miniLineFrames(fen,pv,limit=2) {
  try{
    const game=new Chess(fen),frames=[{fen:game.fen(),label:'Before',words:'Starting position.',last:null}];
    for(const uci of (pv||[]).slice(0,limit)){
      let move;try{move=game.move(uciMove(uci));}catch{break;}
      frames.push({fen:game.fen(),label:move.san,words:moveInWords(move),last:{from:move.from,to:move.to}});
    }
    return frames.length>1?frames:[];
  }catch{return [];}
}
export function miniLineMarkup(fen,pv,flipped=false,{initial=1,arrows=false,limit=2,punishment=false,highlights=null}={}) {
  const frames=miniLineFrames(fen,pv,limit);if(!frames.length)return '';
  const start=Math.max(1,Math.min(frames.length-1,initial));
  const point=s=>{let x=s.charCodeAt(0)-97,y=8-Number(s[1]);if(flipped){x=7-x;y=7-y;}return [x*30,y*30];};
  const squares=Array.from({length:64},(_,i)=>`<rect x="${i%8*30}" y="${Math.floor(i/8)*30}" width="30" height="30" fill="${(i%8+Math.floor(i/8))%2?'#789079':'#eee9d8'}"/>`).join('');
  const frameGroups=frames.map((frame,i)=>{
    const board=new Chess(frame.fen);let highlights='';
    if(frame.last)for(const s of [frame.last.from,frame.last.to]){const [x,y]=point(s);highlights+=`<rect x="${x}" y="${y}" width="30" height="30" fill="#dec362" fill-opacity=".75"/>`;}
    if(arrows&&frame.last){
      const [ax,ay]=point(frame.last.from),[bx,by]=point(frame.last.to),x1=ax+15,y1=ay+15,x2=bx+15,y2=by+15,dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
      highlights+=`<path d="M${x1},${y1} L${x2-ux*7},${y2-uy*7}" stroke="#bf7920" stroke-width="5" opacity=".9"/><polygon points="${x2},${y2} ${x2-ux*12-uy*6},${y2-uy*12+ux*6} ${x2-ux*12+uy*6},${y2-uy*12-ux*6}" fill="#bf7920"/>`;
    }
    const pieces=board.board().flat().filter(Boolean).map(p=>{const [x,y]=point(p.square);return `<text x="${x+15}" y="${y+24}" text-anchor="middle" font-size="28" font-family="Arial Unicode MS,Apple Symbols,DejaVu Sans,serif" fill="${p.color==='w'?'#fffaf0':'#243b32'}" stroke="${p.color==='w'?'#36483f':'#192c25'}" stroke-width=".6" paint-order="stroke">${glyphs[p.type]}</text>`;}).join('');
    return `<g class="mini-state ${i===start?'is-current':''}" data-mini-frame="${i}">${highlights}${pieces}</g>`;
  }).join('');
  const palette={move:'#c59330',idea:'#c59330',threat:'#bf5948',pin:'#8967a8',support:'#377b64'};
  const coaching=highlights?`<g class="replay-coaching-highlights">${highlights.marks.map(mark=>{const [x,y]=point(mark.square);return `<rect x="${x+2}" y="${y+2}" width="26" height="26" rx="4" fill="none" stroke="${palette[mark.role]}" stroke-width="2.3"><title>${escape(mark.label)}</title></rect>`;}).join('')}${highlights.lines.map(line=>{const [ax,ay]=point(line.from),[bx,by]=point(line.to),x1=ax+15,y1=ay+15,x2=bx+15,y2=by+15,dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);if(!length)return '';const ux=dx/length,uy=dy/length,color=palette[line.role];return `<g opacity=".85"><title>${escape(line.label)}</title><path d="M${x1},${y1} L${x2-ux*8},${y2-uy*8}" stroke="${color}" stroke-width="2.8" ${line.conditional?'stroke-dasharray="5 4"':''}/><polygon points="${x2},${y2} ${x2-ux*9-uy*4},${y2-uy*9+ux*4} ${x2-ux*9+uy*4},${y2-uy*9-ux*4}" fill="${color}"/></g>`;}).join('')}</g>`:'';
  return `<figure class="mini-line-preview" data-mini-fen="${escape(fen)}" data-mini-pv="${escape(JSON.stringify(pv))}" data-mini-limit="${limit}" data-mini-punishment="${punishment}" data-mini-flipped="${flipped}" data-mini-count="${frames.length}" data-mini-index="${start}"><button type="button" data-mini-enlarge class="mini-board" aria-label="Enlarge move replay"><svg viewBox="0 0 240 240" aria-hidden="true">${squares}${frameGroups}${coaching}</svg></button><button type="button" class="mini-enlarge" data-mini-enlarge>⛶ Enlarge</button><figcaption><span class="mini-caption">${escape(frames[start].label)}</span><button type="button" class="mini-replay" data-mini-replay aria-label="Replay the move and reply" aria-pressed="false">▶ Replay</button></figcaption><span class="mini-frame-labels" hidden>${frames.map(f=>`<span>${escape(f.label)}</span>`).join('')}</span></figure>`;
}
