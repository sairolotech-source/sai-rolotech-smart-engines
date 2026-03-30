import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Cpu, Loader2, ChevronDown, ChevronUp, Trash2,
  Zap, Code2, FlaskConical, Wrench, BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id:      string;
  role:    "user" | "assistant";
  content: string;
  ts:      number;
  loading?: boolean;
}

interface Props {
  pipelineResult?:       Record<string, unknown> | null;
  payload?:              Record<string, unknown> | null;
  profileCategory?:      string | null;
  remainingWeaknesses?:  string[];
}

// ─── Quick prompts ────────────────────────────────────────────────────────────
const QUICK: { icon: React.ReactNode; label: string; prompt: string; shutter?: boolean }[] = [
  {
    icon:    <FlaskConical className="w-3 h-3" />,
    label:   "Flat strip formula",
    prompt:  "Explain the neutral-axis flat strip formula used here and verify it gives the correct result for my current profile.",
  },
  {
    icon:    <Zap className="w-3 h-3" />,
    label:   "Roll gap analysis",
    prompt:  "Analyze the roll gap and groove depth for each station. Are they within standard manufacturing tolerances? Suggest adjustments if needed.",
  },
  {
    icon:    <Code2 className="w-3 h-3" />,
    label:   "Python geometry code",
    prompt:  "Write Python code using shapely to generate the full 2D profile polygon for each station from the angle progression in the pipeline.",
  },
  {
    icon:    <Wrench className="w-3 h-3" />,
    label:   "Springback correction",
    prompt:  "Calculate the springback angle for each station and what overbend angle should be set on the upper roll to compensate.",
  },
  {
    icon:    <BookOpen className="w-3 h-3" />,
    label:   "Station count check",
    prompt:  "Is the station count optimal for this profile? What is the rule of thumb for angle increment per station and how does this profile compare?",
  },
  {
    icon:    <FlaskConical className="w-3 h-3" />,
    label:   "🪟 Shutter real score",
    shutter: true,
    prompt:  `You are a senior roll-forming tooling engineer auditing a shutter slat profile.

Using the pipeline context provided, compute a REAL engineering score (0–100) for this shutter slat design. Break it down across these 6 dimensions, each worth up to 100 points, then give a weighted composite:

1. **Flat strip width accuracy** (weight 20%): Is the calculated blank width consistent with the neutral-axis formula? Compare against the sum of all segment arc lengths. Penalise if deviation > 0.5 mm.

2. **Rib geometry quality** (weight 20%): Count the rib passes. Each rib should have symmetric angle increments (left = right leg). Penalise asymmetry > 1°. Minimum 4 ribs for a 77 mm slat.

3. **Station count vs industry standard** (weight 15%): Typical shutter slat: 8–14 forming passes + 1 calibration. Is the count within range? Penalise if outside ± 2 of optimum for the rib count.

4. **Roll gap and groove depth per station** (weight 20%): All roll gaps should be in range [t × 0.9, t × 1.3] where t = sheet thickness. Groove depth should match flange height within 5 %. List any out-of-spec stations.

5. **Springback compensation** (weight 15%): Is springback_effective_deg accounted for? Expected range for GI steel 0.8–1.2 mm: 1°–4°. Penalise if 0 or > 8°.

6. **Known engineering limitations** (weight 10%): If remaining_weaknesses list is non-empty, penalise proportionally. Each weakness = −5 pts from this dimension.

For each dimension: state the actual measured value, the ideal target, and the sub-score.
End with a summary table, the composite score, and the top 2 corrective actions.`,
  },
];

