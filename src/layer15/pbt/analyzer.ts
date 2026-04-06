import { readFileSync } from "node:fs";
import type { FunctionSignature, ParamInfo } from "../../types.js";

const EXPORT_FN_RE =
	/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;

function parseType(typeStr: string): string {
	const t = typeStr.trim().toLowerCase();
	if (t.startsWith("string")) return "string";
	if (t.startsWith("number") || t.startsWith("int") || t.startsWith("float"))
		return "number";
	if (t.startsWith("boolean") || t.startsWith("bool")) return "boolean";
	if (t.includes("[]") || t.startsWith("array") || t.startsWith("readonly"))
		return "array";
	if (t.startsWith("record") || t.startsWith("object") || t === "map")
		return "object";
	return "unknown";
}

function parseParams(paramStr: string): readonly ParamInfo[] {
	if (!paramStr.trim()) return [];

	return paramStr
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => {
			// Handle destructured params like { a, b }: Type
			if (p.startsWith("{") || p.startsWith("[")) {
				const colonIdx = p.lastIndexOf(":");
				return {
					name: p.slice(0, colonIdx > 0 ? colonIdx : undefined).trim(),
					type: colonIdx > 0 ? parseType(p.slice(colonIdx + 1)) : "unknown",
				};
			}

			const [nameWithDefault, typeAnnotation] = p.split(/:\s*/);
			const name = nameWithDefault.replace(/\s*=.*/, "").trim();
			const type = typeAnnotation ? parseType(typeAnnotation) : "unknown";
			return { name, type };
		});
}

export function analyzeFunctions(
	filePath: string,
	maxFunctions: number,
): readonly FunctionSignature[] {
	const content = readFileSync(filePath, "utf-8");
	const results: FunctionSignature[] = [];

	EXPORT_FN_RE.lastIndex = 0;
	for (
		let match = EXPORT_FN_RE.exec(content);
		match !== null && results.length < maxFunctions;
		match = EXPORT_FN_RE.exec(content)
	) {
		const name = match[1];
		const params = parseParams(match[2]);
		const returnType = match[3]?.trim() ?? "unknown";

		results.push({
			name,
			params,
			returnType,
			exported: true,
			filePath,
		});
	}

	return results;
}
