import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectProject } from "../src/layer1/detector.js";

describe("detectProject", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-detect-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("detects Node.js project", async () => {
		writeFileSync(join(tempDir, "package.json"), "{}");
		const result = await detectProject(tempDir);
		expect(result.type).toBe("node");
		expect(result.buildCmd).toContain("npm");
		expect(result.testCmd).toContain("npm");
	});

	it("detects TypeScript in Node.js project", async () => {
		writeFileSync(join(tempDir, "package.json"), "{}");
		writeFileSync(join(tempDir, "tsconfig.json"), "{}");
		const result = await detectProject(tempDir);
		expect(result.typecheckCmd).toContain("tsc");
	});

	it("detects Python project", async () => {
		writeFileSync(
			join(tempDir, "pyproject.toml"),
			'[project]\nname = "test"\n',
		);
		const result = await detectProject(tempDir);
		expect(result.type).toBe("python");
	});

	it("detects Python venv", async () => {
		writeFileSync(
			join(tempDir, "pyproject.toml"),
			'[project]\nname = "test"\n',
		);
		const venvBin = join(tempDir, ".venv", "bin");
		mkdirSync(venvBin, { recursive: true });
		writeFileSync(join(venvBin, "python"), "#!/bin/sh\n");
		const result = await detectProject(tempDir);
		expect(result.testCmd).toContain(".venv/bin/pytest");
	});

	it("detects Rust project", async () => {
		writeFileSync(join(tempDir, "Cargo.toml"), '[package]\nname = "test"\n');
		const result = await detectProject(tempDir);
		expect(result.type).toBe("rust");
	});

	it("detects Go project", async () => {
		writeFileSync(join(tempDir, "go.mod"), "module test\n");
		const result = await detectProject(tempDir);
		expect(result.type).toBe("go");
	});

	it("detects Makefile project", async () => {
		writeFileSync(
			join(tempDir, "Makefile"),
			"build:\n\techo building\ntest:\n\techo testing\n",
		);
		const result = await detectProject(tempDir);
		expect(result.type).toBe("make");
		expect(result.buildCmd).toBe("make build");
		expect(result.testCmd).toBe("make test");
	});

	it("returns unknown for empty dir", async () => {
		const result = await detectProject(tempDir);
		expect(result.type).toBe("unknown");
		expect(result.buildCmd).toBe("");
	});
});
