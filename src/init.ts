import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_CONTRACT = `# Contract

## What we're building
(describe the feature or fix)

## Acceptance criteria
- [ ] (criterion 1)
- [ ] (criterion 2)

## Out of scope
- (what NOT to do)
`;

const DEFAULT_EVAL_CRITERIA = `# Evaluation Criteria

| Criterion | Weight | Threshold | Description |
|-----------|--------|-----------|-------------|
| Functionality | 0.30 | 6 | Does it work as specified? |
| Code Quality | 0.25 | 6 | Clean, readable, maintainable? |
| Security | 0.20 | 7 | No vulnerabilities, secrets safe? |
| Testing | 0.15 | 5 | Adequate test coverage? |
| Performance | 0.10 | 5 | No regressions, efficient? |
`;

const DEFAULT_STATE = {
	version: "0.1.0",
	phase: "idle",
	round: 0,
	tier: 1,
	mode: "direct",
	created: new Date().toISOString(),
};

const DEFAULT_CONFIG = {
	timeout_sec: 120,
	build_cmd: "",
	test_cmd: "",
	lint_cmd: "",
	local_llm: {
		enabled: false,
		endpoint: "http://127.0.0.1:8080/v1/chat/completions",
		timeout_sec: 60,
	},
	layer2_skip_max_lines: 20,
};

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function writeIfMissing(path: string, content: string): Promise<boolean> {
	if (await exists(path)) return false;
	await writeFile(path, content, "utf-8");
	return true;
}

export async function initHarness(targetDir: string): Promise<string[]> {
	const harnessDir = join(targetDir, ".harness");
	const created: string[] = [];

	await mkdir(join(harnessDir, "rounds"), { recursive: true });
	await mkdir(join(harnessDir, "traces"), { recursive: true });
	await mkdir(join(harnessDir, "eval-data"), { recursive: true });

	if (await writeIfMissing(join(harnessDir, "contract.md"), DEFAULT_CONTRACT)) {
		created.push(".harness/contract.md");
	}
	if (
		await writeIfMissing(
			join(harnessDir, "eval-criteria.md"),
			DEFAULT_EVAL_CRITERIA,
		)
	) {
		created.push(".harness/eval-criteria.md");
	}
	if (
		await writeIfMissing(
			join(harnessDir, "state.json"),
			`${JSON.stringify(DEFAULT_STATE, null, 2)}\n`,
		)
	) {
		created.push(".harness/state.json");
	}
	if (
		await writeIfMissing(
			join(harnessDir, "config.json"),
			`${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`,
		)
	) {
		created.push(".harness/config.json");
	}

	// Add .harness to .gitignore if not already there
	const gitignorePath = join(targetDir, ".gitignore");
	if (await exists(gitignorePath)) {
		const { readFile } = await import("node:fs/promises");
		const content = await readFile(gitignorePath, "utf-8");
		if (!content.includes(".harness/")) {
			await writeFile(
				gitignorePath,
				`${content.trimEnd()}\n.harness/\n`,
				"utf-8",
			);
			created.push(".gitignore (appended .harness/)");
		}
	} else {
		await writeFile(gitignorePath, ".harness/\n", "utf-8");
		created.push(".gitignore");
	}

	return created;
}
