import { describe, expect, it } from "vitest";
import {
	createVariant,
	evolve,
	initPopulation,
	selectBest,
} from "../population.js";

describe("population", () => {
	const files = new Map([
		["/a.ts", "const x = 1;\n"],
		["/b.ts", "export function b() { return true; }\n"],
	]);

	describe("initPopulation", () => {
		it("creates population of requested size", () => {
			const pop = initPopulation(files, 4, 0.3);
			expect(pop.length).toBe(4);
		});

		it("first individual is the original", () => {
			const pop = initPopulation(files, 3, 0.3);
			expect(pop[0].files.get("/a.ts")).toBe("const x = 1;\n");
		});

		it("all individuals have generation 0", () => {
			const pop = initPopulation(files, 4, 0.3);
			for (const v of pop) {
				expect(v.generation).toBe(0);
			}
		});
	});

	describe("selectBest", () => {
		it("returns top N by composite fitness", () => {
			const variants = [
				createVariant(files, 0, [], {
					l1Pass: true,
					l1Score: 50,
					composite: 50,
				}),
				createVariant(files, 0, [], {
					l1Pass: true,
					l1Score: 100,
					composite: 100,
				}),
				createVariant(files, 0, [], {
					l1Pass: false,
					l1Score: 0,
					composite: 0,
				}),
			];

			const best = selectBest(variants, 2);
			expect(best.length).toBe(2);
			expect(best[0].fitness.composite).toBe(100);
			expect(best[1].fitness.composite).toBe(50);
		});
	});

	describe("evolve", () => {
		it("produces new generation of correct size", () => {
			const parents = [
				createVariant(files, 0, [], {
					l1Pass: true,
					l1Score: 100,
					composite: 100,
				}),
				createVariant(files, 0, [], {
					l1Pass: true,
					l1Score: 80,
					composite: 80,
				}),
			];

			const next = evolve(parents, 4, 1, 0.3, 0.5, 1);
			expect(next.length).toBe(4);
			for (const v of next) {
				expect(v.generation).toBe(1);
			}
		});
	});
});
