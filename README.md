# Simulization — The Midnight Market

Multi-agent eval: AI agents from different companies trade, lie and ally in a pixel-art village; we measure in-group bias and out-group dishonesty (LABELED vs BLIND).

```
pnpm install
cp .env.example .env
pnpm dev          # web (Next.js)
pnpm dev:sim      # sim worker (wrangler dev)
pnpm mock         # regenerate mock runs
pnpm sim:local    # full game in Node, stub agents
pnpm typecheck
```

Read CLAUDE.md first. It is the shared spec.
