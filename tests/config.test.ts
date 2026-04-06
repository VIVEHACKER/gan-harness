import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns defaults when no config file exists", async () => {
		const config = await loadConfig(tempDir);
		expect(config.targetDir).toBe(tempDir);
		expect(config.timeoutSec).toBe(120);
		expect(config.buildCmd).toBe("");
		expect(config.localLlm.enabled).toBe(true);
		expect(config.layer2SkipMaxLines).toBe(20);
	});

	it("reads from .harness/config.json", async () => {
		const harnessDir = join(tempDir, ".harness");
		mkdirSync(harnessDir, { recursive: true });
		writeFileSync(
			join(harnessDir, "config.json"),
			JSON.stringify({
				timeout_sec: 60,
				build_cmd: "make build",
				test_cmd: "make test",
				layer2_skip_max_lines: 50,
			}),
		);

		const config = await loadConfig(tempDir);
		expect(config.timeoutSec).toBe(60);
		expect(config.buildCmd).toBe("make build");
		expect(config.testCmd).toBe("make test");
		expect(config.layer2SkipMaxLines).toBe(50);
	});

	it("clamps timeoutSec to 10-3600", async () => {
		const harnessDir = join(tempDir, ".harness");
		mkdirSync(harnessDir, { recursive: true });
		writeFileSync(
			join(harnessDir, "config.json"),
			JSON.stringify({ timeout_sec: 1 }),
		);

		const config = await loadConfig(tempDir);
		expect(config.timeoutSec).toBe(10);
	});

	it("env vars override config file", async () => {
		const harnessDir = join(tempDir, ".harness");
		mkdirSync(harnessDir, { recursive: true });
		writeFileSync(
			join(harnessDir, "config.json"),
			JSON.stringify({ build_cmd: "from-file" }),
		);

		process.env.HARNESS_BUILD_CMD = "from-env";
		const config = await loadConfig(tempDir);
		expect(config.buildCmd).toBe("from-env");
		delete process.env.HARNESS_BUILD_CMD;
	});
});
