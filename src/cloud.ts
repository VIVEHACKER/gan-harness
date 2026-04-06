import type { VerifyResult } from "./types.js";

const DEFAULT_API = "http://localhost:8090";

export async function pushToCloud(
	result: VerifyResult,
	apiUrl: string = DEFAULT_API,
	apiKey?: string,
): Promise<{ ok: boolean; detail: string }> {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (apiKey) {
		headers["Authorization"] = `Bearer ${apiKey}`;
	}

	// Push verify result as eval record
	const body = {
		timestamp: result.layer1.timestamp,
		target_dir: result.layer1.targetDir,
		gate: result.finalGate,
		layer1_gate: result.layer1.gate,
		layer15_result: result.layer15.result,
		layer2_recommendation: result.skipDecision.recommendation,
		checks: result.layer1.checks.map((c) => ({
			name: c.name,
			status: c.status,
			duration_ms: c.durationMs,
		})),
		secret_scan: result.layer1.secretScan.status,
		changed_lines: result.skipDecision.changedLines,
		new_files: result.skipDecision.newFiles,
		security_files: result.skipDecision.securityFiles,
	};

	try {
		const resp = await fetch(`${apiUrl}/ingest-verify`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(10_000),
		});

		if (!resp.ok) {
			const text = await resp.text();
			return { ok: false, detail: `API ${resp.status}: ${text.slice(0, 100)}` };
		}

		return { ok: true, detail: "synced to dashboard" };
	} catch (err) {
		return { ok: false, detail: `${err}` };
	}
}
