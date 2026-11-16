import { Chess } from 'chess.js';
import { Engine } from './engine.js';
import { OPENINGS, chooseOpening, bookOptions, bookStatus, identifyOpening, openingAt, openingForMove } from './openings.js';
import { PIECE_NAMES, uciMove, displayScore, gradeMove, explainMove, explainCandidate, sanLine, learningSummary } from './coach.js';
import { openStore, readState, writeState, validateBackup } from './storage.js';
import { positionAt, forkSession, opponentMoveAt, replaceOpponentLine } from './timeline.js';
import { positionEvaluation, LatestPositionAnalysis } from './evaluation.js';
import { explainOpponentMove } from './opponent-coach.js';
import './style.css';
import './interaction.css';
import './readability.css';
import './whatif.css';
import './mobile-coach.css';
import './mobile-page.css';
import './mobile-preview.css';
import './mobile-quick.css';
import { moveBadge, playableChoices, pieceQualityTarget } from './quick-coach.js';
import { moveCaption } from './move-caption.js';
import { previewHighlights } from './coach-highlights.js';
import { coachSuggestion, usedCoachHelp, previewSuggestion, previewLesson } from './ask-coach.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glyphs = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
let db, state, game = new Chess(), current, selected = null, busy = true, engineReady = false;
let coachOn = true, awaiting = false, retrying = false, focus = null, preview = null, arrow = null;
let tab = 'coach', generation = 0, flipped = false, toastTimer, saveQueue = Promise.resolve();
let dragState=null, suppressClickUntil=0;
let mobileDestination='board';
let renderedPanelKey=null;
let mobileGradeOpen=false, mobileGradeKey=null;
let coachHelp=null, mobileCoachView='coach', mobilePreviewExpanded=false;
const engine = new Engine(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`);
let meterEngine=null;
const positionAnalysis=new LatestPositionAnalysis(async fen=>{
  meterEngine ||= new Engine(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`,{hash:16});
  const result=await meterEngine.search(fen,{count:1,ms:650});
  return {line:result.lines[0],depth:result.depth};
},()=>paintEvaluation());
engine.ready.then(() => { engineReady = true; busy = false; render(); resumeSession(); }).catch(handleError);

