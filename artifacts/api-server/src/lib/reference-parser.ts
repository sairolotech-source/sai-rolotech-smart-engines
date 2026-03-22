export interface MachineProfile {
  name: string;
  controller: string;
  maxRpm: number;
  maxFeed: number;
  toolChangeCommand: string;
  homeCommand: string;
  spindleOnCommand: string;
  spindleOffCommand: string;
  coolantOnCommand?: string;
  coolantOffCommand?: string;
}

const DEFAULT_PROFILES: Record<string, MachineProfile> = {
  "fanuc": {
    name: "Fanuc",
    controller: "Fanuc",
    maxRpm: 5000,
    maxFeed: 1.0,
    toolChangeCommand: "T{n}{n}",
    homeCommand: "G28 U0. W0.",
    spindleOnCommand: "M3",
    spindleOffCommand: "M5",
    coolantOnCommand: "M8",
    coolantOffCommand: "M9",
  },
  "siemens": {
    name: "Siemens 840D",
    controller: "Siemens 840D",
    maxRpm: 6000,
    maxFeed: 1.0,
    toolChangeCommand: "T{n} D1",
    homeCommand: "G74 X0 Z0",
    spindleOnCommand: "M3",
    spindleOffCommand: "M5",
    coolantOnCommand: "M8",
    coolantOffCommand: "M9",
  },
  "delta": {
    name: "Delta 2X",
    controller: "Delta 2X",
    maxRpm: 3000,
    maxFeed: 0.5,
    toolChangeCommand: "T{n}{n} ()",
    homeCommand: "G28 U0.\nG28 W0.",
    spindleOnCommand: "M4",
    spindleOffCommand: "M5",
  },
};

export function parseReferenceGcode(content: string): MachineProfile {
  const lines = content.split(/\r?\n/);

  let maxRpm = 1500;
  let maxFeed = 0.3;
  let controller = "Fanuc";
  let spindleDir = "M3";
  let hasCoolant = false;

  for (const line of lines) {
    const rpmMatch = line.match(/S(\d+)/);
    if (rpmMatch) {
      const rpm = parseInt(rpmMatch[1]!);
      if (rpm > maxRpm) maxRpm = rpm;
    }
    const feedMatch = line.match(/F([\d.]+)/);
    if (feedMatch) {
      const feed = parseFloat(feedMatch[1]!);
      if (feed > maxFeed) maxFeed = feed;
    }
    if (line.includes("M4")) spindleDir = "M4";
    if (line.includes("M8") || line.includes("M9")) hasCoolant = true;
    if (line.includes("TRAORI")) controller = "Siemens 840D";
    if (line.includes("G12.1")) controller = "Syntec";
  }

  return {
    name: controller,
    controller,
    maxRpm,
    maxFeed,
    toolChangeCommand: "T{n}{n}",
    homeCommand: "G28 U0. W0.",
    spindleOnCommand: spindleDir,
    spindleOffCommand: "M5",
    coolantOnCommand: hasCoolant ? "M8" : undefined,
    coolantOffCommand: hasCoolant ? "M9" : undefined,
  };
}

export function getMachineProfile(name: string): MachineProfile {
  return DEFAULT_PROFILES[name.toLowerCase()] ?? DEFAULT_PROFILES["fanuc"]!;
}
