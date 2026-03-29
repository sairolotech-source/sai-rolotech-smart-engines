import { Cog, Ruler, Zap, Navigation, LayoutGrid, ArrowRight } from "lucide-react";

interface MachineLayoutData {
  duty_class?: string;
  stand_count?: number;
  stand_spacing_mm?: number;
  shaft_center_distance_mm?: number;
  drive_type?: string;
  drive_note?: string;
  motor_kw?: number;
  motor_label?: string;
  gearbox_ratio?: number;
  gearbox_label?: string;
  entry_guide_recommended?: boolean;
  entry_guide_type?: string;
  entry_guide_note?: string;
  straightener_recommended?: boolean;
  straightener_type?: string;
  straightener_note?: string;
  frame_type?: string;
  frame_note?: string;
  coil_stand_type?: string;
  line_speed_mpm?: string;
  total_line_length_m?: number;
  line_length_summary?: {
    entry_and_straightener_m?: number;
    roll_forming_section_m?: number;
    exit_and_cutoff_m?: number;
    total_line_length_m?: number;
  };
  warnings?: string[];
  assumptions?: string[];
}

interface Props {
  data: MachineLayoutData;
}

const DRIVE_COLOR: Record<string, string> = {
  chain_drive: "bg-blue-600",
  gear_drive: "bg-violet-600",
  tandem_gear_drive: "bg-orange-600",
};

const DUTY_COLOR: Record<string, string> = {
  light: "text-green-400",
  medium: "text-blue-400",
  heavy: "text-orange-400",
  industrial: "text-red-400",
};

function fmt(val: string | undefined): string {
  if (!val) return "—";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Chip({ label, color = "bg-neutral-700" }: { label: string; color?: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono text-white ${color}`}>
      {label}
    </span>
  );
}

function Row({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-neutral-700/40">
      <span className="text-neutral-400 text-xs shrink-0 w-44">{label}</span>
      <div className="text-right">
        <div className="text-white text-sm font-mono">{value}</div>
        {note && <div className="text-neutral-500 text-[10px] mt-0.5 max-w-60 text-right">{note}</div>}
      </div>
    </div>
  );
}

export default function MachineLayoutPanel({ data }: Props) {
  if (!data || !data.stand_count) return null;

  const dutyClass = data.duty_class ?? "medium";
  const driveColor = DRIVE_COLOR[data.drive_type ?? ""] ?? "bg-neutral-600";
  const dutyColor = DUTY_COLOR[dutyClass] ?? "text-neutral-300";

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Machine Layout</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className={`text-xs font-bold uppercase ${dutyColor}`}>{dutyClass} duty</span>
          <Chip label={fmt(data.drive_type)} color={driveColor} />
        </div>
      </div>

      {/* Line length visual */}
      {data.line_length_summary && (
        <div className="rounded-lg bg-neutral-800 p-3">
          <div className="text-[10px] text-neutral-400 mb-2 uppercase tracking-wide">Line Layout</div>
          <div className="flex items-center gap-1 text-xs">
            <div className="flex flex-col items-center">
              <div className="h-6 w-12 rounded bg-yellow-700/60 flex items-center justify-center text-[9px] text-yellow-200 font-mono">
                Entry
              </div>
              <div className="text-neutral-500 mt-0.5">{data.line_length_summary.entry_and_straightener_m}m</div>
            </div>
            <ArrowRight className="w-3 h-3 text-neutral-600" />
            <div className="flex flex-col items-center flex-1">
              <div className="h-6 w-full rounded bg-blue-800/60 flex items-center justify-center text-[9px] text-blue-200 font-mono">
                Roll Forming ({data.stand_count} stands)
              </div>
              <div className="text-neutral-500 mt-0.5">{data.line_length_summary.roll_forming_section_m}m</div>
            </div>
            <ArrowRight className="w-3 h-3 text-neutral-600" />
            <div className="flex flex-col items-center">
              <div className="h-6 w-12 rounded bg-neutral-700/60 flex items-center justify-center text-[9px] text-neutral-300 font-mono">
                Exit
              </div>
              <div className="text-neutral-500 mt-0.5">{data.line_length_summary.exit_and_cutoff_m}m</div>
            </div>
          </div>
          <div className="mt-2 text-center text-blue-300 font-mono text-sm font-bold">
            Total: {data.total_line_length_m} m
          </div>
        </div>
      )}

      {/* Stand & Shaft */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Ruler className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[10px] text-neutral-500 uppercase tracking-wide">Stands & Geometry</span>
        </div>
        <Row label="Stand Count" value={`${data.stand_count} stations`} />
        <Row label="Stand Spacing" value={`${data.stand_spacing_mm} mm`} />
        <Row label="Shaft Center Distance" value={`${data.shaft_center_distance_mm} mm`} note="Top to bottom shaft (vertical)" />
      </div>

      {/* Drive & Power */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[10px] text-neutral-500 uppercase tracking-wide">Drive & Power</span>
        </div>
        <Row label="Drive Type" value={<Chip label={fmt(data.drive_type)} color={driveColor} />} note={data.drive_note} />
        <Row label="Motor" value={data.motor_label ?? "—"} />
        <Row label="Gearbox" value={data.gearbox_label ?? "—"} />
        <Row label="Line Speed" value={data.line_speed_mpm ?? "—"} />
      </div>

      {/* Accessories */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Cog className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[10px] text-neutral-500 uppercase tracking-wide">Accessories</span>
        </div>
        <Row
          label="Entry Guide"
          value={
            data.entry_guide_recommended
              ? <Chip label={fmt(data.entry_guide_type)} color="bg-teal-700" />
              : <span className="text-neutral-500 text-xs">Not required</span>
          }
          note={data.entry_guide_note}
        />
        <Row
          label="Straightener"
          value={
            data.straightener_recommended
              ? <Chip label={fmt(data.straightener_type)} color="bg-amber-700" />
              : <span className="text-neutral-500 text-xs">Not required</span>
          }
          note={data.straightener_note}
        />
        <Row label="Frame Type" value={fmt(data.frame_type)} note={data.frame_note} />
        <Row label="Coil Stand" value={fmt(data.coil_stand_type)} />
      </div>

      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="rounded bg-yellow-900/30 border border-yellow-700/40 p-3 space-y-1">
          {data.warnings.map((w, i) => (
            <div key={i} className="text-yellow-300 text-xs flex gap-1.5">
              <span className="shrink-0">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
