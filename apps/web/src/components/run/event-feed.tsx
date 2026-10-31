"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Event} from '@simulization/shared';
import {useEventStore} from '@/store/eventStore';
import {useRun} from './run-context';
import {claimCheck} from './run-helpers';
import {activityText,activityAtCursor,activityGroupText} from './compact-activity';
import type {RunStatus} from './use-run-source';

function Evidence({event:e}:{event:Event}) {
  const {label,agents}=useRun(); const select=useEventStore(s=>s.select); const claim=claimCheck(e);
  const agentId=e.actorId==='world'?e.targetId:e.actorId;
  return <div className="space-y-2 border-t border-border/60 py-3 text-sm">
    {agentId&&agents.some(a=>a.id===agentId)&&<button data-agent-id={agentId} type="button" onClick={()=>select(agentId)} className="min-h-9 text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">Inspect {label(agentId)}</button>}
    {e.type==='message'&&e.channel&&e.channel!=='public'&&<p className="text-xs text-muted-foreground">{e.channel==='dm'?'Private message':'Coalition message'} · observer view</p>}
    {e.text && <p className="whitespace-pre-wrap break-words leading-relaxed">{e.text}</p>}
    {claim && <p>Claimed quality {claim.claimed}; actual quality {claim.actual??'not recorded'} <span className="text-muted-foreground">· observer only</span></p>}
    {e.privatePlan && <div><h4 className="font-medium">Agent’s stated plan <span className="font-normal text-muted-foreground">· observer only</span></h4><p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{e.privatePlan}</p><p className="mt-1 text-xs text-muted-foreground">Model-generated explanation, not a record of internal thoughts.</p></div>}
    <p className="break-all font-mono text-xs text-muted-foreground">Event {e.id} · {e.type}</p>
  </div>;
}
export function EventFeed(props:{followLatest:boolean;status:RunStatus}) {
  const {label}=useRun();
  const all=useEventStore(s=>s.events),seq=useEventStore(s=>s.playbackSeq);
  const [limit,setLimit]=useState(12);
  const groups=useMemo(()=>activityAtCursor(all,seq),[all,seq]);
  const visible=groups.slice(-limit);
  const scroller=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(scroller.current)scroller.current.scrollTop=scroller.current.scrollHeight;},[seq,groups]);
  return <section aria-label="Agent Activity" className="min-w-0">
    <p className="border-b px-3 py-2 text-xs text-muted-foreground">{seq===null?'Full loaded run · all rounds':'Through the current replay position'}</p>
    <div ref={scroller} className="max-h-[65dvh] overflow-y-auto overscroll-contain px-3">
      {groups.length>limit && <button type="button" onClick={()=>setLimit(n=>n+20)} className="my-2 min-h-8 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">Show earlier actions</button>}
      {!groups.length && <p className="py-5 text-sm text-muted-foreground">{all.length?'No actions at this replay position. Resume playback or choose a later round.':props.status==='offline'?'Connection lost. Retrying…':'Waiting for recorded actions.'}</p>}
      <ol>{visible.map(g=>{const e=g.events[0]!,falseClaim=e.type==='trade_offer'&&e.flags.includes('lie');return <li key={e.id} className="border-b border-border/60 last:border-0"><details>
        <summary className="cursor-pointer py-3 text-sm leading-relaxed marker:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary">
          <span className="break-words">{activityGroupText(g,label)}</span>
          {falseClaim&&<span className="mt-1 block font-medium text-violation"><span aria-hidden="true">! </span>False quality claim<span className="block text-xs font-normal">Actual quality {e.groundTruth?.trueQuality??'not recorded'} · observer only</span></span>}
          <span className="mt-0.5 block text-xs text-muted-foreground">Round {e.round} · {e.phase}</span>
        </summary>
        {g.events.map(event=><div key={event.id}>{g.events.length>1&&<p className="pt-2 text-sm font-medium">{activityText(event,label)}</p>}<Evidence event={event}/></div>)}
      </details></li>;})}</ol>
    </div>
  </section>;
}
