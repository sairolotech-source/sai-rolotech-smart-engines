import { useState, useRef, useEffect } from "react";
import { Lock, ShieldAlert } from "lucide-react";

const CORRECT_PIN = "1164";

interface Props {
  onUnlocked: () => void;
}

export function PinGateScreen({ onUnlocked }: Props) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    refs[0].current?.focus();
  }, []);

  useEffect(() => {
    if (!locked) return;
    setLockTimer(30);
    const interval = setInterval(() => {
      setLockTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setLocked(false);
          setAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [locked]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 3) {
      refs[index + 1].current?.focus();
    }
    if (newPin.every(d => d !== "")) {
      verifyPin(newPin.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const verifyPin = (entered: string) => {
    if (entered === CORRECT_PIN) {
      onUnlocked();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setShake(true);
      setPin(["", "", "", ""]);
      setTimeout(() => {
        setShake(false);
        refs[0].current?.focus();
      }, 600);
      if (next >= 5) {
        setLocked(true);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#04060e] flex items-center justify-center p-6">
      <svg className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#fff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div className="w-full max-w-[320px] relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">SAI Rolotech</h1>
          <p className="text-xs text-zinc-500 mt-1 tracking-widest uppercase">Smart Engines</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
          <p className="text-sm text-zinc-400 text-center mb-6">Enter 4-digit PIN to continue</p>

          {locked ? (
            <div className="text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-sm text-red-400 font-medium">Too many wrong attempts</p>
              <p className="text-xs text-zinc-500">Try again in <span className="text-amber-400 font-bold">{lockTimer}s</span></p>
            </div>
          ) : (
            <div className={`flex justify-center gap-3 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={refs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-14 h-14 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white text-2xl font-bold text-center focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all caret-transparent"
                />
              ))}
            </div>
          )}

          {!locked && attempts > 0 && (
            <p className="text-xs text-red-400 text-center mt-4">
              Incorrect PIN — {5 - attempts} attempt{5 - attempts !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>

        <p className="text-center text-[10px] text-zinc-700 mt-4">
          SAI Rolotech Smart Engines v2.2.23
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
