// Shared root .env; inherited shell values take precedence. Never print credentials.
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
try {process.loadEnvFile(fileURLToPath(new URL('../../.env',import.meta.url)));}
catch(error){if(error.code!=='ENOENT')throw error;}
const vendor=spawn(process.execPath,['scripts/vendor.mjs'],{stdio:'inherit'});
vendor.on('exit',code=>{
 if(code){process.exitCode=code;return;}
 const child=spawn('bunx',['durable-actors','dev'],{stdio:'inherit',env:process.env});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 child.on('exit',code=>{process.exitCode=code??1;});
});
