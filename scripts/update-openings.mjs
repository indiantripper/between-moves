import { mkdir, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
const revision='3ba6b20d31b2e6125cb0e6a2e792f400717d9d39';
const index={};
const sources=await Promise.all(['a','b','c','d','e'].map(async volume=>{
  const response=await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/${revision}/${volume}.tsv`);
  if(!response.ok)throw Error(`Opening download failed: ${response.status}`);
  return response.text();
}));
for(const source of sources)for(const row of source.trim().split('\n').slice(1)){
  const [eco,name,pgn]=row.split('\t');
  const game=new Chess();game.loadPgn(pgn);
  const key=game.fen().split(' ').slice(0,4).join(' ');
  index[key]={eco,name};
}
await mkdir('src/data',{recursive:true});
await writeFile('src/data/opening-index.json',JSON.stringify(index));
const licence=await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/${revision}/COPYING.txt`);
if(!licence.ok)throw Error('Opening licence download failed.');
await writeFile('public/OPENINGS-LICENSE.txt',await licence.text());
console.log(`Prepared ${Object.keys(index).length} named opening positions from ${revision}.`);
