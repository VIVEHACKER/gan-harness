# gan-harness — Moved

This repository has been consolidated into a private monorepo: **VIVEHACKER/harness-frontier**.

## What this means

- The npm package **`gan-harness`** continues to be available on npm. Install as before:
  ```bash
  npm install -g gan-harness
  ```
- Active development happens in [VIVEHACKER/harness-frontier](https://github.com/VIVEHACKER/harness-frontier) (private). The package source lives at `packages/gan-harness/` inside that monorepo.
- This repository is archived as a redirect. New issues, PRs, and releases happen in `harness-frontier`.

## Why we moved

The package is one of several components — Python eval engine, spec/ invariants, research notes, automated audit pipelines — that all share git history, CI workflows, and a single test corpus. Splitting them across two repos required two clones and reconciling diverged copies. The monorepo eliminates that friction.

## For npm users

Nothing changes. `npm install gan-harness` resolves the same package name on the npm registry. The published tarballs remain available at https://www.npmjs.com/package/gan-harness.

## For contributors

Reach out at the new repo. This repository is read-only.
