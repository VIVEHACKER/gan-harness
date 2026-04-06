import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanSecrets } from "../src/layer1/secret-scan.js";

// Build fake secrets at runtime to avoid triggering hook scanners on this file
const FAKE_AWS = "AKIA" + "IOSFODNN7EXAMPLE";
const FAKE_GHP = "ghp_" + "abcdefghijklmnopqrstuvwxyz1234567890";

describe("scanSecrets", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-secrets-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns PASS for clean project", async () => {
		writeFileSync(join(tempDir, "app.ts"), 'export const hello = "world";\n');
		const result = await scanSecrets(tempDir);
		expect(result.status).toBe("PASS");
		expect(result.detail).toContain("no secrets");
	});

	it("detects AWS access key pattern", async () => {
		writeFileSync(join(tempDir, "config.ts"), `const key = "${FAKE_AWS}";\n`);
		const result = await scanSecrets(tempDir);
		expect(result.status).toBe("FAIL");
		expect(result.detail).toContain("AWS");
	});

	it("detects hardcoded password", async () => {
		writeFileSync(join(tempDir, "db.py"), "password = 'mysecretpass123'\n");
		const result = await scanSecrets(tempDir);
		expect(result.status).toBe("FAIL");
		expect(result.detail).toContain("Password");
	});

	it("detects GitHub PAT", async () => {
		writeFileSync(join(tempDir, "ci.ts"), `const token = "${FAKE_GHP}";\n`);
		const result = await scanSecrets(tempDir);
		expect(result.status).toBe("FAIL");
		expect(result.detail).toContain("GitHub");
	});

	it("ignores node_modules", async () => {
		const nmDir = join(tempDir, "node_modules", "pkg");
		mkdirSync(nmDir, { recursive: true });
		writeFileSync(join(nmDir, "index.js"), `const key = "${FAKE_AWS}";\n`);
		writeFileSync(join(tempDir, "app.ts"), "export const clean = true;\n");
		const result = await scanSecrets(tempDir);
		expect(result.status).toBe("PASS");
	});

	it("scans .env files", async () => {
		writeFileSync(
			join(tempDir, ".env.production"),
			"password = 'leaked_here_now'\n",
		);
		const result = await scanSecrets(tempDir);
		expect(result.status).toBe("FAIL");
	});

	it("scans yaml files", async () => {
		writeFileSync(join(tempDir, "deploy.yaml"), `api_key: "${FAKE_AWS}"\n`);
		const result = await scanSecrets(tempDir);
		expect(result.status).toBe("FAIL");
	});

	it("returns empty dir as PASS", async () => {
		const result = await scanSecrets(tempDir);
		expect(result.status).toBe("PASS");
	});
});
