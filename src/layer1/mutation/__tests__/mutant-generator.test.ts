import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateMutants } from "../mutant-generator.js";

describe("generateMutants", () => {
	let tempDir: string;
	let testFile: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "gen-test-"));
		testFile = join(tempDir, "sample.ts");
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("generates mutants for simple source", () => {
		writeFileSync(
			testFile,
			`export function add(a: number, b: number): number {
  if (a === 0) return b;
  return a + b;
}
`,
		);

		const mutants = generateMutants(testFile, 10);
		expect(mutants.length).toBeGreaterThan(0);
		expect(mutants.length).toBeLessThanOrEqual(10);
	});

	it("respects maxMutants cap", () => {
		writeFileSync(
			testFile,
			`export function check(x: number): boolean {
  if (x > 0) return true;
  if (x < 0) return false;
  if (x === 0) return true;
  return false;
}
`,
		);

		const mutants = generateMutants(testFile, 3);
		expect(mutants.length).toBeLessThanOrEqual(3);
	});

	it("each mutant has required fields", () => {
		writeFileSync(testFile, "export const x = true;\n");

		const mutants = generateMutants(testFile, 5);
		for (const m of mutants) {
			expect(m.id).toBeTruthy();
			expect(m.file).toBe(testFile);
			expect(m.line).toBeGreaterThan(0);
			expect(m.operator).toBeTruthy();
			expect(m.mutated).not.toBe(m.original);
		}
	});

	it("returns empty for comment-only files", () => {
		writeFileSync(testFile, "// just a comment\n// another one\n");
		const mutants = generateMutants(testFile, 10);
		expect(mutants.length).toBe(0);
	});
});
