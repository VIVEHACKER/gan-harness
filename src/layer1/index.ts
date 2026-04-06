import { execSync } from "node:child_process";
import type {
	CheckResult,
	GateResult,
	HarnessConfig,
	Layer1Report,
	Layer15Report,
	SkipDecision,
	VerifyResult,
} from "../types.js";
import { detectProject } from "./detector.js";
import { runCheck } from "./runner.js";
import { scanSecrets } from "./secret-scan.js";

function gitStat(targetDir: string, flag: string): string {
	try {
		return execSync(`git ${flag}`, {
			cwd: targetDir,
			stdio: ["ignore", "pipe", "pipe"],
		})
			.toString("utf-8")
			.trim();
	} catch {
		return "";
	}
}

function countChangedLines(targetDir: string): number {
	const cached = gitStat(targetDir, "diff --cached --numstat");
	const working = cached || gitStat(targetDir, "diff --numstat");
	if (!working) return 0;
	return working.split("\n").reduce((sum, line) => {
		const [add, del] = line.split("\t");
		return sum + (parseInt(add, 10) || 0) + (parseInt(del, 10) || 0);
	}, 0);
}

function countNewFiles(targetDir: string): number {
	const out = gitStat(targetDir, "diff --cached --diff-filter=A --name-only");
	return out ? out.split("\n").length : 0;
}

function countSecurityFiles(targetDir: string): number {
	const out = gitStat(targetDir, "diff --cached --name-only");
	if (!out) return 0;
	const securityPattern =
		/auth|login|token|secret|password|payment|crypto|session/i;
	return out.split("\n").filter((f) => securityPattern.test(f)).length;
}

export async function runLayer1(config: HarnessConfig): Promise<Layer1Report> {
	const detected = await detectProject(config.targetDir);

	const buildCmd = config.buildCmd || detected.buildCmd;
	const testCmd = config.testCmd || detected.testCmd;
	const lintCmd = config.lintCmd || detected.lintCmd;
	const typecheckCmd = config.typecheckCmd || detected.typecheckCmd;

	const checks: CheckResult[] = [
		runCheck("Build", buildCmd, config.targetDir, config.timeoutSec),
		runCheck("Tests", testCmd, config.targetDir, config.timeoutSec),
		runCheck("Lint", lintCmd, config.targetDir, config.timeoutSec),
		runCheck("TypeCheck", typecheckCmd, config.targetDir, config.timeoutSec),
	];

	const secretScan = await scanSecrets(config.targetDir);

	const allResults = [...checks, secretScan];
	const executedCount = allResults.filter((r) => r.status !== "N/A").length;
	const hasFailure = allResults.some((r) => r.status === "FAIL");
	const gate: GateResult = hasFailure || executedCount === 0 ? "BLOCK" : "PASS";

	return {
		timestamp: new Date().toISOString(),
		targetDir: config.targetDir,
		checks,
		secretScan,
		gate,
		executedCount,
		totalCount: allResults.length,
	};
}

export async function runLayer15(
	config: HarnessConfig,
	_layer1: Layer1Report,
): Promise<Layer15Report> {
	if (!config.localLlm.enabled) {
		return { result: "SKIP", detail: "Local LLM disabled", model: "" };
	}

	// H-2 fix: restrict LLM endpoint to loopback only (prevent SSRF)
	let endpointUrl: URL;
	try {
		endpointUrl = new URL(config.localLlm.endpoint);
	} catch {
		return { result: "SKIP", detail: "Invalid LLM endpoint URL", model: "" };
	}
	if (
		endpointUrl.hostname !== "127.0.0.1" &&
		endpointUrl.hostname !== "localhost"
	) {
		return {
			result: "SKIP",
			detail: "LLM endpoint must be loopback (127.0.0.1 or localhost)",
			model: "",
		};
	}
	const healthUrl = config.localLlm.endpoint.replace(
		"/chat/completions",
		"/health",
	);
	try {
		const resp = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
		if (!resp.ok) throw new Error(`health check ${resp.status}`);
	} catch {
		return {
			result: "SKIP",
			detail: "Local LLM not running",
			model: "qwen3.5-27b",
		};
	}

	// Local LLM is running but full integration deferred to Phase 1
	return {
		result: "SKIP",
		detail: "Local LLM integration coming in v0.2",
		model: "qwen3.5-27b",
	};
}

export function computeSkipDecision(
	config: HarnessConfig,
	layer1: Layer1Report,
	layer15: Layer15Report,
): SkipDecision {
	if (layer1.gate === "BLOCK") {
		return {
			recommendation: "REQUIRED",
			changedLines: 0,
			newFiles: 0,
			securityFiles: 0,
			reason: "L1 BLOCK",
		};
	}

	const changedLines = countChangedLines(config.targetDir);
	const newFiles = countNewFiles(config.targetDir);
	const securityFiles = countSecurityFiles(config.targetDir);

	const reasons: string[] = [];
	if (changedLines > config.layer2SkipMaxLines)
		reasons.push(`${changedLines} lines > ${config.layer2SkipMaxLines}`);
	if (newFiles > 0) reasons.push(`${newFiles} new file(s)`);
	if (securityFiles > 0) reasons.push(`${securityFiles} security file(s)`);
	if (layer15.result === "BLOCK") reasons.push("L1.5 BLOCK");

	const recommendation = reasons.length === 0 ? "SKIP" : "REQUIRED";
	return {
		recommendation,
		changedLines,
		newFiles,
		securityFiles,
		reason: reasons.join(", "),
	};
}

export async function verify(config: HarnessConfig): Promise<VerifyResult> {
	const layer1 = await runLayer1(config);
	const layer15 = await runLayer15(config, layer1);
	const skipDecision = computeSkipDecision(config, layer1, layer15);

	const finalGate: GateResult =
		layer1.gate === "BLOCK" || layer15.result === "BLOCK" ? "BLOCK" : "PASS";

	return { layer1, layer15, skipDecision, finalGate };
}
