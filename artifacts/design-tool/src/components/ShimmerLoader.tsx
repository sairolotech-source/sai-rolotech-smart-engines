import React from "react";

interface ShimmerLoaderProps {
  lines?: number;
  className?: string;
}

export function ShimmerLoader({ lines = 3, className = "" }: ShimmerLoaderProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {i === 0 && (
            <div className="w-10 h-10 rounded-lg bg-white/[0.04] shimmer-block flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <div
              className="h-3 rounded-full bg-white/[0.04] shimmer-block"
              style={{ width: `${70 + Math.random() * 30}%`, animationDelay: `${i * 150}ms` }}
            />
            {i === 0 && (
              <div
                className="h-2 rounded-full bg-white/[0.03] shimmer-block"
                style={{ width: "45%", animationDelay: `${i * 150 + 75}ms` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelShimmer() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#070710] p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] shimmer-block" />
          <div className="h-4 w-40 rounded-full bg-white/[0.04] shimmer-block" />
          <div className="h-3 w-56 rounded-full bg-white/[0.03] shimmer-block" style={{ animationDelay: "100ms" }} />
        </div>
        <div className="space-y-3">
          {[80, 65, 90, 55, 75].map((width, i) => (
            <div
              key={i}
              className="h-3 rounded-full bg-white/[0.04] shimmer-block"
              style={{ width: `${width}%`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-white/[0.03] shimmer-block" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardShimmer({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] shimmer-block flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 rounded-full bg-white/[0.04] shimmer-block" style={{ width: "60%" }} />
              <div className="h-2 rounded-full bg-white/[0.03] shimmer-block" style={{ width: "40%" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
