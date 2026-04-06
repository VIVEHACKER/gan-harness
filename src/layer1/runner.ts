import { execFileSync } from "node:child_process";
import type { CheckResult, CheckStatus } from "../types.js";

const SHELL_METACHAR = /[;&|`$(){}!><\n]/;
const MAX_CMD_LENGTH = 500;

// Minimal safe environment — blocks NODE_OPTIONS injection, PATH poisoning
function safeEnv(): Record<string, string> {
	const env: Record<string, string> = { FORCE_COLOR: "0" };
	for (const key of [
		"PATH",
		"HOME",
		"USER",
		"LANG",
		"TERM",
		"NODE_ENV",
		"VIRTUAL_ENV",
	]) {
		const val = process.env[key];
		if (val) env[key] = val;
	}
	return env;
}

function validateCmd(cmd: string): string | null {
	if (cmd.length > MAX_CMD_LENGTH)
		return `command too long (${cmd.length} > ${MAX_CMD_LENGTH})`;
	if (SHELL_METACHAR.test(cmd)) return `unsafe shell metacharacters in command`;
	return null;
}

export function runCheck(
	name: string,
	cmd: string,
	targetDir: string,
	timeoutSec: number,
): CheckResult {
	if (!cmd) {
		return {
			name,
			status: "N/A",
			command: "",
			detail: "auto-detect failed",
			durationMs: 0,
		};
	}

	const violation = validateCmd(cmd);
	if (violation) {
		return {
			name,
			status: "FAIL",
			command: cmd,
			detail: `BLOCKED: ${violation}`,
			durationMs: 0,
		};
	}

	const parts = cmd.split(/\s+/).filter(Boolean);
	const [bin, ...args] = parts;

	const start = Date.now();
	try {
		const output = execFileSync(bin, args, {
			cwd: targetDir,
			timeout: timeoutSec * 1000,
			stdio: ["ignore", "pipe", "pipe"],
			shell: false,
			env: safeEnv(),
		});

		const detail = output.toString("utf-8").trim().slice(0, 200) || "ok";
		return {
			name,
			status: "PASS" as CheckStatus,
			command: cmd,
			detail,
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
				command: cmd,
				detail: `TIMEOUT: ${timeoutSec}s exceeded`,
				durationMs,
			};
		}

		const stderr = e.stderr?.toString("utf-8").trim().slice(0, 200) ?? "";
		const stdout = e.stdout?.toString("utf-8").trim().slice(0, 200) ?? "";
		const detail = stderr || stdout || `exit code ${e.status ?? "unknown"}`;

		return { name, status: "FAIL", command: cmd, detail, durationMs };
	}
}
