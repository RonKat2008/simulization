import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {loadProjectEnv} from './load-env';
const dir=await mkdtemp(tmpdir()+'/sim-env-');
try {
 await writeFile(dir+'/.env','SIM_ENV_SMOKE=from-file\nSIM_ENV_EMPTY=\n');
 process.env.SIM_ENV_SMOKE='from-shell';loadProjectEnv(dir+'/.env');assert.equal(process.env.SIM_ENV_SMOKE,'from-shell');
 delete process.env.SIM_ENV_SMOKE;loadProjectEnv(dir+'/.env');assert.equal(process.env.SIM_ENV_SMOKE,'from-file');
 assert.equal(process.env.SIM_ENV_EMPTY,'');loadProjectEnv(dir+'/missing');
 console.log('PASS environment loader: file loads, shell wins, missing file tolerated; no secret values printed');
}finally{delete process.env.SIM_ENV_SMOKE;delete process.env.SIM_ENV_EMPTY;await rm(dir,{recursive:true,force:true});}
