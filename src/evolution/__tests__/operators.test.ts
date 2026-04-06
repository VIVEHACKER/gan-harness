import { describe, expect, it } from "vitest";
import { crossoverSources, mutateSource } from "../operators.js";

describe("evolution operators", () => {
	describe("mutateSource", () => {
		it("can modify source with high mutation rate", () => {
			const src = `const x = true;
if (a === b) {
  return 42;
}`;
			// Run multiple times — at least one should differ (probabilistic)
			let modified = false;
			for (let i = 0; i < 20; i++) {
				const result = mutateSource(src, 1.0);
				if (result !== src) {
					modified = true;
					break;
				}
			}
			expect(modified).toBe(true);
		});

		it("returns identical source with zero mutation rate", () => {
			const src = "const x = 1;\n";
			const result = mutateSource(src, 0);
			expect(result).toBe(src);
		});
	});

	describe("crossoverSources", () => {
		it("combines two parents", () => {
			const a = "line1\nline2\nline3\nline4\n";
			const b = "lineA\nlineB\nlineC\nlineD\n";

			const child = crossoverSources(a, b);
			const lines = child.split("\n");

			// Should have some lines from both parents
			expect(lines.length).toBeGreaterThanOrEqual(4);
		});

		it("returns parentA for single-line files", () => {
			const result = crossoverSources("single", "other");
			expect(result).toBe("single");
		});
	});
});
