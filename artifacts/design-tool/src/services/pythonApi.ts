const BASE = "/papi/api";

export interface ManualModePayload {
  bend_count: number;
  section_width_mm: number;
  section_height_mm: number;
  thickness: number;
  material: string;
  profile_type: string;
}

export async function runManualModeDebug(payload: ManualModePayload) {
  const res = await fetch(`${BASE}/manual-mode-debug`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function runManualMode(payload: ManualModePayload) {
  const res = await fetch(`${BASE}/manual-mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function exportManualPdf(payload: ManualModePayload) {
  const res = await fetch(`${BASE}/manual-mode-export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function downloadManualPdf(payload: ManualModePayload): Promise<Blob> {
  const res = await fetch(`${BASE}/manual-mode-download-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("PDF download failed");
  return res.blob();
}

export async function runTests() {
  const res = await fetch(`${BASE}/run-tests`);
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}
