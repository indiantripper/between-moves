import { Chess } from 'chess.js';
import openingIndex from './data/opening-index.json' with { type:'json' };

export const OPENINGS = [
  { id: 'random', name: 'Surprise me', description: 'A different opening, a new perspective.' },
  { id: 'italian', name: 'Italian Game', description: 'Develop naturally. Fight for the centre.', lines: [
    ['e4','e5','Nf3','Nc6','Bc4','Bc5','c3','Nf6','d3','d6'],
    ['e4','e5','Nf3','Nc6','Bc4','Nf6','d3','Bc5','O-O','d6'],
    ['e4','e5','Nf3','Nc6','Bc4','Bc5','b4','Bxb4','c3','Ba5'] ] },
  { id: 'ruy', name: 'Ruy Lopez', description: 'Build pressure with a patient Spanish setup.', lines: [
    ['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6','O-O','Be7','Re1','b5','Bb3','d6'],
    ['e4','e5','Nf3','Nc6','Bb5','Nf6','O-O','Nxe4','d4','Nd6'] ] },
  { id: 'sicilian', name: 'Sicilian Defence', description: 'An unbalanced fight against 1.e4.', lines: [
    ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6'],
    ['e4','c5','Nf3','Nc6','d4','cxd4','Nxd4','g6','Nc3','Bg7'],
    ['e4','c5','Nf3','e6','d4','cxd4','Nxd4','Nc6','Nc3','Qc7'] ] },
  { id: 'queens', name: 'Queen’s Gambit', description: 'Challenge the centre with your c-pawn.', lines: [
    ['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7','e3','O-O'],
    ['d4','d5','c4','dxc4','Nf3','Nf6','e3','e6','Bxc4','c5'],
    ['d4','d5','c4','c6','Nf3','Nf6','Nc3','e6'] ] },
  { id: 'caro', name: 'Caro–Kann Defence', description: 'Build a solid centre against 1.e4.', lines: [
    ['e4','c6','d4','d5','e5','Bf5','Nf3','e6'],
    ['e4','c6','d4','d5','Nc3','dxe4','Nxe4','Bf5'],
    ['e4','c6','d4','d5','exd5','cxd5','Bd3','Nc6'] ] },
  { id: 'french', name: 'French Defence', description: 'A solid centre, followed by counterplay.', lines: [
    ['e4','e6','d4','d5','Nc3','Nf6','e5','Nfd7'],
    ['e4','e6','d4','d5','e5','c5','c3','Nc6'],
    ['e4','e6','d4','d5','exd5','exd5','Nf3','Nf6'] ] },
  { id: 'ponziani', name: 'Ponziani Opening', description: 'Support a central pawn advance with c3.', lines: [
    ['e4','e5','Nf3','Nc6','c3','Nf6','d4','Nxe4','d5','Ne7'],
    ['e4','e5','Nf3','Nc6','c3','d5','Qa4','f6'] ] },
  { id: 'indian', name: 'Indian Game', description: 'Meet 1.d4 with flexible knight development.', lines: [
    ['d4','Nf6','c4','e6','Nf3','b6','g3','Bb7','Bg2','Be7'],
    ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','Nf3','O-O'] ] },
  { id: 'kings-indian', name: 'King’s Indian Defence', description: 'A kingside fianchetto against White’s centre.', lines: [
    ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','Nf3','O-O','Be2','e5'],
    ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','f3','O-O'] ] },
  { id: 'nimzo', name: 'Nimzo-Indian Defence', description: 'Pin the knight and challenge the centre.', lines: [
    ['d4','Nf6','c4','e6','Nc3','Bb4','e3','O-O','Bd3','d5'],
    ['d4','Nf6','c4','e6','Nc3','Bb4','Qc2','O-O','a3','Bxc3+'] ] },
  { id: 'london', name: 'London System', description: 'A familiar setup with a clear plan.', lines: [
    ['d4','d5','Bf4','Nf6','e3','e6','Nf3','Bd6','Bg3','O-O'],
    ['d4','Nf6','Bf4','g6','e3','Bg7','Nf3','O-O','Be2','d6'] ] }
];

const positionKey=fen=>fen.split(' ').slice(0,4).join(' ');
export function openingAt(fen) { return openingIndex[positionKey(fen)] || null; }
export function identifyOpening(game) {
  const history=game.history({verbose:true}),positions=[history[0]?.before||game.fen(),...history.map(m=>m.after)];
  for(let ply=positions.length-1;ply>=0;ply--){
    const opening=openingAt(positions[ply]);
    if(opening)return {...opening,ply,exact:ply===positions.length-1};
  }
  return null;
}
export function openingForMove(fen,uci) {
  const game=new Chess(fen);
  try { game.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci[4]?{promotion:uci[4]}:{})});return openingAt(game.fen()); }
  catch { return null; }
}

export function chooseOpening(id) {
  return OPENINGS.find(o => o.id === id && o.lines) || OPENINGS[1 + Math.floor(Math.random() * (OPENINGS.length - 1))];
}
export function bookOptions(opening, history) {
  return [...new Set((opening?.lines || []).filter(line => history.every((m,i) => m === line[i])).map(line => line[history.length]).filter(Boolean))];
}
export function bookStatus(opening, history) {
  if ((opening?.lines || []).some(line => history.every((m,i) => m === line[i]))) return 'In opening book';
  if ((opening?.lines || []).some(line => line.every((m,i) => m === history[i]))) return 'Book line complete';
  return 'Beyond the book';
}
export function validateBooks() {
  for (const opening of OPENINGS.filter(o => o.lines)) for (const line of opening.lines) {
    const game = new Chess(); for (const move of line) game.move(move);
  }
  return true;
}
