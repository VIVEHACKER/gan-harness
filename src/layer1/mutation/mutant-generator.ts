import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Mutant } from "../../types.js";
import { getOperators, applyOperator } from "./operators.js";

export function generateMutants(
	filePath: string,
	maxMutants: number,
): readonly Mutant[] {
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	const operators = getOperators();
	const mutants: Mutant[] = [];

	for (let i = 0; i < lines.length && mutants.length < maxMutants; i++) {
		const line = lines[i];
		for (const op of operators) {
			if (mutants.length >= maxMutants) break;
			const mutated = applyOperator(op, line);
			if (mutated !== null && mutated !== line) {
				const id = createHash("sha256")
					.update(`${filePath}:${i}:${op.name}`)
					.digest("hex")
					.slice(0, 12);

				mutants.push({
					id,
					file: filePath,
					line: i + 1,
					operator: op.name,
					original: line,
					mutated,
				});
			}
		}
	}

	return mutants;
}