$('#app').innerHTML = `
  <header class="masthead"><a class="brand" href="./" aria-label="Between Moves home"><span class="brand-mark">♞</span><span>between<span class="brand-light">moves</span><small>YOUR PERSONAL CHESS ROOM</small></span></a>
    <nav><button class="nav-link active" data-tab="coach">Practice</button><button class="nav-link" data-tab="progress">My progress <span class="tiny-dot"></span></button></nav>
    <button class="button primary" id="new-game"><span>＋</span> New practice</button></header>
  <main><div class="page-heading"><div><div class="eyebrow">A LITTLE BETTER, EVERY MOVE</div><h1>Make your next move count.</h1><p>A worthy opponent. A thoughtful coach. Your own pace.</p></div><span class="local-badge"><span></span> Saved on this device</span></div>
    <div class="workspace"><section class="play-area" aria-label="Chess game">
      <div class="player-bar"><div class="avatar opponent-avatar">♞</div><div><strong id="opponent-name">Your practice partner</strong><small id="opponent-caption">Getting the board ready</small></div><span id="engine-status" class="status-pill">Loading engine…</span><button id="mobile-best-move" class="board-best-button" aria-label="Show best move and playable alternatives" title="Best move"><span aria-hidden="true">✦</span></button></div>
      <div id="opponent-edit-bar" class="opponent-edit-bar" role="status" hidden></div>
      <div class="board-shell"><div class="board" id="board" role="group" aria-label="Chessboard"></div><svg id="arrows" class="arrows" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4" fill="#d78d2a"/></marker></defs><g id="coach-board-lines"></g><line id="arrow-line" stroke="#d78d2a" stroke-opacity=".86" stroke-width="12" stroke-linecap="round" marker-end="url(#arrowhead)" /></svg><div id="board-quality-overlay" class="board-quality-overlay"></div></div>
      <section class="mobile-glance" id="mobile-glance" aria-label="Quick coaching"><div class="mobile-glance-row"><button id="mobile-move-grade" class="mobile-grade-button" aria-expanded="false" aria-controls="mobile-grade-explanation"></button></div><div id="mobile-grade-explanation" hidden></div><div id="mobile-quick-coach" aria-live="polite" hidden></div></section>
      <section id="mobile-preview-coach" class="mobile-preview-coach" aria-label="Current preview explanation" aria-live="polite" aria-atomic="true" hidden></section>
      <section id="evaluation-panel" class="evaluation-panel" aria-label="Position evaluation" hidden><div class="evaluation-scale"><span>White</span><div id="evaluation-track" class="evaluation-track" role="img" aria-label="Analysing position"><span id="white-advantage"></span></div><span>Black</span></div><div class="evaluation-caption"><strong id="evaluation-score">—</strong><span id="evaluation-headline">Analysing position…</span><button class="button subtle" id="explain-evaluation">Why?</button></div></section>
      <div class="mobile-position" id="mobile-move-names" aria-live="polite">Starting position</div>
      <div class="player-bar bottom-player"><div class="avatar you-avatar">♙</div><div><strong>You <span id="your-color"></span></strong><small id="your-caption">Your practice, your pace</small></div><button class="icon-button" id="flip" aria-label="Flip board" title="Flip board">⇅</button><button class="button subtle" id="review-game">Review game</button></div>
      <div class="timeline" aria-label="Game navigation"><div class="timeline-buttons"><button class="icon-button" id="history-start" aria-label="Go to start" title="Go to start">⇤</button><button class="icon-button" id="history-back" aria-label="Previous move" title="Previous move (left arrow)">←</button><button class="icon-button" id="history-next" aria-label="Next move" title="Next move (right arrow)">→</button><button class="icon-button" id="history-live" aria-label="Go to latest position" title="Go to latest position">⇥</button></div><span id="history-position">Starting position</span><button class="icon-button mobile-tools-button" id="mobile-more" aria-label="Game tools">Tools</button><button class="button subtle" id="reset-board" title="Restart this practice with the same settings">Reset board</button><button class="button subtle" id="change-opponent">Change opponent move</button><button class="button subtle" id="play-from-here" hidden>Play from here ↗</button></div>
      <div class="mobile-reply-actions"><button class="button secondary" id="mobile-change-opponent">Try another reply</button><span id="mobile-reply-label"></span></div>
      <div id="preview-bar" class="preview-bar" hidden></div>
      <div class="board-note"><span id="opening-name">Opening practice</span><span id="book-status">Choose your opening</span></div>
    </section>
    <aside class="side-panel"><div class="panel-tabs"><button class="active" data-panel="coach">Coach</button><button class="mobile-top-five" data-show-five="true">Top 5</button><button data-panel="moves">Moves</button><button data-panel="progress"><span class="desktop-progress-label">My progress</span><span class="mobile-progress-label">Progress</span></button></div><div id="panel-content"></div></aside></div>
    <footer><span>Think first. Understand next. Keep growing.</span><button id="backup">Export backup</button><button id="restore">Import backup</button><button id="pgn">Export PGN</button><button id="about">About & privacy</button></footer>
  </main>
  <nav class="mobile-dock" aria-label="Practice actions"><button class="mobile-ask" id="mobile-ask-coach" aria-label="Show best move" title="Best move"><span aria-hidden="true">✦</span></button><button id="mobile-back-board">↑ Back to board</button></nav>
  <dialog id="mobile-tools"><div class="dialog-top"><h2>Game tools</h2><button class="icon-button" data-close="mobile-tools" aria-label="Close game tools">×</button></div><div class="tools-grid"><button class="button secondary" data-tool="reset-board">Reset board</button><button class="button secondary" data-tool="change-opponent">Change opponent move</button><button class="button secondary" data-tool="play-from-here">Play from here</button><button class="button secondary" data-tool="flip">Flip board</button><button class="button secondary" data-tool="review-game">End game & review</button><button class="button secondary" data-tool="backup">Export backup</button><button class="button secondary" data-tool="restore">Import backup</button><button class="button secondary" data-tool="pgn">Export PGN</button><button class="button secondary" data-tool="about">About & privacy</button></div><p id="mobile-opening"></p></dialog>
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
function shownGame() { return preview?.historyPly!=null?positionAt(current,preview.historyPly):preview?new Chess(preview.fen):game; }
function moveColor() { return preview?.opponentEdit?shownGame().turn():current?.color; }
function opponentTarget() { return !current || preview?.line || preview?.opponentEdit?null:opponentMoveAt(current,preview?.historyPly ?? current.moves.length); }
function evaluationVisible() { return !!current && (coachOn || current.finished); }
function opponentIdeaMarkup() {
  if(!current || (!coachOn&&!current.finished) || preview?.line || preview?.opponentEdit)return '';
  const history=historyGame().history({verbose:true}),cutoff=preview?.historyPly ?? history.length;
  let index=cutoff-1,next=false;
  if(history[index]?.color===current.color && preview?.historyPly!=null && history[cutoff]?.color!==current.color && history[cutoff]){index=cutoff;next=true;}
  const move=history[index];if(!move || move.color===current.color)return '';
  const cached=positionAnalysis.cache.get(move.after)?.analysis;
  const idea=explainOpponentMove({before:move.before,uci:move.lan,previousMove:history[index-1],analysis:cached?{...cached,fen:move.after}:null,level:playerLevel()});
  if(!idea)return '';
  return `<div class="opponent-idea"><span class="opponent-idea-label">${next?`NEXT ${idea.side.toUpperCase()} REPLY`:`${idea.side.toUpperCase()}’S IDEA`} · ${esc(idea.san)}</span><p>${esc(idea.reason)}</p><p><strong>Possible plan:</strong> ${esc(idea.plan)}</p>${idea.watch?`<p class="opponent-idea-watch"><strong>Watch:</strong> ${esc(idea.watch)}</p>`:''}</div>`;
}
function paintOpponentIdea() { const slot=$('#opponent-idea-slot');if(slot)slot.innerHTML=opponentIdeaMarkup(); }
function evaluationState() {
  const shown=shownGame(),state=positionAnalysis.state?.fen===shown.fen()?positionAnalysis.state:null;
  return {shown,state,model:positionEvaluation(shown,state?.analysis)};
}
function paintEvaluation() {
  if(!state || !evaluationVisible())return;
  const {state:analysis,model}=evaluationState();
  if(analysis?.error && !model.terminal)model.headline='Evaluation unavailable';
  $('#evaluation-score').textContent=model.score;
  $('#evaluation-headline').textContent=model.headline;
  $('#white-advantage').style.width=`${model.whiteShare}%`;
  $('#evaluation-track').classList.toggle('is-pending',!model.terminal && !analysis?.analysis);
  $('#evaluation-track').setAttribute('aria-label',`${model.headline}. ${model.score==='—'?'':`Evaluation ${model.score} from White’s perspective.`}`);
  $('#explain-evaluation').disabled=busy || (!model.terminal && (!analysis || analysis.loading));
  paintOpponentIdea();
}
function syncEvaluation() {
  const visible=evaluationVisible();$('#evaluation-panel').hidden=!visible;
  if(!visible){positionAnalysis.pause();return;}
  const shown=shownGame();
  if(shown.isGameOver())positionAnalysis.pause();
  else if(engineReady)positionAnalysis.request(shown.fen());
  paintEvaluation();
}
function explainEvaluation() {
  const {shown,state:analysis,model}=evaluationState();
  if(!model.terminal && analysis?.error){
    $('#info-body').innerHTML=`<div class="eval-explanation"><h2>Evaluation unavailable</h2><p>The position has not been scored. You can keep playing or try the analysis again.</p><button id="retry-evaluation" class="button primary">Retry evaluation</button></div>`;
  }else{
    $('#info-body').innerHTML=`<div class="eval-explanation"><span class="eyebrow">THE POSITION ON YOUR BOARD</span><h2>${esc(model.headline)}</h2><p class="eval-large-score">${esc(model.score)}</p>${model.facts.map(f=>`<p>${esc(f)}</p>`).join('')}${model.line.length?`<h3>Engine continuation</h3><p class="eval-line">${esc(model.line.join('  '))}</p>`:''}<p class="analysis-note">${model.terminal?'Game result.':`Stockfish 19 Lite · depth ${model.depth || '—'}. Positive scores favour White; negative scores favour Black. A score of +1.00 is roughly a pawn’s worth of overall advantage, which can come from position or tactics as well as material. The bar is a visual scale of advantage, not a win probability. Rankings can change with deeper analysis.`}</p></div>`;
  }
  $('#info').showModal();
}
function getOpening() { return OPENINGS.find(o=>o.id === current?.opening); }
function playerLevel() { return current?.level || state?.settings.level || 1350; }
function squarePoint(square) {
  let x = square.charCodeAt(0)-97, y = 8-Number(square[1]);
  if (flipped) { x=7-x; y=7-y; } return [x*100+50,y*100+50];
}
function updateMobileDock() {
  document.querySelectorAll('[data-jump]').forEach(b=>{b.classList.toggle('active',b.dataset.jump===mobileDestination);if(b.dataset.jump===mobileDestination)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
}
function scrollToSection(destination) {
  mobileDestination=destination;updateMobileDock();
  const target=destination==='board'?$('.play-area'):destination==='coach' && preview?.details?$('.variation-card')||$('.side-panel'):$('.side-panel');
  target.scrollIntoView({behavior:(matchMedia('(max-width:900px)').matches && !!preview?.line)||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function variationExplanation() {
  const details=preview?.details;
  return details?`<div class="variation-card"><strong>${esc(details.text)}</strong><p>${esc(details.moves)}</p><small>${esc(details.note)}</small></div>`:'';
}
function drawBoard() {
  const shown = preview ? new Chess(preview.fen) : game;
  const highlights=preview?.coach?previewHighlights(coachHelp?.suggestion,preview.step,playerLevel()):{marks:[],lines:[]};
  const marked=new Map(highlights.marks.map(m=>[m.square,m]));
  const files = flipped ? 'hgfedcba' : 'abcdefgh', ranks = flipped ? '12345678' : '87654321';
  const draggable=canMoveOnBoard(),dragColor=moveColor();
  let legal = []; if (selected && !preview?.line) legal = shown.moves({ square:selected,verbose:true }).map(m=>m.to);
  const last = preview?.coach ? previewSuggestion(coachHelp?.suggestion,preview.step)?.last : preview?.historyPly!=null ? positionAt(current,preview.historyPly).history({verbose:true}).at(-1) : !preview ? game.history({verbose:true}).at(-1) : null;
  $('#board').innerHTML = [...ranks].map((rank,ri)=>[...files].map((file,fi)=> {
    const square=file+rank, piece=shown.get(square), dark=(file.charCodeAt(0)+Number(rank))%2===0;
    const annotation=marked.get(square);
    const check = piece?.type==='k' && piece.color===shown.turn() && shown.isCheck();
    return `<button class="square ${draggable&&piece?.color===dragColor?'can-drag':''} ${dark?'dark':'light'} ${selected===square?'selected':''} ${last?.from===square || last?.to===square?'last-move':''} ${check?'in-check':''} ${dragState?.active && dragState.from===square?'drag-source':''}" data-square="${square}" aria-label="${square}${piece ? ` ${piece.color==='w'?'white':'black'} ${PIECE_NAMES[piece.type]}` : ' empty'}${annotation?' · '+esc(annotation.label):''}">${annotation?`<span class="coach-square-mark coach-mark-${annotation.role}" aria-hidden="true">${['pin','threat'].includes(annotation.role)?`<span>${annotation.role==='pin'?'P':'!'}</span>`:''}</span>`:''}${fi===0?`<span class="rank-label">${rank}</span>`:''}${ri===7?`<span class="file-label">${file}</span>`:''}${piece?`<span class="piece ${piece.color==='w'?'white':'black'}" aria-hidden="true">${glyphs[piece.type]}</span>`:''}${legal.includes(square)?`<span class="legal-dot ${piece?'capture':''}"></span>`:''}</button>`;
  }).join('')).join('');
  $('#coach-board-lines').innerHTML=highlights.lines.map(line=>{const a=squarePoint(line.from),b=squarePoint(line.to);return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="coach-board-line coach-line-${line.role} ${line.conditional?'coach-line-conditional':''}"><title>${esc(line.label)}</title></line>`;}).join('');
  $('#arrow-line').style.display = arrow && !highlights.lines.some(l=>l.from===arrow.from&&l.to===arrow.to) ? '' : 'none';
  if (arrow) { const a=squarePoint(arrow.from),b=squarePoint(arrow.to); ['x1','y1','x2','y2'].forEach((attr,i)=>$('#arrow-line').setAttribute(attr,[...a,...b][i])); }
  paintMobilePreview();
  paintQuickCoach();
  $('#preview-bar').hidden = !preview;
  $('#preview-bar').classList.toggle('coach-line',!!preview?.coach);
  if (preview) $('#preview-bar').innerHTML = `<span>${esc(preview.label)}${preview.line ? ` · ${preview.step}/${preview.line.length}`:''}</span><div>${preview.line?`<button class="icon-button" id="line-back" ${preview.step===0?'disabled':''} aria-label="Previous variation move">←</button><button class="icon-button" id="line-next" ${preview.step>=preview.line.length?'disabled':''} aria-label="Next variation move">→</button>`:''}<button class="button subtle" id="exit-preview">${preview.coach?'Back to my position':current?.finished?'Back to final position':'Back to game'}</button></div>`;
  const ply=preview?.historyPly ?? current?.moves.length ?? 0, total=current?.moves.length || 0;
  $('#mobile-move-names').textContent=moveCaption(current,preview);
  $('#history-position').textContent=ply===0?'Starting position':`${Math.ceil(ply/2)}${ply%2?'. White':'… Black'} · ${ply} / ${total}`;
  for(const id of ['history-start','history-back'])$('#'+id).disabled=busy || !current || ply===0;
  for(const id of ['history-next','history-live'])$('#'+id).disabled=busy || !current || ply>=total;
  $('#history-live').disabled=busy || !current || !preview;
  $('#play-from-here').hidden=preview?.historyPly==null;
  if(preview?.opponentEdit)$('#play-from-here').hidden=true;
  $('#play-from-here').disabled=busy || shown.isGameOver();
  const target=opponentTarget();
  $('#change-opponent').disabled=busy || !engineReady || !target;
  $('#mobile-change-opponent').disabled=$('#change-opponent').disabled;
  $('.mobile-reply-actions').hidden=!!preview?.opponentEdit;
  $('#mobile-reply-label').textContent=target?`Replace ${Math.floor(target.ply/2)+1}${target.color==='w'?'.':'…'} ${target.san}`:preview?.line?'Return to your position to change a reply.':'Available after your opponent moves.';
  $('#change-opponent').title=target?`Try an alternative to ${Math.floor(target.ply/2)+1}${target.color==='w'?'.':'…'} ${target.san}`:'Select an opponent move in Moves, or wait for the opponent to play.';
  $('#opponent-edit-bar').hidden=!preview?.opponentEdit;
  if(preview?.opponentEdit)$('#opponent-edit-bar').innerHTML=`<div><strong>What if ${shown.turn()==='w'?'White':'Black'} played something else?</strong><p>Drag an opponent piece to replace <b>${esc(preview.opponentEdit.san)}</b>. Your original game stays saved.</p></div><button class="button subtle" id="cancel-opponent-edit">Cancel</button>`;
  syncEvaluation();
}
function latestOwnAttempt() {
  if(!current)return null;
  const parity=current.color==='w'?0:1;
  let ply=current.moves.length-1;
  if(ply%2!==parity)ply--;
  if(ply<0)return null;
  return [...current.attempts].reverse().find(a=>a.ply===ply&&a.uci===current.moves[ply])||null;
}
function toggleGradeExplanation() {
  mobileGradeOpen=!mobileGradeOpen;
  if(matchMedia('(min-width:901px)').matches){tab='coach';render();$('#panel-content').scrollTop=0;}
  else paintQuickCoach();
}
function paintQuickCoach() {
  const section=$('#mobile-glance'),attempt=latestOwnAttempt();
  section.hidden=!current || !!preview;
  const visible=coachOn || current?.finished;
  const badge=visible?moveBadge(attempt?.grade):{tone:'neutral',symbol:'○',label:'Coach off'};
  const lastOwn=current?current.moves.length-(game.turn()===current.color?1:0):0;
  const pending=visible && !!current && busy && !attempt && !!current.moves.length;
  const key=`${current?.id}|${attempt?.ply}|${attempt?.uci}|${visible}|${lastOwn}`;
  if(key!==mobileGradeKey){mobileGradeOpen=false;mobileGradeKey=key;}
  const button=$('#mobile-move-grade');
  button.className=`mobile-grade-button grade-${badge.tone}`;
  button.disabled=!visible || !attempt;
  button.setAttribute('aria-expanded',String(mobileGradeOpen));
  button.setAttribute('aria-label',attempt&&visible?`${attempt.san}: ${badge.label}. ${badge.detail||'Explain this move.'}`:pending?'Analysing your move':badge.label);
  button.innerHTML=`<span class="grade-disc" aria-hidden="true">${pending?'…':badge.symbol}</span><span><strong>${attempt&&visible?esc(attempt.san):''}</strong><small>${pending?'Analysing…':!attempt&&visible?'Your move':esc(badge.label)}${attempt&&visible?' · why?':''}</small></span>`;
  const target=visible && !preview?pieceQualityTarget(current,game,attempt):null;
  const overlay=$('#board-quality-overlay');
  if(target){
    const [x,y]=squarePoint(target);
    overlay.innerHTML=`<button id="piece-move-grade" class="piece-quality-control grade-${badge.tone}" data-grade-square="${target}" aria-label="${esc(attempt.san)}: ${esc(badge.label)}. Explain this move" aria-controls="mobile-grade-explanation" aria-expanded="${mobileGradeOpen}" style="left:clamp(16px,${(x+32)/8}%,calc(100% - 16px));top:clamp(16px,${(y-32)/8}%,calc(100% - 16px))"><span class="grade-disc" aria-hidden="true">${badge.symbol}</span></button>`;
  }else overlay.innerHTML='';
  const fallback=!!attempt && visible && !target && !preview;
  $('.mobile-glance-row').hidden=!fallback;
  const showQuick=!!coachHelp?.quick && !!current && !preview;
  section.hidden=!current || !!preview || (!fallback && !mobileGradeOpen && !showQuick);
  const explanation=$('#mobile-grade-explanation');explanation.hidden=!mobileGradeOpen || !attempt || !visible;
  if(!explanation.hidden)explanation.innerHTML=`<p class="quick-explanation-title">${esc(attempt.san)} · ${esc(badge.label)}</p>${attempt.explanation.facts.map(t=>`<p>${esc(t)}</p>`).join('')}<button class="button secondary" id="mobile-grade-retry" ${busy?'disabled':''}>↶ Retry this move</button>`;
  $('#mobile-best-move').disabled=!canAskCoach();
  const quick=$('#mobile-quick-coach');quick.hidden=!showQuick;
  if(quick.hidden){quick.innerHTML='';return;}
  if(coachHelp.stage==='loading'){quick.innerHTML='<p class="quick-status">Finding the best move…</p>';return;}
  if(coachHelp.stage==='error'){quick.innerHTML='<p class="quick-status">Couldn’t analyse this position. Tap Best move to retry.</p>';return;}
  const h=coachHelp,choice=h.choices?.[h.choiceIndex||0];if(!choice){quick.hidden=true;return;}
  const count=h.choices.length,index=h.choiceIndex||0;
  quick.innerHTML=`<div class="quick-choice-row"><span class="quick-choice-name"><span aria-hidden="true">${choice.best?'★':'✓'}</span><strong>${esc(choice.suggestion.san)}</strong><small>${choice.best?'Best':'OK alternative'} · ${index+1}/${count}</small></span><button class="icon-button" id="quick-choice-back" aria-label="Previous playable alternative" ${index===0?'disabled':''}>←</button><button class="icon-button" id="quick-choice-next" aria-label="Next playable alternative" ${index>=count-1?'disabled':''}>→</button><button class="icon-button" id="quick-close" aria-label="Hide suggested move">×</button></div><div class="quick-choice-actions"><button class="button subtle" id="quick-choice-why" aria-expanded="${!!h.quickDetails}" aria-controls="quick-choice-explanation">ⓘ Why?</button><button class="button subtle" id="quick-choice-preview">Preview ↗</button><button class="button primary" id="quick-choice-play" ${canPlayCoachMove()?'':'disabled'}>Play ${esc(choice.suggestion.san)}</button></div><div id="quick-choice-explanation" ${h.quickDetails?'':'hidden'}><p>${esc(choice.suggestion.idea)}</p><small>Stockfish depth ${h.depth}. ${count===1?'No other similarly strong moves found in this search.':'Arrows browse similarly strong choices from the engine’s top five.'} Help marks this decision as assisted.</small></div>`;
}
function chooseQuickAlternative(delta) {
  if(!coachHelp?.quick || !coachHelp.choices?.length || coachHelp.fen!==shownGame().fen())return;
  coachHelp.choiceIndex=Math.max(0,Math.min(coachHelp.choices.length-1,(coachHelp.choiceIndex||0)+delta));
  coachHelp.suggestion=coachHelp.choices[coachHelp.choiceIndex].suggestion;
  arrow=uciMove(coachHelp.suggestion.uci);selected=null;render();
}
function paintMobilePreview() {
  const suggestion=preview?.coach?coachHelp?.suggestion:preview?.line?{fen:preview.base,pv:preview.line,line:sanLine(preview.base,preview.line,preview.line.length),hint:'Step forward to explore the suggested move and the opponent’s reply.'}:null;
  const lesson=suggestion?previewLesson(suggestion,preview.step,playerLevel()):null;
  const card=$('#mobile-preview-coach');card.hidden=!lesson;
  $('.play-area').classList.toggle('coach-preview-active',!!lesson);
  if(!lesson){mobilePreviewExpanded=false;card.classList.remove('is-expanded');card.innerHTML='';return;}
  card.classList.toggle('is-expanded',mobilePreviewExpanded);
  card.innerHTML=`
    <div class="mobile-preview-heading">
      <span class="eyebrow">PREVIEW · ${lesson.step}/${lesson.total}</span>
      <h3>${esc(lesson.heading)}</h3>
    </div>
    <div class="mobile-preview-controls">
      <button class="icon-button" id="mobile-preview-back" aria-label="Previous preview move" ${lesson.step===0?'disabled':''}>←</button>
      <button class="icon-button" id="mobile-preview-next" aria-label="Next preview move" ${lesson.step>=lesson.total?'disabled':''}>→</button>
      <button class="button subtle" id="mobile-preview-return">Return to game</button>
    </div>
    <button class="button subtle" id="mobile-preview-details" aria-controls="mobile-preview-text" aria-expanded="${mobilePreviewExpanded}">${mobilePreviewExpanded?'Hide explanation ↑':'ⓘ Explain this move'}</button>
    <div id="mobile-preview-text">
      <p class="mobile-preview-idea"><strong>Idea:</strong> ${esc(lesson.reason)}</p>
      <p class="mobile-preview-watch"><strong>Watch:</strong> ${esc(lesson.watch)}</p>
      <div id="mobile-preview-extra" ${mobilePreviewExpanded?'':'hidden'}>
        ${lesson.actor==='opponent'?`<p><strong>Possible plan:</strong> ${esc(lesson.plan)}</p>`:''}
        ${lesson.next?`<p><strong>Next in this line:</strong> ${esc(lesson.next)}</p>`:''}
        <p class="mobile-preview-note">This is one engine continuation. Your opponent may choose another reply.</p>
      </div>
    </div>
`;

}
function togglePreviewExplanation() {
  if(!preview?.line)return;
  const card=$('#mobile-preview-coach'),button=$('#mobile-preview-details');
  const top=window.scrollY,left=window.scrollX;
  mobilePreviewExpanded=!mobilePreviewExpanded;
  card.classList.toggle('is-expanded',mobilePreviewExpanded);
  $('#mobile-preview-extra').hidden=!mobilePreviewExpanded;
  button.setAttribute('aria-expanded',String(mobilePreviewExpanded));
  button.textContent=mobilePreviewExpanded?'Hide explanation ↑':'ⓘ Explain this move';
  // Expanding grows the same page; keep the board and current reading position steady.
  window.scrollTo({top,left,behavior:'instant'});
}
function canAskCoach() {
  return !!current && engineReady && !busy && coachHelp?.stage!=='loading' && !preview?.line && !preview?.opponentEdit && shownGame().turn()===current.color && !shownGame().isGameOver();
}
function openMobileTools() {
  document.querySelectorAll('[data-tool]').forEach(b=>{const target=$('#'+b.dataset.tool);b.disabled=!target || target.disabled || target.hidden || (b.dataset.tool==='play-from-here' && preview?.historyPly==null);});
  $('#mobile-opening').textContent=$('#opening-name').textContent+' · '+$('#book-status').textContent;
  $('#mobile-tools').showModal();
}
function coachHelpMarkup() {
  if(!coachHelp)return '';
  const h=coachHelp;
  const lesson=preview?.coach?previewLesson(h.suggestion,preview.step,playerLevel()):null;
  const annotations=lesson?previewHighlights(h.suggestion,preview.step,playerLevel()):null;
  const roles=new Set(annotations?.marks.map(m=>m.role));
  const legend=annotations?.marks.length?`<div class="coach-highlight-legend" aria-label="Board highlights">${[['move','Move'],['threat','! Threat'],['pin','P Pin / queen line'],['support','Support'],['idea','Key square']].filter(([role])=>roles.has(role)).map(([role,label])=>`<span class="legend-${role}">${label}</span>`).join('')}<small>Red dashed = possible reply</small></div>`:'';
  const original=h.suggestion?`<p>Move your ${esc(h.suggestion.piece)} from ${h.suggestion.from} to ${h.suggestion.to}.</p><p>${esc(h.suggestion.idea)}</p><p class="eyebrow">ONE ENGINE CONTINUATION</p><p class="help-line">${esc(h.suggestion.line.join('  '))}</p>`:'';
  let text=h.stage==='loading'?'<h3>Finding a useful move…</h3><p>Analysing the position on your board.</p>':h.stage==='error'?`<h3>Couldn’t analyse this position</h3><p>${esc(h.error)}</p><button class="button secondary" id="coach-retry-help">Try again</button>`:h.stage==='hint'?`<h3>A hint first</h3><p>${esc(h.suggestion.hint)}</p><button class="button primary" id="coach-show-move">Show move + idea</button>`:`<h3>${esc(lesson?.heading || 'Consider '+h.suggestion.san)}</h3>${legend}${lesson?`<div class="coach-step-lesson" data-step="${lesson.step}"><span class="eyebrow">MOVE ${lesson.step} OF ${lesson.total}</span><p><strong>Idea:</strong> ${esc(lesson.reason)}</p>${lesson.actor==='opponent'?`<p><strong>Possible plan:</strong> ${esc(lesson.plan)}</p>`:''}<p class="coach-step-watch"><strong>Watch:</strong> ${esc(lesson.watch)}</p>${lesson.next?`<p class="coach-step-next"><strong>Next in this line:</strong> ${esc(lesson.next)}</p>`:''}</div>`:''}<div class="coach-preview-actions"><button class="button secondary" id="coach-preview-move">Preview move</button>${h.suggestion.pv.length>1?'<button class="button secondary" id="coach-preview-reply">Preview reply</button>':''}<button class="button primary" id="coach-play-move" ${canPlayCoachMove()?'':'disabled'}>${lesson?'Play '+esc(h.suggestion.san):'Play this move'}</button></div>${lesson?`<details class="coach-original-idea"><summary>Original suggestion & full line</summary>${original}</details>`:original}<small>Depth ${h.depth} · Stockfish 19 Lite. One possible line; the opponent can choose another reply.</small>`;
  return `<section class="coach-help" aria-live="polite"><span class="eyebrow">ASK COACH · ${preview?.coach?'BOARD PREVIEW':preview?'DISPLAYED POSITION':'YOUR CURRENT POSITION'}</span>${text}<button class="button subtle" id="coach-dismiss">Dismiss</button><p class="analysis-note">Help marks this decision as assisted, including when coaching is off.</p></section>`;
}
async function askCoach({direct=false}={}) {
  if(!canAskCoach())return;
  tab='coach';mobileCoachView='coach';
  const fen=shownGame().fen(),ply=preview?.historyPly ?? current.moves.length;
  if(coachHelp?.fen===fen && coachHelp.suggestion && (!direct || coachHelp.choices)){
    if(direct){coachHelp.quick=true;coachHelp.quickDetails=false;coachHelp.stage='answer';coachHelp.choiceIndex=0;coachHelp.suggestion=coachHelp.choices[0].suggestion;arrow=uciMove(coachHelp.suggestion.uci);}
    render();if(direct && matchMedia('(min-width:901px)').matches)$('#panel-content').scrollTop=0;if(!direct && matchMedia('(max-width:900px)').matches)scrollToSection('coach');return;
  }
  current.hints ||= [];
  if(!usedCoachHelp(current,fen,ply))current.hints.push({fen,ply,created:new Date().toISOString()});
  const request={fen,gameId:current.id,origin:preview?structuredClone(preview):null,stage:'loading',quick:direct};coachHelp=request;render();persist();
  if(!direct && matchMedia('(max-width:900px)').matches)scrollToSection('coach');
  try {
    const search=await engine.search(fen,{count:direct?Math.min(5,shownGame().moves().length):1,ms:direct?1300:1100});
    if(coachHelp!==request || current?.id!==request.gameId || shownGame().fen()!==fen)return;
    const suggestion=coachSuggestion(fen,search.lines[0],playerLevel());
    if(!suggestion)throw Error('No legal suggestion was returned. Please try again.');
    const choices=direct?playableChoices(fen,search.lines,playerLevel()):null;
    if(direct && !choices.length)throw Error('No legal suggestion was returned.');
    Object.assign(request,{stage:direct?'answer':'hint',suggestion:direct?choices[0].suggestion:suggestion,depth:search.depth,...(direct?{choices,choiceIndex:0}:{})});
    if(direct)arrow=uciMove(request.suggestion.uci);
    render();
    if(direct && matchMedia('(min-width:901px)').matches)$('#panel-content').scrollTop=0;
  }catch(error){if(coachHelp!==request)return;Object.assign(request,{stage:'error',error:error.message});render();}
}
function revealCoachMove() {
  if(!coachHelp?.suggestion || coachHelp.fen!==shownGame().fen())return;
  coachHelp.stage='answer';arrow=uciMove(coachHelp.suggestion.uci);selected=null;render();
}
function previewCoachMove(step=1) {
  if(busy || !coachHelp?.suggestion || coachHelp.gameId!==current?.id)return;
  if(coachHelp.fen!==(preview?.coach?preview.base:shownGame().fen()))return;
  const wasPreview=!!preview?.coach;
  const result=previewSuggestion(coachHelp.suggestion,step);if(!result)return;
  preview={coach:true,fen:result.fen,base:coachHelp.fen,line:coachHelp.suggestion.pv,step:result.step,label:result.step===0?'Your position':`${result.step%2?'You':'Reply'}: ${coachHelp.suggestion.line[result.step-1]}`};
  selected=null;arrow=result.next?uciMove(result.next):null;tab='coach';mobileCoachView='coach';render();
  if(!wasPreview && matchMedia('(max-width:900px)').matches)$('.play-area').scrollIntoView({behavior:'instant',block:'start'});
}
function canPlayCoachMove() {
  if(!coachHelp?.suggestion || busy || current?.id!==coachHelp.gameId)return false;
  if(coachHelp.fen!==(preview?.coach?preview.base:shownGame().fen()))return false;
  return coachHelp.origin?.historyPly!=null || (!current.finished && game.fen()===coachHelp.fen && game.turn()===current.color);
}
function playCoachMove() {
  if(!canPlayCoachMove())return;
  const suggestion=coachHelp.suggestion;
  preview=coachHelp.origin?structuredClone(coachHelp.origin):null;
  if(preview?.historyPly!=null)forkFromHistory(false);
  const move=uciMove(suggestion.uci);makeMove(move.from,move.to,move.promotion||'q');
}
function dismissCoachHelp() {
  if(preview?.coach)preview=coachHelp?.origin?structuredClone(coachHelp.origin):null;
  coachHelp=null;arrow=null;selected=null;render();
}
function render() {
  if (!state) return;
  const active = current && !current.finished;
  if(coachHelp && (coachHelp.fen!==(preview?.coach?preview.base:shownGame().fen()) || coachHelp.gameId!==current?.id))coachHelp=null;
  $('.side-panel').dataset.coachView=mobileCoachView;
  $('#mobile-ask-coach').disabled=!canAskCoach();
  $('#opponent-name').textContent = current ? `Practice partner · ${current.opponent}` : 'Your practice partner';
  $('#opponent-caption').textContent = current ? `${current.color==='w'?'Black':'White'} · target strength` : 'Ready when you are';
  $('#your-color').textContent = current ? `· ${current.color==='w'?'White':'Black'}` : '';
  $('#your-caption').textContent = current?.assess ? 'Assessment · unassisted moves count' : `Teaching level ${playerLevel()}`;
  $('#engine-status').textContent = !engineReady ? 'Loading engine…' : busy ? 'Thinking…' : preview?.opponentEdit ? 'What-if move' : preview ? 'Exploring' : current?.finished ? 'Review' : awaiting ? 'Your decision' : !current ? 'Ready to play' : game.turn()===current.color ? 'Your turn' : 'Opponent’s turn';
  const displayedGame=preview?.historyPly!=null ? positionAt(current,preview.historyPly) : game;
  const recognised=preview?.line ? openingAt(preview.fen) : identifyOpening(displayedGame);
  $('#opening-name').textContent = recognised ? `${recognised.eco} · ${recognised.name}` : 'Opening not yet identified';
  $('#book-status').textContent = current ? `Practice: ${getOpening()?.name || 'Open game'} · ${bookStatus(getOpening(),displayedGame.history())}` : 'Start a new practice';
  $('#review-game').disabled = !current || busy || current.finished;
  $('#new-game').disabled = !engineReady || busy;
  $('#reset-board').disabled = !engineReady || busy || !current;
  document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===tab));
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===(tab==='progress'?'progress':'coach')));
  if(matchMedia('(max-width:900px)').matches){
    $('[data-panel="coach"]').classList.toggle('active',tab==='coach' && mobileCoachView==='coach');
    $('[data-show-five]').classList.toggle('active',tab==='coach' && mobileCoachView==='five');
  }
  updateMobileDock();
  drawBoard();
  if (tab==='coach') renderCoach(active); else if (tab==='moves') renderMoves(); else renderProgress();
  const panelKey=`${tab}|${current?.id}|${current?.moves.length}|${focus?.ply}|${focus?.uci}|${coachHelp?.stage}|${mobileCoachView}|${preview?.coach?preview.step:''}`;
  if(panelKey!==renderedPanelKey){$('#panel-content').scrollTop=0;renderedPanelKey=panelKey;}
}
function renderCoach(active) {
  const f=focus;
  let html=`<div class="coach-header"><div><span class="eyebrow">YOUR CORNER OF THE BOARD</span><h2>Let’s think it through.</h2></div><label class="toggle" title="Toggle live coaching"><input id="coach-toggle" aria-label="Toggle live coaching" type="checkbox" ${coachOn?'checked':''}/><span></span></label></div>`;
  html+=`<div class="ask-coach-row"><small>Stuck? Find a move and understand its idea.</small><button class="button secondary" id="ask-coach" ${canAskCoach()?'':'disabled'}>✦ Ask coach</button></div><div class="mobile-coach-tabs"><button class="button secondary ${mobileCoachView==='coach'?'active':''}" data-coach-view="coach" aria-pressed="${mobileCoachView==='coach'}">Feedback</button><button class="button secondary ${mobileCoachView==='five'?'active':''}" data-coach-view="five" aria-pressed="${mobileCoachView==='five'}">Top 5</button></div>`;
  if(mobileGradeOpen && !preview && (coachOn || current?.finished)){
    const attempt=latestOwnAttempt(),badge=moveBadge(attempt?.grade);
    if(attempt)html+=`<section class="desktop-piece-explanation"><h3>${esc(attempt.san)} · ${esc(badge.label)}</h3>${attempt.explanation.facts.map(t=>`<p>${esc(t)}</p>`).join('')}<button class="button secondary" id="desktop-grade-retry" ${busy?'disabled':''}>↶ Retry this move</button></section>`;
  }
  if(coachHelp?.quick && !preview)html+=`<div class="desktop-quick-suggestions">${$('#mobile-quick-coach').innerHTML.replaceAll('id="quick-','id="desktop-quick-').replaceAll('aria-controls="quick-','aria-controls="desktop-quick-')}</div>`;
  html+=coachHelpMarkup();
  html+='<div class="coach-overview">';
  if (!coachOn && active && !awaiting) {
    html+=`<div class="coach-empty"><span class="empty-icon">♘</span><h3>Just you and the board.</h3><p>Play freely. Your moves are saved for the review. Bring the coach back whenever you like.</p></div>`;
  } else if (f && (coachOn || !active)) {
    const grade=f.grade;
    html+=`<div class="feedback-card severity-${grade.severity}"><div class="feedback-top"><span class="move-token">${esc(f.san)}</span><strong>${esc(grade.label)}</strong><span class="feedback-symbol">${grade.severity>=2?'?!':grade.severity===1?'?!':'✓'}</span></div>${f.explanation.facts.map(t=>`<p>${esc(t)}</p>`).join('')}<div id="opponent-idea-slot">${opponentIdeaMarkup()}</div><small>${f.inherited?'Original line · saved analysis':f.retry?'Practice variation · assisted':f.assisted?'Coached first attempt':'Unassisted first attempt'}</small></div>`;
    html+=`</div><div class="coach-candidates"><div class="section-heading"><h3>Five ways forward</h3><span>Before your ${esc(f.san)}</span></div><div class="candidate-labels"><span>ENGINE CHOICE</span><span>WHITE EVAL.</span></div><div class="candidates">${f.lines.map((line,i)=>{
      const san=sanLine(f.before,line.pv,1)[0], mine=line.pv[0]===f.uci, opening=openingForMove(f.before,line.pv[0]);
      return `<button class="candidate ${mine?'your-move':''}" data-candidate="${i}" ${busy?'disabled':''}><span class="candidate-rank">${i+1}</span><span class="candidate-description"><span class="candidate-title"><strong>${esc(san)}</strong>${mine?'<span class="mine-label">YOUR MOVE</span>':''}</span>${opening?`<small>${esc(opening.name)}</small>`:''}</span><span class="candidate-eval">${displayScore(line,new Chess(f.before).turn())}</span><span class="candidate-arrow">↗</span></button>`;
    }).join('')}</div><p class="analysis-note">Depth ${f.depth} · Stockfish 19 Lite · evaluations favour White when positive. Close scores can be equally playable.</p><div id="candidate-explanation">${variationExplanation()}</div>`;
    html+=`</div><div class="coach-overview"><div class="decision-buttons"><button class="button secondary" id="retry" ${busy?'disabled':''}>↶ Retry this move</button>${f.actual?.pv?.length>1?`<button class="button secondary" id="show-punishment" ${busy?'disabled':''}>See strongest reply ↗</button>`:''}</div>`;
    if (!f.lines.some(l=>l.pv[0]===f.uci)) html+=`<p class="analysis-note">Your move ${esc(f.san)}: ${displayScore(f.actual,new Chess(f.before).turn())}. Analysed separately from the top five.</p>`;
  } else {
    html+=`<div class="coach-empty"><div class="empty-board">♘<span>✦</span></div><h3>${current?'Your move. Your discovery.':'A good habit starts here.'}</h3><p>${current?'Make a move on the board. We’ll compare five possibilities, unpack the idea, and keep what you learn.':'Choose an opening and a worthy opponent. Your coach will help you understand the choices between moves.'}</p>${!current?'<button class="button primary" id="start-first">Start your first practice ↗</button>':''}</div>`;
  }
  html+='</div>';
  if(!f || (!coachOn && active))html+='<div class="coach-candidates"><p class="muted">Top five alternatives appear after your move with coaching on. Ask coach for help with the current position.</p></div>';
  html+='<div class="coach-overview">';
  if(!f && (coachOn||!active))html+=`<div id="opponent-idea-slot">${opponentIdeaMarkup()}</div>`;
  if(current && coachOn && !preview){
    const last=game.history({verbose:true}).at(-1);
    const manual=current.overrides?.find(o=>o.ply===current.moves.length-1&&o.uci===last?.lan);
    if(last && last.color!==current.color)html+=`<div class="opponent-reply"><span class="eyebrow">${manual?'YOUR WHAT-IF REPLY':'OPPONENT’S REPLY'}</span><strong>${esc(last.san)}</strong>${manual?`<p>You chose ${esc(last.san)} instead of ${esc(manual.replacedSan)}. It’s your turn to respond.</p>`:''}<p>${game.isCheck()?'Your king is in check. You must deal with the check.':last.captured?`Your opponent captured your ${PIECE_NAMES[last.captured]} on ${last.to}.`:'Look at what changed. You can rewind as many moves as you like and try a different continuation.'}</p></div>`;
  }
  const summary=learningSummary(state.games), pattern=summary.patterns.find(p=>p.count>=2);
  if(coachOn || !active) html+=`<div class="habit-card"><span class="habit-icon">✦</span><div><span class="eyebrow">${pattern?'A PATTERN TO NOTICE':'ONE SMALL HABIT'}</span><p>${esc(pattern?.tip || 'Before you move, ask: what is my opponent threatening?')}</p></div></div>`;
  if (current?.finished) html+=`<div class="review-banner"><strong>${esc(current.result || 'Practice saved')}</strong><p>Select a move in the Moves tab to revisit its position and coaching.</p><button class="button secondary" id="review-moves">Explore game moves →</button></div>`;
  $('#panel-content').innerHTML=html+'</div>';
}
function renderMoves() {
  if (!current) { $('#panel-content').innerHTML='<div class="coach-empty"><h3>Your story starts on move one.</h3><p>Start a practice to build your move history.</p></div>'; return; }
  const history=historyGame().history({verbose:true});
  let html=`<div class="panel-intro"><span class="eyebrow">${current.finished?'POST-GAME REVIEW':'YOUR GAME SO FAR'}</span><h2>Every move has a story.</h2><p>Select a move to revisit its position. Use the board arrows to go back further, then Play from here to test another line. Your original game is preserved.</p></div><div class="move-table"><div class="move-table-head"><span>#</span><span>WHITE</span><span>BLACK</span></div>`;
  for(let i=0;i<history.length;i+=2) html+=`<div class="move-row"><span>${i/2+1}</span>${[i,i+1].map(j=>{const m=history[j]; if(!m)return '<span></span>'; const a=[...(current.attempts||[])].reverse().find(a=>a.ply===j && a.uci===m.lan); const manual=current.overrides?.some(o=>o.ply===j&&o.uci===m.lan); return `<div class="move-cell"><button data-history="${j}" class="${a?.grade.severity>=2?'bad-move':''}">${esc(m.san)} <small>${manual?'↳':a?.grade.severity>=2?'?':a?.grade.label==='Best move'?'✓':''}</small></button>${m.color!==current.color?`<button class="move-override" data-opponent-ply="${j}" aria-label="Change opponent move ${Math.floor(j/2)+1}${m.color==='w'?'.':'…'} ${esc(m.san)}" title="Try a different opponent move" ${busy?'disabled':''}>↺</button>`:''}</div>`;}).join('')}</div>`;
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
  $('#panel-content').innerHTML=`<div class="panel-intro"><span class="eyebrow">SMALL STEPS, STRONGER CHESS</span><h2>Your game is growing.</h2><p>Evidence from your own moves. Saved only in this browser.</p></div><div class="stats-grid"><div><strong>${state.games.length}</strong><span>practice sessions</span></div><div><strong>${s.originals}</strong><span>first decisions</span></div><div><strong>${s.unassisted}</strong><span>unassisted moves</span></div><div><strong>${s.originals?Math.round(s.good/s.originals*100)+'%':'—'}</strong><span>good / best moves</span></div></div><div class="progress-section"><h3>Patterns worth practising</h3>${s.patterns.length?s.patterns.map(p=>`<div class="pattern"><div><strong>${esc(p.title)}</strong><span>${p.count} ${p.count===1?'example':'examples'}${p.count<3?' · early signal':''}</span></div><p>${esc(p.tip)}</p></div>`).join(''):'<p class="muted">Play a few games. We’ll collect supported patterns from your moves, without judging you on a single mistake.</p>'}<p class="analysis-note">Counts describe detected mistakes, not a complete measure of your skill. Retry attempts are excluded.</p></div><div class="assessment-card"><strong>Level assessment</strong><p>${s.ready?`Suggested practice difficulty: around ${s.suggested}. This is a provisional training setting based on recent unassisted engine losses, not a calibrated chess rating.`:`${s.unassisted}/20 unassisted moves collected. Turn coaching off to build an initial practice-level estimate.`}</p></div><div class="progress-section"><h3>Practice journal</h3>${state.games.slice().reverse().slice(0,20).map(g=>`<button class="journal-entry" data-game="${esc(g.id)}"><span><strong>${esc(OPENINGS.find(o=>o.id===g.opening)?.name || 'Practice')}</strong><small>${g.parentId?'Variation · ':''}${new Date(g.created).toLocaleDateString(undefined,{day:'numeric',month:'short'})} · ${g.color==='w'?'White':'Black'} · ${g.moves.length} plies</small></span><span>${g.finished?'Review ↗':'Resume ↗'}</span></button>`).join('') || '<p class="muted">Your first practice will appear here.</p>'}</div>`;
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
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
  if(current.color==='b') opponentTurn();
}
async function resetBoard() {
  if(busy || !engineReady || !current)return;
  const {color,opening,level,opponent,assess}=current;
  if(!current.finished){current.finished=true;current.result='Board reset · previous practice saved';}
  current={id:crypto.randomUUID(),created:new Date().toISOString(),color,opening,level,opponent,assess,coach:coachOn,moves:[],attempts:[],finished:false};
  state.games.push(current);state.active=current.id;game=new Chess();flipped=color==='b';
  generation++;awaiting=false;retrying=false;focus=null;preview=null;arrow=null;selected=null;tab='coach';
  await persist();render();toast('Board reset. Your previous game is saved in My progress.');
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
  if(color==='b')opponentTurn();
}
async function makeMove(from,to,promotion='q',recovered=null) {
  if(busy || awaiting || preview || !current || current.finished || game.turn()!==current.color) return;
  const legal=game.moves({square:from,verbose:true}).filter(m=>m.to===to);
  if(!legal.length) { selected=null; drawBoard(); return; }
  if(legal.some(m=>m.promotion) && arguments.length<3) { choosePromotion(from,to); return; }
  const token=generation, before=game.fen(), book=bookOptions(getOpening(),game.history()), ply=game.history().length;
  const wasRetry=recovered?.retry ?? (retrying || !!current.parentId), wasAssisted=recovered?.assisted ?? (coachOn || retrying || !!current.parentId || usedCoachHelp(current,before,ply));
  const move=game.move({from,to,promotion}); current.moves.push(move.lan);
  current.pending={before,uci:move.lan,retry:wasRetry,assisted:wasAssisted};
  selected=null; preview=null; arrow=null; coachHelp=null; mobileCoachView='coach';tab='coach';busy=true; render(); await persist();
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
    current.attempts.push(focus); current.pending=null; retrying=false; current.retrying=false; busy=false; awaiting=false;
    if(game.isGameOver()) finishGame(terminalResult());
    await persist(); render();
    if(!current.finished) opponentTurn();
  } catch(error) {
    busy=false; awaiting=false;
    // Keep the played position recoverable; offer retry/continue even when analysis fails.
    focus={before,after:game.fen(),uci:move.lan,san:move.san,ply,lines:[],actual:null,grade:{label:'Unrated',severity:0,loss:0},explanation:{facts:['Analysis was interrupted. You can rewind to retry this move.'],tags:[]},depth:0,retry:wasRetry,assisted:wasAssisted};
    current.attempts.push(focus); current.pending=null; await persist(); render(); toast(error.message);
    if(game.isGameOver()){finishGame(terminalResult());persist();render();}else opponentTurn();
  }
}
function choosePromotion(from,to,onMove=makeMove) {
  const dialog=$('#promotion'); $('.promotion-options').innerHTML=['q','r','b','n'].map(p=>`<button class="promotion-choice" data-promotion="${p}" aria-label="Promote to ${PIECE_NAMES[p]}">${glyphs[p]}</button>`).join('');
  dialog.oncancel=()=>{selected=null;drawBoard();};
  $('.promotion-options').onclick=e=>{ const p=e.target.closest('[data-promotion]')?.dataset.promotion; if(p){dialog.close();onMove(from,to,p);} }; dialog.showModal();
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
  if(busy || !focus || !current)return;
  const before=positionAt(current,focus.ply);
  if(before.fen()!==focus.before){toast('Choose this move in its original game to retry it.');return;}
  navigateHistory(focus.ply);forkFromHistory();
}
function continueGame() { if(busy || !current || current.finished)return; awaiting=false; preview=null; arrow=null; if(game.isGameOver())finishGame(); persist(); render(); if(!current.finished)opponentTurn(); }
function showCandidate(index) {
  const line=focus?.lines[index]; if(!line)return;
  preview={fen:focus.before,label:`${sanLine(focus.before,line.pv,1)[0]} · engine variation`,base:focus.before,line:line.pv,step:0};
  preview.details={text:explainCandidate(focus.before,line,playerLevel()),moves:sanLine(focus.before,line.pv,10).join('  '),note:'Use the arrows below the board to follow this line.'};
  arrow=uciMove(line.pv[0]); selected=null; render();
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
}
function stepPreview(delta) {
  if(preview?.coach){previewCoachMove(preview.step+delta);return;}
  if(!preview?.line)return; preview.step=Math.max(0,Math.min(preview.line.length,preview.step+delta));
  const g=new Chess(preview.base); for(const move of preview.line.slice(0,preview.step))g.move(uciMove(move));
  preview.fen=g.fen(); const next=preview.line[preview.step]; arrow=next?uciMove(next):null; drawBoard();
  const opening=openingAt(preview.fen);$('#opening-name').textContent=opening?`${opening.eco} · ${opening.name}`:'Engine continuation';
}
function returnToGame() {
  if(preview?.coach){preview=coachHelp?.origin?structuredClone(coachHelp.origin):null;arrow=coachHelp?.quick?uciMove(coachHelp.suggestion.uci):null;selected=null;render();return;}
  preview=null;arrow=null;selected=null;focus=current?.attempts.at(-1)||null;render();
}
function navigateHistory(ply) {
  if(!current || busy)return;
  const total=current.moves.length,count=Math.max(0,Math.min(total,ply));
  if(count===total){returnToGame();return;}
  const earlier=positionAt(current,count),last=earlier.history().at(-1);
  preview={fen:earlier.fen(),historyPly:count,label:count?`After ${Math.ceil(count/2)}${count%2?'.':'…'} ${last}`:'Starting position'};
  arrow=null;selected=null;
  focus=[...current.attempts].reverse().find(a=>a.ply<count && a.before===positionAt(current,a.ply).fen())||null;
  render();
}
function stepHistory(delta) { navigateHistory((preview?.historyPly ?? current?.moves.length ?? 0)+delta); }
function changeOpponentMove(ply=null) {
  if(busy || !engineReady || !current)return;
  const target=ply==null?opponentTarget():historyGame().history({verbose:true})[ply];
  if(!target || target.color===current.color)return;
  const index=ply==null?target.ply:ply;
  preview={fen:target.before,historyPly:index,opponentEdit:{ply:index,san:target.san,uci:target.lan},label:`Choose an alternative to ${Math.floor(index/2)+1}${target.color==='w'?'.':'…'} ${target.san}`};
  selected=null;arrow=null;render();
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
}
async function applyOpponentReplacement(from,to,promotion=null) {
  if(busy || !preview?.opponentEdit)return;
  const legal=shownGame().moves({square:from,verbose:true}).filter(m=>m.to===to);
  if(!legal.length){selected=null;drawBoard();return;}
  if(legal.some(m=>m.promotion) && !promotion){choosePromotion(from,to,applyOpponentReplacement);return;}
  try {
    const edit=preview.opponentEdit;
    const branch=replaceOpponentLine(current,edit.ply,`${from}${to}${promotion||''}`,crypto.randomUUID());
    current=branch;state.games.push(branch);state.active=branch.id;game=historyGame();generation++;
    coachOn=branch.coach??true;awaiting=false;retrying=true;preview=null;arrow=null;selected=null;focus=branch.attempts.at(-1)||null;tab='coach';
    if(game.isGameOver())finishGame(terminalResult());
    await persist();render();toast(`What if ${branch.overrides.at(-1).san}? Your original game is saved. It’s your turn to respond.`);
    if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
  }catch(error){toast(error.message);}
}
function forkFromHistory(autoReply=true) {
  if(busy || preview?.historyPly==null || new Chess(preview.fen).isGameOver())return;
  const branch=forkSession(current,preview.historyPly,crypto.randomUUID());
  current=branch;state.games.push(branch);state.active=branch.id;game=historyGame();generation++;
  coachOn=branch.coach??true;awaiting=false;retrying=true;preview=null;arrow=null;selected=null;focus=branch.attempts.at(-1)||null;tab='coach';
  persist();render();toast('Alternate line started. Your original game is saved in My progress.');
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
  if(autoReply && game.turn()!==current.color)opponentTurn();
}
function showPlayedLine() {
  const line=focus?.actual;if(!line?.pv?.length)return;
  preview={fen:focus.before,label:`Strongest reply to ${focus.san}`,base:focus.before,line:line.pv,step:0};
  preview.details={text:`The engine’s strongest continuation against ${focus.san}.`,moves:sanLine(focus.before,line.pv,12).join('  '),note:'Step forward to see the reply and how the position develops. Your chosen-strength opponent may play a different move.'};
  arrow=null;stepPreview(1);render();
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
}
function viewHistory(index) {
  if(busy) return;
  const h=historyGame().history({verbose:true}), move=h[index]; if(!move)return;
  navigateHistory(index+1);
  const attempt=[...current.attempts].reverse().find(a=>a.ply===index && a.uci===move.lan);
  if(attempt){ focus=attempt; tab='coach'; } render();
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
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
  awaiting=false;
  preview=null;arrow=null;selected=null;retrying=!!current.retrying;tab=current.finished?'moves':'coach';generation++;persist();render();
  if(matchMedia('(max-width:900px)').matches)scrollToSection(current.finished?'moves':'board');
  resumeSession();
}
function resumeSession() {
  if(!engineReady || !current || current.finished || busy)return;
  if(game.isGameOver()){finishGame(terminalResult());persist();render();return;}
  if(current.pending && current.moves.at(-1)===current.pending.uci){
    const pending=current.pending; game.undo();current.moves.pop();awaiting=false;
    const move=uciMove(pending.uci);makeMove(move.from,move.to,move.promotion||'q',pending);return;
  }
  if(game.turn()!==current.color && !awaiting)opponentTurn();
}

