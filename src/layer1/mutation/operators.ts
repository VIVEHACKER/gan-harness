import type { MutationOperator } from "../../types.js";

export interface OperatorDef {
	readonly name: MutationOperator;
	readonly apply: (line: string) => string | null;
}

const OPERATORS: readonly OperatorDef[] = [
	{
		name: "negate-equality",
		apply: (line) => {
			if (/===/.test(line)) return line.replace("===", "!==");
			if (/!==/.test(line)) return line.replace("!==", "===");
			if (/==(?!=)/.test(line)) return line.replace(/==(?!=)/, "!=");
			if (/!=(?!=)/.test(line)) return line.replace(/!=(?!=)/, "==");
			return null;
		},
	},
	{
		name: "boundary-off-by-one",
		apply: (line) => {
			if (/>=/.test(line)) return line.replace(">=", ">");
			if (/<=/.test(line)) return line.replace("<=", "<");
			if (/>(?!=)/.test(line)) return line.replace(/>(?!=)/, ">=");
			if (/<(?!=)/.test(line)) return line.replace(/<(?!=)/, "<=");
			return null;
		},
	},
	{
		name: "negate-condition",
		apply: (line) => {
			const match = line.match(/if\s*\((.+)\)\s*\{?$/);
			if (!match) return null;
			const cond = match[1];
			return line.replace(cond, `!(${cond})`);
		},
	},
	{
		name: "swap-boolean",
		apply: (line) => {
			if (/\btrue\b/.test(line)) return line.replace(/\btrue\b/, "false");
			if (/\bfalse\b/.test(line)) return line.replace(/\bfalse\b/, "true");
			return null;
		},
	},
	{
		name: "remove-return",
		apply: (line) => {
			const match = line.match(/^(\s*)return\s+.+;/);
			if (!match) return null;
			return `${match[1]}return undefined;`;
		},
	},
	{
		name: "zero-number",
		apply: (line) => {
			// Skip import lines, version strings, array indices
			if (/import\s/.test(line) || /require\(/.test(line)) return null;
			const match = line.match(/\b(\d+)\b/);
			if (!match || match[1] === "0") return null;
			return line.replace(new RegExp(`\\b${match[1]}\\b`), "0");
		},
	},
	{
		name: "empty-string",
		apply: (line) => {
			if (/import\s/.test(line) || /require\(/.test(line)) return null;
			const match = line.match(/"([^"]+)"/);
			if (!match || match[1] === "") return null;
			return line.replace(`"${match[1]}"`, '""');
		},
	},
	{
		name: "swap-arithmetic",
		apply: (line) => {
			if (/import\s/.test(line)) return null;
			// Avoid ++, --, +=, -=, =>, //, /* patterns
			if (/\+(?![+=])/.test(line) && !/['"`]/.test(line)) {
				return line.replace(/\+(?![+=])/, "-");
			}
			if (/(?<![/])\*(?![*/=])/.test(line)) {
				return line.replace(/(?<![/])\*(?![*/=])/, "/");
			}
			return null;
		},
	},
];

export function getOperators(): readonly OperatorDef[] {
	return OPERATORS;
}

export function applyOperator(
	operator: OperatorDef,
	line: string,
): string | null {
	// Skip comments, imports, blank lines
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) {
		return null;
	}
	return operator.apply(line);
}
