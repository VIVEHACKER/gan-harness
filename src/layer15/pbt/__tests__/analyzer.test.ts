import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeFunctions } from "../analyzer.js";

describe("analyzeFunctions", () => {
	let tempDir: string;
	let testFile: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "pbt-test-"));
		testFile = join(tempDir, "sample.ts");
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("extracts exported functions with params", () => {
		writeFileSync(
			testFile,
			`export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return "Hello " + name;
}

function internal() { return 1; }
`,
		);

		const fns = analyzeFunctions(testFile, 10);
		expect(fns.length).toBe(2);
		expect(fns[0].name).toBe("add");
		expect(fns[0].params.length).toBe(2);
		expect(fns[0].params[0].type).toBe("number");
		expect(fns[1].name).toBe("greet");
		expect(fns[1].params[0].type).toBe("string");
	});

	it("handles async functions", () => {
		writeFileSync(
			testFile,
			`export async function fetchData(url: string): Promise<string> {
  return "";
}
`,
		);

		const fns = analyzeFunctions(testFile, 10);
		expect(fns.length).toBe(1);
		expect(fns[0].name).toBe("fetchData");
	});

	it("respects maxFunctions", () => {
		writeFileSync(
			testFile,
			`export function a() { }
export function b() { }
export function c() { }
`,
		);

		const fns = analyzeFunctions(testFile, 2);
		expect(fns.length).toBe(2);
	});

	it("returns empty for no exported functions", () => {
		writeFileSync(testFile, "const x = 1;\nfunction internal() {}\n");

		const fns = analyzeFunctions(testFile, 10);
		expect(fns.length).toBe(0);
	});

	it("parses unknown types as unknown", () => {
		writeFileSync(
			testFile,
			`export function process(data: CustomType): void {
  // ...
}
`,
		);

		const fns = analyzeFunctions(testFile, 10);
		expect(fns[0].params[0].type).toBe("unknown");
	});
});
