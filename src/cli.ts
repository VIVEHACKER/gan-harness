#!/usr/bin/env node
import { resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { pushToCloud } from "./cloud.js";
import { loadConfig } from "./config.js";
import { initHarness } from "./init.js";
import { verify } from "./layer1/index.js";
import type { CheckResult, VerifyResult } from "./types.js";

const program = new Command();

program
	.name("gan-harness")
	.description("Production safety net for AI agents")
	.version("0.1.0");

program
	.command("init")
	.description("Initialize .harness/ in current project")
	.argument("[dir]", "target directory", ".")
	.action(async (dir: string) => {
		const targetDir = resolve(dir);
		console.log(chalk.blue.bold("\n━━━ gan-harness init ━━━\n"));
		const created = await initHarness(targetDir);
		if (created.length === 0) {
			console.log(chalk.yellow("  .harness/ already exists"));
		} else {
			for (const f of created) {
				console.log(chalk.green("  ✓ ") + f);
			}
		}
		console.log(
			chalk.dim("\n  Run `gan-harness verify` to check your project\n"),
		);
	});

program
	.command("verify")
	.description("Run Layer 1 verification (build/test/lint/typecheck/secrets)")
	.argument("[dir]", "target directory", ".")
	.option("--json", "output as JSON")
	.option("--cloud [url]", "sync results to Pro dashboard")
	.action(
		async (dir: string, opts: { json?: boolean; cloud?: boolean | string }) => {
			const targetDir = resolve(dir);
			const config = await loadConfig(targetDir);
			const result = await verify(config);
			if (opts.json) {
				console.log(JSON.stringify(result, null, 2));
			} else {
				printResult(result);
			}
			// Cloud sync
			if (opts.cloud) {
				const apiUrl =
					typeof opts.cloud === "string" ? opts.cloud : "http://localhost:8090";
				const apiKey = process.env.HARNESS_API_KEY;
				const sync = await pushToCloud(result, apiUrl, apiKey);
				if (!opts.json) {
					const icon = sync.ok ? chalk.green("✓") : chalk.red("✗");
					console.log(`  ${icon} Cloud: ${sync.detail}\n`);
				}
			}

			process.exitCode = result.finalGate === "BLOCK" ? 2 : 0;
		},
	);

function statusIcon(status: string): string {
	if (status === "PASS") return chalk.green("✓");
	if (status === "FAIL") return chalk.red("✗");
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

function printResult(result: VerifyResult): void {
	console.log(chalk.blue.bold("\n━━━ gan-harness verify ━━━\n"));
	console.log(chalk.dim(`  target: ${result.layer1.targetDir}`));
	console.log(chalk.dim(`  time:   ${result.layer1.timestamp}\n`));

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

	console.log(chalk.bold("  Layer 1.5 — Local LLM"));
	console.log(
		`  ${statusIcon(result.layer15.result === "SKIP" ? "N/A" : result.layer15.result)} ${result.layer15.detail}\n`,
	);

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

	const bar =
		result.finalGate === "PASS"
			? chalk.green("━".repeat(40))
			: chalk.red("━".repeat(40));
	console.log(`  ${bar}`);
	console.log(`  Final: ${gateColor(result.finalGate)}`);
	console.log(`  ${bar}\n`);
}

program.parse();
