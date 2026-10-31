import type {Event} from '@simulization/shared';
export interface ActivityGroup {events: Event[]; routine: string | null}
function routineKind(e: Event): string | null {
  if (e.flags.length) return null;
  if (e.type === 'work' || e.type === 'contribute') return e.type;
  const reward = e.type === 'system' && e.actorId === 'world' && e.targetId
    ? /^Coalition reward: (\d+) coins\.$/.exec(e.text ?? '') : null;
  return reward ? `reward:${reward[1]}` : null;
}
/** Filter before grouping: a group must never carry evidence beyond the applied cursor. */
export function activityAtCursor(events: readonly Event[], playbackSeq: number | null): ActivityGroup[] {
  return groupActivity(playbackSeq === null ? events : events.filter(e => e.seq <= playbackSeq));
}

export function activityGroupText(group: ActivityGroup, label: (id: string) => string): string {
  if (!group.routine || group.events.length === 1) return activityText(group.events[0]!, label);
  if (group.routine.startsWith('reward:')) return `${group.events.length} coalition rewards · +${group.routine.split(':')[1]} coins each`;
  const agents = new Set(group.events.map(e => e.actorId)).size;
  if (group.routine === 'contribute') return agents === group.events.length
    ? `${agents} agents contributed · −1 coin each`
    : `${group.events.length} contributions · −${group.events.length} coins total`;
  return agents === group.events.length
    ? `${agents} agents worked · +1 coin each`
    : `${group.events.length} work actions · +${group.events.length} coins total`;
}
/** Only adjacent, unflagged routine actions of the same kind and phase can collapse. */
export function groupActivity(events: readonly Event[]): ActivityGroup[] {
  const groups: ActivityGroup[]=[];
  for (const e of events) {
    const last=groups.at(-1), previous=last?.events.at(-1);
    const routine=routineKind(e);
    if (routine && last?.routine===routine && previous?.seq===e.seq-1 && previous.round===e.round && previous.phase===e.phase) last.events.push(e);
    else groups.push({events:[e],routine});
  }
  return groups.filter(g=>g.events[0]!.type!=='system' || !!g.events[0]!.targetId);
}
export function activityText(e:Event,label:(id:string)=>string):string {
  const a=label(e.actorId),t=e.targetId?label(e.targetId):'another agent';
  switch(e.type){
    case 'work': return `${a} worked · +1 coin`;
    case 'contribute': return `${a} contributed · −1 coin`;
    case 'trade_offer': return `${a} offered an item to ${t} · claimed quality ${e.claim?.claimedQuality ?? '?'} · ${e.claim?.price ?? '?'} coins`;
    case 'trade_accept': return `${a} bought from ${t} · ${e.claim?.price ?? '?'} coins`;
    case 'trade_decline': return `${a} declined ${t}’s offer`;
    case 'steal': {const amount=/^Stole (\d+) coins\.$/.exec(e.text??'')?.[1];return `${a} stole from ${t}${amount!==undefined?` · ${amount} coins`:''}`;}
    case 'caught': {const fine=/^Fined (\d+) coins/.exec(e.text??'')?.[1];return `${a} was caught${fine!==undefined?` · ${fine} coin fine`:''}`;}
    case 'pact_propose': return `${a} proposed a pact to ${t}`;
    case 'pact_accept': return `${a} accepted a pact with ${t}`;
    case 'pact_break': return `${a} broke their pact with ${t}`;
    case 'coalition_create': return `${a} created a coalition`;
    case 'coalition_join': return `${a} joined a coalition`;
    case 'coalition_leave': return `${a} left a coalition`;
    case 'message': return `${a} sent ${e.channel==='public'?'a public message':e.targetId?`a message to ${t}`:'a coalition message'}`;
    case 'pass': return `${a} passed`;
    case 'system': return `${t} · ${e.text??'world update'}`;
    default:return `${a} · ${e.type}`;
  }
}
