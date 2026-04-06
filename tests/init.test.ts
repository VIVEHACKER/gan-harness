import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initHarness } from "../src/init.js";

describe("initHarness", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-init-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("creates .harness/ with all files", async () => {
		const created = await initHarness(tempDir);

		expect(created).toContain(".harness/contract.md");
		expect(created).toContain(".harness/eval-criteria.md");
		expect(created).toContain(".harness/state.json");
		expect(created).toContain(".harness/config.json");
		expect(created).toContain(".gitignore");

		expect(existsSync(join(tempDir, ".harness", "contract.md"))).toBe(true);
		expect(existsSync(join(tempDir, ".harness", "rounds"))).toBe(true);
		expect(existsSync(join(tempDir, ".harness", "traces"))).toBe(true);
		expect(existsSync(join(tempDir, ".harness", "eval-data"))).toBe(true);
	});

	it("does not overwrite existing files", async () => {
		await initHarness(tempDir);
		const secondRun = await initHarness(tempDir);
		expect(secondRun.length).toBe(0);
	});

	it("appends .harness/ to existing .gitignore", async () => {
		writeFileSync(join(tempDir, ".gitignore"), "node_modules/\n");
		await initHarness(tempDir);

		const content = readFileSync(join(tempDir, ".gitignore"), "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain(".harness/");
	});

	it("skips .gitignore append if already present", async () => {
		writeFileSync(join(tempDir, ".gitignore"), "node_modules/\n.harness/\n");
		const created = await initHarness(tempDir);
		expect(created).not.toContain(".gitignore (appended .harness/)");
	});

	it("state.json has valid structure", async () => {
		await initHarness(tempDir);
		const state = JSON.parse(
			readFileSync(join(tempDir, ".harness", "state.json"), "utf-8"),
		);
		expect(state.version).toBe("0.1.0");
		expect(state.phase).toBe("idle");
		expect(state.tier).toBe(1);
	});
});
