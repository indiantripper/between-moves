import { Chess } from 'chess.js';
import { uciMove, PIECE_NAMES } from './coach.js';

// Short, position-verified ideas for the next-move cards.
export function shortMoveIdea(fen,line) {
  try {
    const before=new Chess(fen),after=new Chess(fen),move=after.move(uciMove(line.pv[0]));
    if(after.isCheckmate())return 'Deliver checkmate: the king cannot escape.';
    if(move.promotion)return `Promote your pawn to a ${PIECE_NAMES[move.promotion]}.`;
    if(move.flags.includes('k')||move.flags.includes('q'))return 'Protect your king; activate your rook.';
    if(move.captured)return `Capture the ${PIECE_NAMES[move.captured]} on ${move.to}.`;
    if(after.isCheck())return 'Give check and force a response.';
    const enemy=move.color==='w'?'b':'w';
    const targets=after.board().flat().filter(p=>p&&p.color===enemy&&p.type!=='k'&&after.attackers(p.square,move.color).includes(move.to));
    if(targets[0])return `Attack the ${PIECE_NAMES[targets[0].type]} on ${targets[0].square}.`;
    const supported=after.board().flat().find(p=>p&&p.color===move.color&&p.square!==move.to&&p.type!=='k'&&before.isAttacked(p.square,enemy)&&after.attackers(p.square,move.color).includes(move.to)&&!before.attackers(p.square,move.color).includes(move.from));
    if(supported)return `Defend your ${PIECE_NAMES[supported.type]} on ${supported.square}.`;
    if(['g3','g6','b3','b6'].includes(move.to)&&move.piece==='p'){
      const square=(move.to[0]==='g'?'f':'c')+(move.color==='w'?'1':'8');
      if(after.get(square)?.type==='b')return 'Make room to develop your bishop.';
    }
    if(move.piece==='p'&&['d4','d5','e4','e5'].includes(move.to))return 'Claim more space in the centre.';
    const central=['d4','d5','e4','e5'].filter(square=>after.attackers(square,move.color).includes(move.to));
    if(['n','b'].includes(move.piece)&&move.from[1]===(move.color==='w'?'1':'8'))return central.length?'Develop a piece; control the centre.':`Bring your ${PIECE_NAMES[move.piece]} into play.`;
    if(central.length)return 'Increase your control of the centre.';
    if(move.piece==='p'){
      const rank=Number(move.to[1])+(move.color==='w'?1:-1),file=move.to.charCodeAt(0)-97;
      const squares=[file-1,file+1].filter(f=>f>=0&&f<8).map(f=>String.fromCharCode(97+f)+rank);
      return `Control ${squares.join(' and ')} with your pawn.`;
    }
    return 'Reposition your piece; compare possible replies.';
  }catch{return 'Check the continuation before you decide.';}
}
