import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessConfig } from "./types.js";

const DEFAULTS: HarnessConfig = {
	targetDir: process.cwd(),
	timeoutSec: 120,
	buildCmd: "",
	testCmd: "",
	lintCmd: "",
	typecheckCmd: "",
	localLlm: {
		enabled: true,
		endpoint: "http://127.0.0.1:8080/v1/chat/completions",
		timeoutSec: 60,
	},
	layer2SkipMaxLines: 20,
};

interface ConfigFile {
	readonly timeout_sec?: number;
	readonly build_cmd?: string;
	readonly test_cmd?: string;
	readonly lint_cmd?: string;
	readonly typecheck_cmd?: string;
	readonly local_llm?: {
		readonly enabled?: boolean;
		readonly endpoint?: string;
		readonly timeout_sec?: number;
	};
	readonly layer2_skip_max_lines?: number;
}

function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}

function envInt(key: string): number | undefined {
	const val = process.env[key];
	if (val === undefined) return undefined;
	const n = parseInt(val, 10);
	return Number.isNaN(n) ? undefined : n;
}

async function loadConfigFile(targetDir: string): Promise<ConfigFile> {
	const configPath = join(targetDir, ".harness", "config.json");
	try {
		const raw = await readFile(configPath, "utf-8");
		return JSON.parse(raw) as ConfigFile;
	} catch {
		return {};
	}
}

export async function loadConfig(targetDir: string): Promise<HarnessConfig> {
	const fromEnv = {
		timeoutSec: envInt("HARNESS_TIMEOUT_SEC"),
		buildCmd: process.env.HARNESS_BUILD_CMD ?? "",
		testCmd: process.env.HARNESS_TEST_CMD ?? "",
		lintCmd: process.env.HARNESS_LINT_CMD ?? "",
		llmEnabled: process.env.HARNESS_LLM_ENABLED !== "false",
		llmEndpoint: process.env.HARNESS_LLM_ENDPOINT,
		llmTimeout: envInt("HARNESS_LLM_TIMEOUT"),
		skipMaxLines: envInt("HARNESS_SKIP_MAX_LINES"),
	};

	const fromFile = await loadConfigFile(targetDir);

	return {
		targetDir,
		timeoutSec: clamp(
			fromEnv.timeoutSec ?? fromFile.timeout_sec ?? DEFAULTS.timeoutSec,
			10,
			3600,
		),
		buildCmd: fromEnv.buildCmd || fromFile.build_cmd || "",
		testCmd: fromEnv.testCmd || fromFile.test_cmd || "",
		lintCmd: fromEnv.lintCmd || fromFile.lint_cmd || "",
		typecheckCmd: fromFile.typecheck_cmd || "",
		localLlm: {
			enabled:
				fromEnv.llmEnabled ??
				fromFile.local_llm?.enabled ??
				DEFAULTS.localLlm.enabled,
			endpoint:
				fromEnv.llmEndpoint ??
				fromFile.local_llm?.endpoint ??
				DEFAULTS.localLlm.endpoint,
			timeoutSec:
				fromEnv.llmTimeout ??
				fromFile.local_llm?.timeout_sec ??
				DEFAULTS.localLlm.timeoutSec,
		},
		layer2SkipMaxLines:
			fromEnv.skipMaxLines ??
			fromFile.layer2_skip_max_lines ??
			DEFAULTS.layer2SkipMaxLines,
	};
}
