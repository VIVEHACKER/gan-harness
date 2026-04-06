import { randomUUID } from "node:crypto";
import type { FitnessScore, SolutionVariant } from "../types.js";
import { crossoverSources, mutateSource } from "./operators.js";

const DEFAULT_FITNESS: FitnessScore = {
	l1Pass: false,
	l1Score: 0,
	composite: 0,
};

export function createVariant(
	files: ReadonlyMap<string, string>,
	generation: number,
	parentIds: readonly string[] = [],
	fitness: FitnessScore = DEFAULT_FITNESS,
): SolutionVariant {
	return {
		id: randomUUID().slice(0, 8),
		generation,
		parentIds,
		files,
		fitness,
	};
}

export function initPopulation(
	originalFiles: ReadonlyMap<string, string>,
	populationSize: number,
	mutationRate: number,
): readonly SolutionVariant[] {
	const population: SolutionVariant[] = [];

	// First individual is the original
	population.push(createVariant(originalFiles, 0));

	// Generate mutated variants
	for (let i = 1; i < populationSize; i++) {
		const mutatedFiles = new Map<string, string>();
		for (const [path, content] of originalFiles) {
			mutatedFiles.set(path, mutateSource(content, mutationRate));
		}
		population.push(createVariant(mutatedFiles, 0));
	}

	return population;
}

export function selectBest(
	population: readonly SolutionVariant[],
	count: number,
): readonly SolutionVariant[] {
	return [...population]
		.sort((a, b) => b.fitness.composite - a.fitness.composite)
		.slice(0, count);
}

export function evolve(
	parents: readonly SolutionVariant[],
	populationSize: number,
	generation: number,
	mutationRate: number,
	crossoverRate: number,
	eliteCount: number,
): readonly SolutionVariant[] {
	const next: SolutionVariant[] = [];

	// Elitism: carry best unchanged
	const elite = selectBest(parents, eliteCount);
	for (const e of elite) {
		next.push(createVariant(e.files, generation, [e.id]));
	}

	// Fill rest with crossover + mutation
	while (next.length < populationSize) {
		const parentA = parents[Math.floor(Math.random() * parents.length)];
		const parentB = parents[Math.floor(Math.random() * parents.length)];

		const childFiles = new Map<string, string>();

		for (const [path, contentA] of parentA.files) {
			const contentB = parentB.files.get(path) ?? contentA;
			let child =
				Math.random() < crossoverRate
					? crossoverSources(contentA, contentB)
					: contentA;

			child = mutateSource(child, mutationRate);
			childFiles.set(path, child);
		}

		next.push(createVariant(childFiles, generation, [parentA.id, parentB.id]));
	}

	return next;
}
