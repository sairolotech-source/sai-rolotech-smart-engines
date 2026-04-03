interface Props {
  reportText: string;
}

export function ReportPreview({ reportText }: Props) {
  if (!reportText) return null;

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Readable Report</div>
      <pre className="whitespace-pre-wrap text-[10.5px] text-gray-400 font-mono overflow-auto max-h-[500px] leading-relaxed">
        {reportText}
      </pre>
    </div>
  );
}
