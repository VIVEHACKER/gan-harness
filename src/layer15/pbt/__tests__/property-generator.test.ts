import { describe, expect, it } from "vitest";
import type { FunctionSignature } from "../../../types.js";
import { generateProperties, generateTestFile } from "../property-generator.js";

describe("generateProperties", () => {
	it("generates no-throw and type-consistency for simple fn", () => {
		const fn: FunctionSignature = {
			name: "add",
			params: [
				{ name: "a", type: "number" },
				{ name: "b", type: "number" },
			],
			returnType: "number",
			exported: true,
			filePath: "/test.ts",
		};

		const props = generateProperties(fn);
		expect(props.length).toBeGreaterThanOrEqual(2);

		const kinds = props.map((p) => p.kind);
		expect(kinds).toContain("no-throw");
		expect(kinds).toContain("type-consistency");
	});

	it("generates idempotency for single-param fn", () => {
		const fn: FunctionSignature = {
			name: "normalize",
			params: [{ name: "s", type: "string" }],
			returnType: "string",
			exported: true,
			filePath: "/test.ts",
		};

		const props = generateProperties(fn);
		const kinds = props.map((p) => p.kind);
		expect(kinds).toContain("idempotency");
	});

	it("returns empty for no-param fn", () => {
		const fn: FunctionSignature = {
			name: "getTime",
			params: [],
			returnType: "number",
			exported: true,
			filePath: "/test.ts",
		};

		const props = generateProperties(fn);
		expect(props.length).toBe(0);
	});

	it("rejects unsafe function names", () => {
		const fn: FunctionSignature = {
			name: "'); require('child_process",
			params: [{ name: "x", type: "string" }],
			returnType: "string",
			exported: true,
			filePath: "/test.ts",
		};

		const props = generateProperties(fn);
		expect(props.length).toBe(0);
	});
});

describe("generateTestFile", () => {
	it("produces valid JS with imports and test blocks", () => {
		const imports = new Map([["./test.js", ["add"]]]);
		const props = [
			{
				functionName: "add",
				kind: "no-throw" as const,
				testCode: "fc.assert(fc.property(fc.integer(), () => true));",
			},
		];

		const code = generateTestFile(imports, props, 50);
		expect(code).toContain('import fc from "fast-check"');
		expect(code).toContain('import { add } from "./test.js"');
		expect(code).toContain("NUM_RUNS = 50");
	});

	it("skips unsafe import paths", () => {
		const imports = new Map([["../../etc/passwd", ["evil"]]]);
		const props = [
			{
				functionName: "evil",
				kind: "no-throw" as const,
				testCode: "noop",
			},
		];

		const code = generateTestFile(imports, props, 10);
		expect(code).not.toContain("etc/passwd");
	});
});
