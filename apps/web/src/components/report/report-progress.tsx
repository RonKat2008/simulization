'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

/** Reads only status; refreshing this page never starts analysis or another paid request. */
export function ReportProgress({runId}:{runId:string}) {
 const router=useRouter();const [message,setMessage]=useState('Checking report delivery…');
 useEffect(()=>{
  let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;
  const controller=new AbortController();
  const tick=async()=>{
   let retry=true;
   try{
    const response=await fetch(`/api/runs/${encodeURIComponent(runId)}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});
    if(response.status===404){if(!stopped)setMessage('Run not found. Check the run link or return to past runs.');return;}
    if(!response.ok)throw new Error('Unavailable');
    const status=await response.json();if(stopped)return;
    if(status.reportStatus==='done'){setMessage('Persisted review ready.');router.refresh();retry=false;}
    else if(status.status==='failed'||status.reportStatus==='failed'){setMessage('Report generation stopped or exhausted its retries. The run and any stored metrics remain available.');retry=false;}
    else if(status.reportStatus==='not-requested'&&status.status==='done'){setMessage('No model review was requested for this run.');retry=false;router.refresh();}
    else {setMessage(status.status==='running'?'Run in progress; metrics and review follow completion.':`Review delivery: ${status.reportStatus??'unknown'}. This page refreshes automatically.`);router.refresh();}
   }catch{if(!stopped)setMessage('Report status is temporarily unavailable. Retrying…');}
   if(!stopped&&retry)timer=setTimeout(tick,5000);
  };void tick();return()=>{stopped=true;controller.abort();if(timer)clearTimeout(timer);};
 },[runId,router]);
 return <p role="status" className="font-mono text-xs text-muted-foreground">{message}</p>;
}
