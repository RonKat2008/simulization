"use client";
import { useEffect, useState } from 'react';

/** Independent of playback: only immutable pre-action values, never full-run behavior. */
export function useStartingValues(runId: string | null) {
  const [result, setResult] = useState<{ runId: string | null; values: Record<string, number> | null; loading: boolean; failed: boolean }>({runId:null,values:null,loading:false,failed:false});
  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    setResult({runId,values:null,loading:true,failed:false});
    fetch(`/api/runs/${encodeURIComponent(runId)}/starting-values`, {signal:AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])})
      .then(async response => {
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        const values = data.runId === runId && data.values && typeof data.values === 'object' && !Array.isArray(data.values)
          && Object.values(data.values).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0) ? data.values : null;
        if (!controller.signal.aborted) setResult({runId,values,loading:false,failed:false});
      })
      .catch(() => {if (!controller.signal.aborted) setResult({runId,values:null,loading:false,failed:true});});
    return () => controller.abort();
  }, [runId]);
  return result.runId === runId ? result : {runId,values:null,loading:Boolean(runId),failed:false};
}
