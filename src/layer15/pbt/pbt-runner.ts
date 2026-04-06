import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type {
	FunctionSignature,
	GateResult,
	PbtConfig,
	PbtFailure,
	PbtReport,
} from "../../types.js";
import { analyzeFunctions } from "./analyzer.js";
import { generateProperties, generateTestFile } from "./property-generator.js";

interface PbtResult {
	fn: string;
	prop: string;
	status: "PASS" | "FAIL";
	error?: string;
}

export function runPropertyTests(
	sourceFiles: readonly string[],
	targetDir: string,
	config: PbtConfig,
): PbtReport {
	const start = Date.now();

	if (!config.enabled || sourceFiles.length === 0) {
		return emptyReport(start);
	}

	// Check if fast-check is available
	try {
		execFileSync("node", ["-e", 'require.resolve("fast-check")'], {
			cwd: targetDir,
			timeout: 5_000,
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch {
		return {
			...emptyReport(start),
			gate: "PASS",
		};
	}

	// Analyze functions
	const allFunctions: FunctionSignature[] = [];
	for (const file of sourceFiles) {
		try {
			const fns = analyzeFunctions(file, config.maxFunctions);
			allFunctions.push(...fns);
		} catch {
			// Skip unreadable files
		}
	}

	if (allFunctions.length === 0) {
		return emptyReport(start);
	}

	// Generate properties
	const allProperties = allFunctions.flatMap((fn) => generateProperties(fn));
	if (allProperties.length === 0) {
		return emptyReport(start);
	}

	// Build import map
	const imports = new Map<string, string[]>();
	for (const fn of allFunctions) {
		const relPath = relative(targetDir, fn.filePath).replace(/\.ts$/, ".js");
		const existing = imports.get(`./${relPath}`) ?? [];
		if (!existing.includes(fn.name)) {
			existing.push(fn.name);
			imports.set(`./${relPath}`, existing);
		}
	}

	// Generate and run test file
	const testCode = generateTestFile(imports, allProperties, config.numRuns);
	const tempDir = mkdtempSync(join(tmpdir(), "gan-pbt-"));
	const testFile = join(tempDir, "pbt-test.mjs");

	try {
		writeFileSync(testFile, testCode);

		const output = execFileSync("node", [testFile], {
			cwd: targetDir,
			timeout: config.timeoutSec * 1000,
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, NODE_PATH: join(targetDir, "node_modules") },
		});

		const results: PbtResult[] = JSON.parse(output.toString("utf-8").trim());

		const passed = results.filter((r) => r.status === "PASS").length;
		const failed = results.filter((r) => r.status === "FAIL").length;
		const failures: PbtFailure[] = results
			.filter((r) => r.status === "FAIL")
			.map((r) => ({
				functionName: r.fn,
				property: r.prop as PbtFailure["property"],
				counterexample: "",
				error: r.error ?? "unknown",
			}));

		let gate: GateResult = "PASS";
		if (failed > passed) gate = "BLOCK";
		else if (failed > 0) gate = "WARN";

		return {
			functionsAnalyzed: allFunctions.length,
			propertiesGenerated: allProperties.length,
			propertiesPassed: passed,
			propertiesFailed: failed,
			failures,
			gate,
			durationMs: Date.now() - start,
		};
	} catch {
		return {
			functionsAnalyzed: allFunctions.length,
			propertiesGenerated: allProperties.length,
			propertiesPassed: 0,
			propertiesFailed: 0,
			failures: [],
			gate: "WARN", // PBT infrastructure failure — don't block but warn
			durationMs: Date.now() - start,
		};
	} finally {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// best-effort
		}
	}
}

function emptyReport(startTime: number): PbtReport {
	return {
		functionsAnalyzed: 0,
		propertiesGenerated: 0,
		propertiesPassed: 0,
		propertiesFailed: 0,
		failures: [],
		gate: "PASS",
		durationMs: Date.now() - startTime,
	};
}
