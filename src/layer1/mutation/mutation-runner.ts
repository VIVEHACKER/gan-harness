import { execFileSync } from "node:child_process";
import {
	cpSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type {
	GateResult,
	Mutant,
	MutantResult,
	MutationConfig,
	MutationReport,
} from "../../types.js";

export function runMutationTests(
	mutants: readonly Mutant[],
	testCmd: string,
	targetDir: string,
	config: MutationConfig,
): MutationReport {
	const start = Date.now();

	if (mutants.length === 0 || !testCmd) {
		return {
			totalMutants: 0,
			killed: 0,
			survived: 0,
			score: 1,
			gate: "PASS",
			results: [],
			durationMs: Date.now() - start,
		};
	}

	// Create temp copy of project
	const tempDir = mkdtempSync(join(tmpdir(), "gan-mutation-"));
	try {
		cpSync(targetDir, tempDir, {
			recursive: true,
			filter: (src) => !src.includes("node_modules") && !src.includes(".git"),
		});

		// Symlink node_modules for speed
		try {
			symlinkSync(
				join(targetDir, "node_modules"),
				join(tempDir, "node_modules"),
				"dir",
			);
		} catch {
			// node_modules may not exist
		}

		const results: MutantResult[] = [];

		for (const mutant of mutants) {
			const relPath = relative(targetDir, mutant.file);
			const tempFile = join(tempDir, relPath);
			const original = readFileSync(tempFile, "utf-8");

			try {
				// Apply mutation
				const lines = original.split("\n");
				lines[mutant.line - 1] = mutant.mutated;
				writeFileSync(tempFile, lines.join("\n"));

				// Run tests
				const parts = testCmd.split(/\s+/).filter(Boolean);
				const [bin, ...args] = parts;
				execFileSync(bin, args, {
					cwd: tempDir,
					timeout: 30_000,
					stdio: ["ignore", "pipe", "pipe"],
					shell: false,
					env: { ...process.env, FORCE_COLOR: "0" },
				});

				// Test passed = mutant survived (bad)
				results.push({ mutant, killed: false });
			} catch {
				// Test failed = mutant killed (good)
				results.push({ mutant, killed: true });
			} finally {
				// Restore original
				writeFileSync(tempFile, original);
			}
		}

		const killed = results.filter((r) => r.killed).length;
		const survived = results.filter((r) => !r.killed).length;
		const score = results.length > 0 ? killed / results.length : 1;

		let gate: GateResult = "PASS";
		if (score < config.scoreBlock) gate = "BLOCK";
		else if (score < config.scoreWarn) gate = "WARN";

		return {
			totalMutants: results.length,
			killed,
			survived,
			score,
			gate,
			results,
			durationMs: Date.now() - start,
		};
	} finally {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// cleanup best-effort
		}
	}
}
