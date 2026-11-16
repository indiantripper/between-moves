import { Chess } from 'chess.js';
import { Engine } from './engine.js';
import { OPENINGS, chooseOpening, bookOptions, bookStatus } from './openings.js';
import { PIECE_NAMES, uciMove, displayScore, gradeMove, explainMove, explainCandidate, sanLine, learningSummary } from './coach.js';
import { openStore, readState, writeState, validateBackup } from './storage.js';
import './style.css';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glyphs = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
let db, state, game = new Chess(), current, selected = null, busy = true, engineReady = false;
let coachOn = true, awaiting = false, retrying = false, focus = null, preview = null, arrow = null;
let tab = 'coach', generation = 0, flipped = false, toastTimer, saveQueue = Promise.resolve();
const engine = new Engine(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`);
engine.ready.then(() => { engineReady = true; busy = false; render(); resumeSession(); }).catch(handleError);

$('#app').innerHTML = `
  <header class="masthead"><a class="brand" href="./" aria-label="Between Moves home"><span class="brand-mark">♞</span><span>between<span class="brand-light">moves</span><small>YOUR PERSONAL CHESS ROOM</small></span></a>
    <nav><button class="nav-link active" data-tab="coach">Practice</button><button class="nav-link" data-tab="progress">My progress <span class="tiny-dot"></span></button></nav>
    <button class="button primary" id="new-game"><span>＋</span> New practice</button></header>
  <main><div class="page-heading"><div><div class="eyebrow">A LITTLE BETTER, EVERY MOVE</div><h1>Make your next move count.</h1><p>A worthy opponent. A thoughtful coach. Your own pace.</p></div><span class="local-badge"><span></span> Saved on this device</span></div>
    <div class="workspace"><section class="play-area" aria-label="Chess game">
      <div class="player-bar"><div class="avatar opponent-avatar">♞</div><div><strong id="opponent-name">Your practice partner</strong><small id="opponent-caption">Getting the board ready</small></div><span id="engine-status" class="status-pill">Loading engine…</span></div>
      <div class="board-shell"><div class="board" id="board" role="group" aria-label="Chessboard"></div><svg id="arrows" class="arrows" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4" fill="#d78d2a"/></marker></defs><line id="arrow-line" stroke="#d78d2a" stroke-opacity=".86" stroke-width="12" stroke-linecap="round" marker-end="url(#arrowhead)" /></svg></div>
      <div class="player-bar bottom-player"><div class="avatar you-avatar">♙</div><div><strong>You <span id="your-color"></span></strong><small id="your-caption">Your practice, your pace</small></div><button class="icon-button" id="flip" aria-label="Flip board" title="Flip board">⇅</button><button class="button subtle" id="review-game">Review game</button></div>
      <div id="preview-bar" class="preview-bar" hidden></div>
      <div class="board-note"><span id="opening-name">Opening practice</span><span id="book-status">Choose your opening</span></div>
    </section>
    <aside class="side-panel"><div class="panel-tabs"><button class="active" data-panel="coach">Coach</button><button data-panel="moves">Moves</button><button data-panel="progress">My progress</button></div><div id="panel-content"></div></aside></div>
    <footer><span>Think first. Understand next. Keep growing.</span><button id="backup">Export backup</button><button id="restore">Import backup</button><button id="pgn">Export PGN</button><button id="about">About & privacy</button></footer>
  </main>
  <dialog id="setup"><form id="setup-form"><div class="dialog-top"><span class="eyebrow">A FRESH POSITION, A FRESH PERSPECTIVE</span><button type="button" class="icon-button" data-close="setup" aria-label="Close setup">×</button></div><h2>Set up your practice.</h2><p class="muted">Choose the challenge. We’ll meet you where you are.</p>
    <div class="form-grid"><label>Your teaching level<select name="level"><option value="600">600 · Learning the basics</option><option value="900">900 · Building foundations</option><option value="1100">1100 · Finding your rhythm</option><option value="1350" selected>1350 · Club player</option><option value="1600">1600 · Sharpening your game</option><option value="1900">1900 · Advanced</option><option value="2200">2200 · Expert</option><option value="2500">2500 · Master</option></select></label><label>Opponent target strength<input name="opponent" type="number" min="400" max="3000" step="50" value="1350" required/><small>Approximate engine strength, not a platform rating.</small></label></div>
    <label class="check-label"><input type="checkbox" name="assess"/> Assess my level as I play <small>Starts at 1200 difficulty; adjusts after 20 unassisted moves. Provisional, not a calibrated rating.</small></label>
    <div class="field-label">Play as</div><div class="color-options"><label><input type="radio" name="color" value="w" checked/><span>♔ <strong>White</strong><small>You make the first move</small></span></label><label><input type="radio" name="color" value="b"/><span>♚ <strong>Black</strong><small>Practise your response</small></span></label></div>
    <label>Opening<select name="opening">${OPENINGS.map(o=>`<option value="${o.id}">${o.name}</option>`).join('')}</select><small>Curated book variations. You can leave the book at any time.</small></label>
    <label class="check-label"><input type="checkbox" name="coach" checked/> Start with live coaching <small>Top five alternatives after your move. Switch off anytime.</small></label>
    <button class="button primary wide" type="submit">Let’s play <span>↗</span></button><p class="privacy-note">No account. No subscription. Your history stays in this browser.</p></form></dialog>
  <dialog id="promotion"><h2>Promote your pawn</h2><p>Choose your new piece.</p><div class="promotion-options"></div></dialog>
  <dialog id="info"><div class="dialog-top"><span class="eyebrow">BETWEEN MOVES</span><button class="icon-button" data-close="info" aria-label="Close information">×</button></div><div id="info-body"></div></dialog>
  <input type="file" id="backup-file" accept="application/json,.json" hidden/><div id="toast" role="status"></div>`;

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').classList.remove('visible'),5500); }
function handleError(error) { console.error(error); busy = false; render(); toast(error.message || 'Something went wrong. Please try again.'); }
function persist() {
  if (!db) return Promise.resolve();
  const snapshot = structuredClone(state);
  saveQueue = saveQueue.then(()=>writeState(db,snapshot)).catch(()=> { $('.local-badge').textContent='Storage unavailable — export a backup'; toast('Could not save in this browser. Export a backup to keep your history.'); });
  return saveQueue;
}
function historyGame(record = current) { const g = new Chess(); for (const move of record?.moves || []) g.move(uciMove(move)); return g; }
function getOpening() { return OPENINGS.find(o=>o.id === current?.opening); }
function playerLevel() { return current?.level || state?.settings.level || 1350; }
function squarePoint(square) {
  let x = square.charCodeAt(0)-97, y = 8-Number(square[1]);
  if (flipped) { x=7-x; y=7-y; } return [x*100+50,y*100+50];
}
function drawBoard() {
  const shown = preview ? new Chess(preview.fen) : game;
  const files = flipped ? 'hgfedcba' : 'abcdefgh', ranks = flipped ? '12345678' : '87654321';
  let legal = []; if (selected && !preview) legal = game.moves({ square:selected,verbose:true }).map(m=>m.to);
  const last = game.history({verbose:true}).at(-1);
  $('#board').innerHTML = [...ranks].map((rank,ri)=>[...files].map((file,fi)=> {
    const square=file+rank, piece=shown.get(square), dark=(file.charCodeAt(0)+Number(rank))%2===0;
    const check = piece?.type==='k' && piece.color===shown.turn() && shown.isCheck();
    return `<button class="square ${dark?'dark':'light'} ${selected===square?'selected':''} ${!preview && (last?.from===square || last?.to===square)?'last-move':''} ${check?'in-check':''}" data-square="${square}" aria-label="${square}${piece ? ` ${piece.color==='w'?'white':'black'} ${PIECE_NAMES[piece.type]}` : ' empty'}">${fi===0?`<span class="rank-label">${rank}</span>`:''}${ri===7?`<span class="file-label">${file}</span>`:''}${piece?`<span class="piece ${piece.color==='w'?'white':'black'}" aria-hidden="true">${glyphs[piece.type]}</span>`:''}${legal.includes(square)?`<span class="legal-dot ${piece?'capture':''}"></span>`:''}</button>`;
  }).join('')).join('');
  $('#arrow-line').style.display = arrow ? '' : 'none';
  if (arrow) { const a=squarePoint(arrow.from),b=squarePoint(arrow.to); ['x1','y1','x2','y2'].forEach((attr,i)=>$('#arrow-line').setAttribute(attr,[...a,...b][i])); }
  $('#preview-bar').hidden = !preview;
  if (preview) $('#preview-bar').innerHTML = `<span>${esc(preview.label)}${preview.line ? ` · ${preview.step}/${preview.line.length}`:''}</span><div>${preview.line?'<button class="icon-button" id="line-back" aria-label="Previous variation move">←</button><button class="icon-button" id="line-next" aria-label="Next variation move">→</button>':''}<button class="button subtle" id="exit-preview">${current?.finished?'Back to final position':'Back to game'}</button></div>`;
}
function render() {
  if (!state) return;
  const active = current && !current.finished;
  $('#opponent-name').textContent = current ? `Practice partner · ${current.opponent}` : 'Your practice partner';
  $('#opponent-caption').textContent = current ? `${current.color==='w'?'Black':'White'} · target strength` : 'Ready when you are';
  $('#your-color').textContent = current ? `· ${current.color==='w'?'White':'Black'}` : '';
  $('#your-caption').textContent = current?.assess ? 'Assessment · unassisted moves count' : `Teaching level ${playerLevel()}`;
  $('#engine-status').textContent = !engineReady ? 'Loading engine…' : busy ? 'Thinking…' : preview ? 'Exploring' : current?.finished ? 'Review' : awaiting ? 'Your decision' : !current ? 'Ready to play' : game.turn()===current.color ? 'Your turn' : 'Opponent’s turn';
  $('#opening-name').textContent = getOpening()?.name || 'Your practice room';
  $('#book-status').textContent = current ? bookStatus(getOpening(),game.history()) : 'Start a new practice';
  $('#review-game').disabled = !current || busy || current.finished;
  $('#new-game').disabled = !engineReady || busy;
  document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===tab));
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===(tab==='progress'?'progress':'coach')));
  drawBoard();
  if (tab==='coach') renderCoach(active); else if (tab==='moves') renderMoves(); else renderProgress();
}
function renderCoach(active) {
  const f=focus;
  let html=`<div class="coach-header"><div><span class="eyebrow">YOUR CORNER OF THE BOARD</span><h2>Let’s think it through.</h2></div><label class="toggle" title="Toggle live coaching"><input id="coach-toggle" aria-label="Toggle live coaching" type="checkbox" ${coachOn?'checked':''}/><span></span></label></div>`;
  if (!coachOn && active && !awaiting) {
    html+=`<div class="coach-empty"><span class="empty-icon">♘</span><h3>Just you and the board.</h3><p>Play freely. Your moves are saved for the review. Bring the coach back whenever you like.</p></div>`;
  } else if (f && (coachOn || !active)) {
    const grade=f.grade;
    html+=`<div class="feedback-card severity-${grade.severity}"><div class="feedback-top"><span class="move-token">${esc(f.san)}</span><strong>${esc(grade.label)}</strong><span class="feedback-symbol">${grade.severity>=2?'?!':grade.severity===1?'?!':'✓'}</span></div>${f.explanation.facts.map(t=>`<p>${esc(t)}</p>`).join('')}<small>${f.retry?'Retry · assisted attempt':f.assisted?'Coached first attempt':'Unassisted first attempt'}</small></div>`;
    html+=`<div class="section-heading"><h3>Five ways forward</h3><span>Before your ${esc(f.san)}</span></div><div class="candidate-labels"><span>ENGINE CHOICE</span><span>WHITE EVAL.</span></div><div class="candidates">${f.lines.map((line,i)=>{
      const san=sanLine(f.before,line.pv,1)[0], mine=line.pv[0]===f.uci;
      return `<button class="candidate ${mine?'your-move':''}" data-candidate="${i}"><span class="candidate-rank">${i+1}</span><strong>${esc(san)}</strong>${mine?'<span class="mine-label">YOUR MOVE</span>':''}<span class="candidate-eval">${displayScore(line,new Chess(f.before).turn())}</span><span class="candidate-arrow">↗</span></button>`;
    }).join('')}</div><p class="analysis-note">Depth ${f.depth} · Stockfish 19 Lite · evaluations favour White when positive. Close scores can be equally playable.</p><div id="candidate-explanation"></div>`;
    if (awaiting && active && f.after===game.fen()) html+=`<div class="decision-buttons"><button class="button secondary" id="retry">↶ Retry move</button><button class="button primary" id="continue">Continue <span>→</span></button></div>`;
    if (!f.lines.some(l=>l.pv[0]===f.uci)) html+=`<p class="analysis-note">Your move ${esc(f.san)}: ${displayScore(f.actual,new Chess(f.before).turn())}. Analysed separately from the top five.</p>`;
  } else {
    html+=`<div class="coach-empty"><div class="empty-board">♘<span>✦</span></div><h3>${current?'Your move. Your discovery.':'A good habit starts here.'}</h3><p>${current?'Make a move on the board. We’ll compare five possibilities, unpack the idea, and keep what you learn.':'Choose an opening and a worthy opponent. Your coach will help you understand the choices between moves.'}</p>${!current?'<button class="button primary" id="start-first">Start your first practice ↗</button>':''}</div>`;
  }
  const summary=learningSummary(state.games), pattern=summary.patterns.find(p=>p.count>=2);
  if(coachOn || !active) html+=`<div class="habit-card"><span class="habit-icon">✦</span><div><span class="eyebrow">${pattern?'A PATTERN TO NOTICE':'ONE SMALL HABIT'}</span><p>${esc(pattern?.tip || 'Before you move, ask: what is my opponent threatening?')}</p></div></div>`;
  if (current?.finished) html+=`<div class="review-banner"><strong>${esc(current.result || 'Practice saved')}</strong><p>Select a move in the Moves tab to revisit its position and coaching.</p><button class="button secondary" id="review-moves">Explore game moves →</button></div>`;
  $('#panel-content').innerHTML=html;
}
function renderMoves() {
  if (!current) { $('#panel-content').innerHTML='<div class="coach-empty"><h3>Your story starts on move one.</h3><p>Start a practice to build your move history.</p></div>'; return; }
  const history=historyGame().history({verbose:true});
  let html=`<div class="panel-intro"><span class="eyebrow">${current.finished?'POST-GAME REVIEW':'YOUR GAME SO FAR'}</span><h2>Every move has a story.</h2><p>Select a move to revisit the position.${!current.finished?' Return to the game before playing.':''}</p></div><div class="move-table"><div class="move-table-head"><span>#</span><span>WHITE</span><span>BLACK</span></div>`;
  for(let i=0;i<history.length;i+=2) html+=`<div class="move-row"><span>${i/2+1}</span>${[i,i+1].map(j=>{const m=history[j]; if(!m)return '<span></span>'; const a=[...(current.attempts||[])].reverse().find(a=>a.ply===j && a.uci===m.lan); return `<button data-history="${j}" class="${a?.grade.severity>=2?'bad-move':''}">${esc(m.san)} <small>${a?.grade.severity>=2?'?':a?.grade.label==='Best move'?'✓':''}</small></button>`;}).join('')}</div>`;
  html+='</div>';
  if (!history.length) html+='<p class="muted panel-intro">Make your first move to begin.</p>';
  if (current.finished) {
    const attempts=current.attempts.filter(a=>!a.retry), mistakes=attempts.filter(a=>a.grade.severity>=1);
    html+=`<div class="review-banner"><strong>${attempts.length} decisions · ${mistakes.length} moments to revisit</strong><p>${mistakes.length?'Start with the marked moves. Their coaching explains the engine alternatives.':'Explore your moves and compare their candidate lines.'}</p></div>`;
  }
  $('#panel-content').innerHTML=html;
}
function renderProgress() {
  const s=learningSummary(state.games);
  $('#panel-content').innerHTML=`<div class="panel-intro"><span class="eyebrow">SMALL STEPS, STRONGER CHESS</span><h2>Your game is growing.</h2><p>Evidence from your own moves. Saved only in this browser.</p></div><div class="stats-grid"><div><strong>${state.games.length}</strong><span>practice sessions</span></div><div><strong>${s.originals}</strong><span>first decisions</span></div><div><strong>${s.unassisted}</strong><span>unassisted moves</span></div><div><strong>${s.originals?Math.round(s.good/s.originals*100)+'%':'—'}</strong><span>good / best moves</span></div></div><div class="progress-section"><h3>Patterns worth practising</h3>${s.patterns.length?s.patterns.map(p=>`<div class="pattern"><div><strong>${esc(p.title)}</strong><span>${p.count} ${p.count===1?'example':'examples'}${p.count<3?' · early signal':''}</span></div><p>${esc(p.tip)}</p></div>`).join(''):'<p class="muted">Play a few games. We’ll collect supported patterns from your moves, without judging you on a single mistake.</p>'}<p class="analysis-note">Counts describe detected mistakes, not a complete measure of your skill. Retry attempts are excluded.</p></div><div class="assessment-card"><strong>Level assessment</strong><p>${s.ready?`Suggested practice difficulty: around ${s.suggested}. This is a provisional training setting based on recent unassisted engine losses, not a calibrated chess rating.`:`${s.unassisted}/20 unassisted moves collected. Turn coaching off to build an initial practice-level estimate.`}</p></div><div class="progress-section"><h3>Practice journal</h3>${state.games.slice().reverse().slice(0,20).map(g=>`<button class="journal-entry" data-game="${esc(g.id)}"><span><strong>${esc(OPENINGS.find(o=>o.id===g.opening)?.name || 'Practice')}</strong><small>${new Date(g.created).toLocaleDateString(undefined,{day:'numeric',month:'short'})} · ${g.color==='w'?'White':'Black'} · ${g.moves.length} plies</small></span><span>${g.finished?'Review ↗':'Resume ↗'}</span></button>`).join('') || '<p class="muted">Your first practice will appear here.</p>'}</div>`;
}
function setup() {
  const form=$('#setup-form'), settings=state.settings;
  form.elements.level.value=String(settings.level);
  form.elements.opponent.value=settings.opponent;
  form.elements.assess.checked=!!settings.assess;
  form.elements.color.value=settings.color;
  form.elements.opening.value=settings.opening;
  $('#setup').showModal();
}
async function startGame(event) {
  event.preventDefault();
  if(busy || !engineReady) return;
  const values=new FormData(event.target), opening=chooseOpening(values.get('opening'));
  state.settings={level:Number(values.get('level')),opponent:Number(values.get('opponent')),color:values.get('color'),opening:values.get('opening'),assess:values.has('assess')};
  if(current && !current.finished) { current.finished=true; current.result='Practice paused for a new game'; }
  const learning=learningSummary(state.games), assess=values.has('assess');
  current={id:crypto.randomUUID(),created:new Date().toISOString(),color:values.get('color'),opening:opening.id,level:assess?(learning.ready?learning.suggested:1200):Number(values.get('level')),opponent:assess?(learning.ready?learning.suggested:1200):Number(values.get('opponent')),assess,moves:[],attempts:[],finished:false,coach:values.has('coach')};
  state.games.push(current); state.active=current.id; game=new Chess(); coachOn=current.coach; flipped=current.color==='b';
  generation++; awaiting=false; retrying=false; focus=null; preview=null; arrow=null; selected=null; tab='coach';
  $('#setup').close(); await persist(); render();
  if(current.color==='b') opponentTurn();
}
async function makeMove(from,to,promotion='q',recovered=null) {
  if(busy || awaiting || preview || !current || current.finished || game.turn()!==current.color) return;
  const legal=game.moves({square:from,verbose:true}).filter(m=>m.to===to);
  if(!legal.length) { selected=null; drawBoard(); return; }
  if(legal.some(m=>m.promotion) && arguments.length<3) { choosePromotion(from,to); return; }
  const token=generation, before=game.fen(), book=bookOptions(getOpening(),game.history()), ply=game.history().length;
  const wasRetry=recovered?.retry ?? retrying, wasAssisted=recovered?.assisted ?? (coachOn || retrying);
  const move=game.move({from,to,promotion}); current.moves.push(move.lan);
  current.pending={before,uci:move.lan,retry:wasRetry,assisted:wasAssisted};
  selected=null; preview=null; arrow=null; busy=true; render(); await persist();
  try {
    const search=await engine.search(before,{count:Math.min(5,new Chess(before).moves().length),ms:1000});
    if(token!==generation) return;
    if(!search.lines.length) throw Error('No engine analysis was returned.');
    let actual=search.lines.find(l=>l.pv[0]===move.lan);
    if(!actual) actual=(await engine.search(before,{count:1,only:move.lan,ms:800})).lines[0];
    if(token!==generation) return;
    if(!actual) throw Error('Could not evaluate your move.');
    const grade=gradeMove(search.lines[0],actual,move.lan===search.lines[0].pv[0]);
    const explanation=explainMove(before,move,search.lines[0],actual,grade,playerLevel(),book);
    focus={before,after:game.fen(),uci:move.lan,san:move.san,ply,lines:search.lines,actual,grade,explanation,depth:search.depth,retry:wasRetry,assisted:wasAssisted};
    current.attempts.push(focus); current.pending=null; retrying=false; current.retrying=false; busy=false; awaiting=coachOn;
    if(game.isGameOver() && !coachOn) finishGame(terminalResult());
    await persist(); render();
    if(!coachOn && !current.finished) opponentTurn();
  } catch(error) {
    busy=false; awaiting=true;
    // Keep the played position recoverable; offer retry/continue even when analysis fails.
    focus={before,after:game.fen(),uci:move.lan,san:move.san,ply,lines:[],actual:null,grade:{label:'Unrated',severity:0,loss:0},explanation:{facts:['Analysis was interrupted. Retry this move or continue the game.'],tags:[]},depth:0,retry:wasRetry,assisted:wasAssisted};
    current.attempts.push(focus); current.pending=null; await persist(); render(); toast(error.message);
  }
}
function choosePromotion(from,to) {
  const dialog=$('#promotion'); $('.promotion-options').innerHTML=['q','r','b','n'].map(p=>`<button class="promotion-choice" data-promotion="${p}" aria-label="Promote to ${PIECE_NAMES[p]}">${glyphs[p]}</button>`).join('');
  dialog.oncancel=()=>{selected=null;drawBoard();};
  $('.promotion-options').onclick=e=>{ const p=e.target.closest('[data-promotion]')?.dataset.promotion; if(p){dialog.close();makeMove(from,to,p);} }; dialog.showModal();
}
async function opponentTurn() {
  if(!current || current.finished || game.turn()===current.color || busy) return;
  const token=generation; busy=true; awaiting=false; preview=null; arrow=null; render();
  try {
    const options=bookOptions(getOpening(),game.history()); let move;
    if(options.length) move=game.move(options[Math.floor(Math.random()*options.length)]);
    else { const result=await engine.search(game.fen(),{count:1,ms:600,elo:current.opponent}); if(token!==generation)return; if(!result.bestmove || result.bestmove==='(none)')throw Error('No legal opponent move was returned.'); move=game.move(uciMove(result.bestmove)); }
    current.moves.push(move.lan); busy=false;
    if(game.isGameOver()) finishGame(game.isCheckmate()?'Checkmate · your opponent wins':'Draw');
    current.awaiting=false; await persist(); render();
  } catch(error) { busy=false; render(); toast(`${error.message} Use Resume opponent to try again.`); $('#panel-content').insertAdjacentHTML('beforeend','<button class="button primary" id="resume-opponent">Resume opponent</button>'); }
}
function terminalResult() { return game.isCheckmate() ? (game.turn()===current.color?'Checkmate · your opponent wins':'Checkmate · you win') : 'Draw'; }
function finishGame(result=game.isGameOver()?terminalResult():'Practice ended · saved for review') {
  current.finished=true; current.result=result; awaiting=false; retrying=false; busy=false;
  if(current.assess) { const s=learningSummary(state.games); if(s.ready) { state.settings.level=s.suggested; state.settings.opponent=s.suggested; } }
}
function retryMove() {
  const latest=current?.attempts.at(-1);
  if(!awaiting || !latest || latest.after!==game.fen() || busy) return;
  game.undo(); current.moves.pop(); awaiting=false; retrying=true; current.retrying=true; preview=null; arrow=null; selected=null; current.awaiting=false;
  persist(); render(); toast('Try another move. This attempt is marked as assisted.');
}
function continueGame() { if(busy || !current || current.finished)return; awaiting=false; preview=null; arrow=null; if(game.isGameOver())finishGame(); persist(); render(); if(!current.finished)opponentTurn(); }
function showCandidate(index) {
  const line=focus?.lines[index]; if(!line)return;
  preview={fen:focus.before,label:`${sanLine(focus.before,line.pv,1)[0]} · engine variation`,base:focus.before,line:line.pv,step:0};
  arrow=uciMove(line.pv[0]); selected=null; drawBoard();
  $('#candidate-explanation').innerHTML=`<div class="variation-card"><strong>${esc(explainCandidate(focus.before,line,playerLevel()))}</strong><p>${esc(sanLine(focus.before,line.pv,10).join('  '))}</p><small>Use the arrows below the board to follow this line.</small></div>`;
}
function stepPreview(delta) {
  if(!preview?.line)return; preview.step=Math.max(0,Math.min(preview.line.length,preview.step+delta));
  const g=new Chess(preview.base); for(const move of preview.line.slice(0,preview.step))g.move(uciMove(move));
  preview.fen=g.fen(); const next=preview.line[preview.step]; arrow=next?uciMove(next):null; drawBoard();
}
function viewHistory(index) {
  if(busy) return;
  const h=historyGame().history({verbose:true}), move=h[index]; if(!move)return;
  preview={fen:move.after,label:`After ${Math.floor(index/2)+1}${index%2?'…':'.'} ${move.san}`}; arrow=null; selected=null;
  const attempt=[...current.attempts].reverse().find(a=>a.ply===index && a.uci===move.lan);
  if(attempt){ focus=attempt; tab='coach'; } render();
}
function download(name,data,type='application/json') { const url=URL.createObjectURL(new Blob([data],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportBackup() { download(`between-moves-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2)); toast('Backup exported. Keep it to restore your history or move devices.'); }
function exportPgn() {
  if(!current){toast('Play a game first.');return;} const g=historyGame(); g.setHeader('Event','Between Moves practice','White',current.color==='w'?'You':`Engine target ${current.opponent}`,'Black',current.color==='b'?'You':`Engine target ${current.opponent}`,'Opening',getOpening().name,'Result',game.isCheckmate()?(game.turn()==='w'?'0-1':'1-0'):game.isDraw()?'1/2-1/2':'*');
  download('between-moves.pgn',g.pgn(),'application/x-chess-pgn');
}
async function importBackup(file) {
  if(!file)return;
  if(file.size>30*1024*1024)throw Error('Please import a backup smaller than 30 MB.');
  const incoming=validateBackup(JSON.parse(await file.text()));
  // Validate legal game histories before merging. Existing records always win on duplicate IDs.
  for(const record of incoming.games) { historyGame(record); for(const attempt of record.attempts) { new Chess(attempt.before); if(!Array.isArray(attempt.lines)||!Array.isArray(attempt.explanation?.facts)||!Array.isArray(attempt.explanation?.tags)||typeof attempt.grade?.severity!=='number')throw Error('A coaching record in this backup is invalid.'); } }
  const wasEmpty=state.games.length===0;
  const ids=new Set(state.games.map(g=>g.id)); let count=0;
  incoming.games.forEach(g=>{if(!ids.has(g.id)){state.games.push(g);ids.add(g.id);count++;}});
  if(wasEmpty){
    const s=incoming.settings;
    state.settings={level:Number(s.level)||1350,opponent:Number(s.opponent)||1350,color:s.color==='b'?'b':'w',opening:OPENINGS.some(o=>o.id===s.opening)?s.opening:'random',assess:!!s.assess};
    state.active=state.games.some(g=>g.id===incoming.active)?incoming.active:state.games.at(-1)?.id;
    if(state.active)openRecord(state.active);
  }
  await persist();render();toast(`Imported ${count} practice sessions. Your existing history was kept.`);
}
function openRecord(id) {
  if(busy)return; const record=state.games.find(g=>g.id===id);if(!record)return;
  current=record;game=historyGame();state.active=id;coachOn=current.coach ?? true;flipped=current.color==='b';focus=current.attempts.at(-1)||null;
  awaiting=!current.finished && game.turn()!==current.color && !!focus && focus.after===game.fen() && coachOn;
  preview=null;arrow=null;selected=null;retrying=!!current.retrying;tab=current.finished?'moves':'coach';generation++;persist();render();
  resumeSession();
}
function resumeSession() {
  if(!engineReady || !current || current.finished || busy)return;
  if(current.pending && current.moves.at(-1)===current.pending.uci){
    const pending=current.pending; game.undo();current.moves.pop();awaiting=false;
    const move=uciMove(pending.uci);makeMove(move.from,move.to,move.promotion||'q',pending);return;
  }
  if(game.turn()!==current.color && !awaiting)opponentTurn();
}

$('#setup-form').addEventListener('submit',startGame);
$('#board').addEventListener('click',e=>{
  const square=e.target.closest('[data-square]')?.dataset.square;
  if(!square || busy || awaiting || preview || !current || current.finished || game.turn()!==current.color)return;
  if(selected && game.moves({square:selected,verbose:true}).some(m=>m.to===square)){makeMove(selected,square);return;}
  selected=game.get(square)?.color===current.color ? (selected===square?null:square) : null;drawBoard();
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.close){$('#'+b.dataset.close).close();return;}
  if(b.dataset.tab){tab=b.dataset.tab;render();return;} if(b.dataset.panel){tab=b.dataset.panel;render();return;}
  if(b.dataset.candidate!=null){showCandidate(Number(b.dataset.candidate));return;}
  if(b.dataset.history!=null){viewHistory(Number(b.dataset.history));return;} if(b.dataset.game){openRecord(b.dataset.game);return;}
  const actions={ 'new-game':setup,'start-first':setup,flip:()=>{flipped=!flipped;drawBoard();},retry:retryMove,continue:continueGame,'resume-opponent':opponentTurn,
    'exit-preview':()=>{preview=null;arrow=null;if(awaiting)focus=current.attempts.at(-1);render();},'line-back':()=>stepPreview(-1),'line-next':()=>stepPreview(1),backup:exportBackup,restore:()=>$('#backup-file').click(),pgn:exportPgn,
    'review-moves':()=>{tab='moves';render();},'review-game':()=>{if(!current||busy)return;finishGame();tab='moves';persist();render();},about:()=>{
      $('#info-body').innerHTML='<h2>A practice room of your own.</h2><p>Between Moves runs chess analysis on your device using Stockfish 19 Lite. Coaching uses programmed rules and verified engine continuations, with no AI API.</p><p>Games, retries, and learning history are stored in this browser using IndexedDB. No accounts, analytics, or game uploads. Your host still handles ordinary website requests.</p><p>Clearing browser data can erase history. Export backups regularly, and before switching domains, browsers, or devices. Import merges sessions without replacing existing records.</p><p>Opponent ratings are approximate targets. Level assessment is an experimental practice-difficulty estimate, not a calibrated platform rating. Positional explanations and book variations have limited coverage in this first version.</p><p>Stockfish.js is distributed under GPLv3. <a href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1" target="_blank" rel="noreferrer">Engine source</a> · <a href="./engine/COPYING.txt" target="_blank">Engine licence</a>. Chess rules by chess.js (BSD-2-Clause).</p>';
      $('#info').showModal();
    }
  }; actions[b.id]?.();
});
document.addEventListener('change',e=>{
  if(e.target.id==='coach-toggle'){
    coachOn=e.target.checked;if(current)current.coach=coachOn;
    if(coachOn && !busy && current && !current.finished && game.turn()!==current.color)awaiting=true;
    if(!coachOn && awaiting && !busy){continueGame();return;} persist();render();
  }
});
$('#backup-file').addEventListener('change',e=>{if(busy){toast('Wait for the current move to finish before importing.');return;}importBackup(e.target.files[0]).catch(handleError).finally(()=>e.target.value='');});
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||$('dialog[open]'))return;if(preview?.line && ['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();stepPreview(e.key==='ArrowLeft'?-1:1);} if(e.key==='Escape'&&preview){preview=null;arrow=null;render();}});
try {
  db=await openStore();state=await readState(db);
  const active=state.games.find(g=>g.id===state.active);
  if(active){current=active;game=historyGame();coachOn=current.coach??true;flipped=current.color==='b';focus=current.attempts.at(-1)||null;retrying=!!current.retrying;awaiting=!current.finished && game.turn()!==current.color && coachOn && focus?.after===game.fen();}
  render();resumeSession();
  if(!state.games.length)setup();
} catch(error) {
  state={version:1,games:[],settings:{level:1350,opponent:1350,color:'w',opening:'random'}};render();toast('Browser storage is unavailable. You can play, but export backups to keep your history.');
}
