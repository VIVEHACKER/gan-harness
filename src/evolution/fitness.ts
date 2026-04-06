import { execFileSync } from "node:child_process";
import {
	cpSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { FitnessScore, HarnessConfig, SolutionVariant } from "../types.js";

/**
 * Evaluate a solution variant's fitness in a temp directory (crash-safe).
 * Never modifies live project files.
 */
export function evaluateFitness(
	variant: SolutionVariant,
	config: HarnessConfig,
): FitnessScore {
	const tempDir = mkdtempSync(join(tmpdir(), "gan-evolve-"));

	try {
		// Copy project to temp dir (exclude node_modules, .git)
		cpSync(config.targetDir, tempDir, {
			recursive: true,
			filter: (src) => !src.includes("node_modules") && !src.includes(".git"),
		});

		// Symlink node_modules for speed
		try {
			symlinkSync(
				join(config.targetDir, "node_modules"),
				join(tempDir, "node_modules"),
				"dir",
			);
		} catch {
			// node_modules may not exist
		}

		// Write variant files into temp copy
		for (const [path, content] of variant.files) {
			const relPath = relative(config.targetDir, path);
			writeFileSync(join(tempDir, relPath), content);
		}

		let buildPass = false;
		let testPass = false;

		if (config.buildCmd) {
			try {
				const parts = config.buildCmd.split(/\s+/).filter(Boolean);
				const [bin, ...args] = parts;
				execFileSync(bin, args, {
					cwd: tempDir,
					timeout: 30_000,
					stdio: ["ignore", "pipe", "pipe"],
				});
				buildPass = true;
			} catch {
				buildPass = false;
			}
		} else {
			buildPass = true;
		}

		if (buildPass && config.testCmd) {
			try {
				const parts = config.testCmd.split(/\s+/).filter(Boolean);
				const [bin, ...args] = parts;
				execFileSync(bin, args, {
					cwd: tempDir,
					timeout: 60_000,
					stdio: ["ignore", "pipe", "pipe"],
				});
				testPass = true;
			} catch {
				testPass = false;
			}
		}

		const l1Pass = buildPass && testPass;
		const l1Score = (buildPass ? 50 : 0) + (testPass ? 50 : 0);

		return { l1Pass, l1Score, composite: l1Score };
	} finally {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// best-effort cleanup
		}
	}
}
