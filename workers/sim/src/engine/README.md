# Engine (owner: Person A)

Pure game rules with no I/O, no clock, no storage. `legalActions(state, agentId)` returns the actions an agent may take in the current phase, and `resolvePhase(state, actionsByAgent, rng)` returns `{ state, events }` by applying all submitted actions deterministically using the seeded RNG. WorldActor only wraps these with storage, alarms and broadcast, and `pnpm sim:local` runs a full game against them in Node with stub agents.