// ─── Minimal markdown renderer ────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let codeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let key = 0;

  const flush = () => {
    if (codeLines.length) {
      out.push(
        <div key={key++} className="my-1.5 rounded-lg overflow-hidden border border-gray-700/60">
          {codeLang && (
            <div className="text-[9px] text-gray-500 bg-gray-900 px-3 py-1 font-mono border-b border-gray-700/40 uppercase tracking-wider">
              {codeLang}
            </div>
          )}
          <pre className="text-[11px] font-mono text-gray-200 bg-[#0a0f1a] p-3 overflow-x-auto leading-relaxed whitespace-pre">
            {codeLines.join("\n")}
          </pre>
        </div>,
      );
      codeLines = [];
      codeLang  = "";
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!codeBlock) {
        codeBlock = true;
        codeLang  = line.slice(3).trim();
      } else {
        codeBlock = false;
        flush();
      }
      continue;
    }
    if (codeBlock) { codeLines.push(line); continue; }

    if (line.startsWith("### ")) {
      out.push(<div key={key++} className="mt-3 mb-1 text-[11px] font-bold text-violet-300 uppercase tracking-wide">{line.slice(4)}</div>);
    } else if (line.startsWith("## ")) {
      out.push(<div key={key++} className="mt-3 mb-1 text-xs font-bold text-violet-200">{line.slice(3)}</div>);
    } else if (line.startsWith("# ")) {
      out.push(<div key={key++} className="mt-2 mb-1 text-sm font-bold text-white">{line.slice(2)}</div>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      out.push(
        <div key={key++} className="flex gap-1.5 text-[11.5px] text-gray-300 leading-relaxed pl-1">
          <span className="text-violet-400 shrink-0 mt-0.5">•</span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      const [num, ...rest] = line.split(/\.\s/);
      out.push(
        <div key={key++} className="flex gap-1.5 text-[11.5px] text-gray-300 leading-relaxed pl-1">
          <span className="text-blue-400 font-mono shrink-0">{num}.</span>
          <span>{inlineFormat(rest.join(". "))}</span>
        </div>,
      );
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      out.push(<div key={key++} className="text-[11.5px] font-bold text-white mt-1">{line.slice(2, -2)}</div>);
    } else if (line === "---" || line === "***") {
      out.push(<hr key={key++} className="border-gray-700/60 my-2" />);
    } else if (line.trim() === "") {
      out.push(<div key={key++} className="h-1.5" />);
    } else {
      out.push(<div key={key++} className="text-[11.5px] text-gray-300 leading-relaxed">{inlineFormat(line)}</div>);
    }
  }
  flush();
  return out;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold + inline code
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} className="text-[10.5px] bg-violet-900/40 text-violet-200 px-1 py-0.5 rounded font-mono">{p.slice(1, -1)}</code>;
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>;
    return p;
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CodexEngineerPanel({ pipelineResult, payload, profileCategory, remainingWeaknesses = [] }: Props) {
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState("");
  const [streaming, setStreaming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ctxOn,     setCtxOn]     = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const idRef     = useRef(0);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Build trimmed pipeline context (avoid huge JSON in requests)
  const buildContext = useCallback((): Record<string, unknown> | undefined => {
    if (!ctxOn || !pipelineResult) return undefined;
    const rc  = (pipelineResult.roll_contour_engine  ?? {}) as Record<string, unknown>;
    const se  = (pipelineResult.simulation_engine    ?? {}) as Record<string, unknown>;
    const pae = (pipelineResult.profile_analysis_engine ?? {}) as Record<string, unknown>;
    const ste = (pipelineResult.station_engine       ?? {}) as Record<string, unknown>;
    const fm  = (rc.forming_summary ?? {}) as Record<string, unknown>;
    const passes = (rc.passes as Record<string, unknown>[] | undefined)?.slice(0, 6) ?? [];

    return {
      profile: {
        type:              pae.section_type_detected ?? payload?.profile_type ?? "unknown",
        material:          payload?.material ?? rc.material ?? "GI",
        thickness_mm:      payload?.thickness ?? rc.thickness_mm,
        web_mm:            payload?.section_height_mm ?? pae.web_mm,
        flange_mm:         payload?.section_width_mm  ?? pae.flange_mm,
        bend_radius_mm:    payload?.bend_radius        ?? rc.bend_radius_mm,
      },
      forming: {
        flat_strip_width_mm: fm.flat_strip_width_mm,
        neutral_axis_factor: fm.neutral_axis_factor,
        total_passes:        rc.total_passes ?? ste.total_stations,
        springback_deg:      rc.springback_deg,
      },
      station_sample: passes.map((p) => ({
        pass_no:              p.pass_no,
        station_label:        p.station_label,
        target_angle_deg:     p.target_angle_deg,
        upper_roll_radius_mm: p.upper_roll_radius_mm,
        lower_roll_radius_mm: p.lower_roll_radius_mm,
        roll_gap_mm:          p.roll_gap_mm,
        groove_depth_mm:      p.groove_depth_mm,
      })),
      simulation: {
        quality_score: (se.quality as Record<string, unknown> | undefined)?.score,
        quality_label: (se.quality as Record<string, unknown> | undefined)?.label,
        total_passes:  se.total_passes,
        material:      se.material,
      },
    };
  }, [pipelineResult, payload, ctxOn]);

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || streaming) return;

    const uid  = String(++idRef.current);
    const aid  = String(++idRef.current);
    const userMsg: Message = { id: uid, role: "user",      content: question.trim(), ts: Date.now() };
    const asstMsg: Message = { id: aid, role: "assistant", content: "",              ts: Date.now(), loading: true };

    setMessages(prev => [...prev, userMsg, asstMsg]);
    setInput("");
    setStreaming(true);

    const ctx = buildContext();
    abortRef.current = new AbortController();

    try {
      const resp = await fetch("/api/codex-engineer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: question.trim(), context: ctx }),
        signal:  abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" })) as { error?: string };
        setMessages(prev => prev.map(m =>
          m.id === aid ? { ...m, content: `**Error:** ${err.error ?? "Unknown error"}`, loading: false } : m,
        ));
        return;
      }

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   full    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw) as { text?: string; error?: string };
            if (parsed.error) {
              full += `\n**Error:** ${parsed.error}`;
            } else if (parsed.text) {
              full += parsed.text;
            }
            setMessages(prev => prev.map(m =>
              m.id === aid ? { ...m, content: full, loading: false } : m,
            ));
          } catch { /* ignore malformed SSE */ }
        }
      }

      // Ensure loading is cleared even if stream ends without [DONE]
      setMessages(prev => prev.map(m =>
        m.id === aid ? { ...m, loading: false } : m,
      ));
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        const msg = err instanceof Error ? err.message : "Stream failed";
        setMessages(prev => prev.map(m =>
          m.id === aid ? { ...m, content: `**Error:** ${msg}`, loading: false } : m,
        ));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, buildContext]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const abort = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages(prev => prev.map(m =>
      m.loading ? { ...m, loading: false, content: m.content + "\n\n*[aborted]*" } : m,
    ));
  };

  const hasCtx = !!(pipelineResult && Object.keys(pipelineResult).length > 0);

  return (
    <div className={`rounded-2xl border border-violet-500/20 bg-[#090912] overflow-hidden transition-all duration-200`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-2.5 border-b border-violet-500/15 flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
            <Cpu className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-violet-200 tracking-wide">Codex Engineer</div>
            <div className="text-[10px] text-gray-500 font-mono">o4-mini · Roll Forming AI · OpenRouter</div>
          </div>
          <div className="ml-2 flex items-center gap-1.5">
            {hasCtx && (
              <button
                onClick={e => { e.stopPropagation(); setCtxOn(c => !c); }}
                className={`text-[9px] px-2 py-0.5 rounded border font-mono transition-colors ${
                  ctxOn
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-gray-700 text-gray-600"
                }`}
                title="Toggle pipeline context injection"
              >
                {ctxOn ? "CTX ON" : "CTX OFF"}
              </button>
            )}
            {streaming && (
              <div className="flex items-center gap-1 text-[9px] text-violet-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                streaming…
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto" onClick={e => e.stopPropagation()}>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded text-gray-700 hover:text-red-400 transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* ── Quick prompts ─────────────────────────────────────────────── */}
          {messages.length === 0 && (
            <div className="px-4 pt-3 pb-2">
              <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">Quick questions</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK.map(q => (
                  <button
                    key={q.label}
                    onClick={() => void sendMessage(q.prompt)}
                    disabled={streaming}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-violet-500/20 bg-violet-500/5 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/40 transition-colors disabled:opacity-40"
                  >
                    {q.icon}
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Messages ──────────────────────────────────────────────────── */}
          {messages.length > 0 && (
            <div
              ref={scrollRef}
              className="px-4 py-3 space-y-3 overflow-y-auto"
              style={{ maxHeight: 460 }}
            >
              {messages.map(msg => (
                <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  {msg.role === "user" ? (
                    <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-violet-600/25 border border-violet-500/25 px-3 py-2">
                      <div className="text-[11.5px] text-violet-100 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-[#0d1220] border border-blue-500/15 px-3 py-2.5">
                      {msg.loading && !msg.content ? (
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 py-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                          Codex is thinking…
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {renderMarkdown(msg.content)}
                          {msg.loading && (
                            <span className="inline-block w-1.5 h-3.5 bg-violet-400 ml-0.5 animate-pulse rounded-sm" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Input ─────────────────────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-2 border-t border-violet-500/10">
            {/* Quick prompts after first message */}
            {messages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK.slice(0, 3).map(q => (
                  <button
                    key={q.label}
                    onClick={() => void sendMessage(q.prompt)}
                    disabled={streaming}
                    className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-gray-700/60 text-gray-600 hover:text-violet-400 hover:border-violet-500/30 transition-colors disabled:opacity-40"
                  >
                    {q.icon}
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={streaming}
                placeholder={hasCtx && ctxOn
                  ? "Ask anything — pipeline data auto-attached as context…"
                  : "Ask about roll forming, formulas, Python code…"
                }
                rows={2}
                className="flex-1 resize-none rounded-xl border border-gray-700/50 bg-[#0d1117] text-[11.5px] text-gray-200 placeholder-gray-600 px-3 py-2 focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50 leading-relaxed"
              />
              {streaming ? (
                <button
                  onClick={abort}
                  className="shrink-0 p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors"
                  title="Stop"
                >
                  <div className="w-3 h-3 rounded bg-red-400" />
                </button>
              ) : (
                <button
                  onClick={() => void sendMessage(input)}
                  disabled={!input.trim()}
                  className="shrink-0 p-2.5 rounded-xl bg-violet-600/30 border border-violet-500/30 text-violet-300 hover:bg-violet-600/50 transition-colors disabled:opacity-30"
                  title="Send (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="mt-1.5 text-[9px] text-gray-700 font-mono">
              Enter = send · Shift+Enter = newline
              {hasCtx && ctxOn && " · Pipeline context injected automatically"}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
