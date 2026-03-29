import { CheckCircle2, XCircle } from "lucide-react";

interface TestCase {
  name: string;
  status: string;
  stations?: number;
  shaft_mm?: number;
  bearing?: string;
  roll_od_mm?: number;
  complexity?: string;
  reason?: string;
}

interface TestData {
  status: string;
  total: number;
  passed: number;
  failed: number;
  test_cases: TestCase[];
}

interface Props {
  data: TestData;
}

export function TestResults({ data }: Props) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Test Suite Results</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{data.passed}/{data.total} passed</span>
          {data.failed > 0 && <span className="text-red-400">{data.failed} failed</span>}
        </div>
      </div>

      <div className="space-y-2">
        {data.test_cases.map((tc, i) => (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2 text-xs ${
              tc.status === "pass"
                ? "border-emerald-500/15 bg-emerald-500/5"
                : "border-red-500/20 bg-red-500/8"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-gray-200">{tc.name}</span>
              {tc.status === "pass"
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
            </div>
            {tc.status === "pass" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[10px] text-gray-500">
                <span>Stations: <span className="text-gray-300">{tc.stations}</span></span>
                <span>Shaft: <span className="text-gray-300">{tc.shaft_mm}mm</span></span>
                <span>Bearing: <span className="text-gray-300">{tc.bearing}</span></span>
                <span>Roll OD: <span className="text-gray-300">{tc.roll_od_mm}mm</span></span>
                <span className="col-span-2">Complexity: <span className="text-gray-300">{tc.complexity}</span></span>
              </div>
            ) : (
              <div className="text-[10px] text-red-400">{tc.reason ?? "Pipeline failed"}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
