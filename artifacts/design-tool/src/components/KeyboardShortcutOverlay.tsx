import React, { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; desc: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["?"], desc: "Show keyboard shortcuts" },
      { keys: ["Ctrl", "S"], desc: "Save project" },
      { keys: ["Ctrl", "Z"], desc: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], desc: "Redo" },
      { keys: ["Ctrl", "Y"], desc: "Redo (alternate)" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { keys: ["Ctrl", "C"], desc: "Copy selection" },
      { keys: ["Ctrl", "V"], desc: "Paste" },
      { keys: ["Ctrl", "D"], desc: "Duplicate" },
      { keys: ["Ctrl", "A"], desc: "Select all" },
      { keys: ["Delete"], desc: "Delete selection" },
      { keys: ["Backspace"], desc: "Delete selection" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["1"], desc: "Design tab" },
      { keys: ["2"], desc: "Manufacturing tab" },
      { keys: ["3"], desc: "Simulation tab" },
      { keys: ["4"], desc: "Smart Tools tab" },
      { keys: ["5"], desc: "Project tab" },
      { keys: ["Esc"], desc: "Close overlay / modal" },
    ],
  },
];

export function KeyboardShortcutOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-2xl max-h-[80vh] mx-4 bg-[#0F0F1C] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Keyboard Shortcuts</h2>
              <p className="text-[11px] text-zinc-500">Press ? to toggle this overlay</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-72px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{group.title}</h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-zinc-300">{shortcut.desc}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, j) => (
                          <React.Fragment key={j}>
                            {j > 0 && <span className="text-zinc-600 text-xs">+</span>}
                            <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-[11px] font-mono text-zinc-300 min-w-[24px] text-center">
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
