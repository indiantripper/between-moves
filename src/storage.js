const DB_NAME = 'between-moves';
export async function openStore() {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = () => req.result.createObjectStore('data');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function readState(db) {
  return new Promise((resolve,reject) => {
    const req = db.transaction('data').objectStore('data').get('state');
    req.onsuccess = () => resolve(req.result || { version:1, games:[], settings:{ level:1350, opponent:1350, color:'w', opening:'random', assess:false } });
    req.onerror = () => reject(req.error);
  });
}
export async function writeState(db,state) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction('data','readwrite');
    tx.objectStore('data').put(structuredClone(state),'state');
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export function validateBackup(data) {
  if (data?.version !== 1 || !Array.isArray(data.games) || typeof data.settings !== 'object' || !data.settings || data.games.length > 10000) throw Error('This is not a supported Between Moves backup.');
  for (const game of data.games) {
    if (typeof game.id !== 'string' || !Array.isArray(game.moves) || !Array.isArray(game.attempts) || game.moves.length > 5000 || !game.moves.every(m => typeof m === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))) throw Error('The backup contains an invalid game.');
  }
  return data;
}
