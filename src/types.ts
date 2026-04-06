export type CheckStatus = "PASS" | "FAIL" | "N/A";
export type GateResult = "PASS" | "BLOCK" | "WARN";
export type Layer15Result = "PASS" | "BLOCK" | "WARN" | "SKIP";
export type Layer2Recommendation = "SKIP" | "REQUIRED";
export type Tier = 0 | 1 | 2 | 3 | 4;

export interface CheckResult {
	readonly name: string;
	readonly status: CheckStatus;
	readonly command: string;
	readonly detail: string;
	readonly durationMs: number;
}

export interface SecretMatch {
	readonly file: string;
	readonly line: number;
	readonly pattern: string;
}

export interface Layer1Report {
	readonly timestamp: string;
	readonly targetDir: string;
	readonly checks: readonly CheckResult[];
	readonly secretScan: CheckResult;
	readonly gate: GateResult;
	readonly executedCount: number;
	readonly totalCount: number;
}

export interface Layer15Report {
	readonly result: Layer15Result;
	readonly detail: string;
	readonly model: string;
}

export interface SkipDecision {
	readonly recommendation: Layer2Recommendation;
	readonly changedLines: number;
	readonly newFiles: number;
	readonly securityFiles: number;
	readonly reason: string;
}

export interface VerifyResult {
	readonly layer1: Layer1Report;
	readonly layer15: Layer15Report;
	readonly skipDecision: SkipDecision;
	readonly finalGate: GateResult;
}

export interface HarnessConfig {
	readonly targetDir: string;
	readonly timeoutSec: number;
	readonly buildCmd: string;
	readonly testCmd: string;
	readonly lintCmd: string;
	readonly typecheckCmd: string;
	readonly localLlm: {
		readonly enabled: boolean;
		readonly endpoint: string;
		readonly timeoutSec: number;
	};
	readonly layer2SkipMaxLines: number;
}

export interface ProjectDetection {
	readonly type: "node" | "python" | "rust" | "go" | "make" | "unknown";
	readonly buildCmd: string;
	readonly testCmd: string;
	readonly lintCmd: string;
	readonly typecheckCmd: string;
}

// --- Feature 1: Mutation Testing ---

export type MutationOperator =
	| "negate-condition"
	| "boundary-off-by-one"
	| "remove-return"
	| "swap-boolean"
	| "empty-string"
	| "zero-number"
	| "negate-equality"
	| "swap-arithmetic";

export interface Mutant {
	readonly id: string;
	readonly file: string;
	readonly line: number;
	readonly operator: MutationOperator;
	readonly original: string;
	readonly mutated: string;
}

export interface MutantResult {
	readonly mutant: Mutant;
	readonly killed: boolean;
	readonly error?: string;
}

export interface MutationReport {
	readonly totalMutants: number;
	readonly killed: number;
	readonly survived: number;
	readonly score: number;
	readonly gate: GateResult;
	readonly results: readonly MutantResult[];
	readonly durationMs: number;
}

export interface MutationConfig {
	readonly enabled: boolean;
	readonly maxMutants: number;
	readonly scoreWarn: number;
	readonly scoreBlock: number;
}

// --- Feature 2: Sandbox Execution ---

export interface SandboxConfig {
	readonly enabled: boolean;
	readonly cpus: string;
	readonly memoryMb: number;
	readonly perCheckTimeoutSec: number;
	readonly totalTimeoutSec: number;
	readonly image: string;
	readonly fallbackOnError: boolean;
}

export interface SandboxExecutor {
	readonly available: boolean;
	runCheck(
		name: string,
		cmd: string,
		targetDir: string,
		timeoutSec: number,
	): CheckResult;
	dispose(): void;
}

// --- Feature 3: Property-Based Testing ---

export interface ParamInfo {
	readonly name: string;
	readonly type: string;
}

export interface FunctionSignature {
	readonly name: string;
	readonly params: readonly ParamInfo[];
	readonly returnType: string;
	readonly exported: boolean;
	readonly filePath: string;
}

export type PropertyKind =
	| "no-throw"
	| "type-consistency"
	| "idempotency"
	| "roundtrip"
	| "no-mutation";

export interface GeneratedProperty {
	readonly functionName: string;
	readonly kind: PropertyKind;
	readonly testCode: string;
}

export interface PbtFailure {
	readonly functionName: string;
	readonly property: PropertyKind;
	readonly counterexample: string;
	readonly error: string;
}

export interface PbtReport {
	readonly functionsAnalyzed: number;
	readonly propertiesGenerated: number;
	readonly propertiesPassed: number;
	readonly propertiesFailed: number;
	readonly failures: readonly PbtFailure[];
	readonly gate: GateResult;
	readonly durationMs: number;
}

export interface PbtConfig {
	readonly enabled: boolean;
	readonly numRuns: number;
	readonly maxFunctions: number;
	readonly timeoutSec: number;
}

// --- Feature 4: Evolutionary Optimization ---

export interface FitnessScore {
	readonly l1Pass: boolean;
	readonly l1Score: number;
	readonly composite: number;
}

export interface SolutionVariant {
	readonly id: string;
	readonly generation: number;
	readonly parentIds: readonly string[];
	readonly files: ReadonlyMap<string, string>;
	readonly fitness: FitnessScore;
}

export interface EvolutionConfig {
	readonly enabled: boolean;
	readonly populationSize: number;
	readonly maxGenerations: number;
	readonly mutationRate: number;
	readonly crossoverRate: number;
	readonly eliteCount: number;
}

export interface EvolutionReport {
	readonly generations: number;
	readonly totalVariants: number;
	readonly bestFitness: number;
	readonly fitnessHistory: readonly number[];
	readonly durationMs: number;
}
