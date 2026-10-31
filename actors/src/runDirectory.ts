import { Actor, Persisted } from 'durable-actors';

export interface Registration {
  runId: string; seed: number; condition: 'LABELED' | 'BLIND';
  mode: 'live' | 'stub'; agentCount: number;
}

// Durable intent journal: bootstrap resumes every registered run without viewer traffic.
export class RunDirectory extends Actor {
  @Persisted private runs: Registration[] = [];

  async register(run: Registration): Promise<void> {
    if (!/^[A-Za-z0-9._-]+$/.test(run.runId) || !Number.isSafeInteger(run.seed)
      || !['LABELED','BLIND'].includes(run.condition) || !['live','stub'].includes(run.mode)
      || ![6,18].includes(run.agentCount)) throw new Error('Invalid run registration');
    const previous = this.runs.find(r => r.runId === run.runId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(run)) throw new Error('Run registration conflict');
    if (!previous) this.runs = [...this.runs,run];
  }

  async list(): Promise<Registration[]> { return this.runs; }
}
