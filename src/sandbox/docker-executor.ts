import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type {
	CheckResult,
	CheckStatus,
	SandboxConfig,
	SandboxExecutor,
} from "../types.js";

function isDockerAvailable(): boolean {
	try {
		execFileSync("docker", ["info"], {
			timeout: 5_000,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return true;
	} catch {
		return false;
	}
}

export function createDockerExecutor(
	config: SandboxConfig,
	targetDir: string,
): SandboxExecutor {
	if (!config.enabled) {
		return { available: false, runCheck: noopCheck, dispose: () => {} };
	}

	const dockerOk = isDockerAvailable();
	if (!dockerOk) {
		return { available: false, runCheck: noopCheck, dispose: () => {} };
	}

	const containerId = `gan-sandbox-${randomUUID().slice(0, 8)}`;
	let started = false;

	// Start long-lived container
	try {
		execFileSync(
			"docker",
			[
				"run",
				"-d",
				"--rm",
				"--name",
				containerId,
				`--cpus=${config.cpus}`,
				`--memory=${config.memoryMb}m`,
				"-v",
				`${targetDir}:/workspace`,
				"-w",
				"/workspace",
				config.image,
				"sleep",
				String(config.totalTimeoutSec + 10),
			],
			{ timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] },
		);
		started = true;
	} catch {
		return { available: false, runCheck: noopCheck, dispose: () => {} };
	}

	return {
		available: true,
		runCheck: (
			name: string,
			cmd: string,
			_targetDir: string,
			timeoutSec: number,
		): CheckResult => {
			if (!cmd) {
				return {
					name,
					status: "N/A" as CheckStatus,
					command: "",
					detail: "auto-detect failed",
					durationMs: 0,
				};
			}

			const effectiveTimeout = Math.min(timeoutSec, config.perCheckTimeoutSec);
			const start = Date.now();

			try {
				const output = execFileSync(
					"docker",
					["exec", containerId, ...cmd.split(/\s+/).filter(Boolean)],
					{
						timeout: effectiveTimeout * 1000,
						stdio: ["ignore", "pipe", "pipe"],
					},
				);

				return {
					name,
					status: "PASS" as CheckStatus,
					command: `[sandbox] ${cmd}`,
					detail: output.toString("utf-8").trim().slice(0, 200) || "ok",
					durationMs: Date.now() - start,
				};
			} catch (err: unknown) {
				const durationMs = Date.now() - start;
				const e = err as {
					status?: number;
					stderr?: Buffer;
					stdout?: Buffer;
					killed?: boolean;
				};

				if (e.killed) {
					return {
						name,
						status: "FAIL",
						command: `[sandbox] ${cmd}`,
						detail: `TIMEOUT: ${effectiveTimeout}s exceeded`,
						durationMs,
					};
				}

				const stderr = e.stderr?.toString("utf-8").trim().slice(0, 200) ?? "";
				const stdout = e.stdout?.toString("utf-8").trim().slice(0, 200) ?? "";

				return {
					name,
					status: "FAIL",
					command: `[sandbox] ${cmd}`,
					detail: stderr || stdout || `exit code ${e.status ?? "unknown"}`,
					durationMs,
				};
			}
		},
		dispose: () => {
			if (!started) return;
			try {
				execFileSync("docker", ["rm", "-f", containerId], {
					timeout: 10_000,
					stdio: ["ignore", "pipe", "pipe"],
				});
			} catch {
				// best-effort cleanup
			}
		},
	};
}

function noopCheck(
	name: string,
	_cmd: string,
	_targetDir: string,
	_timeoutSec: number,
): CheckResult {
	return {
		name,
		status: "N/A",
		command: "",
		detail: "sandbox unavailable",
		durationMs: 0,
	};
}
