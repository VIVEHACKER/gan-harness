#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { runEvolution } from "./evolution/index.js";
import { initHarness } from "./init.js";
import type { VerifyExtendedResult } from "./layer1/index.js";
import { verify } from "./layer1/index.js";
import type { CheckResult } from "./types.js";

const program = new Command();

program
	.name("gan-harness")
	.description("Production safety net for AI agents")
	.version("0.2.0");

// --- init ---
program
	.command("init")
	.description("Initialize .harness/ in current project")
	.argument("[dir]", "target directory", ".")
	.action(async (dir: string) => {
		const targetDir = resolve(dir);
		console.log(chalk.blue.bold("\n━━━ gan-harness init ━━━\n"));

		const created = await initHarness(targetDir);
		if (created.length === 0) {
			console.log(
				chalk.yellow("  .harness/ already exists, nothing to create"),
			);
		} else {
			for (const f of created) {
				console.log(chalk.green("  ✓ ") + f);
			}
		}
		console.log(
			chalk.dim("\n  Run `gan-harness verify` to check your project\n"),
		);
	});

// --- verify ---
program
	.command("verify")
	.description(
		"Run verification (build/test/lint/typecheck/secrets/mutation/pbt)",
	)
	.argument("[dir]", "target directory", ".")
	.option("--json", "output as JSON")
	.option("--sandbox", "enable Docker sandbox execution")
	.option("--no-mutation", "disable mutation testing")
	.option("--no-pbt", "disable property-based testing")
	.action(
		async (
			dir: string,
			opts: {
				json?: boolean;
				sandbox?: boolean;
				mutation?: boolean;
				pbt?: boolean;
			},
		) => {
			const targetDir = resolve(dir);
			const config = await loadConfig(targetDir);

			// Override config with CLI flags
			const finalConfig = {
				...config,
				sandbox: {
					...config.sandbox,
					enabled: opts.sandbox ?? config.sandbox.enabled,
				},
				mutation: {
					...config.mutation,
					enabled: opts.mutation ?? config.mutation.enabled,
				},
				pbt: { ...config.pbt, enabled: opts.pbt ?? config.pbt.enabled },
			};

			const result = await verify(finalConfig);

			if (opts.json) {
				console.log(JSON.stringify(result, null, 2));
			} else {
				printResult(result);
			}

			process.exitCode = result.finalGate === "BLOCK" ? 2 : 0;
		},
	);

// --- evolve (T4 only) ---
program
	.command("evolve")
	.description("Evolutionary code optimization (T4 only)")
	.argument("<files...>", "source files to evolve")
	.option("--pop <size>", "population size", "4")
	.option("--gens <n>", "max generations", "5")
	.action(async (files: string[], opts: { pop: string; gens: string }) => {
		const config = await loadConfig(resolve("."));

		const originalFiles = new Map<string, string>();
		for (const f of files) {
			const absPath = resolve(f);
			originalFiles.set(absPath, readFileSync(absPath, "utf-8"));
		}

		console.log(chalk.blue.bold("\n━━━ gan-harness evolve ━━━\n"));
		console.log(
			chalk.dim(
				`  population: ${opts.pop}, generations: ${opts.gens}, files: ${files.length}\n`,
			),
		);

		const report = runEvolution(
			originalFiles,
			{
				...config.evolution,
				enabled: true,
				populationSize: parseInt(opts.pop, 10),
				maxGenerations: parseInt(opts.gens, 10),
			},
			config,
		);

		console.log(chalk.bold("  Results"));
		console.log(`  Generations: ${report.generations}`);
		console.log(`  Variants tested: ${report.totalVariants}`);
		console.log(
			`  Best fitness: ${report.bestFitness}${report.bestFitness >= 100 ? chalk.green(" (perfect)") : ""}`,
		);
		console.log(
			`  History: ${report.fitnessHistory.map((f) => f.toFixed(0)).join(" → ")}`,
		);
		console.log(chalk.dim(`  Duration: ${report.durationMs}ms\n`));
	});

function statusIcon(status: string): string {
	if (status === "PASS") return chalk.green("✓");
	if (status === "FAIL") return chalk.red("✗");
	if (status === "WARN") return chalk.yellow("!");
	return chalk.dim("—");
}

