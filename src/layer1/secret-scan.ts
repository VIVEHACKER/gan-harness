import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { glob } from "glob";
import type { CheckResult, SecretMatch } from "../types.js";

// Build regex patterns at runtime to avoid triggering secret scanners on this file
function pat(prefix: string, suffix: string): RegExp {
	return new RegExp(prefix + suffix, "g");
}
function pati(prefix: string, suffix: string): RegExp {
	return new RegExp(prefix + suffix, "gi");
}

const SECRET_PATTERNS: readonly { name: string; regex: RegExp }[] = [
	{ name: "AWS Access Key", regex: pat("AKIA", "[0-9A-Z]{16}") },
	{ name: "OpenAI/Stripe Key", regex: pat("sk" + "-", "[a-zA-Z0-9]{20,}") },
	{ name: "GitHub PAT", regex: pat("ghp" + "_", "[a-zA-Z0-9]{36}") },
	{
		name: "Slack Bot Token",
		regex: pat("xox" + "b-", "[0-9]+-[0-9]+-[a-zA-Z0-9]+"),
	},
	{ name: "Anthropic Key", regex: pat("sk-" + "ant-", "[a-zA-Z0-9-]{20,}") },
	{ name: "Private Key", regex: pati("PRIVATE", "[_ ]KEY") },
	{
		name: "Hardcoded Password",
		regex: pati("password\\s*=\\s*", "[\"'][^\"']{4,}"),
	},
	{
		name: "Hardcoded Secret",
		regex: pati("secret\\s*=\\s*", "[\"'][^\"']{4,}"),
	},
];

const CODE_GLOBS = [
	"**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,php,sh,bash,yaml,yml,json,xml,toml,properties}",
	"**/.env*",
];
const IGNORE_DIRS = [
	"**/node_modules/**",
	"**/.git/**",
	"**/dist/**",
	"**/build/**",
	"**/.venv/**",
	"**/secret-scan.*",
];

export async function scanSecrets(targetDir: string): Promise<CheckResult> {
	const start = Date.now();
	const matches: SecretMatch[] = [];

	const files = await glob(CODE_GLOBS, {
		cwd: targetDir,
		ignore: IGNORE_DIRS,
		absolute: true,
		nodir: true,
	});

	const FILE_CAP = 500;
	const truncated = files.length > FILE_CAP;
	for (const filePath of files.slice(0, FILE_CAP)) {
		try {
			const content = await readFile(filePath, "utf-8");
			const lines = content.split("\n");

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				for (const pattern of SECRET_PATTERNS) {
					pattern.regex.lastIndex = 0;
					if (pattern.regex.test(line)) {
						matches.push({
							file: relative(targetDir, filePath),
							line: i + 1,
							pattern: pattern.name,
						});
					}
				}
			}
		} catch {
			// skip unreadable files
		}

		if (matches.length >= 10) break;
	}

	const durationMs = Date.now() - start;

	if (matches.length > 0) {
		const detail = matches
			.slice(0, 5)
			.map((m) => `${m.file}:${m.line} (${m.pattern})`)
			.join("; ");
		return {
			name: "Secrets",
			status: "FAIL",
			command: "secret-scan",
			detail: `${matches.length} suspicious pattern(s): ${detail}`,
			durationMs,
		};
	}

	return {
		name: "Secrets",
		status: truncated ? "FAIL" : "PASS",
		command: "secret-scan",
		detail: truncated
			? `no secrets in first ${FILE_CAP} files, but ${files.length - FILE_CAP} files were NOT scanned`
			: "no secrets found",
		durationMs,
	};
}
