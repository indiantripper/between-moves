import { Chess } from 'chess.js';
import { uciMove } from './coach.js';
import { moveInWords } from './move-language.js';
const glyphs={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function miniLineFrames(fen,pv) {
  try{
    const game=new Chess(fen),frames=[{fen:game.fen(),label:'Before',words:'Position before your move.',last:null}];
    for(const uci of (pv||[]).slice(0,2)){
      let move;try{move=game.move(uciMove(uci));}catch{break;}
      frames.push({fen:game.fen(),label:move.san,words:moveInWords(move),last:{from:move.from,to:move.to}});
    }
    return frames.length>1?frames:[];
  }catch{return [];}
}
export function miniLineMarkup(fen,pv,flipped=false) {
  const frames=miniLineFrames(fen,pv);if(!frames.length)return '';
  const point=s=>{let x=s.charCodeAt(0)-97,y=8-Number(s[1]);if(flipped){x=7-x;y=7-y;}return [x*30,y*30];};
  const squares=Array.from({length:64},(_,i)=>`<rect x="${i%8*30}" y="${Math.floor(i/8)*30}" width="30" height="30" fill="${(i%8+Math.floor(i/8))%2?'#789079':'#eee9d8'}"/>`).join('');
  const frameGroups=frames.map((frame,i)=>{
    const board=new Chess(frame.fen);let highlights='';
    if(frame.last)for(const s of [frame.last.from,frame.last.to]){const [x,y]=point(s);highlights+=`<rect x="${x}" y="${y}" width="30" height="30" fill="#dec362" fill-opacity=".75"/>`;}
    const pieces=board.board().flat().filter(Boolean).map(p=>{const [x,y]=point(p.square);return `<text x="${x+15}" y="${y+24}" text-anchor="middle" font-size="28" font-family="Arial Unicode MS,Apple Symbols,DejaVu Sans,serif" fill="${p.color==='w'?'#fffaf0':'#243b32'}" stroke="${p.color==='w'?'#36483f':'#192c25'}" stroke-width=".6" paint-order="stroke">${glyphs[p.type]}</text>`;}).join('');
    return `<g class="mini-state ${i===1?'is-current':''}" data-mini-frame="${i}">${highlights}${pieces}</g>`;
  }).join('');
  return `<figure class="mini-line-preview" data-mini-count="${frames.length}" data-mini-index="1"><div class="mini-board" role="img" aria-label="Move preview: ${escape(frames.slice(1).map(f=>f.words).join(' '))}"><svg viewBox="0 0 240 240" aria-hidden="true">${squares}${frameGroups}</svg></div><figcaption><span class="mini-caption">${escape(frames[1].label)}</span><button type="button" class="mini-replay" data-mini-replay aria-label="Replay the move and reply" aria-pressed="false">▶ Replay</button></figcaption><span class="mini-frame-labels" hidden>${frames.map(f=>`<span>${escape(f.label)}</span>`).join('')}</span></figure>`;
}
