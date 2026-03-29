interface Props {
  summary: Record<string, unknown>;
}

const FIELDS: Array<[string, string, string?]> = [
  ["Profile Type", "profile_type"],
  ["Width", "section_width_mm", "mm"],
  ["Height", "section_height_mm", "mm"],
  ["Bends", "bend_count"],
  ["Material", "material"],
  ["Thickness", "sheet_thickness_mm", "mm"],
  ["Complexity", "forming_complexity_class"],
  ["Score", "complexity_score"],
  ["Est. Passes", "estimated_forming_passes"],
  ["Stations", "recommended_station_count"],
  ["Shaft", "shaft_diameter_mm", "mm"],
  ["Bearing", "bearing_type"],
  ["Roll OD", "estimated_roll_od_mm", "mm"],
  ["Vert. Gap", "estimated_vertical_gap_mm", "mm"],
  ["Side Clr.", "estimated_side_clearance_mm", "mm"],
  ["Line Length", "estimated_line_length_mm", "mm"],
  ["Duty Class", "machine_duty_class"],
];

export function SummaryCards({ summary }: Props) {
  if (!summary || Object.keys(summary).length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Engineering Summary</div>
        <div className="text-xs text-gray-600">No summary available yet.</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Engineering Summary</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
        {FIELDS.map(([label, key, unit]) => {
          const val = summary[key];
          return (
            <div key={key} className="rounded-lg border border-gray-700/40 bg-gray-800/50 px-3 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
              <div className="text-sm font-semibold text-gray-200 truncate">
                {val !== undefined && val !== null ? `${val}${unit ?? ""}` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
