"use client";
import {useState} from "react";
import {Leaderboard} from "./leaderboard";
import {HappeningFeed} from "./happening-feed";
import type {RunStatus} from "./use-run-source";
export function GameSide({status,finalScores,onOpenLog}:{status:RunStatus;finalScores:Record<string,number>|null;onOpenLog:()=>void}) {
 const [tab,setTab]=useState<"leaderboard"|"activity">("leaderboard");
 return <aside className="min-w-0 overflow-hidden rounded-lg border bg-surface lg:sticky lg:top-3">
  <div role="tablist" aria-label="Run sidebar" className="flex border-b p-1">{(["leaderboard","activity"] as const).map((key,i)=><button key={key} id={`sidebar-tab-${key}`} type="button" role="tab" aria-selected={tab===key} aria-controls={`sidebar-panel-${key}`} tabIndex={tab===key?0:-1} onClick={()=>setTab(key)} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();const next=e.key==="Home"?"leaderboard":e.key==="End"?"activity":i===0?"activity":"leaderboard";setTab(next);document.getElementById(`sidebar-tab-${next}`)?.focus();}}} className={`min-h-10 flex-1 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${tab===key?"bg-surface-raised text-foreground":"text-muted-foreground hover:text-foreground"}`}>{key==="leaderboard"?"Leaderboard":"Activity"}</button>)}</div>
  <div role="tabpanel" id={`sidebar-panel-${tab}`} aria-labelledby={`sidebar-tab-${tab}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">{tab==="leaderboard"?<Leaderboard finalScores={finalScores}/>:<HappeningFeed status={status} onOpenLog={onOpenLog}/>}</div>
 </aside>;
}
