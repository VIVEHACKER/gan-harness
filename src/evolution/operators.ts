import { applyOperator, getOperators } from "../layer1/mutation/operators.js";

/**
 * Apply random mutations to source code for evolutionary optimization.
 * Reuses mutation testing operators but applies them probabilistically.
 */
export function mutateSource(content: string, mutationRate: number): string {
	const lines = content.split("\n");
	const operators = getOperators();
	const mutated = [...lines];

	for (let i = 0; i < lines.length; i++) {
		if (Math.random() >= mutationRate) continue;

		// Pick a random operator
		const op = operators[Math.floor(Math.random() * operators.length)];
		const result = applyOperator(op, lines[i]);
		if (result !== null) {
			mutated[i] = result;
		}
	}

	return mutated.join("\n");
}

/**
 * Single-point crossover between two source files.
 */
export function crossoverSources(parentA: string, parentB: string): string {
	const linesA = parentA.split("\n");
	const linesB = parentB.split("\n");
	const minLen = Math.min(linesA.length, linesB.length);

	if (minLen < 2) return parentA;

	const crossPoint = Math.floor(Math.random() * (minLen - 1)) + 1;
	const child = [...linesA.slice(0, crossPoint), ...linesB.slice(crossPoint)];

	return child.join("\n");
}
