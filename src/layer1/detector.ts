import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectDetection } from "../types.js";

// Safe tool allowlist — only these names are accepted
const KNOWN_TOOLS = new Set([
	"npm",
	"npx",
	"node",
	"make",
	"python3",
	"pytest",
	"ruff",
	"mypy",
	"cargo",
	"go",
	"golangci-lint",
]);

function hasCmd(cmd: string): boolean {
	if (!KNOWN_TOOLS.has(cmd)) return false;
	const pathDirs = (process.env.PATH ?? "").split(":");
	return pathDirs.some((dir) => existsSync(join(dir, cmd)));
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function hasMakeTarget(dir: string, target: string): Promise<boolean> {
	const makefile = join(dir, "Makefile");
	if (!(await fileExists(makefile))) return false;
	try {
		const content = await readFile(makefile, "utf-8");
		const safeName = target.replace(/[^a-zA-Z0-9_-]/g, "");
		return new RegExp(`^${safeName}:`, "m").test(content);
	} catch {
		return false;
	}
}

export async function detectProject(
	targetDir: string,
): Promise<ProjectDetection> {
	if (await hasMakeTarget(targetDir, "build")) {
		return {
			type: "make",
			buildCmd: "make build",
			testCmd: (await hasMakeTarget(targetDir, "test")) ? "make test" : "",
			lintCmd: (await hasMakeTarget(targetDir, "lint")) ? "make lint" : "",
			typecheckCmd: "",
		};
	}

	if (await fileExists(join(targetDir, "package.json"))) {
		const hasTsConfig = await fileExists(join(targetDir, "tsconfig.json"));
		return {
			type: "node",
			buildCmd: hasCmd("npm") ? "npm run build --if-present" : "",
			testCmd: hasCmd("npm") ? "npm test --if-present" : "",
			lintCmd: hasCmd("npm") ? "npm run lint --if-present" : "",
			typecheckCmd: hasTsConfig && hasCmd("npx") ? "npx tsc --noEmit" : "",
		};
	}

	if (await fileExists(join(targetDir, "pyproject.toml"))) {
		const hasVenv = await fileExists(join(targetDir, ".venv", "bin", "python"));
		const venvPrefix = hasVenv ? ".venv/bin/" : "";
		const pyTest = hasCmd("pytest") || hasVenv;
		const pyRuff =
			hasCmd("ruff") ||
			(await fileExists(join(targetDir, ".venv", "bin", "ruff")));
		return {
			type: "python",
			buildCmd: "",
			testCmd: pyTest ? `${venvPrefix}pytest` : "",
			lintCmd: hasCmd("ruff")
				? "ruff check ."
				: pyRuff
					? `${venvPrefix}ruff check .`
					: "",
			typecheckCmd: hasCmd("mypy") ? "mypy ." : "",
		};
	}

	if (await fileExists(join(targetDir, "Cargo.toml"))) {
		return {
			type: "rust",
			buildCmd: hasCmd("cargo") ? "cargo build" : "",
			testCmd: hasCmd("cargo") ? "cargo test" : "",
			lintCmd: hasCmd("cargo") ? "cargo clippy" : "",
			typecheckCmd: "",
		};
	}

	if (await fileExists(join(targetDir, "go.mod"))) {
		return {
			type: "go",
			buildCmd: hasCmd("go") ? "go build ./..." : "",
			testCmd: hasCmd("go") ? "go test ./..." : "",
			lintCmd: hasCmd("golangci-lint") ? "golangci-lint run" : "",
			typecheckCmd: "",
		};
	}

	return {
		type: "unknown",
		buildCmd: "",
		testCmd: "",
		lintCmd: "",
		typecheckCmd: "",
	};
}
