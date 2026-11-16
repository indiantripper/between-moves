import { execFileSync } from 'node:child_process';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const remote = execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim();
if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(remote)) throw Error('Expected a GitHub HTTPS origin.');
const directory = await mkdtemp(path.join(tmpdir(),'between-moves-pages-'));
const run = args => execFileSync('git',args,{cwd:directory,stdio:'inherit'});
try {
  await cp('dist',directory,{recursive:true});
  run(['init','-b','gh-pages']);
  run(['remote','add','origin',remote]);
  // Preserve branch history when updating an existing deployment.
  const exists = execFileSync('git',['ls-remote','--heads',remote,'gh-pages'],{encoding:'utf8'}).trim();
  if (exists) {
    run(['fetch','--depth=1','origin','gh-pages']);
    run(['reset','--soft','FETCH_HEAD']);
  }
  run(['add','--all']);
  run(['-c','user.name=indiantripper','-c','user.email=indiantripper@users.noreply.github.com','commit','--allow-empty','-m','Publish Between Moves']);
  run(['-c','credential.helper=','-c','credential.helper=!gh auth git-credential','push','origin','HEAD:gh-pages']);
  console.log('Published gh-pages. Enable that branch in repository Settings → Pages.');
} finally { await rm(directory,{recursive:true,force:true}); }
