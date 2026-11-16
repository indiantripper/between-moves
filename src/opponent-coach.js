import { Chess } from 'chess.js';
import { PIECE_NAMES, uciMove } from './coach.js';

const VALUE={p:1,n:3,b:3,r:5,q:9,k:100};
const name=color=>color==='w'?'White':'Black';
const targetName=p=>`your ${PIECE_NAMES[p.type]} on ${p.square}`;
const squares=Array.from({length:64},(_,i)=>'abcdefgh'[i%8]+(1+Math.floor(i/8)));

export function pinBehind(game,move){
  const directions=[];
  if('bq'.includes(move.piece))directions.push([1,1],[1,-1],[-1,1],[-1,-1]);
  if('rq'.includes(move.piece))directions.push([1,0],[-1,0],[0,1],[0,-1]);
  for(const [dx,dy] of directions){
    let x=move.to.charCodeAt(0)-97,y=Number(move.to[1])-1,first=null;
    while((x+=dx)>=0&&x<8&&(y+=dy)>=0&&y<8){
      const square='abcdefgh'[x]+(y+1),p=game.get(square);if(!p)continue;
      if(p.color===move.color)break;
      if(!first){if(p.type==='k')break;first={...p,square};continue;}
      if(p.type==='k')return {piece:first,behind:'king',behindSquare:square};
      if(p.type==='q'&&VALUE[first.type]<9)return {piece:first,behind:'queen',behindSquare:square};
      break;
    }
  }
  return null;
}

function plainMove(move,possessive){
  if(move.flags.includes('k'))return 'castle on the kingside';
  if(move.flags.includes('q'))return 'castle on the queenside';
  if(move.promotion)return `promote ${possessive} pawn to a ${PIECE_NAMES[move.promotion]}`;
  if(move.captured)return `capture on ${move.to} with ${possessive} ${PIECE_NAMES[move.piece]}${move.san.includes('+')?' and give check':''}`;
  return `${move.piece==='p'?'push':'move'} ${possessive} ${PIECE_NAMES[move.piece]} to ${move.to}${move.san.includes('+')?' and give check':''}`;
}

