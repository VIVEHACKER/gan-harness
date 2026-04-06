import { describe, expect, it } from "vitest";
import { applyOperator, getOperators } from "../operators.js";

function findOp(name: string) {
	const op = getOperators().find((o) => o.name === name);
	if (!op) throw new Error(`operator ${name} not found`);
	return op;
}

describe("mutation operators", () => {
	describe("negate-equality", () => {
		const op = findOp("negate-equality");

		it("flips === to !==", () => {
			expect(applyOperator(op, "  if (a === b) {")).toBe("  if (a !== b) {");
		});

		it("flips !== to ===", () => {
			expect(applyOperator(op, "  if (a !== b) {")).toBe("  if (a === b) {");
		});

		it("returns null for no match", () => {
			expect(applyOperator(op, "  const x = 1;")).toBeNull();
		});
	});

	describe("boundary-off-by-one", () => {
		const op = findOp("boundary-off-by-one");

		it("flips >= to >", () => {
			expect(applyOperator(op, "  if (x >= 0) {")).toBe("  if (x > 0) {");
		});

		it("skips arrow functions", () => {
			expect(applyOperator(op, "  const fn = (x) => x + 1;")).toBeNull();
		});
	});

	describe("swap-boolean", () => {
		const op = findOp("swap-boolean");

		it("flips true to false", () => {
			expect(applyOperator(op, "  return true;")).toBe("  return false;");
		});

		it("flips false to true", () => {
			expect(applyOperator(op, "  const x = false;")).toBe("  const x = true;");
		});
	});

	describe("remove-return", () => {
		const op = findOp("remove-return");

		it("replaces return value with undefined", () => {
			expect(applyOperator(op, "  return result;")).toBe("  return undefined;");
		});

		it("skips bare return", () => {
			expect(applyOperator(op, "  return;")).toBeNull();
		});
	});

	describe("swap-arithmetic", () => {
		const op = findOp("swap-arithmetic");

		it("swaps + to -", () => {
			expect(applyOperator(op, "  const x = a + b;")).toBe(
				"  const x = a - b;",
			);
		});

		it("swaps * to /", () => {
			expect(applyOperator(op, "  const x = a * b;")).toBe(
				"  const x = a / b;",
			);
		});

		it("skips lines with strings", () => {
			expect(applyOperator(op, '  const msg = "hello" + name;')).toBeNull();
		});

		it("skips imports", () => {
			expect(applyOperator(op, 'import { a } from "b";')).toBeNull();
		});
	});

	describe("zero-number", () => {
		const op = findOp("zero-number");

		it("replaces number with 0", () => {
			expect(applyOperator(op, "  const x = 42;")).toBe("  const x = 0;");
		});

		it("skips already-zero", () => {
			expect(applyOperator(op, "  const x = 0;")).toBeNull();
		});

		it("skips imports", () => {
			expect(applyOperator(op, 'import { foo } from "bar";')).toBeNull();
		});
	});

	describe("applyOperator skips", () => {
		const op = findOp("swap-boolean");

		it("skips comments", () => {
			expect(applyOperator(op, "  // return true;")).toBeNull();
		});

		it("skips blank lines", () => {
			expect(applyOperator(op, "   ")).toBeNull();
		});
	});
});
