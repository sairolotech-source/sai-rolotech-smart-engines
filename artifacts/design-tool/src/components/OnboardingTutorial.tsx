import { useState, useEffect } from "react";

const STEPS = [
  {
    icon: "🚀",
    title: "SAI Rolotech Smart Engines mein Swagat!",
    desc: "Yeh world-class roll forming engineering suite hai — DXF se G-Code tak, sab kuch ek jagah. Chaliye step-by-step features dekhte hain.",
    color: "#f59e0b",
  },
  {
    icon: "📐",
    title: "DXF File Upload",
    desc: "Apna DXF profile upload karo 'CNC/DXF' tab mein. Software automatically segments detect karega, profile visualize karega aur dimensions calculate karega.",
    color: "#06b6d4",
  },
  {
    icon: "🌸",
    title: "Flower Pattern Generator",
    desc: "'Flower' tab mein jaao. Material type aur thickness set karo, stations choose karo — ek click mein complete roll forming flower pattern generate hoga.",
    color: "#8b5cf6",
  },
  {
    icon: "⚙️",
    title: "G-Code Generator",
    desc: "'G-Code' tab mein professional CNC machine code generate karo. Fanuc, Siemens, Mazak — sabke liye compatible output milega.",
    color: "#10b981",
  },
  {
    icon: "🤖",
    title: "Super Pro Mode — AI Assistant",
    desc: "AutoCAD Drawing tab mein 'Super Pro' button hai. Gemini AI se Hinglish mein engineering advice lo, pipeline automatically run karo aur smart suggestions pao.",
    color: "#f43f5e",
  },
  {
    icon: "🔗",
    title: "Project Share",
    desc: "Apna project ek code mein export karo aur kisi bhi engineer ke saath share karo. Unhe sirf code paste karna hoga aur pura project load ho jayega.",
    color: "#f59e0b",
  },
  {
    icon: "✅",
    title: "Sab Ready Hai!",
    desc: "Ab tum expert ho! Koi bhi sawaal ho toh AI Guide button (neeche right) press karo ya Super Pro Mode mein poocho. Happy Engineering! 🎉",
    color: "#16a34a",
  },
];

interface Props {
  onClose: () => void;
}

export function OnboardingTutorial({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 300);
    localStorage.setItem("sai-tutorial-done", "1");
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-6 flex flex-col gap-4"
        style={{
          background: "linear-gradient(135deg, #0d0e1e 0%, #12132a 100%)",
          border: `1px solid ${current.color}40`,
          boxShadow: `0 0 60px ${current.color}20, 0 24px 48px rgba(0,0,0,0.6)`,
          transform: visible ? "scale(1)" : "scale(0.9)",
          transition: "transform 0.3s ease, box-shadow 0.4s ease",
        }}
      >
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center mb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              className="h-1.5 rounded-full cursor-pointer transition-all duration-300"
              style={{
                width: i === step ? "24px" : "6px",
                background: i === step ? current.color : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-center text-5xl">{current.icon}</div>

        {/* Content */}
        <div className="text-center">
          <h2 className="text-lg font-bold text-white mb-2">{current.title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            {current.desc}
          </p>
        </div>

        {/* Step indicator */}
        <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          {step + 1} / {STEPS.length}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={close}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Skip
          </button>
          <button
            onClick={() => isLast ? close() : setStep(s => s + 1)}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${current.color}, ${current.color}cc)`,
              color: "#000",
            }}
          >
            {isLast ? "Shuru Karo! 🚀" : "Aage →"}
          </button>
        </div>

        {/* Close X */}
        <button
          onClick={close}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-xs"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
