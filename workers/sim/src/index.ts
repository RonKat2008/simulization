// Frozen HTTP surface, served by Bun and backed exclusively by Terse actors.
import { createActorTransport, type DurableActorsClientOptions } from 'durable-actors/backend';
import { SocketProxy } from 'durable-actors/proxy';
import type { ServerWebSocket } from 'bun';
const headers = {'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type'};
const json = (body:unknown,status=200) => Response.json(body,{status,headers});
type SocketData = {url:string; upstream?:WebSocket};
export function startHttp(options: DurableActorsClientOptions, port = 8787, register?: (run: {runId:string;seed:number;condition:"LABELED"|"BLIND"}) => Promise<void>) {
  const transport = createActorTransport(options);
  const sockets = new SocketProxy({WorldActor:{}},options);
  const invoke = async (id:string,method:string,...args:unknown[]) => JSON.parse(await transport.invoke('WorldActor',id,method,args) as string);
  const create = async (condition:unknown,seed:unknown) => {
    if (!['LABELED','BLIND'].includes(String(condition)) || !Number.isSafeInteger(seed)) throw new Error('Invalid run options');
    const runId = crypto.randomUUID();
    await register?.({runId,seed:seed as number,condition:condition as 'LABELED'|'BLIND'});
    await invoke(runId,'initialize',runId,seed,condition,6,true);
    return runId;
  };
  return Bun.serve<SocketData>({port,hostname:'127.0.0.1',
    async fetch(request,server) {
      if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
      const url = new URL(request.url); const method = request.method;
      try {
        if(method==='POST' && url.pathname==='/runs') {
          const body = await request.json() as {condition:unknown;seed:unknown};
          return json({runId:await create(body.condition,body.seed)});
        }
        if(method==='POST' && url.pathname==='/batch') {
          const {n} = await request.json() as {n:number};
          if(!Number.isInteger(n) || n<1 || n>100) return json({error:'n must be 1..100'},400);
          const runIds:string[]=[];
          for(let i=1;i<=n;i++) runIds.push(await create(i%2 ? 'LABELED':'BLIND',i));
          return json({runIds});
        }
        const match = url.pathname.match(/^\/runs\/([\w.-]+)(\/events|\/ws|\/stop)?$/);
        if(!match) return json({error:'Not found'},404);
        const id=match[1]!; const suffix=match[2]??'';
        if(method==='GET' && suffix==='') return json(await invoke(id,'status'));
        if(method==='GET' && suffix==='/events') return json(await invoke(id,'events',Number(url.searchParams.get('after')??0)));
        if(method==='POST' && suffix==='/stop') return json(await invoke(id,'stop'));
        if(method==='GET' && suffix==='/ws') {
          await invoke(id,'status');
          const grant = await sockets.handle({actorName:'WorldActor',actorId:id,metadata:null});
          if(server.upgrade(request,{data:{url:grant.websocketUrl}})) return;
          return json({error:'WebSocket upgrade required'},426);
        }
        return json({error:'Not found'},404);
      } catch(error) {
        const message=error instanceof Error ? error.message : String(error);
        return json({error:message},message.includes('Run not found') ? 404 : 400);
      }
    },
    websocket:{
      open(socket:ServerWebSocket<SocketData>) {
        const upstream = new WebSocket(socket.data.url); socket.data.upstream=upstream;
        upstream.onmessage=e=>{if(typeof e.data==='string') socket.send(e.data);};
        upstream.onclose=()=>socket.close();
        upstream.onerror=()=>socket.close(1011,'Actor connection failed');
      },
      message() { /* Observer stream is read-only; use HTTP events cursor for catch-up. */ },
      close(socket:ServerWebSocket<SocketData>) {socket.data.upstream?.close();},
    },
  });
}
