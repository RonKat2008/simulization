// Local bootstrap recovery index only; authoritative state/events stay in Terse SQLite.
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
export interface RunRegistration {runId:string;seed:number;condition:'LABELED'|'BLIND'}
export class RunRegistry {
  private queue:Promise<unknown>=Promise.resolve();
  constructor(private directory:string) {}
  async list():Promise<RunRegistration[]> {
    try {return JSON.parse(await readFile(join(this.directory,'runs.json'),'utf8'));}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
  }
  register(run:RunRegistration):Promise<void> {
    const work=this.queue.then(async()=>{
      const runs=await this.list();if(runs.some(r=>r.runId===run.runId))return;
      await mkdir(this.directory,{recursive:true});
      await writeFile(join(this.directory,'runs.json.tmp'),JSON.stringify([...runs,run]));
      await rename(join(this.directory,'runs.json.tmp'),join(this.directory,'runs.json'));
    });this.queue=work.catch(()=>{});return work;
  }
}