export function explainOpponentMove({before,uci,previousMove=null,analysis=null,level=1350}){
  const prior=new Chess(before),after=new Chess(before);let move;
  try{move=after.move(uciMove(uci));}catch{return null;}
  const side=name(move.color),enemy=move.color==='w'?'b':'w',piece=PIECE_NAMES[move.piece];
  const threats=after.board().flat().filter(p=>p&&p.color===enemy&&after.attackers(p.square,move.color).includes(move.to)&&!prior.attackers(p.square,move.color).includes(move.from)).sort((a,b)=>VALUE[b.type]-VALUE[a.type]);
  const pin=pinBehind(after,move),valuable=threats.filter(p=>p.type!=='p');
  let reason='',plan='',watch='';
  if(after.isCheckmate())return {side,san:move.san,reason:`${side} gives checkmate: your king has no legal escape.`,plan:'The mating attack has finished the game.',watch:''};
  if(pin){
    reason=`${side} lines up the ${piece} with ${targetName(pin.piece)} and your ${pin.behind} behind it.`;
    plan=pin.behind==='king'?'Keep that piece tied to defending the king, then increase the pressure.':'Make it difficult to move that piece without exposing the queen.';
    watch=pin.behind==='king'?`Moving the ${PIECE_NAMES[pin.piece.type]} off this line would expose your king to check.`:`Check the queen behind your ${PIECE_NAMES[pin.piece.type]} before moving it.`;
  }else if(valuable.length>=2){
    reason=`${side} creates a fork: the ${piece} attacks ${valuable.slice(0,2).map(targetName).join(' and ')}.`;
    plan=level<1000?'Attack two valuable targets at once, hoping you cannot save both.':'Use the double attack to win material or force a concession.';
    watch=after.isCheck()?'Your king is in check, so your reply must deal with that first.':'Check for a forcing response before deciding which piece to save.';
  }else if(after.isCheck()){
    reason=`${side} checks your king with ${move.san}.`;
    plan='Force you to answer the check before continuing your own plan.';
    watch='Your next move must remove or escape the check.';
  }else if(move.promotion){
    reason=`${side} promotes the pawn to a ${PIECE_NAMES[move.promotion]}, adding much more power to that piece.`;
    plan='Use the promoted piece to create threats and convert the pawn advance into an advantage.';
  }else if(move.captured){
    const recapture=previousMove?.captured&&previousMove.to===move.to;
    reason=`${side} ${recapture?'recaptures':'captures'} on ${move.to}, taking your ${PIECE_NAMES[move.captured]}${['d4','e4','d5','e5'].includes(move.to)?' out of the centre':''}.`;
    plan=recapture?'Answer your capture and contest the square where the exchange is happening.':'Remove that piece or pawn and change the material balance.';
  }else if(move.flags.includes('k')||move.flags.includes('q')){
    reason=`${side} castles, moving the king to ${move.to} and bringing a rook closer to the centre.`;
    plan='Reduce the king’s exposure and get the rook ready to join the game.';
  }else if(threats[0]&&VALUE[threats[0].type]>=3){
    reason=`${side} attacks ${targetName(threats[0])} with the ${piece}.`;
    plan='Gain time by making you address the attack.';
    watch=`Check the threat to your ${PIECE_NAMES[threats[0].type]} before starting another plan.`;
  }else if(prior.isAttacked(move.from,enemy)&&!after.isAttacked(move.to,enemy)&&move.piece!=='p'){
    reason=`${side} moves the ${piece} away from an attacked square to ${move.to}.`;
    plan='Keep that piece in play rather than leave it under attack.';
  }else if('nb'.includes(move.piece)&&move.from[1]===(move.color==='w'?'1':'8')){
    reason=`${side} brings the ${piece} out from its starting square to ${move.to}${threats[0]?`, attacking ${targetName(threats[0])}`:''}.`;
    plan='Get pieces into play and increase influence over the centre.';
    const rank=move.color==='w'?'1':'8',right=move.color==='w'?'K':'k';
    if(['f'+rank,'g'+rank].includes(move.from)&&after.fen().split(' ')[2].includes(right)&&after.get('e'+rank)?.type==='k'&&after.get('h'+rank)?.type==='r'&&!after.get('f'+rank)&&!after.get('g'+rank)){
      reason+=' This also clears the path for kingside castling.';
      plan='Prepare to castle on the kingside and bring the rook into play.';
    }
  }else{
    const defended=after.board().flat().filter(p=>p&&p.color===move.color&&p.type!=='k'&&p.square!==move.to&&after.attackers(p.square,move.color).includes(move.to)&&!prior.attackers(p.square,move.color).includes(move.from)).sort((a,b)=>Number(prior.isAttacked(b.square,enemy))-Number(prior.isAttacked(a.square,enemy))||VALUE[b.type]-VALUE[a.type]);
    const fianchetto=move.piece==='p'&&((move.color==='b'&&['g6','b6'].includes(move.to))||(move.color==='w'&&['g3','b3'].includes(move.to)));
    const bishopSquare=(move.to[0]==='g'?'f':'c')+(move.color==='w'?'1':'8');
    if(defended[0]){
      reason=`${side} adds a defender to the ${PIECE_NAMES[defended[0].type]} on ${defended[0].square}.`;
      plan=`Support that ${PIECE_NAMES[defended[0].type]} and make it harder for you to capture it profitably.`;
    }else if(move.piece==='p'&&['d4','e4','d5','e5'].includes(move.to)){
      reason=`${side} puts a pawn in the centre on ${move.to}${threats[0]?`, challenging ${targetName(threats[0])}`:''}.`;
      plan='Contest the centre and build space for the other pieces.';
    }else if(fianchetto&&after.get(bishopSquare)?.type==='b'&&after.get(bishopSquare)?.color===move.color){
      const entry=move.to[0]+(move.color==='w'?'2':'7');
      reason=`${side} opens ${entry} for the bishop on ${bishopSquare}.`;
      plan=`Develop that bishop to ${entry}, pointing it along the long diagonal towards the centre.`;
    }else if(move.piece==='r'&&!after.board().flat().some(p=>p?.type==='p'&&p.color===move.color&&p.square[0]===move.to[0])){
      const open=!after.board().flat().some(p=>p?.type==='p'&&p.square[0]===move.to[0]);
      reason=`${side} puts the rook on the ${open?'open':'semi-open'} ${move.to[0]}-file, which has ${open?'no pawns':'no friendly pawns'}.`;
      plan='Build pressure down that file and look for a way into your position.';
    }else{
      const bishop=move.piece==='p'?after.board().flat().find(p=>p?.type==='b'&&p.color===move.color&&prior.get(p.square)?.type==='b'&&squares.some(s=>after.attackers(s,move.color).includes(p.square)&&!prior.attackers(s,move.color).includes(p.square))):null;
      if(bishop){reason=`${side} opens a diagonal for the bishop on ${bishop.square}.`;plan='Make room to bring that bishop into play.';}
      else if(move.piece==='p'){
        const controlled=squares.filter(s=>after.attackers(s,move.color).includes(move.to));
        const central=controlled.filter(s=>['d4','e4','d5','e5'].includes(s));
        reason=`${side} advances the pawn to ${move.to}, controlling ${(central.length?central:controlled).join(' and ')}.`;
        plan=central.length?`Challenge the centre and contest ${central.join(' and ')} from the side.`:'Gain space and make those squares less comfortable for your pieces.';
      }
      else if(threats[0]){reason=`${side} puts pressure on ${targetName(threats[0])}.`;plan='Make you take account of that attack when choosing your next move.';}
      else{reason=`${side} repositions the ${piece} to ${move.to}.`;plan='A specific tactical purpose is not clear from the move alone; compare the continuation before assuming a threat.';}
    }
  }
  // A continuation is conditional on the user's reply, never a claim to know the opponent's mind.
  if(analysis?.fen===after.fen()&&analysis.line){
    if(analysis.line.mate>0)watch=`The engine finds a forced mate in ${analysis.line.mate} for you. Look for the forcing checks.`;
    else if(analysis.line.mate<0)watch=`The engine finds a mating attack for ${side}; inspect the strongest reply before continuing.`;
    else if(!pin&&valuable.length<2&&analysis.line.pv?.length>=2){
      const continuation=new Chess(after.fen());
      try{
        const response=continuation.move(uciMove(analysis.line.pv[0])),followup=continuation.move(uciMove(analysis.line.pv[1]));
        plan=`If you ${plainMove(response,'your')}, ${side} could ${plainMove(followup,'its')}.`;
      }catch{/* Keep the supported general idea when the supplied line is incomplete or illegal. */}
    }
  }
  if(!watch&&threats[0]&&after.attackers(threats[0].square,enemy).length===0&&threats[0].type!=='k')watch=`Your ${PIECE_NAMES[threats[0].type]} on ${threats[0].square} is attacked and has no defender.`;
  if(after.isCheck())watch='Your king is in check; your next move must answer it.';
  return {side,san:move.san,reason,plan,watch};
}
