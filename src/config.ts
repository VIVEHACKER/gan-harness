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
	mutation: {
		enabled: true,
		maxMutants: 20,
		scoreWarn: 0.6,
		scoreBlock: 0.3,
	},
	sandbox: {
		enabled: false,
		cpus: "1",
		memoryMb: 512,
		perCheckTimeoutSec: 30,
		totalTimeoutSec: 120,
		image: "node:22-slim",
		fallbackOnError: true,
	},
	pbt: {
		enabled: true,
		numRuns: 100,
		maxFunctions: 10,
		timeoutSec: 30,
	},
	evolution: {
		enabled: false,
		populationSize: 4,
		maxGenerations: 5,
		mutationRate: 0.3,
		crossoverRate: 0.5,
		eliteCount: 1,
	},
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

export async function loadConfig(targetDir: string): Promise<HarnessConfig> {
	const fromEnv: Partial<HarnessConfig> = {
		timeoutSec: envInt("HARNESS_TIMEOUT_SEC"),
		buildCmd: process.env.HARNESS_BUILD_CMD ?? "",
		testCmd: process.env.HARNESS_TEST_CMD ?? "",
		lintCmd: process.env.HARNESS_LINT_CMD ?? "",
		localLlm: {
			enabled: process.env.HARNESS_LLM_ENABLED !== "false",
			endpoint: process.env.HARNESS_LLM_ENDPOINT ?? DEFAULTS.localLlm.endpoint,
			timeoutSec: envInt("HARNESS_LLM_TIMEOUT") ?? DEFAULTS.localLlm.timeoutSec,
		},
		layer2SkipMaxLines: envInt("HARNESS_SKIP_MAX_LINES"),
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
				fromEnv.localLlm?.enabled ??
				fromFile.local_llm?.enabled ??
				DEFAULTS.localLlm.enabled,
			endpoint:
				fromEnv.localLlm?.endpoint ??
				fromFile.local_llm?.endpoint ??
				DEFAULTS.localLlm.endpoint,
			timeoutSec:
				fromEnv.localLlm?.timeoutSec ??
				fromFile.local_llm?.timeout_sec ??
				DEFAULTS.localLlm.timeoutSec,
		},
		layer2SkipMaxLines:
			fromEnv.layer2SkipMaxLines ??
			fromFile.layer2_skip_max_lines ??
			DEFAULTS.layer2SkipMaxLines,
		mutation: {
			enabled:
				process.env.HARNESS_MUTATION_ENABLED !== "false" &&
				DEFAULTS.mutation.enabled,
			maxMutants:
				envInt("HARNESS_MUTATION_MAX") ?? DEFAULTS.mutation.maxMutants,
			scoreWarn: DEFAULTS.mutation.scoreWarn,
			scoreBlock: DEFAULTS.mutation.scoreBlock,
		},
		sandbox: {
			enabled: process.env.HARNESS_SANDBOX_ENABLED === "true",
			cpus: DEFAULTS.sandbox.cpus,
			memoryMb: envInt("HARNESS_SANDBOX_MEMORY") ?? DEFAULTS.sandbox.memoryMb,
			perCheckTimeoutSec: DEFAULTS.sandbox.perCheckTimeoutSec,
			totalTimeoutSec: DEFAULTS.sandbox.totalTimeoutSec,
			image: process.env.HARNESS_SANDBOX_IMAGE ?? DEFAULTS.sandbox.image,
			fallbackOnError: DEFAULTS.sandbox.fallbackOnError,
		},
		pbt: {
			enabled:
				process.env.HARNESS_PBT_ENABLED !== "false" && DEFAULTS.pbt.enabled,
			numRuns: envInt("HARNESS_PBT_RUNS") ?? DEFAULTS.pbt.numRuns,
			maxFunctions: DEFAULTS.pbt.maxFunctions,
			timeoutSec: DEFAULTS.pbt.timeoutSec,
		},
		evolution: {
			enabled: process.env.HARNESS_EVOLUTION_ENABLED === "true",
			populationSize:
				envInt("HARNESS_EVOLUTION_POP") ?? DEFAULTS.evolution.populationSize,
			maxGenerations: DEFAULTS.evolution.maxGenerations,
			mutationRate: DEFAULTS.evolution.mutationRate,
			crossoverRate: DEFAULTS.evolution.crossoverRate,
			eliteCount: DEFAULTS.evolution.eliteCount,
		},
	};
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

function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}

function envInt(key: string): number | undefined {
	const val = process.env[key];
	if (val === undefined) return undefined;
	const n = parseInt(val, 10);
	return Number.isNaN(n) ? undefined : n;
}
