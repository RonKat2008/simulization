// Track A shared environment bootstrap. Keep secrets server-side and preserve shell precedence.
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const root=new URL('../../../',import.meta.url);
try{process.loadEnvFile(fileURLToPath(new URL('.env',root)));}
catch(error){if(error.code!=='ENOENT')throw error;}
const require=createRequire(new URL('apps/web/package.json',root));
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev',fileURLToPath(new URL('apps/web',root))],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code??1;});
