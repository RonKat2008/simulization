"use client";
import {EventFeed} from "./event-feed";
import type {RunStatus} from "./use-run-source";
export function HappeningFeed({status,onOpenLog}:{status:RunStatus;onOpenLog:()=>void}) {
 return <><EventFeed followLatest status={status}/><button type="button" onClick={onOpenLog} className="min-h-10 w-full border-t px-3 text-left text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">Full-run event log · filters and search</button></>;
}
