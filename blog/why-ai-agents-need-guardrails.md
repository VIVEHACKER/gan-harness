# Why Your AI Agent Will Fail in Production (And How to Prevent It)

> You built an AI agent. It works on your laptop. You ship it. It hallucinates, leaks API keys, burns $500 in a loop, and gets stuck for 20 minutes doing nothing. Sound familiar?

## The 5 Ways AI Agents Die in Production

### 1. The Infinite Loop
Your agent calls the same tool 10 times with identical input. Each call costs money. By the time you notice, it's burned through your API budget.

### 2. The Secret Leak
The agent writes code with hardcoded API keys. Or commits `.env` files. Your AWS credentials are now on GitHub.

### 3. The Hallucination Ship
The agent confidently produces code that looks right but doesn't work. It writes tests that pass by testing nothing.

### 4. The Cost Explosion
Without cost controls, a simple task triggers dozens of expensive API calls when a local check would have caught the problem for $0.

### 5. The Silent Stall
The agent appears busy but makes no progress. 20 tool calls later, nothing has changed.

## Agents Need a Nervous System

Humans don't ship code without CI/CD. Yet we deploy AI agents with none of this.

**gan-harness** is the missing safety net. A 3-layer evaluation system:

```
Layer 1 ($0, instant)  ->  Build + Test + Lint + TypeCheck + Secret Scan
Layer 1.5 ($0, local)  ->  Local LLM review
Layer 2 (API, $$)      ->  Full AI evaluation (only when needed)
```

**60-70% of agent work can be verified for $0.**

## How It Works

```bash
npx gan-harness init
npx gan-harness verify
```

Auto-detects Node.js, Python, Rust, Go. No configuration needed.

## Security Built In

- **Command injection protection** -- shell metacharacters blocked
- **Secret scanning** -- 8 patterns, 17+ file types
- **SSRF prevention** -- LLM endpoints restricted to loopback
- **Environment isolation** -- minimal env vars to child processes

## Open Source + Pro

Layer 1 is open source (MIT). **gan-harness Pro** adds Layer 2 evaluation, failure pattern learning, eval dashboard, 35+ domain skills, and ensemble voting.

## Try It

```bash
npx gan-harness verify
```

- **GitHub:** https://github.com/VIVEHACKER/gan-harness
- **npm:** https://www.npmjs.com/package/gan-harness
