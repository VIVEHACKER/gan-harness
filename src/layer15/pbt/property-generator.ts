import type { FunctionSignature, GeneratedProperty } from "../../types.js";

const SAFE_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function isSafeIdentifier(name: string): boolean {
	return SAFE_IDENTIFIER.test(name);
}

function isSafeImportPath(path: string): boolean {
	return !path.includes("..") && !/[;`$(){}]/.test(path);
}

function arbitraryForType(type: string): string {
	switch (type) {
		case "string":
			return "fc.string()";
		case "number":
			return "fc.float({ noNaN: true, noDefaultInfinity: true })";
		case "boolean":
			return "fc.boolean()";
		case "array":
			return "fc.array(fc.anything())";
		case "object":
			return "fc.dictionary(fc.string(), fc.string())";
		default:
			return "fc.anything()";
	}
}

function generateNoThrow(fn: FunctionSignature): GeneratedProperty | null {
	if (fn.params.length === 0) return null;

	const arbs = fn.params.map((p) => arbitraryForType(p.type));
	const paramNames = fn.params.map((_, i) => `p${i}`);

	const testCode = `
fc.assert(
  fc.property(${arbs.join(", ")}, (${paramNames.join(", ")}) => {
    try { ${fn.name}(${paramNames.join(", ")}); return true; }
    catch { return false; }
  }),
  { numRuns: NUM_RUNS }
);`;

	return { functionName: fn.name, kind: "no-throw", testCode };
}

function generateTypeConsistency(
	fn: FunctionSignature,
): GeneratedProperty | null {
	if (fn.params.length === 0 || fn.returnType === "void") return null;

	const arbs = fn.params.map((p) => arbitraryForType(p.type));
	const paramNames = fn.params.map((_, i) => `p${i}`);

	const testCode = `
fc.assert(
  fc.property(${arbs.join(", ")}, (${paramNames.join(", ")}) => {
    const r1 = typeof ${fn.name}(${paramNames.join(", ")});
    const r2 = typeof ${fn.name}(${paramNames.join(", ")});
    return r1 === r2;
  }),
  { numRuns: NUM_RUNS }
);`;

	return { functionName: fn.name, kind: "type-consistency", testCode };
}

function generateIdempotency(fn: FunctionSignature): GeneratedProperty | null {
	// Only for single-param functions where input/output types match
	if (fn.params.length !== 1) return null;
	const paramType = fn.params[0].type;
	if (paramType === "unknown" || paramType === "object") return null;

	const arb = arbitraryForType(paramType);

	const testCode = `
fc.assert(
  fc.property(${arb}, (p0) => {
    try {
      const r1 = ${fn.name}(p0);
      const r2 = ${fn.name}(r1);
      return JSON.stringify(r1) === JSON.stringify(r2);
    } catch { return true; } // Skip if types don't match
  }),
  { numRuns: NUM_RUNS }
);`;

	return { functionName: fn.name, kind: "idempotency", testCode };
}

export function generateProperties(
	fn: FunctionSignature,
): readonly GeneratedProperty[] {
	// Validate function name to prevent code injection
	if (!isSafeIdentifier(fn.name)) return [];

	const properties: GeneratedProperty[] = [];

	const noThrow = generateNoThrow(fn);
	if (noThrow) properties.push(noThrow);

	const typeConsistency = generateTypeConsistency(fn);
	if (typeConsistency) properties.push(typeConsistency);

	const idempotency = generateIdempotency(fn);
	if (idempotency) properties.push(idempotency);

	return properties;
}

export function generateTestFile(
	imports: ReadonlyMap<string, readonly string[]>,
	properties: readonly GeneratedProperty[],
	numRuns: number,
): string {
	const importLines: string[] = ['import fc from "fast-check";'];

	for (const [filePath, fnNames] of imports) {
		// Validate import path and function names to prevent injection
		if (!isSafeImportPath(filePath)) continue;
		const safeFns = fnNames.filter((n) => isSafeIdentifier(n));
		if (safeFns.length === 0) continue;
		importLines.push(`import { ${safeFns.join(", ")} } from "${filePath}";`);
	}

	const testBlocks = properties.map(
		(p) => `
// Property: ${p.kind} for ${p.functionName}
try {
  const NUM_RUNS = ${numRuns};
  ${p.testCode.trim()}
  results.push({ fn: "${p.functionName}", prop: "${p.kind}", status: "PASS" });
} catch (e) {
  results.push({ fn: "${p.functionName}", prop: "${p.kind}", status: "FAIL", error: String(e).slice(0, 200) });
}`,
	);

	return `${importLines.join("\n")}

const results = [];

${testBlocks.join("\n")}

console.log(JSON.stringify(results));
`;
}