function gateColor(gate: string): string {
	if (gate === "PASS") return chalk.green.bold(gate);
	if (gate === "BLOCK") return chalk.red.bold(gate);
	return chalk.yellow.bold(gate);
}

function printCheck(check: CheckResult): void {
	const icon = statusIcon(check.status);
	const name = check.name.padEnd(10);
	const time = check.durationMs > 0 ? chalk.dim(` ${check.durationMs}ms`) : "";
	const cmd = check.command ? chalk.dim(` (${check.command})`) : "";

	console.log(`  ${icon} ${name}${time}${cmd}`);
	if (check.status === "FAIL") {
		console.log(chalk.red(`    ${check.detail.slice(0, 120)}`));
	}
}

function printResult(result: VerifyExtendedResult): void {
	console.log(chalk.blue.bold("\n━━━ gan-harness verify ━━━\n"));
	console.log(chalk.dim(`  target: ${result.layer1.targetDir}`));
	console.log(chalk.dim(`  time:   ${result.layer1.timestamp}\n`));

	// Layer 1
	console.log(chalk.bold("  Layer 1 — Static Checks ($0)"));
	console.log();
	for (const check of result.layer1.checks) {
		printCheck(check);
	}
	printCheck(result.layer1.secretScan);
	console.log();
	console.log(
		`  Gate: ${gateColor(result.layer1.gate)} (${result.layer1.executedCount}/${result.layer1.totalCount} checks)\n`,
	);

	// Mutation Testing
	if (result.mutation && result.mutation.totalMutants > 0) {
		console.log(chalk.bold("  Mutation Testing"));
		const pct = (result.mutation.score * 100).toFixed(0);
		console.log(
			`  ${statusIcon(result.mutation.gate)} Score: ${pct}% (${result.mutation.killed}/${result.mutation.totalMutants} killed)`,
		);
		if (result.mutation.survived > 0) {
			const survived = result.mutation.results
				.filter((r) => !r.killed)
				.slice(0, 3);
			for (const s of survived) {
				console.log(
					chalk.dim(
						`    survived: ${s.mutant.file}:${s.mutant.line} [${s.mutant.operator}]`,
					),
				);
			}
		}
		console.log(
			`  Gate: ${gateColor(result.mutation.gate)} ${chalk.dim(`${result.mutation.durationMs}ms`)}\n`,
		);
	}

	// PBT
	if (result.pbt && result.pbt.propertiesGenerated > 0) {
		console.log(chalk.bold("  Property-Based Testing"));
		console.log(
			`  ${statusIcon(result.pbt.gate)} ${result.pbt.propertiesPassed}/${result.pbt.propertiesGenerated} properties passed (${result.pbt.functionsAnalyzed} functions)`,
		);
		for (const f of result.pbt.failures.slice(0, 3)) {
			console.log(
				chalk.red(
					`    ${f.functionName}:${f.property} — ${f.error.slice(0, 80)}`,
				),
			);
		}
		console.log(
			`  Gate: ${gateColor(result.pbt.gate)} ${chalk.dim(`${result.pbt.durationMs}ms`)}\n`,
		);
	}

	// Layer 1.5
	console.log(chalk.bold("  Layer 1.5 — Local LLM"));
	console.log(
		`  ${statusIcon(result.layer15.result === "SKIP" ? "N/A" : result.layer15.result)} ${result.layer15.detail}\n`,
	);

	// Skip decision
	console.log(chalk.bold("  Layer 2 Recommendation"));
	if (result.skipDecision.recommendation === "SKIP") {
		console.log(chalk.green("  → SKIP (minor change, L1 passed)"));
		console.log(
			chalk.dim(
				`    ${result.skipDecision.changedLines} lines, ${result.skipDecision.newFiles} new files\n`,
			),
		);
	} else {
		console.log(chalk.yellow(`  → REQUIRED (${result.skipDecision.reason})\n`));
	}

	// Final
	const bar =
		result.finalGate === "PASS"
			? chalk.green("━".repeat(40))
			: result.finalGate === "WARN"
				? chalk.yellow("━".repeat(40))
				: chalk.red("━".repeat(40));
	console.log(`  ${bar}`);
	console.log(`  Final: ${gateColor(result.finalGate)}`);
	console.log(`  ${bar}\n`);
}

program.parse();
