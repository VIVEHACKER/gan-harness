import { describe, expect, it } from "vitest";
import type { SandboxConfig } from "../../types.js";
import { createDockerExecutor } from "../docker-executor.js";

const disabledConfig: SandboxConfig = {
	enabled: false,
	cpus: "1",
	memoryMb: 512,
	perCheckTimeoutSec: 30,
	totalTimeoutSec: 120,
	image: "node:22-slim",
	fallbackOnError: true,
};

describe("createDockerExecutor", () => {
	it("returns unavailable executor when disabled", () => {
		const executor = createDockerExecutor(disabledConfig, "/tmp");
		expect(executor.available).toBe(false);
	});

	it("dispose is safe to call on unavailable executor", () => {
		const executor = createDockerExecutor(disabledConfig, "/tmp");
		expect(() => executor.dispose()).not.toThrow();
	});

	it("runCheck returns N/A for unavailable executor", () => {
		const executor = createDockerExecutor(disabledConfig, "/tmp");
		const result = executor.runCheck("Test", "echo hi", "/tmp", 10);
		expect(result.status).toBe("N/A");
		expect(result.detail).toBe("sandbox unavailable");
	});
});