$('#setup-form').addEventListener('submit',startGame);
function canMoveOnBoard() {
  if(busy || !current || preview?.line)return false;
  if(preview?.opponentEdit)return !shownGame().isGameOver();
  if(preview?.historyPly!=null)return new Chess(preview.fen).turn()===current.color;
  return !current.finished && game.turn()===current.color;
}
function playBoardMove(from,to) {
  if(!canMoveOnBoard())return;
  const shown=preview?new Chess(preview.fen):game;
  if(!shown.moves({square:from,verbose:true}).some(m=>m.to===to)){selected=null;drawBoard();return;}
  if(preview?.opponentEdit){applyOpponentReplacement(from,to);return;}
  if(preview?.historyPly!=null)forkFromHistory(false);
  makeMove(from,to);
}
$('#board').addEventListener('click',e=>{
  if(performance.now()<suppressClickUntil)return;
  const square=e.target.closest('[data-square]')?.dataset.square;
  if(!square || !canMoveOnBoard())return;
  const shown=preview?new Chess(preview.fen):game;
  if(selected && shown.moves({square:selected,verbose:true}).some(m=>m.to===square)){playBoardMove(selected,square);return;}
  selected=shown.get(square)?.color===moveColor() ? (selected===square?null:square) : null;drawBoard();
});
$('#board-quality-overlay').addEventListener('dragstart',e=>e.preventDefault());
$('#board-quality-overlay').addEventListener('pointerdown',e=>{
  if(e.button!==0 || !canMoveOnBoard())return;
  const from=e.target.closest('[data-grade-square]')?.dataset.gradeSquare;
  const piece=from?shownGame().get(from):null;
  if(piece?.color!==moveColor())return;
  dragState={from,piece,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false};
});
$('#board').addEventListener('dragstart',e=>e.preventDefault());
$('#board').addEventListener('pointerdown',e=>{
  if(e.button!==0 || !canMoveOnBoard())return;
  const from=e.target.closest('[data-square]')?.dataset.square;
  const shown=preview?new Chess(preview.fen):game,piece=from?shown.get(from):null;
  if(piece?.color!==moveColor())return;
  dragState={from,piece,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false};
});
document.addEventListener('pointermove',e=>{
  if(!dragState || e.pointerId!==dragState.pointerId)return;
  if(!dragState.active && Math.hypot(e.clientX-dragState.x,e.clientY-dragState.y)<5)return;
  e.preventDefault();
  if(!dragState.active){
    dragState.active=true;selected=dragState.from;$('#board').setPointerCapture(e.pointerId);drawBoard();
    const ghost=document.createElement('div');ghost.id='drag-piece';ghost.className='drag-ghost';
    ghost.innerHTML=`<span class="piece ${dragState.piece.color==='w'?'white':'black'}">${glyphs[dragState.piece.type]}</span>`;
    const boardWidth=$('#board').getBoundingClientRect().width;
    ghost.style.width=`${boardWidth/8}px`;ghost.style.fontSize=`${Math.max(24,Math.min(62,boardWidth/10))}px`;document.body.append(ghost);
  }
  const ghost=$('#drag-piece');ghost.style.left=`${e.clientX}px`;ghost.style.top=`${e.clientY}px`;
  document.querySelector('.drop-target')?.classList.remove('drop-target');
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('#board [data-square]');
  if(target)target.classList.add('drop-target');
},{passive:false});
function releaseDrag(e,cancelled=false) {
  if(!dragState || e.pointerId!==dragState.pointerId)return;
  const drag=dragState;dragState=null;
  if(!drag.active)return;
  const to=document.elementFromPoint(e.clientX,e.clientY)?.closest('#board [data-square]')?.dataset.square;
  if($('#board').hasPointerCapture(e.pointerId))$('#board').releasePointerCapture(e.pointerId);
  $('#drag-piece')?.remove();suppressClickUntil=performance.now()+300;
  if(!cancelled && to && to!==drag.from)playBoardMove(drag.from,to);
  else {selected=null;drawBoard();}
}
document.addEventListener('pointerup',e=>releaseDrag(e));
document.addEventListener('pointercancel',e=>releaseDrag(e,true));
window.addEventListener('blur',()=>{if(dragState)releaseDrag({pointerId:dragState.pointerId,clientX:0,clientY:0},true);});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b || b.disabled)return;
  if(b.dataset.tool){$('#mobile-tools').close();$('#'+b.dataset.tool)?.click();return;}
  if(b.dataset.showFive){tab='coach';mobileCoachView='five';render();return;}
  if(b.dataset.coachView){mobileCoachView=b.dataset.coachView;render();return;}
  if(b.dataset.close){$('#'+b.dataset.close).close();return;}
  if(b.dataset.jump){
    mobileDestination=b.dataset.jump;
    if(mobileDestination!=='board')tab=mobileDestination;
    render();
    scrollToSection(mobileDestination);
    return;
  }
  if(b.dataset.tab){tab=b.dataset.tab;mobileDestination=tab;render();return;} if(b.dataset.panel){tab=b.dataset.panel;if(tab==='coach')mobileCoachView='coach';mobileDestination=tab;render();return;}
  if(b.dataset.candidate!=null){showCandidate(Number(b.dataset.candidate));return;}
  if(b.dataset.history!=null){viewHistory(Number(b.dataset.history));return;} if(b.dataset.game){openRecord(b.dataset.game);return;}
  if(b.dataset.opponentPly!=null){changeOpponentMove(Number(b.dataset.opponentPly));return;}
  const actions={ 'piece-move-grade':toggleGradeExplanation,'mobile-move-grade':toggleGradeExplanation,'desktop-grade-retry':retryMove,'mobile-grade-retry':retryMove,'mobile-best-move':()=>askCoach({direct:true}),'quick-choice-back':()=>chooseQuickAlternative(-1),'quick-choice-next':()=>chooseQuickAlternative(1),'quick-close':()=>{if(coachHelp){coachHelp.quick=false;coachHelp.quickDetails=false;}arrow=null;render();},'quick-choice-why':()=>{if(coachHelp)coachHelp.quickDetails=!coachHelp.quickDetails;render();},'quick-choice-preview':()=>previewCoachMove(1),'quick-choice-play':playCoachMove,'mobile-preview-back':()=>stepPreview(-1),'mobile-preview-next':()=>stepPreview(1),'mobile-preview-return':returnToGame,'mobile-preview-details':togglePreviewExplanation,'ask-coach':askCoach,'mobile-ask-coach':()=>askCoach({direct:true}),'coach-show-move':()=>revealCoachMove(),'coach-preview-move':()=>previewCoachMove(1),'coach-preview-reply':()=>previewCoachMove(2),'coach-play-move':playCoachMove,'coach-dismiss':dismissCoachHelp,'coach-retry-help':()=>{coachHelp=null;askCoach();},'mobile-back-board':()=>scrollToSection('board'),'mobile-change-opponent':()=>changeOpponentMove(),'mobile-more':openMobileTools,'mobile-game-tools':openMobileTools,'new-game':setup,'start-first':setup,'reset-board':resetBoard,flip:()=>{flipped=!flipped;drawBoard();},retry:retryMove,continue:continueGame,'resume-opponent':opponentTurn,
    'exit-preview':returnToGame,'cancel-opponent-edit':returnToGame,'change-opponent':changeOpponentMove,'explain-evaluation':explainEvaluation,'retry-evaluation':()=>{$('#info').close();positionAnalysis.retry(shownGame().fen());},'line-back':()=>stepPreview(-1),'line-next':()=>stepPreview(1),'history-start':()=>navigateHistory(0),'history-back':()=>stepHistory(-1),'history-next':()=>stepHistory(1),'history-live':returnToGame,'play-from-here':forkFromHistory,'show-punishment':showPlayedLine,backup:exportBackup,restore:()=>$('#backup-file').click(),pgn:exportPgn,
    'review-moves':()=>{tab='moves';render();},'review-game':()=>{if(!current||busy)return;finishGame();tab='moves';persist();render();},about:()=>{
      $('#info-body').innerHTML='<h2>A practice room of your own.</h2><p>Between Moves runs chess analysis on your device using Stockfish 19 Lite. Coaching uses programmed rules and verified engine continuations, with no AI API.</p><p>Games, retries, and learning history are stored in this browser using IndexedDB. No accounts, analytics, or game uploads. Your host still handles ordinary website requests.</p><p>Clearing browser data can erase history. Export backups regularly, and before switching domains, browsers, or devices. Import merges sessions without replacing existing records.</p><p>Opponent ratings are approximate targets. Level assessment is an experimental practice-difficulty estimate, not a calibrated platform rating. Positional explanations and practice book lines have limited coverage. Opening recognition uses the local Lichess opening-name database (CC0).</p><p>Stockfish.js is distributed under GPLv3. <a href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1" target="_blank" rel="noreferrer">Engine source</a> · <a href="./engine/COPYING.txt" target="_blank">Engine licence</a>. Chess rules by chess.js (BSD-2-Clause).</p>';
      $('#info').showModal();
    }
  }; actions[b.id.replace(/^desktop-quick-/,'quick-')]?.();
});
document.addEventListener('change',e=>{
  if(e.target.id==='coach-toggle'){
    coachOn=e.target.checked;if(current)current.coach=coachOn;
    persist();render();
  }
});
$('#backup-file').addEventListener('change',e=>{if(busy){toast('Wait for the current move to finish before importing.');return;}importBackup(e.target.files[0]).catch(handleError).finally(()=>e.target.value='');});
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||$('dialog[open]'))return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(preview?.line)stepPreview(e.key==='ArrowLeft'?-1:1);else stepHistory(e.key==='ArrowLeft'?-1:1);} if(e.key==='Escape'&&preview)returnToGame();});
try {
  db=await openStore();state=await readState(db);
  const active=state.games.find(g=>g.id===state.active);
  if(active){current=active;game=historyGame();coachOn=current.coach??true;flipped=current.color==='b';focus=current.attempts.at(-1)||null;retrying=!!current.retrying;awaiting=false;}
  render();resumeSession();
  if(!state.games.length)setup();
} catch(error) {
  state={version:1,games:[],settings:{level:1350,opponent:1350,color:'w',opening:'random'}};render();toast('Browser storage is unavailable. You can play, but export backups to keep your history.');
}
