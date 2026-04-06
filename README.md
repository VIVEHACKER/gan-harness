# gan-harness

Production safety net for AI agents — guardrails + evaluation + auto-learning.

Stop your AI agents from hallucinating, looping, leaking secrets, and burning API credits.

## Quick Start (2 minutes)

```bash
# Install
npm install -g gan-harness

# Initialize in your project
cd your-project
gan-harness init

# Run verification
gan-harness verify
```

Output:

```
━━━ gan-harness verify ━━━

  Layer 1 — Static Checks ($0)

  ✓ Build      395ms (npm run build --if-present)
  ✓ Tests      3977ms (pytest)
  ✓ Lint       10ms (ruff check .)
  ✓ TypeCheck  428ms (npx tsc --noEmit)
  ✓ Secrets    8ms (secret-scan)

  Gate: PASS (5/5 checks)

  Layer 2 Recommendation
  → SKIP (minor change, L1 passed)

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Final: PASS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## What It Does

**Layer 1 ($0, local, instant):**
- Build check (auto-detects npm/pytest/cargo/go)
- Test runner
- Linter
- TypeScript type checking
- Secret scanning (AWS keys, API tokens, hardcoded passwords)

**Layer 1.5 ($0, local LLM):**
- Local LLM review for bugs, security issues, error handling gaps
- Runs only when your local LLM server is active

**Layer 2 Skip Decision:**
- If L1+L1.5 pass AND change is small (<20 lines, no new files, no security files)
- Skip expensive API evaluation — saves 60-70% of API costs

## Auto-Detection

gan-harness detects your project type and picks the right commands:

| Project | Build | Test | Lint | TypeCheck |
|---------|-------|------|------|-----------|
| Node.js | `npm run build` | `npm test` | `npm run lint` | `npx tsc --noEmit` |
| Python | — | `pytest` | `ruff check .` | `mypy .` |
| Rust | `cargo build` | `cargo test` | `cargo clippy` | — |
| Go | `go build ./...` | `go test ./...` | `golangci-lint run` | — |
| Makefile | `make build` | `make test` | `make lint` | — |

## Configuration

Override auto-detection via `.harness/config.json`:

```json
{
  "timeout_sec": 120,
  "build_cmd": "make build",
  "test_cmd": "pytest -x",
  "lint_cmd": "ruff check .",
  "local_llm": {
    "enabled": true,
    "endpoint": "http://127.0.0.1:8080/v1/chat/completions",
    "timeout_sec": 60
  },
  "layer2_skip_max_lines": 20
}
```

Or via environment variables:

```bash
HARNESS_BUILD_CMD="make build" gan-harness verify
HARNESS_TIMEOUT_SEC=60 gan-harness verify
```

## Programmatic API

```typescript
import { verify, loadConfig } from 'gan-harness';

const config = await loadConfig('/path/to/project');
const result = await verify(config);

if (result.finalGate === 'BLOCK') {
  console.error('Verification failed:', result.layer1.checks.filter(c => c.status === 'FAIL'));
  process.exit(1);
}

// Use in CI/CD
if (result.skipDecision.recommendation === 'SKIP') {
  console.log('Minor change, skipping expensive API review');
}
```

## JSON Output

```bash
gan-harness verify --json
```

Returns structured `VerifyResult` for CI/CD integration.

## Architecture

```
3-Layer Evaluation (fail-closed):

  L1 ($0, bash)     →  build + test + lint + typecheck + secrets
  L1.5 ($0, local)  →  local LLM review (bugs, security, error handling)
  L2 (API, $$)      →  Claude/GPT evaluation (only when needed)

  Skip Logic: L1+L1.5 PASS + small change → skip L2 (saves 60-70% cost)
```

## gan-harness Pro

The open-source CLI covers Layer 1 verification. For production AI agent deployments, **gan-harness Pro** adds:

- **Layer 2 API Evaluation** — Claude/GPT-powered code review with dual-prompt optimization and model fallback chains
- **Eval Dashboard** — Real-time failure pattern visualization with team sharing
- **Ontology Engine** — Auto-learns from failures and builds anti-pattern templates
- **35+ Domain Skills** — Design, backend, security, deployment skill packs
- **3-Actor Orchestration** — Planner/Generator/Evaluator separation for reliable agent workflows
- **Ensemble Voting** — Multi-model consensus for high-stakes deployments

Coming soon. [Join the waitlist](https://github.com/your-org/gan-harness/issues).

## License

MIT
