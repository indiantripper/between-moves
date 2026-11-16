import { Chess } from 'chess.js';

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
  { id: 'london', name: 'London System', description: 'A familiar setup with a clear plan.', lines: [
    ['d4','d5','Bf4','Nf6','e3','e6','Nf3','Bd6','Bg3','O-O'],
    ['d4','Nf6','Bf4','g6','e3','Bg7','Nf3','O-O','Be2','d6'] ] }
];

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
