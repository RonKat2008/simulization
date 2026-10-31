// Track A: compile the existing engine/world under one SDK installation.
// The Terse host identifies actors by SDK class identity; mixing workspace copies fails validation.
import {execFileSync} from 'node:child_process';
import {cpSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
execFileSync(process.execPath,[join(root,'scripts/vendor.mjs')],{cwd:root,stdio:'inherit'});
for(const dir of ['engine','world','agents']){
 const target=join(root,'vendor/sim',dir);
 cpSync(join(root,'../workers/sim/src',dir),target,{recursive:true});
 for(const name of readdirSync(target))if(name.endsWith('.ts')){
  const path=join(target,name);
  const source=readFileSync(path,'utf8').replace(/((?:from|import\()\s*)(["'])(\.{1,2}\/[^"']+?)\2/g,(_m,pre,q,spec)=>`${pre}${q}${/\.[cm]?[jt]sx?$|\.json$/.test(spec)?spec:spec+'.js'}${q}`);
  writeFileSync(path,source);
 }
}
