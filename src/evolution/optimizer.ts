import type {
	EvolutionConfig,
	EvolutionReport,
	HarnessConfig,
	SolutionVariant,
} from "../types.js";
import { evaluateFitness } from "./fitness.js";
import { evolve, initPopulation, selectBest } from "./population.js";

export function runEvolution(
	originalFiles: ReadonlyMap<string, string>,
	config: EvolutionConfig,
	harnessConfig: HarnessConfig,
): EvolutionReport {
	const start = Date.now();
	const fitnessHistory: number[] = [];
	let totalVariants = 0;

	// Guard: eliteCount must not exceed populationSize
	const safeElite = Math.min(config.eliteCount, config.populationSize - 1);
	const safeConfig = { ...config, eliteCount: Math.max(1, safeElite) };

	// Initialize population
	let population = initPopulation(
		originalFiles,
		config.populationSize,
		config.mutationRate,
	);
	totalVariants += population.length;

	for (let gen = 0; gen < config.maxGenerations; gen++) {
		// Evaluate fitness for each variant
		const evaluated: SolutionVariant[] = population.map((variant) => {
			const fitness = evaluateFitness(variant, harnessConfig);
			return { ...variant, fitness };
		});

		// Track best fitness
		const best = selectBest(evaluated, 1)[0];
		fitnessHistory.push(best.fitness.composite);

		// Early termination: perfect score
		if (best.fitness.composite >= 100) {
			return {
				generations: gen + 1,
				totalVariants,
				bestFitness: best.fitness.composite,
				fitnessHistory,
				durationMs: Date.now() - start,
			};
		}

		// Early termination: no improvement for 2 generations
		if (
			fitnessHistory.length >= 3 &&
			fitnessHistory[fitnessHistory.length - 1] ===
				fitnessHistory[fitnessHistory.length - 2] &&
			fitnessHistory[fitnessHistory.length - 2] ===
				fitnessHistory[fitnessHistory.length - 3]
		) {
			return {
				generations: gen + 1,
				totalVariants,
				bestFitness: best.fitness.composite,
				fitnessHistory,
				durationMs: Date.now() - start,
			};
		}

		// Select parents and evolve
		const parents = selectBest(
			evaluated,
			Math.ceil(safeConfig.populationSize / 2),
		);
		population = [
			...evolve(
				parents,
				safeConfig.populationSize,
				gen + 1,
				safeConfig.mutationRate,
				safeConfig.crossoverRate,
				safeConfig.eliteCount,
			),
		];
		totalVariants += population.length;
	}

	// Final evaluation
	const finalEval = population.map((variant) => {
		const fitness = evaluateFitness(variant, harnessConfig);
		return { ...variant, fitness };
	});

	const finalBest = selectBest(finalEval, 1)[0];
	fitnessHistory.push(finalBest.fitness.composite);

	return {
		generations: config.maxGenerations,
		totalVariants,
		bestFitness: finalBest.fitness.composite,
		fitnessHistory,
		durationMs: Date.now() - start,
	};
}
