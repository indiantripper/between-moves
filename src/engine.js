export function parseInfo(line) {
  if (!line.startsWith('info ') || !line.includes(' pv ') || /\b(?:lowerbound|upperbound)\b/.test(line)) return null;
  const score = line.match(/\bscore (cp|mate) (-?\d+)/), pv = line.split(' pv ')[1]?.trim().split(/\s+/);
  if (!score || !pv?.length) return null;
  return { index:Number(line.match(/\bmultipv (\d+)/)?.[1] || 1), depth:Number(line.match(/\bdepth (\d+)/)?.[1] || 0), [score[1]]:Number(score[2]), pv };
}
export class Engine {
  constructor(url,{hash=32}={}) {
    this.worker = new Worker(url); this.queue = Promise.resolve(); this.listeners = new Set();
    this.worker.onmessage = e => String(e.data).split('\n').forEach(line => this.listeners.forEach(fn => fn(line)));
    this.ready = new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(Error('The chess engine could not start. Reload to try again.')),25000);
      this.worker.onerror = () => { clearTimeout(timer); reject(Error('The chess engine could not load. Check your connection and reload.')); };
      const onLine = line => { if (line === 'uciok') { clearTimeout(timer); this.listeners.delete(onLine); this.send(`setoption name Hash value ${hash}`); resolve(); } };
      this.listeners.add(onLine); this.send('uci');
    });
  }
  send(command) { this.worker.postMessage(command); }
  search(fen,{ count = 5, ms = 900, elo = null, only = null } = {}) {
    const task = async () => {
      await this.ready;
      return new Promise((resolve,reject) => {
        const depths = new Map();
        const timer = setTimeout(() => { this.send('stop'); this.listeners.delete(onLine); reject(Error('Analysis timed out. Please try again.')); }, Math.max(ms * 4,15000));
        const onLine = line => {
          const info = parseInfo(line);
          if (info) { if (!depths.has(info.depth)) depths.set(info.depth,new Map()); depths.get(info.depth).set(info.index,info); }
          if (line.startsWith('bestmove ')) {
            clearTimeout(timer); this.listeners.delete(onLine);
            const complete = [...depths.entries()].sort((a,b) => b[0]-a[0]);
            const desired = only ? 1 : count;
            const match = complete.find(([,items]) => items.size >= desired) || complete.sort((a,b) => b[1].size-a[1].size || b[0]-a[0])[0];
            const lines = match ? [...match[1].values()].sort((a,b) => a.index-b.index) : [];
            resolve({ lines, bestmove:line.split(' ')[1], depth:match?.[0] || 0 });
          }
        };
        this.listeners.add(onLine);
        this.send(`setoption name MultiPV value ${only ? 1 : count}`);
        this.send(`setoption name UCI_LimitStrength value ${elo ? 'true' : 'false'}`);
        if (elo) this.send(`setoption name UCI_Elo value ${Math.max(1320,Math.min(3190,elo))}`);
        if (elo && elo < 1320) { this.send('setoption name UCI_LimitStrength value false'); this.send(`setoption name Skill Level value ${Math.max(0,Math.round((elo-400)/90))}`); }
        else this.send('setoption name Skill Level value 20');
        this.send(`position fen ${fen}`);
        this.send(`go movetime ${ms}${only ? ` searchmoves ${only}` : ''}`);
      });
    };
    const promise = this.queue.then(task); this.queue = promise.catch(() => {}); return promise;
  }
}
