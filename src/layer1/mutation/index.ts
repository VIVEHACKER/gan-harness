import { execSync } from "node:child_process";
import { join } from "node:path";
import type { MutationConfig, MutationReport } from "../../types.js";
import { generateMutants } from "./mutant-generator.js";
import { runMutationTests } from "./mutation-runner.js";

function getChangedSourceFiles(targetDir: string): string[] {
	try {
		const cached = execSync("git diff --cached --name-only", {
			cwd: targetDir,
			stdio: ["ignore", "pipe", "pipe"],
		})
			.toString("utf-8")
			.trim();

		const files = (cached || "")
			.split("\n")
			.filter(Boolean)
			.filter(
				(f) =>
					/\.(ts|js|tsx|jsx)$/.test(f) &&
					!f.includes(".test.") &&
					!f.includes(".spec.") &&
					!f.includes("__tests__"),
			)
			.map((f) => join(targetDir, f));

		return files;
	} catch {
		return [];
	}
}

export async function runMutationAnalysis(
	testCmd: string,
	targetDir: string,
	config: MutationConfig,
): Promise<MutationReport> {
	if (!config.enabled || !testCmd) {
		return {
			totalMutants: 0,
			killed: 0,
			survived: 0,
			score: 1,
			gate: "PASS",
			results: [],
			durationMs: 0,
		};
	}

	const changedFiles = getChangedSourceFiles(targetDir);
	if (changedFiles.length === 0) {
		return {
			totalMutants: 0,
			killed: 0,
			survived: 0,
			score: 1,
			gate: "PASS",
			results: [],
			durationMs: 0,
		};
	}

	const perFile = Math.max(
		1,
		Math.floor(config.maxMutants / changedFiles.length),
	);
	const allMutants = changedFiles.flatMap((f) => generateMutants(f, perFile));

	return runMutationTests(
		allMutants.slice(0, config.maxMutants),
		testCmd,
		targetDir,
		config,
	);
}
