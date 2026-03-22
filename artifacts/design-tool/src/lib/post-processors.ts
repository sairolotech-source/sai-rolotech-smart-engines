// ─── Post Processor Definitions ───────────────────────────────────────────────
// Pre-built machine profiles for different CNC controller brands
// These are passed as `machineProfile` to the G-code generator API

export interface PostProcessorPreset {
  id: string;
  name: string;
  brand: string;
  description: string;
  icon: string;
  machineProfile: {
    coordinateFormat: "absolute" | "incremental";
    decimalPrecision: number;
    feedRate: number;
    feedUnit: "mm_rev" | "mm_min";
    spindleSpeed: number;
    maxSpindleSpeed: number;
    maxSpindleCmd: "G50" | "G92";
    spindleMode: "css" | "rpm";
    spindleDirection: "M3" | "M4";
    safeZ: number;
    workOffset: string;
    coolant: boolean;
    xDiameterMode: boolean;
    useG28: boolean;
    arcFormat: "R" | "IJK";
    headerLines: string[];
    footerLines: string[];
    safetyBlock: string;
    toolFormat: string;
    toolChangeSafety: string[];
    endCode: string;
    lineNumberFormat: { enabled: boolean; start: number; increment: number };
    programNumberFormat: string;
    endOfBlockChar: string;
    toolChangeSequence: string[];
    detectedTools: { toolNumber: string; offsetNumber: string; description: string }[];
    modalGroups: {
      motionCodes: string[]; feedCodes: string[]; unitCodes: string[];
      planeCodes: string[]; coolantCodes: string[]; spindleCodes: string[];
      compensationCodes: string[];
    };
    customCodes: string[];
    maxAcceleration?: number;
    exactStopMode?: "G61" | "G64" | "auto";
  };
}

