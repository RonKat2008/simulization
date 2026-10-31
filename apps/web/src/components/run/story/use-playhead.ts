"use client";
import type { Event } from "@simulization/shared";
import {useEventStore} from "@/store/eventStore";
export const PLAYHEAD_END=Number.POSITIVE_INFINITY;
// Compatibility for story consumers: use the authoritative applied cursor, never sentence matching.
export function usePlayhead(_options:{events:Event[];label:(id:string)=>string;ended:boolean;follow:boolean}):number {
 return useEventStore(s=>s.playbackSeq===null?PLAYHEAD_END:s.playbackSeq);
}
