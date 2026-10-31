// Track A completion delivery. Keep slow model review outside the serialized World actor.
import {Actor,Persisted} from 'durable-actors';
export class ReportJob extends Actor {
  @Persisted private state='pending';
  @Persisted private attempts=0;
  async status():Promise<{state:string;attempts:number}>{return {state:this.state,attempts:this.attempts};}
  async request():Promise<string>{
    if(this.state!=='done'&&this.attempts<3)this.alarm.set(Date.now()+100);
    return this.state;
  }
  async onAlarm():Promise<void>{
    if(this.state==='done'||this.attempts>=3)return;
    this.attempts++;
    const base=process.env.WEB_URL;
    try{
      if(!base)throw new Error('WEB_URL required');
      const response=await fetch(`${base.replace(/\/$/,'')}/api/analyze/${encodeURIComponent(this.id)}`,{method:'POST',signal:AbortSignal.timeout(310000)});
      if(!response.ok)throw new Error('Report request failed');
      this.state='done';
      this.alarm.delete();
    }catch{
      this.state='failed';
      if(this.attempts<3)this.alarm.set(Date.now()+10000);
    }
  }
}