export const POST_PROCESSORS: PostProcessorPreset[] = [
  {
    id: "fanuc_0i",
    name: "Fanuc 0i-TF / 31i-B",
    brand: "Fanuc",
    description: "Standard Fanuc CNC lathe — most common in India. O-number program, T0101 tool format, M30 end.",
    icon: "🔵",
    machineProfile: {
      coordinateFormat: "absolute",
      decimalPrecision: 3,
      feedRate: 0.25,
      feedUnit: "mm_rev",
      spindleSpeed: 200,
      maxSpindleSpeed: 3000,
      maxSpindleCmd: "G50",
      spindleMode: "css",
      spindleDirection: "M3",
      safeZ: 100,
      workOffset: "G54",
      coolant: true,
      xDiameterMode: true,
      useG28: true,
      arcFormat: "R",
      headerLines: ["G18 G40 G80", "G21 G95"],
      footerLines: ["M09", "G28 U0 W0", "M30"],
      safetyBlock: "G18 G80 G40 G49",
      toolFormat: "T{tt}{oo}",
      toolChangeSafety: ["G28 U0 W0"],
      endCode: "M30",
      lineNumberFormat: { enabled: true, start: 10, increment: 10 },
      programNumberFormat: "O{n:04d}",
      endOfBlockChar: "",
      toolChangeSequence: ["T{tt}{oo}", "G97 S500 M03"],
      detectedTools: [],
      modalGroups: {
        motionCodes: ["G00", "G01", "G02", "G03"],
        feedCodes: ["G94", "G95"],
        unitCodes: ["G20", "G21"],
        planeCodes: ["G18"],
        coolantCodes: ["M08", "M09"],
        spindleCodes: ["G96", "G97", "M03", "M04", "M05"],
        compensationCodes: ["G41", "G42", "G40"],
      },
      customCodes: [],
    },
  },
  {
    id: "siemens_840d",
    name: "Siemens 840D SL",
    brand: "Siemens",
    description: "Siemens 840D SL ShopTurn — European machines, Mazak Integrex etc. Uses N_MPF, T1 D1 format, M2 end.",
    icon: "🟢",
    machineProfile: {
      coordinateFormat: "absolute",
      decimalPrecision: 3,
      feedRate: 0.25,
      feedUnit: "mm_rev",
      spindleSpeed: 200,
      maxSpindleSpeed: 3000,
      maxSpindleCmd: "G92",
      spindleMode: "css",
      spindleDirection: "M3",
      safeZ: 100,
      workOffset: "G54",
      coolant: true,
      xDiameterMode: true,
      useG28: false,
      arcFormat: "R",
      headerLines: [
        "G18 G40 LIMS=3000",
        "G21 G95",
        "DIAMON",
      ],
      footerLines: ["M09", "M5", "SPOS=0", "M2"],
      safetyBlock: "G18 G40 LIMS=3000",
      toolFormat: "T{t} D{o}",
      toolChangeSafety: ["SPOS=0"],
      endCode: "M2",
      lineNumberFormat: { enabled: true, start: 10, increment: 10 },
      programNumberFormat: ";{name}_MPF",
      endOfBlockChar: "",
      toolChangeSequence: ["T{t} D{o}", "M6", "G97 S500 M03"],
      detectedTools: [],
      modalGroups: {
        motionCodes: ["G0", "G1", "G2", "G3"],
        feedCodes: ["G94", "G95"],
        unitCodes: ["G71"],
        planeCodes: ["G18"],
        coolantCodes: ["M8", "M9"],
        spindleCodes: ["G96", "G97", "M3", "M4", "M5"],
        compensationCodes: ["G41", "G42", "G40"],
      },
      customCodes: ["LIMS", "SPOS", "DIAMOF", "DIAMON"],
    },
  },
  {
    id: "haas",
    name: "Haas ST / TL Series",
    brand: "Haas",
    description: "Haas CNC lathe — USA brand. Similar to Fanuc but uses different tool change and % markers.",
    icon: "🟡",
    machineProfile: {
      coordinateFormat: "absolute",
      decimalPrecision: 4,
      feedRate: 0.25,
      feedUnit: "mm_rev",
      spindleSpeed: 200,
      maxSpindleSpeed: 3000,
      maxSpindleCmd: "G50",
      spindleMode: "css",
      spindleDirection: "M3",
      safeZ: 100,
      workOffset: "G54",
      coolant: true,
      xDiameterMode: true,
      useG28: true,
      arcFormat: "R",
      headerLines: ["%", "O0001", "G18 G21 G40 G80 G99"],
      footerLines: ["M09", "G28 U0 W0", "M30", "%"],
      safetyBlock: "G18 G40 G80",
      toolFormat: "T{tt}00",
      toolChangeSafety: ["G28 U0 W0"],
      endCode: "M30",
      lineNumberFormat: { enabled: true, start: 10, increment: 10 },
      programNumberFormat: "O{n:04d}",
      endOfBlockChar: "",
      toolChangeSequence: ["T{tt}00", "M06", "G97 S500 M03"],
      detectedTools: [],
      modalGroups: {
        motionCodes: ["G00", "G01", "G02", "G03"],
        feedCodes: ["G98", "G99"],
        unitCodes: ["G20", "G21"],
        planeCodes: ["G18"],
        coolantCodes: ["M08", "M09"],
        spindleCodes: ["G96", "G97", "M03", "M04", "M05"],
        compensationCodes: ["G41", "G42", "G40"],
      },
      customCodes: [],
    },
  },
  {
    id: "mitsubishi_m70",
    name: "Mitsubishi M70 / M80",
    brand: "Mitsubishi",
    description: "Mitsubishi Electric CNC — Japanese machines. Uses % markers, T0101 format, M02 end code.",
    icon: "🔴",
    machineProfile: {
      coordinateFormat: "absolute",
      decimalPrecision: 3,
      feedRate: 0.25,
      feedUnit: "mm_rev",
      spindleSpeed: 200,
      maxSpindleSpeed: 3000,
      maxSpindleCmd: "G50",
      spindleMode: "css",
      spindleDirection: "M3",
      safeZ: 100,
      workOffset: "G54",
      coolant: true,
      xDiameterMode: true,
      useG28: true,
      arcFormat: "R",
      headerLines: ["%", "O0001", "G18 G40 G80"],
      footerLines: ["M09", "G28 U0.0 W0.0", "M02", "%"],
      safetyBlock: "G18 G40 G80",
      toolFormat: "T{tt}{oo}",
      toolChangeSafety: ["G28 U0.0 W0.0"],
      endCode: "M02",
      lineNumberFormat: { enabled: true, start: 10, increment: 10 },
      programNumberFormat: "O{n:04d}",
      endOfBlockChar: ";",
      toolChangeSequence: ["T{tt}{oo}", "G97 S500 M03"],
      detectedTools: [],
      modalGroups: {
        motionCodes: ["G00", "G01", "G02", "G03"],
        feedCodes: ["G94", "G95"],
        unitCodes: ["G20", "G21"],
        planeCodes: ["G18"],
        coolantCodes: ["M08", "M09"],
        spindleCodes: ["G96", "G97", "M03", "M04", "M05"],
        compensationCodes: ["G41", "G42", "G40"],
      },
      customCodes: [],
    },
  },
  {
    id: "delta_2x",
    name: "Delta 2X (SAI / TR Contour)",
    brand: "Delta",
    description: "Sai Rolotech — Delta 2X controller (VERIFIED from actual TAP files). M4 spindle | G92 S500 max | G0→G53→G28 U0.→G28 W0. | T0404 () format | Rough F0.102 Finish F0.051 | G96 CSS | No M8/M9.",
    icon: "⬛",
    machineProfile: {
      coordinateFormat: "absolute",
      decimalPrecision: 3,
      feedRate: 0.102,
      feedUnit: "mm_rev",
      spindleSpeed: 200,
      maxSpindleSpeed: 500,
      maxSpindleCmd: "G92",
      spindleMode: "css",
      spindleDirection: "M4",
      safeZ: 50,
      workOffset: "",
      coolant: false,
      xDiameterMode: true,
      useG28: true,
      arcFormat: "R",
      headerLines: [
        "G0",
        "G53",
        "G28 U0.",
        "G28 W0.",
        "M1",
      ],
      footerLines: [
        "G0",
        "G53",
        "G28 U0.",
        "G28 W0.",
        "M30",
        "%",
      ],
      safetyBlock: "G0\nG53\nG28 U0.\nG28 W0.\nM1",
      toolFormat: "T{tt}{oo}  ()",
      toolChangeSafety: ["G0", "G53", "G28 U0.", "G28 W0.", "M1"],
      endCode: "M30",
      lineNumberFormat: { enabled: true, start: 2, increment: 0 },
      programNumberFormat: "O{n:04d}",
      endOfBlockChar: "",
      toolChangeSequence: [
        "G0",
        "G53",
        "G28 U0.",
        "G28 W0.",
        "M1",
        "T{tt}{oo}  ()",
        "G92 S500",
        "G96 S200 M4",
        "G90",
        "G0 Z50.",
      ],
      detectedTools: [],
      modalGroups: {
        motionCodes: ["G0", "G1", "G2", "G3"],
        feedCodes: ["G95"],
        unitCodes: ["G21"],
        planeCodes: ["G18"],
        coolantCodes: ["M08", "M09"],
        spindleCodes: ["G96", "G97", "M04", "M05"],
        compensationCodes: ["G41", "G42", "G40"],
      },
      customCodes: ["G92", "G53", "G28"],
    },
  },
  {
    id: "syntec",
    name: "Syntec 22TA / 21TA",
    brand: "Syntec",
    description: "Syntec (Taiwan) CNC controller — very common in Indian roll forming shops and affordable machines.",
    icon: "🟠",
    machineProfile: {
      coordinateFormat: "absolute",
      decimalPrecision: 3,
      feedRate: 0.20,
      feedUnit: "mm_rev",
      spindleSpeed: 200,
      maxSpindleSpeed: 3000,
      maxSpindleCmd: "G50",
      spindleMode: "css",
      spindleDirection: "M3",
      safeZ: 100,
      workOffset: "G54",
      coolant: true,
      xDiameterMode: true,
      useG28: false,
      arcFormat: "R",
      headerLines: ["%", "O0001", "G18 G40 G95"],
      footerLines: ["M09", "M05", "M30", "%"],
      safetyBlock: "G18 G40",
      toolFormat: "T{tt}{oo}",
      toolChangeSafety: ["M05"],
      endCode: "M30",
      lineNumberFormat: { enabled: true, start: 10, increment: 10 },
      programNumberFormat: "O{n:04d}",
      endOfBlockChar: "",
      toolChangeSequence: ["T{tt}{oo}", "G97 S500 M03"],
      detectedTools: [],
      modalGroups: {
        motionCodes: ["G00", "G01", "G02", "G03"],
        feedCodes: ["G94", "G95"],
        unitCodes: ["G21"],
        planeCodes: ["G18"],
        coolantCodes: ["M08", "M09"],
        spindleCodes: ["G96", "G97", "M03", "M04", "M05"],
        compensationCodes: ["G41", "G42", "G40"],
      },
      customCodes: [],
    },
  },
];

export function getPostProcessor(id: string): PostProcessorPreset | undefined {
  return POST_PROCESSORS.find(p => p.id === id);
}
