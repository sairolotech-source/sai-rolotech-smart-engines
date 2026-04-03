import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { use3DStudioStore } from "./use3DStudioStore";

const CAD_KNOWLEDGE: Record<string, string> = {
  extrude: "Extrude karne ke liye pehle 2D Sketch Mode mein jaayein, koi shape draw karein (rectangle/circle), phir Extrude button press karein. Depth set karke 3D solid ban jaayega.",
  gcode: "G-Code generate karne ke liye: CAM panel mein tool type aur settings set karein, phir 'Generate Toolpath' button click karein. Baad mein .nc file download kar sakte hain.",
  toolpath: "Toolpath ek simulated cutting path hai jo 3D object ke around banta hai. End Mill typically perimeter milling ke liye, Face Mill surface ke liye, aur Drill holes ke liye use hota hai.",
  material: "Material selection ke baad feed rate automatically adjust karein: Aluminum ke liye 1500-3000 mm/min, Steel ke liye 500-1200 mm/min, aur Plastic ke liye 2000-5000 mm/min recommend hai.",
  feed: "Feed rate woh speed hai jis par tool material mein move karta hai. Zyada feed rate = faster machining but poorer surface finish. Optimal feed = (chip load × flutes × RPM).",
  rpm: "Spindle RPM formula: RPM = (Cutting Speed × 1000) / (π × Tool Diameter). Aluminum ke liye cutting speed ~300 m/min, Steel ~100 m/min.",
  box: "Box primitive add karne ke liye toolbar mein 'Box' button click karein. Phir Properties panel mein position, scale, rotation adjust kar sakte hain.",
  orbit: "3D viewport mein: Left Click + Drag = Orbit (rotate), Right Click + Drag = Pan, Scroll = Zoom. Bottom-right corner mein gizmo se quick orientation change kar sakte hain.",
  sketch: "2D Sketch Mode mein XY plane pe shapes draw kar sakte hain: Rectangle, Circle, Line. Sabse pehle tool select karein, phir canvas pe click-drag se shape draw karein.",
  cnc: "CNC machining ke 3 main axes hain: X (left-right), Y (front-back), Z (up-down). G00 = rapid positioning, G01 = linear feed, M03 = spindle on, M30 = program end.",
  coolant: "Coolant ON karne se: (1) tool life badh jaata hai, (2) surface finish improve hoti hai, (3) chip evacuation better hoti hai. G-Code mein M08 se coolant on aur M09 se off hota hai.",
  scale: "Object scale change karne ke liye Properties panel mein Scale X/Y/Z values change karein. 1.0 = default size. 2.0 = double size. Scale uniformly change karne ke liye teen values equal rakhein.",
};

function getAIResponse(query: string, selectedObj: string | null): string {
  const q = query.toLowerCase();

  for (const [key, answer] of Object.entries(CAD_KNOWLEDGE)) {
    if (q.includes(key)) {
      return answer;
    }
  }

  if (selectedObj && (q.includes("ye") || q.includes("this") || q.includes("yeh") || q.includes("selected"))) {
    return `Selected object "${selectedObj}" ke baare mein: Properties panel mein aap position, scale, rotation aur color change kar sakte hain. CAM panel mein toolpath generate karne ke liye pehle is object ko select rakhein.`;
  }

  if (q.includes("help") || q.includes("kya") || q.includes("how") || q.includes("kaise")) {
    return `Main aapki help kar sakta hoon: \n• 3D shapes add karna (Box, Cylinder, Sphere, Cone)\n• 2D Sketch se 3D extrude karna\n• CAM settings aur toolpath generation\n• G-Code download karna\n• Object properties edit karna\n\nKoi specific sawaal poochhein!`;
  }

  const defaults = [
    "Yeh ek bahut achha sawaal hai! CAD/CAM workflow mein pehle geometry define ki jaati hai, phir machining strategy set ki jaati hai. Kuch specific poochhna chahte hain?",
    "3D Studio mein aap primitives add karke ya 2D sketch se extrude karke objects bana sakte hain. CAM panel mein toolpath generate kar sakte hain aur G-Code download kar sakte hain.",
    "Engineering design mein dimensional accuracy bahut important hai. Properties panel mein scale values millimeters mein adjust karein. Koi specific dimension chahiye?",
    "CNC machining ke liye sahi tool selection bahut zaroori hai. End Mill general purpose ke liye, Drill holes ke liye, aur Face Mill flat surfaces ke liye best hai.",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

export function AIChatPanel() {
  const { chatMessages, addChatMessage, isChatLoading, setChatLoading, selectedObjectId, objects } = use3DStudioStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedObj = selectedObjectId ? objects.find(o => o.id === selectedObjectId) : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isChatLoading) return;
    setInput("");
    addChatMessage("user", text);
    setChatLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 600));
    const response = getAIResponse(text, selectedObj?.name || null);
    addChatMessage("assistant", response);
    setChatLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const QUICK_PROMPTS = [
    "Box kaise add karein?",
    "G-Code kaise generate karein?",
    "Sketch extrude karna sikhao",
    "Feed rate kya honi chahiye?",
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[11px] font-semibold text-zinc-400">AI Assistant</span>
        {selectedObj && (
          <span className="ml-auto text-[9px] text-zinc-600 truncate">
            Focus: {selectedObj.name}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
              msg.role === "assistant"
                ? "bg-violet-500/20 border border-violet-500/30"
                : "bg-blue-500/20 border border-blue-500/30"
            }`}>
              {msg.role === "assistant"
                ? <Bot className="w-3 h-3 text-violet-400" />
                : <User className="w-3 h-3 text-blue-400" />}
            </div>
            <div className={`flex-1 text-[11px] leading-relaxed rounded-xl px-3 py-2 max-w-[85%] ${
              msg.role === "assistant"
                ? "bg-white/[0.03] border border-white/[0.06] text-zinc-300"
                : "bg-blue-500/10 border border-blue-500/15 text-blue-200 ml-auto"
            }`}>
              {msg.content.split("\n").map((line, i) => (
                <span key={i}>{line}{i < msg.content.split("\n").length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}

        {isChatLoading && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center bg-violet-500/20 border border-violet-500/30">
              <Bot className="w-3 h-3 text-violet-400" />
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="px-2 pb-1 flex gap-1 flex-wrap flex-shrink-0 border-t border-white/[0.04] pt-1.5">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => { setInput(p); }}
            className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-zinc-600 hover:text-zinc-400 hover:border-white/[0.08] transition-all"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex gap-2 p-2 flex-shrink-0 border-t border-white/[0.06]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="CAD/CAM ke baare mein poochhein..."
          className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/40"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isChatLoading}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
