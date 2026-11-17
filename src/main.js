import { Chess } from 'chess.js';
import { Engine } from './engine.js';
import { OPENINGS, chooseOpening, bookOptions, bookStatus, identifyOpening, openingAt, openingForMove } from './openings.js';
import { PIECE_NAMES, uciMove, displayScore, gradeMove, explainMove, explainCandidate, sanLine } from './coach.js';
import { openStore, readState, writeState } from './storage.js';
import { positionAt, forkSession, replaceOpponentLine, historyRows } from './timeline.js';
import { positionEvaluation, LatestPositionAnalysis } from './evaluation.js';
import { explainOpponentMove } from './opponent-coach.js';
import './style.css';
import './interaction.css';
import './readability.css';
import { COACHING_MODES, coachingIntensity as savedIntensity, feedbackPolicy } from './coaching-intensity.js';
import { COACH_QUESTIONS, coachQuestion } from './coach-questions.js';
import { resetPractice } from './reset-practice.js';
import { bestMovePreview } from './best-move-preview.js';
import { miniLineMarkup } from './mini-line.js';
import { shortMoveIdea } from './move-idea.js';
import { compareMove } from './move-comparison.js';
import './whatif.css';
import './mobile-coach.css';
import './mobile-page.css';
import './mobile-preview.css';
import './mobile-quick.css';
import './coach-popover.css';
import './position-editor.css';
import './coaching-intensity.css';
import './coach-questions.css';
import './best-move-preview.css';
import './compact-practice.css';
import { moveDraftPiece, editedSession } from './position-editor.js';
import { placeCoachPopover } from './coach-popover.js';
import { moveBadge, playableChoices, pieceQualityTarget } from './quick-coach.js';
import { moveInWords, moveWords } from './move-language.js';
import './move-language.css';
import './compact-coach.css';
import { moveCaption, moveTranslation } from './move-caption.js';
import { previewHighlights } from './coach-highlights.js';
import { coachSuggestion, usedCoachHelp, previewSuggestion, previewLesson } from './ask-coach.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glyphs = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
let db, state, game = new Chess(), current, selected = null, busy = true, engineReady = false;
let intensity='coached';
let coachOn = true, awaiting = false, retrying = false, focus = null, preview = null, arrow = null;
let tab = 'coach', generation = 0, flipped = false, toastTimer, saveQueue = Promise.resolve();
let dragState=null, suppressClickUntil=0;
let mobileDestination='board';
let renderedPanelKey=null;
let positionEditor=null, gradeTriggerWasOpen=false;
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
  <main><h1 class="sr-only">Between Moves chess practice</h1><div class="practice-brand-bar"><div class="brand-lockup"><a class="compact-brand" href="./" aria-label="Between Moves home"><span class="compact-brand-knight" aria-hidden="true">♞</span><span>between<span class="compact-brand-light">moves</span></span></a><p class="brand-tagline">Understand every move.</p></div><div class="practice-actions masthead-actions" aria-label="Practice controls"><button class="icon-button top-reset" id="reset-board" aria-label="Reset board" title="Reset board · previous game stays saved"><span aria-hidden="true">↻</span><span class="reset-label">Reset</span></button><button class="button primary" id="new-game" aria-label="New practice"><span aria-hidden="true">＋</span><span class="new-practice-label">New practice</span></button><button class="icon-button top-flip" id="flip" aria-label="Flip board" title="Flip board"><span aria-hidden="true">⇅</span></button></div></div>
    <div class="workspace"><section class="play-area" aria-label="Chess game">
      <div class="player-bar practice-topbar"><div class="practice-identity"><div><strong id="opponent-name">Your practice partner</strong><small id="opponent-caption">Getting the board ready</small></div><span id="engine-status" class="status-pill">Loading engine…</span></div></div>
      <div class="timeline" aria-label="Game navigation"><div class="timeline-buttons"><button class="icon-button" id="history-start" aria-label="Go to start" title="Go to start">⇤</button><button class="icon-button" id="history-back" aria-label="Previous move" title="Previous move (left arrow)">←</button><button class="icon-button" id="history-next" aria-label="Next move" title="Next move (right arrow)">→</button><button class="icon-button" id="history-live" aria-label="Go to latest position" title="Go to latest position">⇥</button></div><span id="history-position">Starting position</span><button id="mobile-best-move" class="board-best-button" aria-label="Ask coach: show best next move" title="Ask coach"><span aria-hidden="true">✦</span></button><label class="coaching-switch"><span class="sr-only">Coaching intensity</span><select id="coaching-intensity" aria-label="Coaching intensity">${COACHING_MODES.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}</select></label><button class="button subtle" id="review-game" title="End practice and review moves">Review</button><button class="button subtle" id="play-from-here" hidden>Play from here ↗</button></div>
      <div id="position-editor-bar" class="position-editor-bar" hidden><div><strong>Edit position</strong><p>Drag either side’s pieces freely. Your original game stays saved.</p></div><div class="position-editor-actions"><label>Side to play<select id="editor-turn"><option value="w">White</option><option value="b">Black</option></select></label><button class="button primary" id="editor-resume">Resume</button><button class="button secondary" id="editor-undo">Undo edit</button><button class="button subtle" id="editor-cancel">Cancel</button></div><small>You’ll play the selected side. Resume when your setup is ready.</small><p id="position-editor-error" role="alert" hidden></p></div>
      <div id="opponent-edit-bar" class="opponent-edit-bar" role="status" hidden></div>
      <div class="board-shell"><div class="board" id="board" role="group" aria-label="Chessboard"></div><svg id="arrows" class="arrows" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4" fill="#d78d2a"/></marker></defs><g id="coach-board-lines"></g><line id="arrow-line" stroke="#d78d2a" stroke-opacity=".86" stroke-width="12" stroke-linecap="round" marker-end="url(#arrowhead)" /></svg><div id="board-quality-overlay" class="board-quality-overlay"></div></div>
      <section class="mobile-glance" id="mobile-glance" aria-label="Quick coaching"><div class="mobile-glance-row"><button id="mobile-move-grade" class="mobile-grade-button" aria-expanded="false" aria-controls="piece-grade-popover"></button></div><div id="mobile-quick-coach" aria-live="polite" hidden></div></section>
      <section id="mobile-preview-coach" class="mobile-preview-coach" aria-label="Current preview explanation" aria-live="polite" aria-atomic="true" hidden></section>
      <section id="evaluation-panel" class="evaluation-panel" aria-label="Position evaluation" hidden><div class="evaluation-scale"><span>White</span><div id="evaluation-track" class="evaluation-track" role="img" aria-label="Analysing position"><span id="white-advantage"></span></div><span>Black</span></div><div class="evaluation-caption"><strong id="evaluation-score">—</strong><span id="evaluation-headline">Analysing position…</span><button class="button subtle" id="explain-evaluation">Why?</button></div></section>
      <div class="mobile-position" id="mobile-move-names" aria-live="polite">Starting position</div>
      <div class="player-bar bottom-player"><div class="avatar you-avatar">♙</div><div><strong>You <span id="your-color"></span></strong><small id="your-caption">Your practice, your pace</small></div></div>


      <div id="preview-bar" class="preview-bar" hidden></div>
      <div class="board-note"><span id="opening-name">Opening practice</span><span id="book-status">Choose your opening</span></div>
    </section>
    <aside class="side-panel"><div class="panel-tabs"><button class="active" data-panel="coach">Coach</button><button class="mobile-top-five" data-show-five="true">Top 5</button><button data-panel="moves">Moves</button></div><div id="panel-content"></div></aside></div>
    <footer><span>Between Moves · Saved on this device</span><button id="about">About & privacy</button></footer>
  </main>
  <nav class="mobile-dock" aria-label="Practice actions"><button class="mobile-ask" id="mobile-ask-coach" hidden aria-label="Ask coach" title="Ask coach"><span aria-hidden="true">✦</span></button><button id="mobile-back-board">↑ Back to board</button></nav>

  <dialog id="setup"><form id="setup-form"><div class="dialog-top"><span class="eyebrow">A FRESH POSITION, A FRESH PERSPECTIVE</span><button type="button" class="icon-button" data-close="setup" aria-label="Close setup">×</button></div><h2>Set up your practice.</h2><p class="muted">Choose the challenge. We’ll meet you where you are.</p>
    <label>Practice mode<select name="mode"><option value="opponent">Play an opponent</option><option value="free">Free play · I move both sides</option></select><small>Free play coaches each move for White and Black.</small></label><label id="opponent-setting">Opponent target strength<input name="opponent" type="number" min="400" max="3000" step="50" value="1350" required/><small>Approximate playing strength. Your coach always uses full-strength Stockfish analysis.</small></label>

    <div class="field-label" id="setup-side-label">Play as</div><div class="color-options"><label><input type="radio" name="color" value="w" checked/><span>♔ <strong>White</strong><small>You make the first move</small></span></label><label><input type="radio" name="color" value="b"/><span>♚ <strong>Black</strong><small>Practise your response</small></span></label></div>
    <label>Opening<select name="opening">${OPENINGS.map(o=>`<option value="${o.id}">${o.name}</option>`).join('')}</select><small>Curated book variations. You can leave the book at any time.</small></label>
    <label>Coaching intensity<select name="coachingIntensity">${COACHING_MODES.map(m=>`<option value="${m.id}" ${m.id==='coached'?'selected':''}>${m.label}</option>`).join('')}</select><small id="setup-coaching-description" aria-live="polite">${COACHING_MODES.find(m=>m.id==='coached').description}</small></label>
    <button class="button primary wide" type="submit">Let’s play <span>↗</span></button><p class="privacy-note">No account. No subscription. Your history stays in this browser.</p></form></dialog>
  <section id="piece-grade-popover" class="piece-grade-popover" popover="auto" role="dialog" aria-labelledby="piece-grade-title"></section>
  <dialog id="promotion"><h2>Promote your pawn</h2><p>Choose your new piece.</p><div class="promotion-options"></div></dialog>
  <dialog id="info"><div class="dialog-top"><span class="eyebrow">BETWEEN MOVES</span><button class="icon-button" data-close="info" aria-label="Close information">×</button></div><div id="info-body"></div></dialog>
  <div id="toast" role="status"></div>`;

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').classList.remove('visible'),5500); }
function handleError(error) { console.error(error); busy = false; render(); toast(error.message || 'Something went wrong. Please try again.'); }
function persist() {
  if (!db) return Promise.resolve();
  const snapshot = structuredClone(state);
  saveQueue = saveQueue.then(()=>writeState(db,snapshot)).catch(()=> { $('.local-badge').textContent='Storage unavailable — export a backup'; toast('Could not save in this browser. Export a backup to keep your history.'); });
  return saveQueue;
}
function historyGame(record = current) { const g = new Chess(record?.startFen); for (const move of record?.moves || []) g.move(uciMove(move)); return g; }
function shownGame() { if(positionEditor)return new Chess(positionEditor.fen,{skipValidation:true});return preview?.historyPly!=null?positionAt(current,preview.historyPly):preview?new Chess(preview.fen):game; }
function restoreCoaching(record) { intensity=savedIntensity(record);coachOn=intensity!=='silent'; }
function coaching() { return feedbackPolicy({coachingIntensity:intensity},!!current?.finished); }
function isFreePlay() { return current?.mode==='free'; }
function humanTurn(board=game) { return isFreePlay() || board.turn()===current?.color; }
function moveColor() { return preview?.opponentEdit || isFreePlay()?shownGame().turn():current?.color; }
function evaluationVisible() { return !!current && !positionEditor && !(coachHelp?.quick&&!preview) && coaching().evaluation; }
function opponentIdeaMarkup() {
  if(isFreePlay())return '';
  if(!current || (!coachOn&&!current.finished) || preview?.line || preview?.opponentEdit)return '';
  const history=historyGame().history({verbose:true}),cutoff=preview?.historyPly ?? history.length;
  let index=cutoff-1,next=false;
  if(history[index]?.color===current.color && preview?.historyPly!=null && history[cutoff]?.color!==current.color && history[cutoff]){index=cutoff;next=true;}
  const move=history[index];if(!move || move.color===current.color)return '';
  const cached=positionAnalysis.cache.get(move.after)?.analysis;
  const idea=explainOpponentMove({before:move.before,uci:move.lan,previousMove:history[index-1],analysis:cached?{...cached,fen:move.after}:null,level:playerLevel()});
  if(!idea)return '';
  const content=`<div class="opponent-idea"><span class="opponent-idea-label">${next?`NEXT ${idea.side.toUpperCase()} REPLY`:`${idea.side.toUpperCase()}’S IDEA`} · ${esc(idea.san)}</span><p>${esc(idea.reason)}</p><p><strong>Possible plan:</strong> ${esc(idea.plan)}</p>${idea.watch?`<p class="opponent-idea-watch"><strong>Watch:</strong> ${esc(idea.watch)}</p>`:''}</div>`;
  return focus?`<details class="opponent-context"><summary>${idea.side}’s last move · ${esc(idea.san)}</summary>${content}</details>`:content;
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
  closeGradePopover();
  const shown = shownGame();
  $('.play-area').classList.toggle('editing-position',!!positionEditor);
  $('#position-editor-bar').hidden=!positionEditor;
  if(positionEditor){$('#position-editor-bar > small').textContent=isFreePlay()?'You control both sides. Choose whose turn comes next.':'You’ll play the selected side. Resume when your setup is ready.';$('#editor-turn').value=positionEditor.turn;$('#editor-undo').disabled=!positionEditor.past.length;$('#editor-resume').textContent=`Resume · ${positionEditor.turn==='w'?'White':'Black'} to play`;}
  const question=coachHelp?.quick&&!preview&&coachHelp?.suggestion?coachQuestion(coachHelp.suggestion,coachHelp.question||'why',playerLevel()):null;
  const highlights=preview?.bestAlternative?previewHighlights(preview.suggestion,preview.step,playerLevel()):preview?.coach?previewHighlights(coachHelp?.suggestion,preview.step,playerLevel()):question||{marks:[],lines:[]};
  const marked=new Map(highlights.marks.map(m=>[m.square,m]));
  const files = flipped ? 'hgfedcba' : 'abcdefgh', ranks = flipped ? '12345678' : '87654321';
  const freeDrag=canDragToEdit(),draggable=canMoveOnBoard()||freeDrag,dragColor=moveColor();
  let legal = []; if (selected && !positionEditor && !preview?.line) legal = shown.moves({ square:selected,verbose:true }).map(m=>m.to);
  const last = positionEditor?null:preview?.coach ? previewSuggestion(coachHelp?.suggestion,preview.step)?.last : preview?.historyPly!=null ? positionAt(current,preview.historyPly).history({verbose:true}).at(-1) : !preview ? game.history({verbose:true}).at(-1) : null;
  $('#board').innerHTML = [...ranks].map((rank,ri)=>[...files].map((file,fi)=> {
    const square=file+rank, piece=shown.get(square), dark=(file.charCodeAt(0)+Number(rank))%2===0;
    const annotation=marked.get(square);
    const check = piece?.type==='k' && piece.color===shown.turn() && shown.isCheck();
    return `<button class="square ${draggable&&piece&&(positionEditor||freeDrag||piece.color===dragColor)?'can-drag':''} ${dark?'dark':'light'} ${selected===square?'selected':''} ${last?.from===square || last?.to===square?'last-move':''} ${check?'in-check':''} ${dragState?.active && dragState.from===square?'drag-source':''}" data-square="${square}" aria-label="${square}${piece ? ` ${piece.color==='w'?'white':'black'} ${PIECE_NAMES[piece.type]}` : ' empty'}${annotation?' · '+esc(annotation.label):''}">${annotation?`<span class="coach-square-mark coach-mark-${annotation.role}" aria-hidden="true">${['pin','threat'].includes(annotation.role)?`<span>${annotation.role==='pin'?'P':'!'}</span>`:''}</span>`:''}${fi===0?`<span class="rank-label">${rank}</span>`:''}${ri===7?`<span class="file-label">${file}</span>`:''}${piece?`<span class="piece ${piece.color==='w'?'white':'black'}" aria-hidden="true">${glyphs[piece.type]}</span>`:''}${legal.includes(square)?`<span class="legal-dot ${piece?'capture':''}"></span>`:''}</button>`;
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
  $('#mobile-move-names').innerHTML=positionEditor?'Editing position · drag either colour':`${esc(moveCaption(current,preview))}<small class="move-translation">${esc(moveTranslation(current,preview))}</small>`;
  const historyMove=current&&ply?positionAt(current,ply).history({verbose:true}).at(-1):null;
  $('#history-position').textContent=historyMove?`${historyMove.before.split(' ')[5]}${historyMove.color==='w'?'. White':'… Black'} · ${ply} / ${total}`:'Starting position';
  for(const id of ['history-start','history-back'])$('#'+id).disabled=busy || !current || ply===0;
  for(const id of ['history-next','history-live'])$('#'+id).disabled=busy || !current || ply>=total;
  $('#history-live').disabled=busy || !current || !preview;
  $('#play-from-here').hidden=preview?.historyPly==null;
  if(preview?.opponentEdit)$('#play-from-here').hidden=true;
  $('#play-from-here').disabled=busy || shown.isGameOver();
  $('#opponent-edit-bar').hidden=!preview?.opponentEdit;
  if(preview?.opponentEdit)$('#opponent-edit-bar').innerHTML=`<div><strong>What if ${shown.turn()==='w'?'White':'Black'} played something else?</strong><p>Drag an opponent piece to replace <b>${esc(preview.opponentEdit.san)}</b>. Your original game stays saved.</p></div><button class="button subtle" id="cancel-opponent-edit">Cancel</button>`;
  syncEvaluation();
}
function latestOwnAttempt() {
  if(!current)return null;
  const parity=current.color===new Chess(current.startFen).turn()?0:1;
  let ply=current.moves.length-1;
  if(!isFreePlay() && ply%2!==parity)ply--;
  if(ply<0)return null;
  return [...current.attempts].reverse().find(a=>a.ply===ply&&a.uci===current.moves[ply])||null;
}
function moveExplanationMarkup(attempt) {
  const comparison=compareMove(attempt,playerLevel());
  const translation=`<p class="move-in-words">${esc(moveWords(attempt.before,attempt.uci))}</p>`;
  if(!comparison)return translation+attempt.explanation.facts.map(t=>`<p>${esc(t)}</p>`).join('');
  const c=comparison;
  return (c.bestSAN===c.playedSAN?'':translation)+`${attempt.grade.severity>0&&c.bestSAN!==c.playedSAN&&c.cause?`<p>${esc(c.cause)}</p>`:''}<div class="best-move-lesson"><div class="best-move-copy"><button class="best-move-preview-trigger" data-best-ply="${attempt.ply}" data-best-uci="${attempt.uci}" aria-label="Preview ${esc(c.bestSAN)} and the opponent’s reply" ${busy||coachHelp?.stage==='loading'?'disabled':''}>${c.bestSAN===c.playedSAN?'Best move':'Best was'} <strong>${esc(c.bestSAN)}</strong><span aria-hidden="true"> ↗</span></button><small class="move-translation">${esc(moveWords(attempt.before,attempt.lines[0].pv[0]))}</small><p>${esc(c.bestIdea)}</p></div>${miniLineMarkup(attempt.before,attempt.lines[0].pv,flipped)}</div>${c.reply?`<p class="coach-reply-summary"><strong>Watch for:</strong> ${esc(c.reply)}</p>`:''}`;

}
function closeGradePopover(restoreFocus=false) {
  const popup=$('#piece-grade-popover');
  if(popup?.matches(':popover-open'))popup.hidePopover();
  mobileGradeOpen=false;
  for(const button of document.querySelectorAll('[aria-controls="piece-grade-popover"]'))button.setAttribute('aria-expanded','false');
  if(restoreFocus)($('#piece-move-grade')||$('#mobile-move-grade'))?.focus({preventScroll:true});
}
function toggleGradeExplanation() {
  const popup=$('#piece-grade-popover');
  if(gradeTriggerWasOpen || popup.matches(':popover-open')){gradeTriggerWasOpen=false;closeGradePopover(true);return;}
  gradeTriggerWasOpen=false;
  const attempt=latestOwnAttempt();if(!attempt || preview || !coaching().grades)return;
  focus=attempt;selected=null;drawBoard();
  const anchor=$('#piece-move-grade')||$('#mobile-move-grade'),badge=moveBadge(attempt.grade);
  popup.innerHTML=`<div class="piece-grade-heading"><span class="grade-${badge.tone}"><span class="grade-disc" aria-hidden="true">${badge.symbol}</span></span><div><h3 id="piece-grade-title">${isFreePlay()?(new Chess(attempt.before).turn()==='w'?'White · ':'Black · '):''}${esc(attempt.san)} · ${esc(badge.label)}</h3></div><button id="piece-grade-close" class="icon-button" aria-label="Close explanation">×</button></div><div class="piece-grade-facts">${moveExplanationMarkup(attempt)}</div><button class="button secondary" id="piece-grade-retry" ${busy?'disabled':''}>↶ Retry this move</button>`;
  popup.style.visibility='hidden';popup.style.maxHeight='';popup.showPopover();
  const footer=matchMedia('(max-width:900px)').matches?$('.mobile-dock').getBoundingClientRect().height:0;
  const location=placeCoachPopover(anchor.getBoundingClientRect(),popup.getBoundingClientRect(),{width:innerWidth,height:innerHeight-footer});
  popup.style.left=`${location.left}px`;popup.style.top=`${location.top}px`;popup.style.maxHeight=`${Math.min(360,innerHeight-90,location.maxHeight)}px`;popup.style.visibility='visible';
  mobileGradeOpen=true;anchor.setAttribute('aria-expanded','true');
  $('#piece-grade-close').focus({preventScroll:true});
}
function paintQuickCoach() {
  const section=$('#mobile-glance'),attempt=latestOwnAttempt();
  section.hidden=!current || !!preview;
  const visible=!positionEditor && coaching().grades;
  const badge=visible?moveBadge(attempt?.grade):{tone:'neutral',symbol:'○',label:'Coach off'};
  const lastOwn=current?current.moves.length-(game.turn()===current.color?1:0):0;
  const pending=visible && !!current && busy && !attempt && !!current.moves.length;
  const key=`${current?.id}|${attempt?.ply}|${attempt?.uci}|${visible}|${lastOwn}`;
  if(key!==mobileGradeKey){closeGradePopover();mobileGradeKey=key;}
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
    overlay.innerHTML=`<button id="piece-move-grade" class="piece-quality-control grade-${badge.tone}" data-grade-square="${target}" aria-label="${esc(attempt.san)}: ${esc(badge.label)}. Explain this move" aria-controls="piece-grade-popover" aria-haspopup="dialog" aria-expanded="${mobileGradeOpen}" style="left:clamp(16px,${(x+32)/8}%,calc(100% - 16px));top:clamp(16px,${(y-32)/8}%,calc(100% - 16px))"><span class="grade-disc" aria-hidden="true">${badge.symbol}</span></button>`;
  }else overlay.innerHTML='';
  const fallback=!!attempt && visible && !target && !preview;
  $('.mobile-glance-row').hidden=!fallback;
  const showQuick=!!coachHelp?.quick && !!current && !preview;
  $('.play-area').classList.toggle('quick-coach-active',showQuick);
  section.hidden=!current || !!positionEditor || !!preview || (!fallback && !showQuick);
  $('#mobile-best-move').disabled=!canAskCoach();
  const quick=$('#mobile-quick-coach');quick.hidden=!showQuick;
  if(quick.hidden){quick.innerHTML='';return;}
  if(coachHelp.stage==='loading'){quick.innerHTML='<p class="quick-status">Finding the best move…</p>';return;}
  if(coachHelp.stage==='error'){quick.innerHTML='<p class="quick-status">Couldn’t analyse this position. Tap Best move to retry.</p>';return;}
  const h=coachHelp,choice=h.choices?.[h.choiceIndex||0];if(!choice){quick.hidden=true;return;}
  const count=h.choices.length,index=h.choiceIndex||0;
  const answer=coachQuestion(h.suggestion,h.question||'why',playerLevel());
  quick.innerHTML=`<div class="quick-choice-row"><span class="quick-choice-name"><strong>${esc(choice.suggestion.san)}</strong><small>${choice.best?'Engine choice':'OK alternative'} · ${index+1}/${count}</small></span><button class="icon-button" id="quick-choice-back" aria-label="Previous playable alternative" ${index===0?'disabled':''}>←</button><button class="icon-button" id="quick-choice-next" aria-label="Next playable alternative" ${index>=count-1?'disabled':''}>→</button><button class="icon-button" id="quick-close" aria-label="Close Ask coach">×</button></div><p class="quick-move-translation">${esc(choice.suggestion.words)}</p><div class="coach-question-tabs" role="group" aria-label="Quick coach questions">${COACH_QUESTIONS.map(q=>`<button data-coach-question="${q.id}" aria-label="${q.question}" aria-pressed="${(h.question||'why')===q.id}">${q.label}</button>`).join('')}</div><p class="coach-question-answer" role="status">${esc(answer?.text||'No verified explanation is available for this line.')}</p><div class="quick-choice-actions"><small>${answer?.future?'Dashed = possible line':'Highlights = current position'}</small><button class="button subtle" id="quick-choice-preview">Preview ↗</button><button class="button primary" id="quick-choice-play" ${canPlayCoachMove()?'':'disabled'}>Play ${esc(choice.suggestion.san)}</button></div>`;

}
function chooseQuickAlternative(delta) {
  if(!coachHelp?.quick || !coachHelp.choices?.length || coachHelp.fen!==shownGame().fen())return;
  coachHelp.choiceIndex=Math.max(0,Math.min(coachHelp.choices.length-1,(coachHelp.choiceIndex||0)+delta));
  coachHelp.suggestion=coachHelp.choices[coachHelp.choiceIndex].suggestion;
  arrow=null;selected=null;render();
}
function paintMobilePreview() {
  const suggestion=preview?.bestAlternative?preview.suggestion:preview?.coach?coachHelp?.suggestion:preview?.line?{fen:preview.base,pv:preview.line,line:sanLine(preview.base,preview.line,preview.line.length),hint:'Step forward to explore the suggested move and the opponent’s reply.'}:null;
  const lesson=suggestion?previewLesson(suggestion,preview.step,playerLevel()):null;
  const card=$('#mobile-preview-coach');card.hidden=!lesson;
  if(preview?.bestAlternative){$('.play-area').classList.add('coach-preview-active');card.classList.add('best-alternative-card');card.innerHTML=bestPreviewMarkup();return;}
  card.classList.remove('best-alternative-card');
  $('.play-area').classList.toggle('coach-preview-active',!!lesson);
  if(!lesson){mobilePreviewExpanded=false;card.classList.remove('is-expanded');card.innerHTML='';return;}
  card.classList.toggle('is-expanded',mobilePreviewExpanded);
  card.innerHTML=`
    <div class="mobile-preview-heading">
      <span class="eyebrow">PREVIEW · ${lesson.step}/${lesson.total}</span>
      <h3>${esc(lesson.heading)}</h3>
    </div>
    ${lesson.words?`<p class="preview-move-translation">${esc(lesson.words)}</p>`:''}<div class="mobile-preview-controls">
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
  return !!current && !positionEditor && engineReady && !busy && coachHelp?.stage!=='loading' && !preview?.line && !preview?.opponentEdit && humanTurn(shownGame()) && !shownGame().isGameOver();
}
function coachHelpMarkup() {
  if(!coachHelp || (coachHelp.quick&&!preview))return '';
  const h=coachHelp;
  const lesson=preview?.coach?previewLesson(h.suggestion,preview.step,playerLevel()):null;
  const annotations=lesson?previewHighlights(h.suggestion,preview.step,playerLevel()):null;
  const roles=new Set(annotations?.marks.map(m=>m.role));
  const legend=annotations?.marks.length?`<div class="coach-highlight-legend" aria-label="Board highlights">${[['move','Move'],['threat','! Threat'],['pin','P Pin / queen line'],['support','Support'],['idea','Key square']].filter(([role])=>roles.has(role)).map(([role,label])=>`<span class="legend-${role}">${label}</span>`).join('')}<small>Red dashed = possible reply</small></div>`:'';
  const original=h.suggestion?`<p>Move your ${esc(h.suggestion.piece)} from ${h.suggestion.from} to ${h.suggestion.to}.</p><p>${esc(h.suggestion.idea)}</p><p class="eyebrow">ONE ENGINE CONTINUATION</p><p class="help-line">${esc(h.suggestion.line.join('  '))}</p>`:'';
  let text=h.stage==='loading'?'<h3>Finding a useful move…</h3><p>Analysing the position on your board.</p>':h.stage==='error'?`<h3>Couldn’t analyse this position</h3><p>${esc(h.error)}</p><button class="button secondary" id="coach-retry-help">Try again</button>`:h.stage==='hint'?`<h3>A hint first</h3><p>${esc(h.suggestion.hint)}</p><button class="button primary" id="coach-show-move">Show move + idea</button>`:`<h3>${esc(lesson?.heading || 'Consider '+h.suggestion.san)}</h3>${legend}${lesson?`<div class="coach-step-lesson" data-step="${lesson.step}"><span class="eyebrow">MOVE ${lesson.step} OF ${lesson.total}</span><p class="move-in-words">${esc(lesson.words)}</p><p><strong>Idea:</strong> ${esc(lesson.reason)}</p>${lesson.actor==='opponent'?`<p><strong>Possible plan:</strong> ${esc(lesson.plan)}</p>`:''}<p class="coach-step-watch"><strong>Watch:</strong> ${esc(lesson.watch)}</p>${lesson.next?`<p class="coach-step-next"><strong>Next in this line:</strong> ${esc(lesson.next)}</p>`:''}</div>`:''}<div class="coach-preview-actions"><button class="button secondary" id="coach-preview-move">Preview move</button>${h.suggestion.pv.length>1?'<button class="button secondary" id="coach-preview-reply">Preview reply</button>':''}<button class="button primary" id="coach-play-move" ${canPlayCoachMove()?'':'disabled'}>${lesson?'Play '+esc(h.suggestion.san):'Play this move'}</button></div>${lesson?`<details class="coach-original-idea"><summary>Original suggestion & full line</summary>${original}</details>`:original}<small>One possible continuation. Your opponent may choose another reply.</small>`;
  return `<section class="coach-help" aria-live="polite"><span class="eyebrow">COACH · ${preview?.coach?'BOARD PREVIEW':preview?'DISPLAYED POSITION':'YOUR CURRENT POSITION'}</span>${text}<button class="button subtle" id="coach-dismiss">${preview?.coach?'Return to game':'Close'}</button></section>`;
}
async function askCoach({direct=true}={}) {
  if(!canAskCoach())return;
  tab='coach';mobileCoachView='coach';
  const fen=shownGame().fen(),ply=preview?.historyPly ?? current.moves.length;
  if(coachHelp?.fen===fen && coachHelp.suggestion && (!direct || coachHelp.choices)){
    if(direct){coachHelp.quick=true;coachHelp.stage='answer';coachHelp.choiceIndex=0;coachHelp.suggestion=coachHelp.choices[0].suggestion;arrow=null;}
    render();if(direct && matchMedia('(min-width:901px)').matches)$('#panel-content').scrollTop=0;if(!direct && matchMedia('(max-width:900px)').matches)scrollToSection('coach');return;
  }
  current.hints ||= [];
  if(!usedCoachHelp(current,fen,ply))current.hints.push({fen,ply,created:new Date().toISOString()});
  const request={fen,gameId:current.id,origin:preview?structuredClone(preview):null,stage:'loading',quick:direct,question:'why'};coachHelp=request;render();persist();
  if(direct && matchMedia('(max-width:900px)').matches){const rect=$('#board').getBoundingClientRect();if(rect.top<0||rect.bottom>innerHeight-240)scrollToSection('board');}
  if(!direct && matchMedia('(max-width:900px)').matches)scrollToSection('coach');
  try {
    const search=await engine.search(fen,{count:direct?Math.min(5,shownGame().moves().length):1,ms:direct?1300:1100});
    if(coachHelp!==request || current?.id!==request.gameId || shownGame().fen()!==fen)return;
    const suggestion=coachSuggestion(fen,search.lines[0],playerLevel());
    if(!suggestion)throw Error('No legal suggestion was returned. Please try again.');
    const choices=direct?playableChoices(fen,search.lines,playerLevel()):null;
    if(direct && !choices.length)throw Error('No legal suggestion was returned.');
    Object.assign(request,{stage:direct?'answer':'hint',suggestion:direct?choices[0].suggestion:suggestion,depth:search.depth,...(direct?{choices,choiceIndex:0}:{})});
    if(direct)arrow=null;
    render();
    if(direct && matchMedia('(min-width:901px)').matches)$('#panel-content').scrollTop=0;
  }catch(error){if(coachHelp!==request)return;Object.assign(request,{stage:'error',error:error.message});render();}
}
function revealCoachMove() {
  if(!coachHelp?.suggestion || coachHelp.fen!==shownGame().fen())return;
  coachHelp.stage='answer';arrow=null;selected=null;render();
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
  return coachHelp.origin?.historyPly!=null || (!current.finished && game.fen()===coachHelp.fen && humanTurn());
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
  stopMiniReplay();
  const active = current && !current.finished;
  $('#coaching-intensity').value=intensity;
  $('#coaching-intensity').title=COACHING_MODES.find(m=>m.id===intensity).description;
  document.querySelector('[data-show-five]').hidden=true;
  if(coachHelp && (coachHelp.fen!==(preview?.coach?preview.base:shownGame().fen()) || coachHelp.gameId!==current?.id))coachHelp=null;
  $('.side-panel').dataset.coachView=mobileCoachView;
  $('#mobile-ask-coach').disabled=!canAskCoach();
  $('#opponent-name').textContent = current ? isFreePlay()?'Free play · both sides':`Practice partner · ${current.opponent}` : 'Your practice partner';
  $('#opponent-caption').textContent = current ? isFreePlay()?'You control White and Black':`${current.color==='w'?'Black':'White'} · target strength` : 'Ready when you are';
  $('#your-color').textContent = current ? isFreePlay()?'· Both sides':`· ${current.color==='w'?'White':'Black'}` : '';
  $('#your-caption').textContent = 'Coach · full-strength analysis';
  $('#engine-status').textContent = positionEditor?'Editing position':!engineReady ? 'Loading engine…' : busy ? 'Thinking…' : preview?.opponentEdit ? 'What-if move' : preview ? 'Exploring' : current?.finished ? 'Review' : awaiting ? 'Your decision' : !current ? 'Ready to play' : isFreePlay()?`${game.turn()==='w'?'White':'Black'} to play`:game.turn()===current.color ? 'Your turn' : 'Opponent’s turn';
  const displayedGame=preview?.historyPly!=null ? positionAt(current,preview.historyPly) : game;
  const recognised=preview?.line ? openingAt(preview.fen) : identifyOpening(displayedGame);
  $('#opening-name').textContent = positionEditor?'Position editor':recognised ? `${recognised.eco} · ${recognised.name}` : 'Opening not yet identified';
  $('#book-status').textContent = current ? `Practice: ${getOpening()?.name || 'Custom position'} · ${bookStatus(getOpening(),displayedGame.history())}` : 'Start a new practice';
  $('#review-game').disabled = !current || busy || !!positionEditor || current.finished;
  $('#new-game').disabled = !engineReady || busy || !!positionEditor;
  $('#reset-board').disabled = !engineReady || busy || !current;
  document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===tab));
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='coach'));
  if(matchMedia('(max-width:900px)').matches){
    $('[data-panel="coach"]').classList.toggle('active',tab==='coach' && mobileCoachView==='coach');
    $('[data-show-five]').classList.toggle('active',tab==='coach' && mobileCoachView==='five');
  }
  updateMobileDock();
  drawBoard();
  if (tab==='moves') renderMoves(); else renderCoach(active);
  const panelKey=`${tab}|${current?.id}|${current?.moves.length}|${focus?.ply}|${focus?.uci}|${coachHelp?.stage}|${mobileCoachView}|${preview?.coach?preview.step:''}`;
  if(panelKey!==renderedPanelKey){$('#panel-content').scrollTop=0;renderedPanelKey=panelKey;}
}
// Suggestions are keyed to the displayed position, never the previous attempt.
let nextMoves=null,nextExpandedFen=null;
function nextMovePosition() {
  if(!current || positionEditor || preview?.line || busy || !engineReady || !coaching().guidance || current.finished)return null;
  const board=shownGame();
  return humanTurn(board)&&!board.isGameOver()?board.fen():null;
}
function ensureNextMoves() {
  const fen=nextMovePosition();if(!fen || (nextMoves?.fen===fen&&nextMoves.gameId===current.id))return;
  const request={fen,gameId:current.id,stage:'loading',choices:[]};nextMoves=request;
  queueMicrotask(async()=>{
    try{
      if(nextMovePosition()!==fen || nextMoves!==request){if(nextMoves===request)nextMoves=null;return;}
      const search=await engine.search(fen,{count:Math.min(5,new Chess(fen).moves().length),ms:1100});
      if(nextMoves!==request || current?.id!==request.gameId || nextMovePosition()!==fen){if(nextMoves===request)nextMoves=null;return;}
      request.choices=search.lines.map((line,index)=>({line,index,suggestion:coachSuggestion(fen,line,playerLevel()),grade:gradeMove(search.lines[0],line,index===0)})).filter(c=>c.suggestion);
      request.stage=request.choices.length?'ready':'error';
    }catch{if(nextMoves===request)request.stage='error';}
    if(nextMoves===request && tab==='coach' && nextMovePosition()===fen)renderCoach(!current.finished);
  });
}
async function showBestDirection() {
  if(!canAskCoach())return;
  const fen=shownGame().fen(),id=current.id;
  let best=nextMoves?.fen===fen&&nextMoves.gameId===id?nextMoves.choices?.[0]?.suggestion.uci:null;
  if(!best){
    $('#mobile-best-move').disabled=true;
    try{best=(await engine.search(fen,{count:1,ms:850})).lines[0]?.pv[0];}
    catch{toast('Couldn’t find a move. Try again.');}
  }
  if(current?.id!==id || shownGame().fen()!==fen || busy || preview?.line)return;
  arrow=best?uciMove(best):null;drawBoard();
  $('#mobile-best-move').disabled=!canAskCoach();
}
function renderCoach(active) {
  if(current?.finished || preview?.bestAlternative){renderLegacyCoach(active);return;}
  if(preview?.coach){$('#panel-content').innerHTML=coachHelpMarkup();return;}
  let html='<div class="coach-toolbar"><h2>Your coach</h2></div>';
  if(!current){$('#panel-content').innerHTML=html+'<p>Start a practice to explore your next moves.</p>';return;}
  if(!coaching().guidance){$('#panel-content').innerHTML=html+'<div class="coach-empty"><h3>Just you and the board.</h3><p>Play freely. Review afterward, or switch to Coached for guidance.</p></div>';return;}
  if(focus){
    const f=focus;
    html+=`<div class="feedback-card severity-${f.grade.severity}"><div class="feedback-top"><span class="move-token">${isFreePlay()?(new Chess(f.before).turn()==='w'?'White · ':'Black · '):''}${esc(f.san)}</span><strong>${esc(f.grade.label)}</strong><span class="feedback-symbol">${f.grade.severity>=1?'?!':'✓'}</span></div>${moveExplanationMarkup(f)}<div id="opponent-idea-slot">${opponentIdeaMarkup()}</div></div><div class="decision-buttons"><button class="button secondary" id="retry" ${busy?'disabled':''}>↶ Retry this move</button></div>`;
  }else html+=`<div id="opponent-idea-slot">${opponentIdeaMarkup()}</div><p class="next-moves-status">Make a move to see its feedback here.</p>`;
  ensureNextMoves();
  const fen=nextMovePosition();
  if(!fen){$('#panel-content').innerHTML=html+`<p class="next-moves-status">${game.isGameOver()?'Game over. Review your moves to learn from this game.':busy||!engineReady?'Thinking… Suggestions will follow.':positionEditor?'Finish arranging the position to see suggestions.':'Waiting for the opponent’s reply…'}</p>`;return;}
  html+=`<details class="next-options" data-next-options data-position="${esc(fen)}" ${nextExpandedFen===fen?'open':''}><summary>Explore my next moves <span>${new Chess(fen).turn()==='w'?'White':'Black'} to move</span></summary>`;
  if(nextMoves.stage==='loading')html+='<p class="next-moves-status" role="status">Finding five moves and their ideas…</p>';
  else if(nextMoves.stage==='error')html+='<p>No suggestions available yet.</p><button class="button secondary" data-next-retry>Try again</button>';
  else html+=`<div class="next-move-options">${nextMoves.choices.map((choice,i)=>{
    const {suggestion,grade}=choice,opening=openingForMove(fen,suggestion.uci);
    return `<article class="next-move-option"><div class="next-option-text"><div class="next-move-title"><span class="next-rank">${i+1}</span><strong>${esc(suggestion.san)}</strong><small>${i===0?'Best move':grade.severity===0?'Good alternative':'Less strong'}</small></div><p class="next-idea">${esc(shortMoveIdea(fen,choice.line))}</p></div>${miniLineMarkup(fen,suggestion.pv,flipped)}</article>`;
  }).join('')}</div><small class="next-moves-note">Tap Replay to see the move and a possible reply. Your game stays unchanged.</small>`;
  $('#panel-content').innerHTML=html+'</details>';
}
function renderLegacyCoach(active) {
  if(preview?.bestAlternative && matchMedia('(min-width:901px)').matches){$('#panel-content').innerHTML=`<section class="desktop-best-preview">${bestPreviewMarkup()}</section>`;return;}
  if(coachHelp?.quick&&!preview&&matchMedia('(min-width:901px)').matches){
    $('#panel-content').innerHTML=`<section class="desktop-question-coach"><span class="eyebrow">ASK COACH</span><h2>Let’s look at the board.</h2>${$('#mobile-quick-coach').innerHTML.replaceAll('id="quick-','id="desktop-quick-')}</section>`;return;
  }
  const f=focus, policy=coaching(),gentle=!policy.grades;
  let html=`<div class="coach-toolbar"><h2>Your coach</h2></div><div class="mobile-coach-tabs"><button class="button secondary ${mobileCoachView==='coach'?'active':''}" data-coach-view="coach" aria-pressed="${mobileCoachView==='coach'}">Feedback</button><button class="button secondary ${mobileCoachView==='five'?'active':''}" data-coach-view="five" aria-pressed="${mobileCoachView==='five'}">Top 5</button></div>`;

  html+=coachHelpMarkup();
  html+='<div class="coach-overview">';
  if (!coachOn && active && !awaiting) {
    html+=`<div class="coach-empty"><span class="empty-icon">♘</span><h3>Just you and the board.</h3><p>Play freely. Your moves are saved for the review. Bring the coach back whenever you like.</p></div>`;
  } else if (f && (coachOn || !active)) {
    const grade=f.grade;
    html+=`<div class="feedback-card ${gentle?'gentle-feedback':'severity-'+grade.severity}"><div class="feedback-top"><span class="move-token">${isFreePlay()?(new Chess(f.before).turn()==='w'?'White · ':'Black · '):''}${esc(f.san)}</span>${gentle?'<strong>The idea</strong>':`<strong>${esc(grade.label)}</strong><span class="feedback-symbol">${grade.severity>=1?'?!':'✓'}</span>`}</div>${gentle?`<p class="move-in-words">${esc(moveWords(f.before,f.uci))}</p><p>${esc(f.actual?explainCandidate(f.before,f.actual,playerLevel()):'Analysis was interrupted. Retry the move to explore its ideas.')}</p>`:moveExplanationMarkup(f)}<div id="opponent-idea-slot">${opponentIdeaMarkup()}</div></div>`;
    html+=`</div><div class="coach-candidates">${!gentle&&!current.finished?`<details class="optional-alternatives" ${mobileCoachView==='five'?'open':''}><summary>Explore five alternatives</summary>`:''}<div class="section-heading"><h3>Five ways forward</h3><span>Before your ${esc(f.san)}</span></div><div class="candidate-labels"><span>ENGINE CHOICE</span><span>WHITE EVAL.</span></div><div class="candidates">${f.lines.map((line,i)=>{
      const san=sanLine(f.before,line.pv,1)[0], mine=line.pv[0]===f.uci, opening=openingForMove(f.before,line.pv[0]);
      return `<button class="candidate ${mine?'your-move':''}" data-candidate="${i}" ${busy?'disabled':''}><span class="candidate-rank">${i+1}</span><span class="candidate-description"><span class="candidate-title"><strong>${esc(san)}</strong>${mine?'<span class="mine-label">YOUR MOVE</span>':''}</span><small class="move-translation">${esc(moveWords(f.before,line.pv[0]))}</small>${opening?`<small>${esc(opening.name)}</small>`:''}</span><span class="candidate-eval">${displayScore(line,new Chess(f.before).turn())}</span><span class="candidate-arrow">↗</span></button>`;
    }).join('')}</div><div id="candidate-explanation">${variationExplanation()}</div>${!gentle&&!current.finished?'</details>':''}`;
    html+=`</div><div class="coach-overview"><div class="decision-buttons"><button class="button secondary" id="retry" ${busy?'disabled':''}>↶ Retry this move</button>${f.actual?.pv?.length>1?`<button class="button secondary" id="show-punishment" ${busy?'disabled':''}>${gentle?'Explore continuation':'See strongest reply'} ↗</button>`:''}</div>`;

  } else {
    html+=`<div class="coach-empty"><div class="empty-board" aria-hidden="true">♘</div><h3>${current?'Your move. Your discovery.':'A good habit starts here.'}</h3><p>${current?'Make a move. Your coach will explain the idea and show a better option when there is one.':'Choose an opening and a worthy opponent. Your coach will help you understand the choices between moves.'}</p>${!current?'<button class="button primary" id="start-first">Start your first practice ↗</button>':''}</div>`;
  }
  html+='</div>';

  html+='<div class="coach-overview">';
  if(!f && (coachOn||!active))html+=`<div id="opponent-idea-slot">${opponentIdeaMarkup()}</div>`;
  if (current?.finished) html+=`<div class="review-banner"><strong>${esc(current.result || 'Practice saved')}</strong><p>Select a move in the Moves tab to revisit its position and coaching.</p><button class="button secondary" id="review-moves">Explore game moves →</button></div>`;
  $('#panel-content').innerHTML=html+'</div>';
}
function renderMoves() {
  if (!current) { $('#panel-content').innerHTML='<div class="coach-empty"><h3>Your story starts on move one.</h3><p>Start a practice to build your move history.</p></div>'; return; }
  const history=historyGame().history({verbose:true});
  if(current.finished){
    let review='<div class="review-story-heading"><h2>Every move has a story.</h2><p>Replay a moment. Learn its idea.</p></div><div class="review-story-cards">';
    review+=history.map((move,i)=>{
      const attempt=[...(current.attempts||[])].reverse().find(a=>a.ply===i&&a.uci===move.lan);
      const badge=attempt?moveBadge(attempt.grade):null;
      const pv=[move.lan,...(history[i+1]?[history[i+1].lan]:[])];
      return `<article class="next-move-option review-story-card"><div class="next-option-text"><button class="review-story-move" data-history="${i}" aria-label="Review ${move.color==='w'?'White':'Black'} ${move.san}"><strong>${Math.floor(i/2)+1}${move.color==='w'?'.':'…'} ${esc(move.san)}</strong>${badge?`<span class="review-story-grade grade-${badge.tone}">${esc(badge.symbol)} ${esc(badge.label)}</span>`:''}</button><p class="next-idea">${esc(shortMoveIdea(move.before,{pv}))}</p><small class="review-story-words">${esc(moveInWords(move))}</small></div>${miniLineMarkup(move.before,pv,flipped)}</article>`;
    }).join('');
    $('#panel-content').innerHTML=review+'</div>';return;
  }
  let html=`<div class="panel-intro"><h2>Your moves</h2><p>Tap a move to revisit it.</p></div><div class="move-table"><div class="move-table-head"><span>#</span><span>WHITE</span><span>BLACK</span></div>`;
  for(const row of historyRows(current)) html+=`<div class="move-row"><span>${row.number}</span>${[row.w,row.b].map(j=>{const m=j==null?null:history[j]; if(!m)return '<span></span>'; const a=coaching().grades?[...(current.attempts||[])].reverse().find(a=>a.ply===j && a.uci===m.lan):null; const manual=current.overrides?.some(o=>o.ply===j&&o.uci===m.lan); return `<div class="move-cell"><button data-history="${j}" class="${a?.grade.severity>=2?'bad-move':''}">${esc(m.san)} <span class="move-list-translation">${esc(moveInWords(m))}</span><small>${manual?'↳':a?.grade.severity>=2?'?':a?.grade.label==='Best move'?'✓':''}</small></button></div>`;}).join('')}</div>`;
  html+='</div>';
  if (!history.length) html+='<p class="muted panel-intro">Make your first move to begin.</p>';
  $('#panel-content').innerHTML=html;
}
function updateSetupMode() {
  const free=$('#setup-form').elements.mode.value==='free';
  $('#opponent-setting').hidden=free;
  $('#setup-side-label').textContent=free?'Board view':'Play as';
  const notes=$('.color-options').querySelectorAll('small');
  notes[0].textContent=free?'White at the bottom':'You make the first move';
  notes[1].textContent=free?'Black at the bottom':'Practise your response';
}
$('#setup-form').elements.mode.addEventListener('change',updateSetupMode);
function updateSetupCoachingDescription() {
  const mode=COACHING_MODES.find(m=>m.id===$('#setup-form').elements.coachingIntensity.value);
  $('#setup-coaching-description').textContent=mode.description;
}
function setup() {
  const form=$('#setup-form'), settings=state.settings;
  form.elements.coachingIntensity.value=savedIntensity(settings);
  updateSetupCoachingDescription();
  form.elements.mode.value=settings.mode==='free'?'free':'opponent';
  updateSetupMode();
  form.elements.opponent.value=settings.opponent;
  form.elements.color.value=settings.color;
  form.elements.opening.value=settings.opening;
  $('#setup').showModal();
}
async function startGame(event) {
  event.preventDefault();
  if(busy || !engineReady) return;
  const values=new FormData(event.target), opening=chooseOpening(values.get('opening'));
  state.settings={mode:values.get('mode'),coachingIntensity:values.get('coachingIntensity'),level:Number(values.get('opponent')),opponent:Number(values.get('opponent')),color:values.get('color'),opening:values.get('opening'),assess:false};
  if(current && !current.finished) { current.finished=true; current.result='Practice paused for a new game'; }
  const assess=false;
  current={id:crypto.randomUUID(),created:new Date().toISOString(),mode:values.get('mode'),coachingIntensity:values.get('coachingIntensity'),color:values.get('color'),opening:opening.id,level:Number(values.get('opponent')),opponent:Number(values.get('opponent')),assess,moves:[],attempts:[],finished:false,coach:values.get('coachingIntensity')!=='silent'};
  state.games.push(current); state.active=current.id; game=new Chess(); restoreCoaching(current); flipped=current.color==='b';
  generation++; awaiting=false; retrying=false; focus=null; preview=null; arrow=null; selected=null; tab='coach';
  $('#setup').close(); await persist(); render();
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
  if(current.color==='b') opponentTurn();
}
async function resetBoard() {
  if(busy || !engineReady || !current)return;
  const {color}=current;
  const opening=getOpening()?.id||chooseOpening(state.settings.opening).id;
  if(!current.finished){current.finished=true;current.result='Board reset · previous practice saved';}
  current=resetPractice(current,crypto.randomUUID(),{opening,coachingIntensity:intensity,coach:coachOn});
  state.games.push(current);state.active=current.id;game=new Chess();flipped=color==='b';
  generation++;positionEditor=null;coachHelp=null;dragState=null;$('#drag-piece')?.remove();awaiting=false;retrying=false;focus=null;preview=null;arrow=null;selected=null;mobileCoachView='coach';mobilePreviewExpanded=false;tab='coach';
  await persist();render();toast('Board reset. Ready for a fresh start.');
  if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
  if(color==='b')opponentTurn();
}
async function makeMove(from,to,promotion='q',recovered=null) {
  if(busy || awaiting || preview || !current || current.finished || !humanTurn()) return;
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
  if(!current || isFreePlay() || current.finished || game.turn()===current.color || busy) return;
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
function terminalResult() { if(isFreePlay())return game.isCheckmate()?`Checkmate · ${game.turn()==='w'?'Black':'White'} wins`:'Draw';return game.isCheckmate() ? (game.turn()===current.color?'Checkmate · your opponent wins':'Checkmate · you win') : 'Draw'; }
function finishGame(result=game.isGameOver()?terminalResult():'Practice ended · saved for review') {
  current.finished=true; current.result=result; awaiting=false; retrying=false; busy=false;
}
function retryMove() {
  if(busy || !focus || !current)return;
  const before=positionAt(current,focus.ply);
  if(before.fen()!==focus.before){toast('Choose this move in its original game to retry it.');return;}
  navigateHistory(focus.ply);forkFromHistory();
}
function continueGame() { if(busy || !current || current.finished)return; awaiting=false; preview=null; arrow=null; if(game.isGameOver())finishGame(); persist(); render(); if(!current.finished)opponentTurn(); }
function bestPreviewMarkup() {
  const p=preview,lesson=previewLesson(p.suggestion,p.step,playerLevel());
  if(!lesson)return '';
  return `<div class="best-preview-top"><span class="eyebrow">BEST MOVE PREVIEW · ${p.step}/${p.line.length}</span><button class="button subtle" data-best-return>Return to game ×</button></div><div class="best-preview-heading"><h3>${esc(lesson.heading)}</h3><div><button class="icon-button" data-best-step="-1" aria-label="Previous best-line move" ${p.step<=1?'disabled':''}>←</button><button class="icon-button" data-best-step="1" aria-label="Show opponent’s reply" ${p.step>=p.line.length?'disabled':''}>→</button></div></div><p class="preview-move-translation">${esc(lesson.words)}</p><p class="best-preview-reason" role="status">${esc(lesson.reason)}</p>${lesson.actor==='opponent'?`<p class="best-preview-plan"><strong>Possible plan:</strong> ${esc(lesson.plan)}</p>`:''}<small>${p.line.length===1?'No opponent reply in this saved line.':p.step<p.line.length?'Use → to see one engine reply.':'Use ← to revisit the best move.'} Preview only · your moves stay unchanged.</small>`;
}
function previewBestMove(ply,uci) {
  if(busy || !current || preview?.bestAlternative || coachHelp?.stage==='loading')return;
  const attempt=[...current.attempts].reverse().find(a=>a.ply===ply&&a.uci===uci);
  const result=bestMovePreview(current,attempt,playerLevel());
  if(!result){toast('No saved best-move line is available for this decision.');return;}
  const returnState={preview,coachHelp,focus,tab,mobileCoachView,mobilePreviewExpanded,arrow};
  closeGradePopover();coachHelp=null;preview={...result,returnState};arrow=null;selected=null;tab='coach';mobileCoachView='coach';render();
  if(matchMedia('(max-width:900px)').matches){const rect=$('#board').getBoundingClientRect();if(rect.top<0||rect.bottom>innerHeight-240)scrollToSection('board');}
}
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
  preview.fen=g.fen();if(preview.bestAlternative){arrow=null;render();return;} const next=preview.line[preview.step]; arrow=next?uciMove(next):null; drawBoard();
  const opening=openingAt(preview.fen);$('#opening-name').textContent=opening?`${opening.eco} · ${opening.name}`:'Engine continuation';
}
function returnToGame() {
  if(preview?.bestAlternative){const saved=preview.returnState;preview=saved.preview;coachHelp=saved.coachHelp;focus=saved.focus;tab=saved.tab;mobileCoachView=saved.mobileCoachView;mobilePreviewExpanded=saved.mobilePreviewExpanded;arrow=saved.arrow;selected=null;render();return;}
  if(preview?.coach){preview=coachHelp?.origin?structuredClone(coachHelp.origin):null;arrow=null;selected=null;render();return;}
  preview=null;arrow=null;selected=null;focus=current?.attempts.at(-1)||null;render();
}
function navigateHistory(ply) {
  if(!current || busy)return;
  const total=current.moves.length,count=Math.max(0,Math.min(total,ply));
  if(count===total){returnToGame();return;}
  const earlier=positionAt(current,count),last=earlier.history({verbose:true}).at(-1);
  preview={fen:earlier.fen(),historyPly:count,label:last?`After ${last.before.split(' ')[5]}${last.color==='w'?'.':'…'} ${last.san}`:'Starting position'};
  arrow=null;selected=null;
  focus=[...current.attempts].reverse().find(a=>a.ply<count && a.before===positionAt(current,a.ply).fen())||null;
  render();
}
function stepHistory(delta) { navigateHistory((preview?.historyPly ?? current?.moves.length ?? 0)+delta); }
async function applyOpponentReplacement(from,to,promotion=null) {
  if(busy || !preview?.opponentEdit)return;
  const legal=shownGame().moves({square:from,verbose:true}).filter(m=>m.to===to);
  if(!legal.length){selected=null;drawBoard();return;}
  if(legal.some(m=>m.promotion) && !promotion){choosePromotion(from,to,applyOpponentReplacement);return;}
  try {
    const edit=preview.opponentEdit;
    const branch=replaceOpponentLine(current,edit.ply,`${from}${to}${promotion||''}`,crypto.randomUUID());
    current=branch;state.games.push(branch);state.active=branch.id;game=historyGame();generation++;
    restoreCoaching(branch);awaiting=false;retrying=true;preview=null;arrow=null;selected=null;focus=branch.attempts.at(-1)||null;tab='coach';
    if(game.isGameOver())finishGame(terminalResult());
    await persist();render();toast(`What if ${branch.overrides.at(-1).san}? Your original game is saved. It’s your turn to respond.`);
    if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
  }catch(error){toast(error.message);}
}
function forkFromHistory(autoReply=true) {
  if(busy || preview?.historyPly==null || new Chess(preview.fen).isGameOver())return;
  const branch=forkSession(current,preview.historyPly,crypto.randomUUID());
  current=branch;state.games.push(branch);state.active=branch.id;game=historyGame();generation++;
  restoreCoaching(branch);awaiting=false;retrying=true;preview=null;arrow=null;selected=null;focus=branch.attempts.at(-1)||null;tab='coach';
  persist();render();toast('Alternate line started. Your original game is saved in this device.');
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
function openRecord(id) {
  if(busy)return; const record=state.games.find(g=>g.id===id);if(!record)return;
  current=record;game=historyGame();state.active=id;restoreCoaching(current);flipped=current.color==='b';focus=current.attempts.at(-1)||null;
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
function startPositionEditor() {
  if(busy || !current || positionEditor)return;
  positionEditor={fen:shownGame().fen(),turn:shownGame().turn(),past:[],sourcePreview:preview?structuredClone(preview):null,sourceHelp:coachHelp?.stage==='loading'?null:coachHelp,sourceArrow:arrow};
  preview=null;coachHelp=null;arrow=null;selected=null;
  $('#position-editor-error').hidden=true;render();
  if(matchMedia('(max-width:900px)').matches)$('.play-area').scrollIntoView({behavior:'instant',block:'start'});
}
function applyPositionEdit(from,to) {
  if(!positionEditor)return;
  try{const next=moveDraftPiece(positionEditor.fen,from,to);if(next!==positionEditor.fen){positionEditor.past.push(positionEditor.fen);positionEditor.fen=next;}$('#position-editor-error').hidden=true;}
  catch(error){$('#position-editor-error').textContent=error.message;$('#position-editor-error').hidden=false;}
  selected=null;render();
}
function undoPositionEdit() {
  if(!positionEditor?.past.length)return;
  positionEditor.fen=positionEditor.past.pop();$('#position-editor-error').hidden=true;selected=null;render();
}
function cancelPositionEditor() {
  if(!positionEditor)return;
  const draft=positionEditor;positionEditor=null;preview=draft.sourcePreview;coachHelp=draft.sourceHelp;arrow=draft.sourceArrow;selected=null;render();
}
async function resumeEditedPosition() {
  if(!positionEditor)return;
  try{
    const record=editedSession({...current,coachingIntensity:intensity,coach:coachOn},positionEditor.fen,positionEditor.turn,crypto.randomUUID());
    positionEditor=null;current=record;state.games.push(record);state.active=record.id;game=historyGame();generation++;
    preview=null;coachHelp=null;arrow=null;selected=null;focus=null;awaiting=false;retrying=true;tab='coach';flipped=current.color==='b';
    if(game.isGameOver())finishGame(terminalResult());
    await persist();render();toast(`Position ready. ${current.color==='w'?'White':'Black'} to play. Your original game is saved.`);
    if(matchMedia('(max-width:900px)').matches)scrollToSection('board');
  }catch(error){$('#position-editor-error').textContent=error.message;$('#position-editor-error').hidden=false;}
}
function canDragToEdit() {
  return !!current && !busy && !positionEditor && !preview?.line && !preview?.opponentEdit;
}
function canMoveOnBoard() {
  if(positionEditor)return !busy;
  if(busy || !current || preview?.line)return false;
  if(preview?.opponentEdit)return !shownGame().isGameOver();
  if(preview?.historyPly!=null)return humanTurn(new Chess(preview.fen));
  return !current.finished && humanTurn();
}
function playBoardMove(from,to) {
  if(positionEditor){applyPositionEdit(from,to);return;}
  if(!canMoveOnBoard())return;
  const shown=shownGame();
  if(!shown.moves({square:from,verbose:true}).some(m=>m.to===to)){selected=null;drawBoard();return;}
  if(preview?.opponentEdit){applyOpponentReplacement(from,to);return;}
  if(preview?.historyPly!=null)forkFromHistory(false);
  makeMove(from,to);
}
$('#board').addEventListener('click',e=>{
  if(performance.now()<suppressClickUntil)return;
  const square=e.target.closest('[data-square]')?.dataset.square;
  if(!square || !canMoveOnBoard())return;
  const shown=shownGame();
  if(positionEditor){
    if(selected && selected!==square && (!shown.get(square)||shown.get(square).color!==shown.get(selected)?.color)){applyPositionEdit(selected,square);return;}
    selected=shown.get(square)?(selected===square?null:square):null;drawBoard();return;
  }
  if(selected && shown.moves({square:selected,verbose:true}).some(m=>m.to===square)){playBoardMove(selected,square);return;}
  selected=shown.get(square)?.color===moveColor() ? (selected===square?null:square) : null;drawBoard();
});
$('#board-quality-overlay').addEventListener('dragstart',e=>e.preventDefault());
$('#board-quality-overlay').addEventListener('pointerdown',e=>{
  if(e.button!==0 || (!canMoveOnBoard()&&!canDragToEdit()))return;
  const from=e.target.closest('[data-grade-square]')?.dataset.gradeSquare;
  const piece=from?shownGame().get(from):null;
  if(!piece || (!positionEditor && !canDragToEdit() && piece.color!==moveColor()))return;
  dragState={from,piece,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false,freeEditAllowed:canDragToEdit()};
});
$('#board').addEventListener('dragstart',e=>e.preventDefault());
$('#board').addEventListener('pointerdown',e=>{
  if(e.button!==0 || (!canMoveOnBoard()&&!canDragToEdit()))return;
  const from=e.target.closest('[data-square]')?.dataset.square;
  const shown=shownGame(),piece=from?shown.get(from):null;
  if(!piece || (!positionEditor && !canDragToEdit() && piece.color!==moveColor()))return;
  dragState={from,piece,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false,freeEditAllowed:canDragToEdit()};
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
  if(!cancelled && to && to!==drag.from){
    if(positionEditor){applyPositionEdit(drag.from,to);return;}
    const shown=shownGame(),legal=shown.moves({square:drag.from,verbose:true}).some(m=>m.to===to);
    if(drag.freeEditAllowed && (!legal || drag.piece.color!==moveColor() || current.finished)){
      const target=shown.get(to);
      if(target && (target.color===drag.piece.color||target.type==='k')){selected=null;drawBoard();return;}
      startPositionEditor();applyPositionEdit(drag.from,to);
    }else playBoardMove(drag.from,to);
  }
  else {selected=null;drawBoard();}
}
document.addEventListener('pointerup',e=>releaseDrag(e));
document.addEventListener('pointercancel',e=>releaseDrag(e,true));
window.addEventListener('blur',()=>{if(dragState)releaseDrag({pointerId:dragState.pointerId,clientX:0,clientY:0},true);});
let miniReplayTimer;
function stopMiniReplay(){clearInterval(miniReplayTimer);miniReplayTimer=null;for(const mini of document.querySelectorAll('.mini-line-preview')){const btn=mini.querySelector('[data-mini-replay]');btn.setAttribute('aria-pressed','false');btn.textContent='▶ Replay';}}
function replayMini(button){
  const mini=button.closest('.mini-line-preview'),wasPlaying=button.getAttribute('aria-pressed')==='true';stopMiniReplay();if(wasPlaying)return;
  const frames=[...mini.querySelectorAll('[data-mini-frame]')],labels=[...mini.querySelectorAll('.mini-frame-labels span')];let index=0;
  const paint=()=>{frames.forEach((frame,i)=>frame.classList.toggle('is-current',i===index));mini.dataset.miniIndex=index;mini.querySelector('.mini-caption').textContent=labels[index].textContent;};
  paint();button.setAttribute('aria-pressed','true');button.textContent='Ⅱ Pause';
  miniReplayTimer=setInterval(()=>{if(!mini.isConnected){stopMiniReplay();return;}index++;if(index>=frames.length){stopMiniReplay();return;}paint();},1100);
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b || b.disabled)return;
  if(positionEditor && !['editor-resume','editor-undo','editor-cancel','flip','reset-board'].includes(b.id)){toast('Resume or cancel your position edits first.');return;}
  if(b.hasAttribute('data-mini-replay')){replayMini(b);return;}
  if(b.hasAttribute('data-best-return')){returnToGame();return;}
  if(b.dataset.bestStep){stepPreview(Number(b.dataset.bestStep));return;}
  if(b.dataset.bestPly!=null){previewBestMove(Number(b.dataset.bestPly),b.dataset.bestUci);return;}
  if(b.dataset.showFive){tab='coach';mobileCoachView='five';render();return;}
  if(b.dataset.coachView){mobileCoachView=b.dataset.coachView;render();return;}
  if(b.dataset.coachQuestion){if(coachHelp?.suggestion){coachHelp.question=b.dataset.coachQuestion;arrow=null;render();}return;}
  if(b.dataset.close){$('#'+b.dataset.close).close();return;}
  if(b.dataset.jump){
    mobileDestination=b.dataset.jump;
    if(mobileDestination!=='board')tab=mobileDestination;
    render();
    scrollToSection(mobileDestination);
    return;
  }
  if(b.dataset.tab){tab=b.dataset.tab;mobileDestination=tab;render();return;} if(b.dataset.panel){tab=b.dataset.panel;if(tab==='coach')mobileCoachView='coach';mobileDestination=tab;render();return;}
  if(b.hasAttribute('data-next-retry')){nextMoves=null;render();return;}
  if(b.dataset.candidate!=null){showCandidate(Number(b.dataset.candidate));return;}
  if(b.dataset.history!=null){viewHistory(Number(b.dataset.history));return;} if(b.dataset.game){$('#info').close();openRecord(b.dataset.game);return;}
  const actions={ 'editor-resume':resumeEditedPosition,'editor-undo':undoPositionEdit,'editor-cancel':cancelPositionEditor,'piece-grade-close':()=>closeGradePopover(true),'piece-grade-retry':()=>{closeGradePopover();retryMove();},'piece-move-grade':toggleGradeExplanation,'mobile-move-grade':toggleGradeExplanation,'desktop-grade-retry':retryMove,'mobile-grade-retry':retryMove,'mobile-best-move':showBestDirection,'quick-choice-back':()=>chooseQuickAlternative(-1),'quick-choice-next':()=>chooseQuickAlternative(1),'quick-close':()=>{coachHelp=null;arrow=null;render();},'quick-choice-preview':()=>previewCoachMove(1),'quick-choice-play':playCoachMove,'mobile-preview-back':()=>stepPreview(-1),'mobile-preview-next':()=>stepPreview(1),'mobile-preview-return':returnToGame,'mobile-preview-details':togglePreviewExplanation,'ask-coach':askCoach,'mobile-ask-coach':()=>askCoach({direct:true}),'coach-show-move':()=>revealCoachMove(),'coach-preview-move':()=>previewCoachMove(1),'coach-preview-reply':()=>previewCoachMove(2),'coach-play-move':playCoachMove,'coach-dismiss':dismissCoachHelp,'coach-retry-help':()=>{coachHelp=null;askCoach();},'mobile-back-board':()=>scrollToSection('board'),'new-game':setup,'start-first':setup,'reset-board':resetBoard,flip:()=>{flipped=!flipped;drawBoard();},retry:retryMove,continue:continueGame,'resume-opponent':opponentTurn,
    'exit-preview':returnToGame,'cancel-opponent-edit':returnToGame,'explain-evaluation':explainEvaluation,'retry-evaluation':()=>{$('#info').close();positionAnalysis.retry(shownGame().fen());},'line-back':()=>stepPreview(-1),'line-next':()=>stepPreview(1),'history-start':()=>navigateHistory(0),'history-back':()=>stepHistory(-1),'history-next':()=>stepHistory(1),'history-live':returnToGame,'play-from-here':forkFromHistory,'show-punishment':showPlayedLine,
    'review-moves':()=>{tab='moves';render();},'review-game':()=>{if(!current||busy)return;finishGame();tab='moves';persist();render();},about:()=>{
      $('#info-body').innerHTML='<h2>A practice room of your own.</h2><p>Between Moves runs chess analysis on your device using Stockfish 19 Lite. Coaching uses programmed rules and verified engine continuations, with no AI API.</p><p>Games, retries, and learning history are stored in this browser using IndexedDB. No accounts, analytics, or game uploads. Your host still handles ordinary website requests.</p><p>Games stay in this browser. Clearing browser data or changing browsers or devices won’t carry them over.</p><p>Opponent ratings are approximate targets. Positional explanations and practice book lines have limited coverage. Opening recognition uses the local Lichess opening-name database (CC0).</p><p>Stockfish.js is distributed under GPLv3. <a href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1" target="_blank" rel="noreferrer">Engine source</a> · <a href="./engine/COPYING.txt" target="_blank">Engine licence</a>. Chess rules by chess.js (BSD-2-Clause).</p>';
      $('#info').showModal();
    }
  }; actions[b.id.replace(/^desktop-quick-/,'quick-')]?.();
});
document.addEventListener('change',e=>{
  if(e.target.name==='coachingIntensity')updateSetupCoachingDescription();
  if(e.target.id==='editor-turn' && positionEditor){positionEditor.turn=e.target.value;$('#editor-resume').textContent=`Resume · ${e.target.value==='w'?'White':'Black'} to play`;}
  if(e.target.id==='coaching-intensity'){
    intensity=e.target.value;coachOn=intensity!=='silent';
    if(current){current.coachingIntensity=intensity;current.coach=coachOn;}
    state.settings.coachingIntensity=intensity;
    closeGradePopover();coachHelp=null;arrow=null;
    if(preview?.line)preview=null;
    mobileCoachView='coach';persist();render();
  }
});
document.addEventListener('toggle',e=>{if(e.target.matches('[data-next-options]'))nextExpandedFen=e.target.open?e.target.dataset.position:null;},true);
document.addEventListener('pointerdown',e=>{gradeTriggerWasOpen=!!e.target.closest('#piece-move-grade,#mobile-move-grade') && $('#piece-grade-popover').matches(':popover-open');},true);
$('#piece-grade-popover').addEventListener('toggle',e=>{if(e.newState==='closed'){mobileGradeOpen=false;for(const b of document.querySelectorAll('[aria-controls="piece-grade-popover"]'))b.setAttribute('aria-expanded','false');}});
window.addEventListener('scroll',()=>closeGradePopover(),{passive:true});
let resizeFrame;
window.addEventListener('resize',()=>{closeGradePopover();cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(render);});
document.addEventListener('keydown',e=>{if(positionEditor){if(e.key==='Escape')cancelPositionEditor();return;}if(e.key==='Escape' && $('#piece-grade-popover').matches(':popover-open')){e.preventDefault();closeGradePopover(true);return;}if(e.target.matches('input,select,textarea')||$('dialog[open]'))return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(preview?.line)stepPreview(e.key==='ArrowLeft'?-1:1);else stepHistory(e.key==='ArrowLeft'?-1:1);} if(e.key==='Escape'&&preview)returnToGame();});
try {
  db=await openStore();state=await readState(db);
  const active=state.games.find(g=>g.id===state.active);
  if(active){current=active;game=historyGame();restoreCoaching(current);flipped=current.color==='b';focus=current.attempts.at(-1)||null;retrying=!!current.retrying;awaiting=false;}
  render();resumeSession();
  if(!state.games.length)setup();
} catch(error) {
  state={version:1,games:[],settings:{level:1350,opponent:1350,color:'w',opening:'random'}};render();toast('Browser storage is unavailable. You can play, but your game will not be saved.');
}
