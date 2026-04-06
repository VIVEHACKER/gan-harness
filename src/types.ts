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
