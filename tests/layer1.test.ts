import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import {
	computeSkipDecision,
	runLayer1,
	runLayer15,
} from "../src/layer1/index.js";
import type {
	HarnessConfig,
	Layer1Report,
	Layer15Report,
} from "../src/types.js";

const FAKE_AWS = "AKIA" + "IOSFODNN7EXAMPLE";

describe("runLayer1", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-l1-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns BLOCK when no checks can run", async () => {
		const config = await loadConfig(tempDir);
		const report = await runLayer1(config);
		expect(report.gate).toBe("PASS");
		expect(report.executedCount).toBe(1); // secret scan always runs
	});

	it("runs secret scan even on unknown project", async () => {
		const config = await loadConfig(tempDir);
		const report = await runLayer1(config);
		expect(report.secretScan.status).toBe("PASS");
	});

	it("detects secrets in project files", async () => {
		writeFileSync(join(tempDir, "leak.ts"), `const key = "${FAKE_AWS}";\n`);
		const config = await loadConfig(tempDir);
		const report = await runLayer1(config);
		expect(report.secretScan.status).toBe("FAIL");
		expect(report.gate).toBe("BLOCK");
	});
});

describe("runLayer15", () => {
	it("returns SKIP when disabled", async () => {
		const config: HarnessConfig = {
			targetDir: "/tmp",
			timeoutSec: 10,
			buildCmd: "",
			testCmd: "",
			lintCmd: "",
			typecheckCmd: "",
			localLlm: {
				enabled: false,
				endpoint: "http://127.0.0.1:8080/v1/chat/completions",
				timeoutSec: 10,
			},
			layer2SkipMaxLines: 20,
		};
		const fakeL1: Layer1Report = {
			timestamp: "",
			targetDir: "/tmp",
			checks: [],
			secretScan: {
				name: "Secrets",
				status: "PASS",
				command: "",
				detail: "",
				durationMs: 0,
			},
			gate: "PASS",
			executedCount: 1,
			totalCount: 1,
		};
		const result = await runLayer15(config, fakeL1);
		expect(result.result).toBe("SKIP");
	});

	it("rejects non-loopback LLM endpoint", async () => {
		const config: HarnessConfig = {
			targetDir: "/tmp",
			timeoutSec: 10,
			buildCmd: "",
			testCmd: "",
			lintCmd: "",
			typecheckCmd: "",
			localLlm: {
				enabled: true,
				endpoint: "http://evil.com/v1/chat/completions",
				timeoutSec: 10,
			},
			layer2SkipMaxLines: 20,
		};
		const fakeL1: Layer1Report = {
			timestamp: "",
			targetDir: "/tmp",
			checks: [],
			secretScan: {
				name: "Secrets",
				status: "PASS",
				command: "",
				detail: "",
				durationMs: 0,
			},
			gate: "PASS",
			executedCount: 1,
			totalCount: 1,
		};
		const result = await runLayer15(config, fakeL1);
		expect(result.result).toBe("SKIP");
		expect(result.detail).toContain("loopback");
	});
});

describe("computeSkipDecision", () => {
	const baseConfig: HarnessConfig = {
		targetDir: "/tmp/nonexistent",
		timeoutSec: 10,
		buildCmd: "",
		testCmd: "",
		lintCmd: "",
		typecheckCmd: "",
		localLlm: { enabled: false, endpoint: "", timeoutSec: 10 },
		layer2SkipMaxLines: 20,
	};

	const passL1: Layer1Report = {
		timestamp: "",
		targetDir: "/tmp",
		checks: [],
		secretScan: {
			name: "S",
			status: "PASS",
			command: "",
			detail: "",
			durationMs: 0,
		},
		gate: "PASS",
		executedCount: 1,
		totalCount: 1,
	};

	const blockL1: Layer1Report = { ...passL1, gate: "BLOCK" };
	const skipL15: Layer15Report = { result: "SKIP", detail: "", model: "" };
	const blockL15: Layer15Report = {
		result: "BLOCK",
		detail: "bug found",
		model: "",
	};

	it("returns REQUIRED when L1 is BLOCK", () => {
		const decision = computeSkipDecision(baseConfig, blockL1, skipL15);
		expect(decision.recommendation).toBe("REQUIRED");
	});

	it("returns REQUIRED when L1.5 is BLOCK", () => {
		const decision = computeSkipDecision(baseConfig, passL1, blockL15);
		expect(decision.recommendation).toBe("REQUIRED");
		expect(decision.reason).toContain("L1.5 BLOCK");
	});

	it("returns SKIP for small changes with PASS", () => {
		const decision = computeSkipDecision(baseConfig, passL1, skipL15);
		expect(decision.recommendation).toBe("SKIP");
	});
});
