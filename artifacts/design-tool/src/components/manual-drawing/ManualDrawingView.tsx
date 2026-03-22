import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useReducer,
} from "react";
import {
  Layers,
  Download,
  FileText,
  Image as ImageIcon,
  Send,
  Grid,
  Compass,
  Crosshair,
  Zap,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronRight,
  ChevronDown,
  Settings,
  Trash2,
} from "lucide-react";
import {
  parseCoordinates,
  resolveCommand,
  newEntityId,
  getInitialDrawingState,
  worldToCanvas,
  canvasToWorld,
  applyOrtho,
  snapToGrid,
  findNearestOsnap,
  generateDXF,
} from "./ManualDrawingEngine";
import type {
  DrawingState,
  DrawEntity,
  Layer,
  Point,
  CommandLineEntry,
  CommandState,
} from "./ManualDrawingEngine";
import { useCncStore } from "../../store/useCncStore";
import {
  type HatchStyle,
  DEFAULT_HATCH_STYLE,
  HATCH_PATTERNS,
  extractBoundaryPoints,
  generateHatchLines,
  renderHatchOnCanvas,
} from "./HatchEngine";
import {
  trimLine,
  extendLine,
  filletLines,
  chamferLines,
  rectangularArray,
  polarArray,
} from "./EditingCommands";
import {
  type BlockLibrary,
  createBlockLibrary,
  defineBlock,
  insertBlock,
  explodeBlockRef,
  getBlockNames,
  BUILT_IN_SYMBOLS,
} from "./BlockSystem";
import {
  type TextStyle,
  DEFAULT_TEXT_STYLE,
  AVAILABLE_FONTS,
  createTextStyleManager,
  createMTextEntity,
  renderTextEntity,
} from "./TextStyles";
import {
  type DimensionStyle,
  DEFAULT_DIM_STYLE,
  createDimStyleManager,
  createLeaderEntity,
  formatDimValue,
  renderDimensionEntity,
} from "./DimensionStyles";
import {
  type PrintLayoutConfig,
  PAPER_SIZES,
  getDefaultPrintConfig,
  exportToPDF,
} from "./PrintLayout";

type CommandPhase = {
  command: string;
  state: CommandState;
  tempData: Record<string, any>;
  points: Point[];
  prompt: string;
  previewEntity?: DrawEntity | null;
};

const INITIAL_PHASE: CommandPhase = {
  command: "",
  state: "idle",
  tempData: {},
  points: [],
  prompt: "",
  previewEntity: null,
};

function layerColor(state: DrawingState, layerName: string): string {
  const layer = state.layers.find((l) => l.name === layerName);
  return layer?.color || "#ffffff";
}

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1; const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitTestEntity(ent: DrawEntity, pt: Point, tol: number): boolean {
  const { data, type } = ent;
  switch (type) {
    case "line":
      return distPointToSegment(pt.x, pt.y, data.x1, data.y1, data.x2, data.y2) <= tol;
    case "circle": {
      const d = Math.abs(Math.hypot(pt.x - data.cx, pt.y - data.cy) - data.r);
      return d <= tol;
    }
    case "arc": {
      const dist = Math.hypot(pt.x - data.cx, pt.y - data.cy);
      if (Math.abs(dist - data.r) > tol) return false;
      let ang = Math.atan2(pt.y - data.cy, pt.x - data.cx) * 180 / Math.PI;
      if (ang < 0) ang += 360;
      let sa = ((data.startAngle % 360) + 360) % 360;
      let ea = ((data.endAngle % 360) + 360) % 360;
      if (sa <= ea) return ang >= sa && ang <= ea;
      return ang >= sa || ang <= ea;
    }
    case "polyline": {
      const pts: Point[] = data.points || [];
      for (let i = 0; i < pts.length - 1; i++) {
        if (distPointToSegment(pt.x, pt.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= tol) return true;
      }
      if (data.closed && pts.length > 2) {
        const last = pts[pts.length - 1]; const first = pts[0];
        if (distPointToSegment(pt.x, pt.y, last.x, last.y, first.x, first.y) <= tol) return true;
      }
      return false;
    }
    case "text":
    case "mtext":
      return Math.hypot(pt.x - data.x, pt.y - data.y) <= tol * 3;
    case "point":
      return Math.hypot(pt.x - data.x, pt.y - data.y) <= tol;
    case "dimension_linear":
    case "dimension_angular":
    case "dimension_radius":
    case "dimension_diameter": {
      if (data.p1 && data.p2) {
        if (distPointToSegment(pt.x, pt.y, data.p1.x, data.p1.y, data.p2.x, data.p2.y) <= tol * 2) return true;
        if (data.location && distPointToSegment(pt.x, pt.y, data.p1.x, data.p1.y, data.location.x, data.location.y) <= tol * 2) return true;
      }
      return false;
    }
    default: {
      const t = type as string;
      if (t === "hatch") {
        const boundary: Point[] = data.boundary || [];
        if (boundary.length < 3) return false;
        let inside = false;
        for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
          if (((boundary[i].y > pt.y) !== (boundary[j].y > pt.y)) &&
              pt.x < (boundary[j].x - boundary[i].x) * (pt.y - boundary[i].y) / (boundary[j].y - boundary[i].y) + boundary[i].x) {
            inside = !inside;
          }
        }
        return inside;
      }
      if (t === "block_ref") {
        const ip = data.insertPoint;
        if (ip) return Math.hypot(pt.x - ip.x, pt.y - ip.y) <= tol * 4;
        return false;
      }
      if (t === "leader") {
        const points: Point[] = data.points || [];
        for (let i = 0; i < points.length - 1; i++) {
          if (distPointToSegment(pt.x, pt.y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y) <= tol) return true;
        }
        return false;
      }
      return false;
    }
  }
}

function windowSelectEntities(entities: DrawEntity[], x1: number, y1: number, x2: number, y2: number): string[] {
  const minX = Math.min(x1, x2); const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2); const maxY = Math.max(y1, y2);
  return entities.filter((ent) => {
    const { data, type } = ent;
    if (type === "line") return data.x1 >= minX && data.x1 <= maxX && data.y1 >= minY && data.y1 <= maxY && data.x2 >= minX && data.x2 <= maxX && data.y2 >= minY && data.y2 <= maxY;
    if (type === "circle") return data.cx - data.r >= minX && data.cx + data.r <= maxX && data.cy - data.r >= minY && data.cy + data.r <= maxY;
    if (type === "polyline") return (data.points as Point[]).every((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
    if (type === "text" || type === "mtext" || type === "point") return data.x >= minX && data.x <= maxX && data.y >= minY && data.y <= maxY;
    return false;
  }).map((e) => e.id);
}

export function ManualDrawingView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const [drawing, setDrawing] = useState<DrawingState>(
    getInitialDrawingState()
  );
  const [phase, setPhase] = useState<CommandPhase>(INITIAL_PHASE);
  const [cmdHistory, setCmdHistory] = useState<CommandLineEntry[]>([
    {
      type: "response",
      text: "FormAxis Manual Drawing — AutoCAD Command Mode. Type a command and press Enter.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [mouseWorldPos, setMouseWorldPos] = useState<Point>({ x: 0, y: 0 });
  const [snapPoint, setSnapPoint] = useState<{
    point: Point;
    type: string;
  } | null>(null);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [showLayers, setShowLayers] = useState(true);
  const [showProps, setShowProps] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [isAddingLayer, setIsAddingLayer] = useState(false);

  const [rubberBand, setRubberBand] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartWorldRef = useRef<Point | null>(null);

  const [blockLibrary, setBlockLibrary] = useState<BlockLibrary>(() => {
    const lib = createBlockLibrary();
    let result = lib;
    for (const [name, sym] of Object.entries(BUILT_IN_SYMBOLS)) {
      result = defineBlock(result, name, sym.basePoint, sym.entities, sym.description);
    }
    return result;
  });
  const [textStyles] = useState<TextStyle[]>(() => createTextStyleManager());
  const [currentTextStyle, setCurrentTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [dimStyles] = useState<DimensionStyle[]>(() => createDimStyleManager());
  const [currentDimStyle, setCurrentDimStyle] = useState<DimensionStyle>(DEFAULT_DIM_STYLE);
  const [printConfig, setPrintConfig] = useState<PrintLayoutConfig>(getDefaultPrintConfig());
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showBlockPanel, setShowBlockPanel] = useState(false);

  const { geometry, stations } = useCncStore();

  const canvasDims = useRef({ w: 800, h: 600 });

  const addHistory = useCallback(
    (type: CommandLineEntry["type"], text: string) => {
      setCmdHistory((prev) => [...prev, { type, text }]);
    },
    []
  );

  const pushUndo = useCallback((entities: DrawEntity[]) => {
    setDrawing((prev) => ({
      ...prev,
      undoStack: [...prev.undoStack, [...prev.entities]],
      redoStack: [],
    }));
  }, []);

  const commitEntities = useCallback(
    (newEntities: DrawEntity[]) => {
      setDrawing((prev) => ({
        ...prev,
        entities: [...prev.entities, ...newEntities],
        undoStack: [...prev.undoStack, [...prev.entities]],
        redoStack: [],
      }));
    },
    []
  );

  const getCanvasDims = () => {
    const c = canvasRef.current;
    if (!c) return { w: 800, h: 600 };
    return { w: c.width, h: c.height };
  };

  const getWorldPoint = useCallback(
    (cx: number, cy: number, st: DrawingState): Point => {
      const { w, h } = getCanvasDims();
      return canvasToWorld(cx, cy, st.panX, st.panY, st.zoom, h);
    },
    []
  );

  const finishCommand = useCallback(() => {
    setPhase(INITIAL_PHASE);
    addHistory("prompt", "Command:");
  }, [addHistory]);

  const cancelCommand = useCallback(() => {
    addHistory("response", "*Cancel*");
    setPhase(INITIAL_PHASE);
    addHistory("prompt", "Command:");
  }, [addHistory]);

  const processInput = useCallback(
    (raw: string) => {
      const val = raw.trim();
      if (!val) {
        if (phase.state === "awaiting_object_select") {
          const accIds: string[] = phase.tempData.ids || [];
          if (phase.command === "ERASE") {
            handleEraseInput("");
            return;
          }
          if (phase.command === "SELECT") {
            setDrawing((prev) => ({ ...prev, selectedIds: accIds }));
            addHistory("response", `Selection complete: ${accIds.length} object(s) selected.`);
            finishCommand();
            return;
          }
          if ((phase.command === "MOVE" || phase.command === "COPY") && accIds.length > 0) {
            setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, ids: accIds }, state: "awaiting_base_point", prompt: "Specify base point:" }));
            addHistory("prompt", "Specify base point:");
            return;
          }
        }
        if (phase.state !== "idle") cancelCommand();
        return;
      }

      addHistory("input", val);
      setInputHistory((prev) => [val, ...prev.slice(0, 49)]);

      const { state, command, points, tempData } = phase;

      if (state === "idle") {
        const cmd = resolveCommand(val);
        executeCommand(cmd);
        return;
      }

      if (val.toUpperCase() === "ESC" || val === "\x1B") {
        cancelCommand();
        return;
      }

      switch (command) {
        case "LINE":
          handleLineInput(val);
          break;
        case "CIRCLE":
          handleCircleInput(val);
          break;
        case "ARC":
          handleArcInput(val);
          break;
        case "POLYLINE":
          handlePolylineInput(val);
          break;
        case "RECTANGLE":
          handleRectInput(val);
          break;
        case "ERASE":
          handleEraseInput(val);
          break;
        case "SELECT": {
          const valUp = val.toUpperCase();
          if (valUp === "END" || valUp === "DONE" || valUp === "ALL") {
            const accIds = valUp === "ALL" ? drawing.entities.map((e) => e.id) : (phase.tempData.ids || []);
            setDrawing((prev) => ({ ...prev, selectedIds: accIds }));
            addHistory("response", `Selection: ${accIds.length} object(s) selected.`);
            finishCommand();
          } else {
            addHistory("response", `Click entities on canvas. Type END or press Enter to finish.`);
          }
          break;
        }
        case "MOVE":
          handleMoveInput(val);
          break;
        case "COPY":
          handleCopyInput(val);
          break;
        case "ROTATE":
          handleRotateInput(val);
          break;
        case "SCALE":
          handleScaleInput(val);
          break;
        case "MIRROR":
          handleMirrorInput(val);
          break;
        case "OFFSET":
          handleOffsetInput(val);
          break;
        case "FILLET":
          handleFilletInput(val);
          break;
        case "CHAMFER":
          handleChamferInput(val);
          break;
        case "TRIM":
          handleTrimInput(val);
          break;
        case "EXTEND":
          handleExtendInput(val);
          break;
        case "HATCH":
          handleHatchInput(val);
          break;
        case "BLOCK":
          handleBlockInput(val);
          break;
        case "INSERT":
          handleInsertInput(val);
          break;
        case "ARRAY":
          handleArrayInput(val);
          break;
        case "LEADER":
        case "QLEADER":
          handleLeaderInput(val);
          break;
        case "DIMLINEAR":
        case "DIMANGULAR":
        case "DIMRADIUS":
        case "DIMDIAMETER":
          handleDimInput(val, command);
          break;
        case "TEXT":
          handleTextInput(val);
          break;
        case "MTEXT":
          handleMTextInput(val);
          break;
        case "LAYER":
          handleLayerInput(val);
          break;
        case "ZOOM":
          handleZoomInput(val);
          break;
        case "SNAP":
          handleSnapInput(val);
          break;
        default:
          cancelCommand();
          break;
      }
    },
    [phase, drawing]
  );

  const executeCommand = useCallback(
    (cmd: string) => {
      switch (cmd) {
        case "LINE":
          setPhase({
            command: "LINE",
            state: "awaiting_first_point",
            tempData: {},
            points: [],
            prompt: "LINE Specify first point:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify first point:");
          break;
        case "CIRCLE":
          setPhase({
            command: "CIRCLE",
            state: "awaiting_center",
            tempData: {},
            points: [],
            prompt: "CIRCLE Specify center point:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify center point or [3P/2P/Ttr]:");
          break;
        case "ARC":
          setPhase({
            command: "ARC",
            state: "awaiting_first_point",
            tempData: {},
            points: [],
            prompt: "ARC Specify start point of arc:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify start point of arc:");
          break;
        case "POLYLINE":
          setPhase({
            command: "POLYLINE",
            state: "awaiting_first_point",
            tempData: {},
            points: [],
            prompt: "POLYLINE Specify start point:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify start point:");
          break;
        case "RECTANGLE":
          setPhase({
            command: "RECTANGLE",
            state: "awaiting_first_point",
            tempData: {},
            points: [],
            prompt: "RECTANGLE Specify first corner point:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify first corner point:");
          break;
        case "SPLINE":
          addHistory(
            "response",
            "SPLINE: Click points on canvas. Type 'C' to close or press Enter to end."
          );
          setPhase({
            command: "POLYLINE",
            state: "awaiting_first_point",
            tempData: { isSpline: true },
            points: [],
            prompt: "SPLINE Specify first point:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify first point:");
          break;
        case "POINT":
          setPhase({
            command: "LINE",
            state: "awaiting_first_point",
            tempData: { singlePoint: true },
            points: [],
            prompt: "POINT Specify a point:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify a point:");
          break;
        case "SELECT":
          addHistory("response", "SELECT: Click entities on canvas, or drag to window-select. Shift+click to add. Press Enter or type END when done.");
          setPhase({
            command: "SELECT",
            state: "awaiting_object_select",
            tempData: {},
            points: [],
            prompt: "SELECT: Click objects or drag window. Enter to finish.",
          });
          break;
        case "ERASE": {
          const alreadySel = drawing.selectedIds;
          if (alreadySel.length > 0) {
            setDrawing((prev) => ({
              ...prev,
              entities: prev.entities.filter((e) => !alreadySel.includes(e.id)),
              selectedIds: [],
              undoStack: [...prev.undoStack, [...prev.entities]],
              redoStack: [],
            }));
            addHistory("response", `ERASE: ${alreadySel.length} object(s) erased.`);
            finishCommand();
          } else {
            addHistory("prompt", "Select objects to erase — click canvas, or type All/Last:");
            setPhase({
              command: "ERASE",
              state: "awaiting_object_select",
              tempData: {},
              points: [],
              prompt: "ERASE Select objects:",
            });
          }
          break;
        }
        case "MOVE":
          addHistory("prompt", "MOVE: Enter ID(s) or 'Last' then base point:");
          setPhase({
            command: "MOVE",
            state: "awaiting_object_select",
            tempData: {},
            points: [],
            prompt: "MOVE Select objects:",
          });
          break;
        case "COPY":
          addHistory("prompt", "COPY: Enter ID or 'Last':");
          setPhase({
            command: "COPY",
            state: "awaiting_object_select",
            tempData: {},
            points: [],
            prompt: "COPY Select objects:",
          });
          break;
        case "ROTATE":
          addHistory(
            "prompt",
            "ROTATE: Enter ID(s) or 'Last', then base point, then angle:"
          );
          setPhase({
            command: "ROTATE",
            state: "awaiting_object_select",
            tempData: {},
            points: [],
            prompt: "ROTATE Select objects:",
          });
          break;
        case "SCALE":
          addHistory(
            "prompt",
            "SCALE: Enter ID(s) or 'Last', then base point, then scale factor:"
          );
          setPhase({
            command: "SCALE",
            state: "awaiting_object_select",
            tempData: {},
            points: [],
            prompt: "SCALE Select objects:",
          });
          break;
        case "MIRROR":
          setPhase({
            command: "MIRROR",
            state: "awaiting_object_select",
            tempData: {},
            points: [],
            prompt: "MIRROR Select objects:",
          });
          addHistory("prompt", "Select objects:");
          break;
        case "OFFSET":
          setPhase({
            command: "OFFSET",
            state: "awaiting_offset_distance",
            tempData: {},
            points: [],
            prompt: "OFFSET Specify offset distance:",
          });
          addHistory("prompt", "Specify offset distance or [Through]:");
          break;
        case "FILLET":
          setPhase({
            command: "FILLET",
            state: "awaiting_fillet_radius",
            tempData: {},
            points: [],
            prompt: "FILLET Specify fillet radius <0>:",
          });
          addHistory("prompt", "Specify fillet radius <0>:");
          break;
        case "CHAMFER":
          setPhase({
            command: "CHAMFER",
            state: "awaiting_chamfer_dist1",
            tempData: {},
            points: [],
            prompt: "CHAMFER Specify first chamfer distance <0>:",
          });
          addHistory("prompt", "Specify first chamfer distance <0>:");
          break;
        case "DIMLINEAR":
        case "DIMANGULAR":
        case "DIMRADIUS":
        case "DIMDIAMETER":
          setPhase({
            command: cmd,
            state: "awaiting_dim_first_point",
            tempData: {},
            points: [],
            prompt: `${cmd} Specify first extension line origin:`,
          });
          addHistory("prompt", "Specify first extension line origin:");
          break;
        case "TEXT":
          setPhase({
            command: "TEXT",
            state: "awaiting_text_insert",
            tempData: {},
            points: [],
            prompt: "TEXT Specify start point of text:",
          });
          addHistory("prompt", "Specify start point of text:");
          break;
        case "MTEXT":
          setPhase({
            command: "TEXT",
            state: "awaiting_text_insert",
            tempData: { multi: true },
            points: [],
            prompt: "MTEXT Specify start point:",
          });
          addHistory("prompt", "Specify start point:");
          break;
        case "LAYER":
          addHistory(
            "response",
            'LAYER: Options: [New <name>] [Set <name>] [Color <layer> <#hex>] [On <name>] [Off <name>] [Lock <name>] [Unlock <name>] [Delete <name>]'
          );
          setPhase({
            command: "LAYER",
            state: "awaiting_text",
            tempData: {},
            points: [],
            prompt: "LAYER Enter option:",
          });
          break;
        case "ZOOM":
          setPhase({
            command: "ZOOM",
            state: "awaiting_text",
            tempData: {},
            points: [],
            prompt: "ZOOM Enter option [All/In/Out/Extents/factor]:",
          });
          addHistory("prompt", "Enter option [All/In/Out/Extents/factor]:");
          break;
        case "PAN":
          addHistory(
            "response",
            "PAN: Use middle-mouse-button drag or arrow keys to pan."
          );
          finishCommand();
          break;
        case "REGEN":
        case "REDRAW":
          addHistory("response", "Regenerating display...");
          finishCommand();
          break;
        case "UNDO":
          doUndo();
          finishCommand();
          break;
        case "REDO":
          doRedo();
          finishCommand();
          break;
        case "OOPS":
          doUndo();
          finishCommand();
          break;
        case "ORTHO":
          setDrawing((prev) => ({
            ...prev,
            orthoMode: !prev.orthoMode,
          }));
          addHistory(
            "response",
            `ORTHO ${drawing.orthoMode ? "off" : "on"}.`
          );
          finishCommand();
          break;
        case "SNAP":
          setPhase({
            command: "SNAP",
            state: "awaiting_text",
            tempData: {},
            points: [],
            prompt: "SNAP Enter spacing or [On/Off]:",
          });
          addHistory("prompt", "Specify snap spacing or [On/Off]:");
          break;
        case "GRID":
          setDrawing((prev) => ({
            ...prev,
            gridVisible: !prev.gridVisible,
          }));
          addHistory(
            "response",
            `Grid ${drawing.gridVisible ? "off" : "on"}.`
          );
          finishCommand();
          break;
        case "UNITS":
          setDrawing((prev) => ({
            ...prev,
            units: prev.units === "mm" ? "inch" : "mm",
          }));
          addHistory(
            "response",
            `Units set to ${drawing.units === "mm" ? "inch" : "mm"}.`
          );
          finishCommand();
          break;
        case "PROPERTIES":
          setShowProps(true);
          addHistory("response", "Properties panel opened.");
          finishCommand();
          break;
        case "TRIM":
          setPhase({
            command: "TRIM",
            state: "awaiting_trim_cutting",
            tempData: { cuttingIds: [] },
            points: [],
            prompt: "TRIM Select cutting edges (Enter when done):",
          });
          addHistory("prompt", "Select cutting edge(s), then press Enter:");
          break;
        case "EXTEND":
          setPhase({
            command: "EXTEND",
            state: "awaiting_extend_boundary",
            tempData: { boundaryIds: [] },
            points: [],
            prompt: "EXTEND Select boundary edge(s) (Enter when done):",
          });
          addHistory("prompt", "Select boundary edge(s), then press Enter:");
          break;
        case "HATCH":
          setPhase({
            command: "HATCH",
            state: "awaiting_hatch_pattern",
            tempData: { style: { ...DEFAULT_HATCH_STYLE } },
            points: [],
            prompt: "HATCH Select pattern [ANSI31/ANSI37/ISO/SOLID/DOTS/DASH]:",
          });
          addHistory("prompt", "Specify hatch pattern [ANSI31/ANSI37/ISO/SOLID/DOTS/DASH] <ANSI31>:");
          break;
        case "BLOCK":
          setPhase({
            command: "BLOCK",
            state: "awaiting_block_name",
            tempData: {},
            points: [],
            prompt: "BLOCK Enter block name:",
          });
          addHistory("prompt", "Enter block name:");
          break;
        case "INSERT":
          setPhase({
            command: "INSERT",
            state: "awaiting_insert_name",
            tempData: {},
            points: [],
            prompt: "INSERT Enter block name to insert:",
          });
          addHistory("prompt", `Enter block name [${getBlockNames(blockLibrary).join("/")}]:`);
          break;
        case "ARRAY":
          setPhase({
            command: "ARRAY",
            state: "awaiting_object_select",
            tempData: {},
            points: [],
            prompt: "ARRAY Select objects:",
          });
          addHistory("prompt", "Select objects for array, then press Enter:");
          break;
        case "LEADER":
        case "QLEADER":
          setPhase({
            command: "LEADER",
            state: "awaiting_first_point",
            tempData: {},
            points: [],
            prompt: "LEADER Specify leader start point:",
          });
          addHistory("prompt", "Specify leader start point:");
          break;
        case "MTEXT":
          setPhase({
            command: "MTEXT",
            state: "awaiting_text_insert",
            tempData: { multi: true },
            points: [],
            prompt: "MTEXT Specify insertion point:",
          });
          addHistory("prompt", "Specify first corner:");
          break;
        case "PLOT":
          setShowPrintDialog(true);
          addHistory("response", "PLOT: Print/plot dialog opened.");
          finishCommand();
          break;
        case "EXPLODE": {
          const selIds = drawing.selectedIds;
          if (selIds.length === 0) {
            addHistory("error", "EXPLODE: No objects selected.");
          } else {
            const toExplode = drawing.entities.filter((e) => selIds.includes(e.id) && (e.type as string) === "block_ref");
            if (toExplode.length === 0) {
              addHistory("response", "EXPLODE: No block references in selection.");
            } else {
              const exploded: DrawEntity[] = [];
              for (const ref of toExplode) {
                exploded.push(...explodeBlockRef(blockLibrary, ref));
              }
              setDrawing((prev) => ({
                ...prev,
                entities: [...prev.entities.filter((e) => !toExplode.map((t) => t.id).includes(e.id)), ...exploded],
                selectedIds: [],
                undoStack: [...prev.undoStack, [...prev.entities]],
                redoStack: [],
              }));
              addHistory("response", `EXPLODE: ${toExplode.length} block(s) exploded into ${exploded.length} entities.`);
            }
          }
          finishCommand();
          break;
        }
        case "BREAK":
        case "JOIN":
        case "STRETCH":
        case "LENGTHEN":
          addHistory("response", `${cmd}: Select objects on canvas to operate.`);
          finishCommand();
          break;
        case "XLINE":
          setPhase({
            command: "LINE",
            state: "awaiting_first_point",
            tempData: { isXline: true },
            points: [],
            prompt: "XLINE Specify point:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify a point:");
          break;
        case "RAY":
          setPhase({
            command: "LINE",
            state: "awaiting_first_point",
            tempData: { isRay: true },
            points: [],
            prompt: "RAY Specify start point:",
            previewEntity: null,
          });
          addHistory("prompt", "Specify start point:");
          break;
        case "ELLIPSE":
          setPhase({
            command: "ELLIPSE",
            state: "awaiting_first_point",
            tempData: {},
            points: [],
            prompt: "ELLIPSE Specify axis endpoint:",
          });
          addHistory("prompt", "Specify axis endpoint of ellipse:");
          break;
        default:
          addHistory("error", `Unknown command: "${cmd}". Type a valid AutoCAD command.`);
          setPhase(INITIAL_PHASE);
          addHistory("prompt", "Command:");
          break;
      }
    },
    [drawing, phase]
  );

  const handleLineInput = useCallback(
    (val: string) => {
      const { points, tempData } = phase;
      if (
        phase.state === "awaiting_first_point" ||
        phase.state === "awaiting_next_point"
      ) {
        const valUp = val.toUpperCase();
        if (valUp === "U" && points.length > 0) {
          const newPoints = points.slice(0, -1);
          addHistory("response", "Undo last segment.");
          setPhase((prev) => ({
            ...prev,
            points: newPoints,
            state: newPoints.length > 0 ? "awaiting_next_point" : "awaiting_first_point",
            prompt: newPoints.length > 0
              ? "Specify next point or [Undo/Close]:"
              : "Specify first point:",
          }));
          return;
        }
        if (valUp === "C" && points.length >= 2) {
          const entities: DrawEntity[] = [];
          const allPts = [...points];
          for (let i = 0; i < allPts.length - 1; i++) {
            entities.push({
              id: newEntityId("line"),
              type: "line",
              layer: drawing.currentLayer,
              color: layerColor(drawing, drawing.currentLayer),
              lineType: "Continuous",
              lineWeight: 0.25,
              data: {
                x1: allPts[i].x,
                y1: allPts[i].y,
                x2: allPts[i + 1].x,
                y2: allPts[i + 1].y,
              },
            });
          }
          entities.push({
            id: newEntityId("line"),
            type: "line",
            layer: drawing.currentLayer,
            color: layerColor(drawing, drawing.currentLayer),
            lineType: "Continuous",
            lineWeight: 0.25,
            data: {
              x1: allPts[allPts.length - 1].x,
              y1: allPts[allPts.length - 1].y,
              x2: allPts[0].x,
              y2: allPts[0].y,
            },
          });
          commitEntities(entities);
          addHistory("response", `LINE: ${entities.length} segments drawn (closed).`);
          finishCommand();
          return;
        }

        const lastPt = points.length > 0 ? points[points.length - 1] : undefined;
        const pt = parseCoordinates(val, lastPt);
        if (!pt) {
          addHistory("error", `Invalid coordinate: "${val}"`);
          return;
        }

        if (tempData.singlePoint) {
          const ent: DrawEntity = {
            id: newEntityId("point"),
            type: "point",
            layer: drawing.currentLayer,
            color: layerColor(drawing, drawing.currentLayer),
            lineType: "Continuous",
            lineWeight: 0.25,
            data: { x: pt.x, y: pt.y },
          };
          commitEntities([ent]);
          addHistory("response", `POINT at (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)})`);
          finishCommand();
          return;
        }

        const newPoints = [...points, pt];
        if (newPoints.length >= 2) {
          const entities: DrawEntity[] = [];
          entities.push({
            id: newEntityId("line"),
            type: "line",
            layer: drawing.currentLayer,
            color: layerColor(drawing, drawing.currentLayer),
            lineType: "Continuous",
            lineWeight: 0.25,
            data: {
              x1: newPoints[newPoints.length - 2].x,
              y1: newPoints[newPoints.length - 2].y,
              x2: pt.x,
              y2: pt.y,
            },
          });
          commitEntities(entities);
          addHistory(
            "response",
            `LINE to (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)})`
          );
        }
        setPhase((prev) => ({
          ...prev,
          points: newPoints,
          state: "awaiting_next_point",
          prompt: "Specify next point or [Undo/Close]:",
        }));
        addHistory("prompt", "Specify next point or [Undo/Close]:");
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleCircleInput = useCallback(
    (val: string) => {
      const { points, tempData } = phase;
      if (phase.state === "awaiting_center") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) {
          addHistory("error", `Invalid coordinate: "${val}"`);
          return;
        }
        setPhase((prev) => ({
          ...prev,
          points: [pt],
          state: "awaiting_radius",
          prompt: "Specify radius:",
        }));
        addHistory("prompt", `Specify radius or [Diameter]:`);
      } else if (phase.state === "awaiting_radius") {
        const valUp = val.toUpperCase();
        let r: number;
        if (valUp.startsWith("D")) {
          const d = parseFloat(valUp.slice(1));
          r = isNaN(d) ? 1 : d / 2;
        } else {
          r = parseFloat(val);
        }
        if (isNaN(r) || r <= 0) {
          const tryPt = parseCoordinates(val, points[0]);
          if (tryPt) {
            r = Math.sqrt(
              (tryPt.x - points[0].x) ** 2 + (tryPt.y - points[0].y) ** 2
            );
          } else {
            addHistory("error", `Invalid radius: "${val}"`);
            return;
          }
        }
        const ent: DrawEntity = {
          id: newEntityId("circle"),
          type: "circle",
          layer: drawing.currentLayer,
          color: layerColor(drawing, drawing.currentLayer),
          lineType: "Continuous",
          lineWeight: 0.25,
          data: { cx: points[0].x, cy: points[0].y, r },
        };
        commitEntities([ent]);
        addHistory(
          "response",
          `CIRCLE center (${points[0].x.toFixed(3)}, ${points[0].y.toFixed(3)}) radius ${r.toFixed(3)}`
        );
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleArcInput = useCallback(
    (val: string) => {
      const { points, state } = phase;
      if (state === "awaiting_first_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point: "${val}"`); return; }
        setPhase((prev) => ({
          ...prev,
          points: [pt],
          state: "awaiting_second_point",
          prompt: "Specify second point or [Center]:",
        }));
        addHistory("prompt", "Specify second point of arc or [Center]:");
      } else if (state === "awaiting_second_point") {
        const lastPt = points[points.length - 1];
        const pt = parseCoordinates(val, lastPt);
        if (!pt) { addHistory("error", `Invalid point: "${val}"`); return; }
        setPhase((prev) => ({
          ...prev,
          points: [...points, pt],
          state: "awaiting_next_point",
          prompt: "Specify end point of arc:",
        }));
        addHistory("prompt", "Specify end point of arc:");
      } else if (state === "awaiting_next_point" && points.length === 2) {
        const endPt = parseCoordinates(val, points[1]);
        if (!endPt) { addHistory("error", `Invalid point: "${val}"`); return; }
        const [p1, p2] = points;
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        const r = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) / 2;
        const startAngle = Math.atan2(p1.y - cy, p1.x - cx) * (180 / Math.PI);
        const endAngle = Math.atan2(endPt.y - cy, endPt.x - cx) * (180 / Math.PI);
        const ent: DrawEntity = {
          id: newEntityId("arc"),
          type: "arc",
          layer: drawing.currentLayer,
          color: layerColor(drawing, drawing.currentLayer),
          lineType: "Continuous",
          lineWeight: 0.25,
          data: { cx, cy, r, startAngle, endAngle },
        };
        commitEntities([ent]);
        addHistory("response", `ARC drawn.`);
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handlePolylineInput = useCallback(
    (val: string) => {
      const { points, state, tempData } = phase;
      if (state === "awaiting_first_point" || state === "awaiting_next_point") {
        const valUp = val.toUpperCase();
        if (valUp === "C" && points.length >= 2) {
          const ent: DrawEntity = {
            id: newEntityId("polyline"),
            type: "polyline",
            layer: drawing.currentLayer,
            color: layerColor(drawing, drawing.currentLayer),
            lineType: "Continuous",
            lineWeight: 0.25,
            data: { points: [...points, points[0]], closed: true, isSpline: !!tempData.isSpline },
          };
          commitEntities([ent]);
          addHistory("response", `POLYLINE closed with ${points.length + 1} vertices.`);
          finishCommand();
          return;
        }
        const lastPt = points.length > 0 ? points[points.length - 1] : undefined;
        const pt = parseCoordinates(val, lastPt);
        if (!pt) { addHistory("error", `Invalid point: "${val}"`); return; }
        const newPoints = [...points, pt];
        setPhase((prev) => ({
          ...prev,
          points: newPoints,
          state: "awaiting_next_point",
          prompt: "Specify next point or [Undo/Close]:",
        }));
        addHistory("prompt", "Specify next point or [Undo/Close]:");

        if (newPoints.length >= 2) {
          const ent: DrawEntity = {
            id: newEntityId("line"),
            type: "line",
            layer: drawing.currentLayer,
            color: layerColor(drawing, drawing.currentLayer),
            lineType: "Continuous",
            lineWeight: 0.25,
            data: {
              x1: newPoints[newPoints.length - 2].x,
              y1: newPoints[newPoints.length - 2].y,
              x2: pt.x,
              y2: pt.y,
            },
          };
          commitEntities([ent]);
        }
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleRectInput = useCallback(
    (val: string) => {
      const { points, state } = phase;
      if (state === "awaiting_first_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point: "${val}"`); return; }
        setPhase((prev) => ({
          ...prev,
          points: [pt],
          state: "awaiting_second_point",
          prompt: "Specify other corner point:",
        }));
        addHistory("prompt", "Specify other corner point or [Dimensions]:");
      } else if (state === "awaiting_second_point") {
        const lastPt = points[0];
        const pt = parseCoordinates(val, lastPt);
        if (!pt) { addHistory("error", `Invalid point: "${val}"`); return; }
        const p1 = points[0];
        const minX = Math.min(p1.x, pt.x);
        const minY = Math.min(p1.y, pt.y);
        const maxX = Math.max(p1.x, pt.x);
        const maxY = Math.max(p1.y, pt.y);
        const rectPoints: Point[] = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
          { x: minX, y: minY },
        ];
        const ent: DrawEntity = {
          id: newEntityId("polyline"),
          type: "polyline",
          layer: drawing.currentLayer,
          color: layerColor(drawing, drawing.currentLayer),
          lineType: "Continuous",
          lineWeight: 0.25,
          data: { points: rectPoints, closed: true },
        };
        commitEntities([ent]);
        addHistory(
          "response",
          `RECTANGLE from (${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}) to (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`
        );
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleEraseInput = useCallback(
    (val: string) => {
      const valUp = val.toUpperCase();
      if (valUp === "ALL") {
        setDrawing((prev) => ({
          ...prev,
          entities: [],
          selectedIds: [],
          undoStack: [...prev.undoStack, [...prev.entities]],
          redoStack: [],
        }));
        addHistory("response", "All entities erased.");
        finishCommand();
      } else if (valUp === "LAST") {
        setDrawing((prev) => {
          if (prev.entities.length === 0) return prev;
          return {
            ...prev,
            entities: prev.entities.slice(0, -1),
            selectedIds: [],
            undoStack: [...prev.undoStack, [...prev.entities]],
            redoStack: [],
          };
        });
        addHistory("response", "Last entity erased.");
        finishCommand();
      } else if (val === "" || valUp === "END" || valUp === "DONE") {
        const accIds: string[] = phase.tempData.ids || [];
        if (accIds.length > 0) {
          setDrawing((prev) => ({
            ...prev,
            entities: prev.entities.filter((e) => !accIds.includes(e.id)),
            selectedIds: [],
            undoStack: [...prev.undoStack, [...prev.entities]],
            redoStack: [],
          }));
          addHistory("response", `ERASE: ${accIds.length} object(s) erased.`);
        } else {
          addHistory("error", "No objects selected. Click entities on canvas then press Enter.");
        }
        finishCommand();
      } else {
        const ids = val.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
        setDrawing((prev) => ({
          ...prev,
          entities: prev.entities.filter((e) => !ids.includes(e.id)),
          selectedIds: [],
          undoStack: [...prev.undoStack, [...prev.entities]],
          redoStack: [],
        }));
        addHistory("response", `Erased: ${ids.join(", ")}`);
        finishCommand();
      }
    },
    [phase.tempData, addHistory, finishCommand]
  );

  const handleMoveInput = useCallback(
    (val: string) => {
      const { state, points, tempData } = phase;
      if (state === "awaiting_object_select") {
        const valUp = val.toUpperCase();
        let ids: string[] = [];
        if (valUp === "LAST" && drawing.entities.length > 0) {
          ids = [drawing.entities[drawing.entities.length - 1].id];
        } else if (valUp === "ALL") {
          ids = drawing.entities.map((e) => e.id);
        } else if (valUp === "END" || valUp === "DONE") {
          ids = tempData.ids || [];
        } else {
          ids = val.split(/[\s,]+/).filter(Boolean);
        }
        if (ids.length === 0) {
          addHistory("error", "No objects selected. Click entities on canvas or type ALL/LAST."); return;
        }
        setPhase((prev) => ({
          ...prev,
          tempData: { ids },
          state: "awaiting_base_point",
          prompt: "Specify base point:",
        }));
        setDrawing((prev) => ({ ...prev, selectedIds: ids }));
        addHistory("prompt", "Specify base point:");
      } else if (state === "awaiting_base_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point: "${val}"`); return; }
        setPhase((prev) => ({
          ...prev,
          points: [pt],
          state: "awaiting_displacement",
          prompt: "Specify second point (displacement):",
        }));
        addHistory("prompt", "Specify second point of displacement:");
      } else if (state === "awaiting_displacement") {
        const pt = parseCoordinates(val, points[0]);
        if (!pt) { addHistory("error", `Invalid point: "${val}"`); return; }
        const dx = pt.x - points[0].x;
        const dy = pt.y - points[0].y;
        const { ids } = tempData;
        setDrawing((prev) => ({
          ...prev,
          entities: prev.entities.map((e) => {
            if (!ids.includes(e.id)) return e;
            const d = { ...e.data };
            if (e.type === "line") { d.x1 += dx; d.y1 += dy; d.x2 += dx; d.y2 += dy; }
            else if (e.type === "circle" || e.type === "arc") { d.cx += dx; d.cy += dy; }
            else if (e.type === "polyline") { d.points = (d.points as Point[]).map((p: Point) => ({ x: p.x + dx, y: p.y + dy })); }
            return { ...e, data: d };
          }),
          undoStack: [...prev.undoStack, [...prev.entities]],
          redoStack: [],
        }));
        addHistory("response", `MOVE: ${ids.length} object(s) moved by (${dx.toFixed(3)}, ${dy.toFixed(3)})`);
        finishCommand();
      }
    },
    [phase, drawing, addHistory, finishCommand]
  );

  const handleCopyInput = useCallback(
    (val: string) => {
      const { state, points, tempData } = phase;
      if (state === "awaiting_object_select") {
        const valUp = val.toUpperCase();
        let ids: string[] = [];
        if (valUp === "LAST" && drawing.entities.length > 0) {
          ids = [drawing.entities[drawing.entities.length - 1].id];
        } else if (valUp === "ALL") {
          ids = drawing.entities.map((e) => e.id);
        } else {
          ids = val.split(/[\s,]+/).filter(Boolean);
        }
        setPhase((prev) => ({ ...prev, tempData: { ids }, state: "awaiting_base_point", prompt: "Specify base point:" }));
        addHistory("prompt", "Specify base point:");
      } else if (state === "awaiting_base_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        setPhase((prev) => ({ ...prev, points: [pt], state: "awaiting_displacement", prompt: "Specify second point:" }));
        addHistory("prompt", "Specify second point:");
      } else if (state === "awaiting_displacement") {
        const pt = parseCoordinates(val, points[0]);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        const dx = pt.x - points[0].x;
        const dy = pt.y - points[0].y;
        const { ids } = tempData;
        const copies = drawing.entities
          .filter((e) => ids.includes(e.id))
          .map((e) => {
            const d = JSON.parse(JSON.stringify(e.data));
            if (e.type === "line") { d.x1 += dx; d.y1 += dy; d.x2 += dx; d.y2 += dy; }
            else if (e.type === "circle" || e.type === "arc") { d.cx += dx; d.cy += dy; }
            else if (e.type === "polyline") { d.points = d.points.map((p: Point) => ({ x: p.x + dx, y: p.y + dy })); }
            return { ...e, id: newEntityId(e.type), data: d };
          });
        commitEntities(copies);
        addHistory("response", `COPY: ${copies.length} object(s) copied.`);
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleRotateInput = useCallback(
    (val: string) => {
      const { state, points, tempData } = phase;
      if (state === "awaiting_object_select") {
        const ids = val.toUpperCase() === "LAST"
          ? drawing.entities.length > 0 ? [drawing.entities[drawing.entities.length - 1].id] : []
          : val.toUpperCase() === "ALL" ? drawing.entities.map((e) => e.id)
          : val.split(/[\s,]+/).filter(Boolean);
        setPhase((prev) => ({ ...prev, tempData: { ids }, state: "awaiting_base_point", prompt: "Specify base point:" }));
        addHistory("prompt", "Specify base point:");
      } else if (state === "awaiting_base_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        setPhase((prev) => ({ ...prev, points: [pt], state: "awaiting_angle", prompt: "Specify rotation angle:" }));
        addHistory("prompt", "Specify rotation angle [Reference]:");
      } else if (state === "awaiting_angle") {
        const deg = parseFloat(val);
        if (isNaN(deg)) { addHistory("error", `Invalid angle.`); return; }
        const rad = (deg * Math.PI) / 180;
        const base = points[0];
        const { ids } = tempData;
        const rotPt = (px: number, py: number) => {
          const tx = px - base.x;
          const ty = py - base.y;
          return {
            x: base.x + tx * Math.cos(rad) - ty * Math.sin(rad),
            y: base.y + tx * Math.sin(rad) + ty * Math.cos(rad),
          };
        };
        setDrawing((prev) => ({
          ...prev,
          entities: prev.entities.map((e) => {
            if (!ids.includes(e.id)) return e;
            const d = JSON.parse(JSON.stringify(e.data));
            if (e.type === "line") {
              const np1 = rotPt(d.x1, d.y1); const np2 = rotPt(d.x2, d.y2);
              d.x1 = np1.x; d.y1 = np1.y; d.x2 = np2.x; d.y2 = np2.y;
            } else if (e.type === "circle" || e.type === "arc") {
              const nc = rotPt(d.cx, d.cy); d.cx = nc.x; d.cy = nc.y;
            } else if (e.type === "polyline") {
              d.points = d.points.map((p: Point) => rotPt(p.x, p.y));
            }
            return { ...e, data: d };
          }),
          undoStack: [...prev.undoStack, [...prev.entities]],
          redoStack: [],
        }));
        addHistory("response", `ROTATE: ${ids.length} object(s) rotated by ${deg}°`);
        finishCommand();
      }
    },
    [phase, drawing, addHistory, finishCommand]
  );

  const handleScaleInput = useCallback(
    (val: string) => {
      const { state, points, tempData } = phase;
      if (state === "awaiting_object_select") {
        const ids = val.toUpperCase() === "LAST"
          ? drawing.entities.length > 0 ? [drawing.entities[drawing.entities.length - 1].id] : []
          : val.split(/[\s,]+/).filter(Boolean);
        setPhase((prev) => ({ ...prev, tempData: { ids }, state: "awaiting_base_point", prompt: "Specify base point:" }));
        addHistory("prompt", "Specify base point:");
      } else if (state === "awaiting_base_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        setPhase((prev) => ({ ...prev, points: [pt], state: "awaiting_scale_factor", prompt: "Specify scale factor:" }));
        addHistory("prompt", "Specify scale factor:");
      } else if (state === "awaiting_scale_factor") {
        const factor = parseFloat(val);
        if (isNaN(factor) || factor <= 0) { addHistory("error", `Invalid scale factor.`); return; }
        const base = points[0];
        const { ids } = tempData;
        setDrawing((prev) => ({
          ...prev,
          entities: prev.entities.map((e) => {
            if (!ids.includes(e.id)) return e;
            const d = JSON.parse(JSON.stringify(e.data));
            const scl = (px: number, py: number) => ({
              x: base.x + (px - base.x) * factor,
              y: base.y + (py - base.y) * factor,
            });
            if (e.type === "line") {
              const np1 = scl(d.x1, d.y1); const np2 = scl(d.x2, d.y2);
              d.x1 = np1.x; d.y1 = np1.y; d.x2 = np2.x; d.y2 = np2.y;
            } else if (e.type === "circle") { d.r *= factor; const nc = scl(d.cx, d.cy); d.cx = nc.x; d.cy = nc.y; }
            else if (e.type === "polyline") { d.points = d.points.map((p: Point) => scl(p.x, p.y)); }
            return { ...e, data: d };
          }),
          undoStack: [...prev.undoStack, [...prev.entities]],
          redoStack: [],
        }));
        addHistory("response", `SCALE: ${ids.length} object(s) scaled by ${factor}`);
        finishCommand();
      }
    },
    [phase, drawing, addHistory, finishCommand]
  );

  const handleMirrorInput = useCallback(
    (val: string) => {
      const { state, points, tempData } = phase;
      if (state === "awaiting_object_select") {
        const ids = val.toUpperCase() === "ALL"
          ? drawing.entities.map((e) => e.id)
          : val.toUpperCase() === "LAST"
          ? drawing.entities.length > 0 ? [drawing.entities[drawing.entities.length - 1].id] : []
          : val.split(/[\s,]+/).filter(Boolean);
        setPhase((prev) => ({ ...prev, tempData: { ids }, state: "awaiting_mirror_line_first", prompt: "Specify first point of mirror line:" }));
        addHistory("prompt", "Specify first point of mirror line:");
      } else if (state === "awaiting_mirror_line_first") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        setPhase((prev) => ({ ...prev, points: [pt], state: "awaiting_mirror_line_second", prompt: "Specify second point of mirror line:" }));
        addHistory("prompt", "Specify second point of mirror line:");
      } else if (state === "awaiting_mirror_line_second") {
        const pt = parseCoordinates(val, points[0]);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        const p1 = points[0]; const p2 = pt;
        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
        const len2 = dx * dx + dy * dy;
        const mirrorPt = (px: number, py: number) => {
          const t = ((px - p1.x) * dx + (py - p1.y) * dy) / len2;
          const fx = p1.x + t * dx; const fy = p1.y + t * dy;
          return { x: 2 * fx - px, y: 2 * fy - py };
        };
        const { ids } = tempData;
        const mirrors = drawing.entities
          .filter((e) => ids.includes(e.id))
          .map((e) => {
            const d = JSON.parse(JSON.stringify(e.data));
            if (e.type === "line") {
              const mp1 = mirrorPt(d.x1, d.y1); const mp2 = mirrorPt(d.x2, d.y2);
              d.x1 = mp1.x; d.y1 = mp1.y; d.x2 = mp2.x; d.y2 = mp2.y;
            } else if (e.type === "circle") { const mc = mirrorPt(d.cx, d.cy); d.cx = mc.x; d.cy = mc.y; }
            else if (e.type === "polyline") { d.points = d.points.map((p: Point) => mirrorPt(p.x, p.y)); }
            return { ...e, id: newEntityId(e.type), data: d };
          });
        const erase = val.toUpperCase() === "YES";
        commitEntities(mirrors);
        addHistory("response", `MIRROR: ${mirrors.length} object(s) mirrored.`);
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleOffsetInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_offset_distance") {
        const dist = parseFloat(val);
        if (isNaN(dist) || dist <= 0) { addHistory("error", `Invalid distance.`); return; }
        setPhase((prev) => ({ ...prev, tempData: { dist }, state: "awaiting_object_select", prompt: "Select object to offset:" }));
        addHistory("prompt", "Select object to offset:");
      } else if (state === "awaiting_object_select") {
        const ids = val.toUpperCase() === "LAST"
          ? drawing.entities.length > 0 ? [drawing.entities[drawing.entities.length - 1].id] : []
          : val.split(/[\s,]+/).filter(Boolean);
        const ent = drawing.entities.find((e) => ids.includes(e.id));
        if (!ent) { addHistory("error", `Object not found.`); return; }
        const { dist } = tempData;
        if (ent.type === "line") {
          const { x1, y1, x2, y2 } = ent.data;
          const dx = x2 - x1; const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len * dist; const ny = dx / len * dist;
          const newEnt: DrawEntity = {
            id: newEntityId("line"), type: "line",
            layer: ent.layer, color: ent.color, lineType: ent.lineType, lineWeight: ent.lineWeight,
            data: { x1: x1 + nx, y1: y1 + ny, x2: x2 + nx, y2: y2 + ny },
          };
          commitEntities([newEnt]);
          addHistory("response", `OFFSET: line offset by ${dist}`);
        } else if (ent.type === "circle") {
          const newEnt: DrawEntity = {
            id: newEntityId("circle"), type: "circle",
            layer: ent.layer, color: ent.color, lineType: ent.lineType, lineWeight: ent.lineWeight,
            data: { cx: ent.data.cx, cy: ent.data.cy, r: ent.data.r + dist },
          };
          commitEntities([newEnt]);
          addHistory("response", `OFFSET: circle offset by ${dist}`);
        }
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleFilletInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_fillet_radius") {
        const r = parseFloat(val);
        if (isNaN(r) || r < 0) { addHistory("error", `Invalid fillet radius.`); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, radius: r },
          state: "awaiting_fillet_select_first",
          prompt: "Select first line:",
        }));
        addHistory("prompt", `Fillet radius = ${r}. Select first object:`);
      } else if (state === "awaiting_fillet_select_first") {
        const ids = val.toUpperCase() === "LAST" && drawing.entities.length > 0
          ? [drawing.entities[drawing.entities.length - 1].id]
          : val.split(/[\s,]+/).filter(Boolean);
        const ent = drawing.entities.find((e) => ids.includes(e.id));
        if (!ent) { addHistory("error", "Object not found. Click on a line."); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, firstId: ent.id },
          state: "awaiting_fillet_select_second",
          prompt: "Select second line:",
        }));
        addHistory("prompt", "Select second object:");
      } else if (state === "awaiting_fillet_select_second") {
        const ids = val.toUpperCase() === "LAST" && drawing.entities.length > 0
          ? [drawing.entities[drawing.entities.length - 1].id]
          : val.split(/[\s,]+/).filter(Boolean);
        const ent2 = drawing.entities.find((e) => ids.includes(e.id));
        if (!ent2) { addHistory("error", "Object not found."); return; }
        const ent1 = drawing.entities.find((e) => e.id === tempData.firstId);
        if (!ent1) { addHistory("error", "First object lost."); finishCommand(); return; }
        const result = filletLines(ent1, ent2, tempData.radius || 0, drawing.currentLayer, layerColor(drawing, drawing.currentLayer));
        if (result) {
          setDrawing((prev) => ({
            ...prev,
            entities: [
              ...prev.entities.filter((e) => e.id !== ent1.id && e.id !== ent2.id),
              result.modified1,
              result.modified2,
              ...(result.arc.data.r > 0 ? [result.arc] : []),
            ],
            undoStack: [...prev.undoStack, [...prev.entities]],
            redoStack: [],
          }));
          addHistory("response", `FILLET: Applied with radius ${tempData.radius || 0}.`);
        } else {
          addHistory("error", "FILLET: Could not fillet these objects.");
        }
        finishCommand();
      }
    },
    [phase, drawing, addHistory, finishCommand]
  );

  const handleChamferInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_chamfer_dist1") {
        const d1 = parseFloat(val);
        if (isNaN(d1) || d1 < 0) { addHistory("error", `Invalid distance.`); return; }
        setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, d1 }, state: "awaiting_chamfer_dist2", prompt: "Specify second chamfer distance:" }));
        addHistory("prompt", "Specify second chamfer distance:");
      } else if (state === "awaiting_chamfer_dist2") {
        const d2 = parseFloat(val);
        if (isNaN(d2) || d2 < 0) { addHistory("error", `Invalid distance.`); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, d2 },
          state: "awaiting_chamfer_select_first",
          prompt: "Select first line:",
        }));
        addHistory("prompt", `Chamfer distances: ${tempData.d1}, ${d2}. Select first line:`);
      } else if (state === "awaiting_chamfer_select_first") {
        const ids = val.toUpperCase() === "LAST" && drawing.entities.length > 0
          ? [drawing.entities[drawing.entities.length - 1].id]
          : val.split(/[\s,]+/).filter(Boolean);
        const ent = drawing.entities.find((e) => ids.includes(e.id));
        if (!ent) { addHistory("error", "Object not found."); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, firstId: ent.id },
          state: "awaiting_chamfer_select_second",
          prompt: "Select second line:",
        }));
        addHistory("prompt", "Select second line:");
      } else if (state === "awaiting_chamfer_select_second") {
        const ids = val.toUpperCase() === "LAST" && drawing.entities.length > 0
          ? [drawing.entities[drawing.entities.length - 1].id]
          : val.split(/[\s,]+/).filter(Boolean);
        const ent2 = drawing.entities.find((e) => ids.includes(e.id));
        if (!ent2) { addHistory("error", "Object not found."); return; }
        const ent1 = drawing.entities.find((e) => e.id === tempData.firstId);
        if (!ent1) { addHistory("error", "First object lost."); finishCommand(); return; }
        const result = chamferLines(ent1, ent2, tempData.d1 || 0, tempData.d2 || 0, drawing.currentLayer, layerColor(drawing, drawing.currentLayer));
        if (result) {
          setDrawing((prev) => ({
            ...prev,
            entities: [
              ...prev.entities.filter((e) => e.id !== ent1.id && e.id !== ent2.id),
              result.modified1,
              result.modified2,
              result.chamferLine,
            ],
            undoStack: [...prev.undoStack, [...prev.entities]],
            redoStack: [],
          }));
          addHistory("response", `CHAMFER: Applied with distances ${tempData.d1}, ${tempData.d2}.`);
        } else {
          addHistory("error", "CHAMFER: Could not chamfer these objects.");
        }
        finishCommand();
      }
    },
    [phase, drawing, addHistory, finishCommand]
  );

  const handleDimInput = useCallback(
    (val: string, cmd: string) => {
      const { state, points } = phase;
      if (state === "awaiting_dim_first_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        setPhase((prev) => ({ ...prev, points: [pt], state: "awaiting_dim_second_point", prompt: "Specify second extension line origin:" }));
        addHistory("prompt", "Specify second extension line origin:");
      } else if (state === "awaiting_dim_second_point") {
        const pt = parseCoordinates(val, points[0]);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        setPhase((prev) => ({ ...prev, points: [...points, pt], state: "awaiting_dim_location", prompt: "Specify dimension line location:" }));
        addHistory("prompt", "Specify dimension line location:");
      } else if (state === "awaiting_dim_location") {
        const pt = parseCoordinates(val, points[1]);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        const p1 = points[0]; const p2 = points[1];
        const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const dimEnt: DrawEntity = {
          id: newEntityId("dim"),
          type: "dimension_linear",
          layer: drawing.currentLayer,
          color: layerColor(drawing, drawing.currentLayer),
          lineType: "Continuous",
          lineWeight: 0.18,
          data: { p1, p2, location: pt, value: dist.toFixed(3), cmd },
        };
        commitEntities([dimEnt]);
        addHistory("response", `DIM: ${dist.toFixed(3)} ${drawing.units}`);
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleTextInput = useCallback(
    (val: string) => {
      const { state, points, tempData } = phase;
      if (state === "awaiting_text_insert") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", `Invalid point.`); return; }
        setPhase((prev) => ({ ...prev, points: [pt], state: "awaiting_text_height", prompt: "Specify height <2.5>:" }));
        addHistory("prompt", "Specify height <2.5>:");
      } else if (state === "awaiting_text_height") {
        const h = val.trim() === "" ? 2.5 : parseFloat(val);
        setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, height: isNaN(h) ? 2.5 : h }, state: "awaiting_text_rotation", prompt: "Specify rotation <0>:" }));
        addHistory("prompt", "Specify text rotation angle <0>:");
      } else if (state === "awaiting_text_rotation") {
        const rot = val.trim() === "" ? 0 : parseFloat(val);
        setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, rotation: isNaN(rot) ? 0 : rot }, state: "awaiting_text_value", prompt: "Enter text:" }));
        addHistory("prompt", "Enter text:");
      } else if (state === "awaiting_text_value") {
        const ent: DrawEntity = {
          id: newEntityId("text"), type: "text",
          layer: drawing.currentLayer,
          color: layerColor(drawing, drawing.currentLayer),
          lineType: "Continuous", lineWeight: 0.18,
          data: { x: points[0].x, y: points[0].y, text: val, height: tempData.height || 2.5, rotation: tempData.rotation || 0 },
        };
        commitEntities([ent]);
        addHistory("response", `TEXT: "${val}" placed.`);
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleLayerInput = useCallback(
    (val: string) => {
      const parts = val.trim().split(/\s+/);
      const op = parts[0]?.toUpperCase();
      const name = parts[1];
      switch (op) {
        case "NEW":
          if (!name) { addHistory("error", "Usage: New <layerName>"); return; }
          if (drawing.layers.find((l) => l.name === name)) { addHistory("error", `Layer "${name}" already exists.`); finishCommand(); return; }
          setDrawing((prev) => ({
            ...prev,
            layers: [...prev.layers, { id: name, name, visible: true, locked: false, color: "#ffffff", lineType: "Continuous", frozen: false }],
          }));
          addHistory("response", `Layer "${name}" created.`);
          break;
        case "SET":
          if (!name || !drawing.layers.find((l) => l.name === name)) { addHistory("error", `Layer "${name}" not found.`); finishCommand(); return; }
          setDrawing((prev) => ({ ...prev, currentLayer: name }));
          addHistory("response", `Current layer set to "${name}".`);
          break;
        case "COLOR":
          const color = parts[2];
          if (!name || !color) { addHistory("error", "Usage: Color <layer> <#hex>"); finishCommand(); return; }
          setDrawing((prev) => ({
            ...prev,
            layers: prev.layers.map((l) => l.name === name ? { ...l, color } : l),
          }));
          addHistory("response", `Layer "${name}" color set to ${color}.`);
          break;
        case "ON":
          setDrawing((prev) => ({ ...prev, layers: prev.layers.map((l) => l.name === name ? { ...l, visible: true } : l) }));
          addHistory("response", `Layer "${name}" on.`);
          break;
        case "OFF":
          setDrawing((prev) => ({ ...prev, layers: prev.layers.map((l) => l.name === name ? { ...l, visible: false } : l) }));
          addHistory("response", `Layer "${name}" off.`);
          break;
        case "LOCK":
          setDrawing((prev) => ({ ...prev, layers: prev.layers.map((l) => l.name === name ? { ...l, locked: true } : l) }));
          addHistory("response", `Layer "${name}" locked.`);
          break;
        case "UNLOCK":
          setDrawing((prev) => ({ ...prev, layers: prev.layers.map((l) => l.name === name ? { ...l, locked: false } : l) }));
          addHistory("response", `Layer "${name}" unlocked.`);
          break;
        case "DELETE":
          if (name === "0") { addHistory("error", "Cannot delete default layer 0."); finishCommand(); return; }
          setDrawing((prev) => ({
            ...prev,
            layers: prev.layers.filter((l) => l.name !== name),
            currentLayer: prev.currentLayer === name ? "0" : prev.currentLayer,
          }));
          addHistory("response", `Layer "${name}" deleted.`);
          break;
        case "LIST":
          const list = drawing.layers.map((l) => `${l.name} [${l.visible ? "ON" : "OFF"}${l.locked ? ",LOCKED" : ""}]`).join(", ");
          addHistory("response", `Layers: ${list}`);
          break;
        default:
          addHistory("error", "LAYER options: New/Set/Color/On/Off/Lock/Unlock/Delete/List");
          break;
      }
      finishCommand();
    },
    [phase, drawing, addHistory, finishCommand]
  );

  const handleZoomInput = useCallback(
    (val: string) => {
      const upper = val.toUpperCase();
      if (upper === "IN" || upper === "I") {
        setDrawing((prev) => ({ ...prev, zoom: Math.min(prev.zoom * 1.5, 50) }));
        addHistory("response", "Zoom in.");
      } else if (upper === "OUT" || upper === "O") {
        setDrawing((prev) => ({ ...prev, zoom: Math.max(prev.zoom / 1.5, 0.05) }));
        addHistory("response", "Zoom out.");
      } else if (upper === "ALL" || upper === "A" || upper === "EXTENTS" || upper === "E") {
        setDrawing((prev) => ({ ...prev, zoom: 1, panX: 0, panY: 0 }));
        addHistory("response", "Zoom to extents.");
      } else {
        const factor = parseFloat(val);
        if (!isNaN(factor) && factor > 0) {
          setDrawing((prev) => ({ ...prev, zoom: factor }));
          addHistory("response", `Zoom set to ${factor}.`);
        } else {
          addHistory("error", "Invalid zoom. Use: In/Out/All/Extents or a factor.");
        }
      }
      finishCommand();
    },
    [addHistory, finishCommand]
  );

  const handleSnapInput = useCallback(
    (val: string) => {
      const upper = val.toUpperCase();
      if (upper === "ON") {
        setDrawing((prev) => ({ ...prev, snapMode: true }));
        addHistory("response", "Snap on.");
      } else if (upper === "OFF") {
        setDrawing((prev) => ({ ...prev, snapMode: false }));
        addHistory("response", "Snap off.");
      } else {
        const sp = parseFloat(val);
        if (!isNaN(sp) && sp > 0) {
          setDrawing((prev) => ({ ...prev, snapMode: true, gridSpacing: sp }));
          addHistory("response", `Snap spacing: ${sp}.`);
        }
      }
      finishCommand();
    },
    [addHistory, finishCommand]
  );

  const handleTrimInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_trim_cutting") {
        const valUp = val.toUpperCase();
        if (valUp === "" || valUp === "ALL") {
          const cuttingIds = valUp === "ALL" ? drawing.entities.map((e) => e.id) : (tempData.cuttingIds || []);
          if (cuttingIds.length === 0) {
            const allIds = drawing.entities.map((e) => e.id);
            setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, cuttingIds: allIds }, state: "awaiting_trim_object", prompt: "Select object to trim:" }));
            addHistory("prompt", "All objects as cutting edges. Select object to trim:");
          } else {
            setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, cuttingIds }, state: "awaiting_trim_object", prompt: "Select object to trim:" }));
            addHistory("prompt", `${cuttingIds.length} cutting edge(s). Select object to trim:`);
          }
        } else {
          const ids = val.split(/[\s,]+/).filter(Boolean);
          const newCuttingIds = [...(tempData.cuttingIds || []), ...ids];
          setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, cuttingIds: newCuttingIds } }));
          addHistory("response", `Added ${ids.length} cutting edge(s). Enter to proceed.`);
        }
      } else if (state === "awaiting_trim_object") {
        if (val === "") { finishCommand(); return; }
        const ids = val.split(/[\s,]+/).filter(Boolean);
        const ent = drawing.entities.find((e) => ids.includes(e.id));
        if (!ent) { addHistory("error", "Object not found. Click on an entity."); return; }
        const cuttingEdges = drawing.entities.filter((e) => (tempData.cuttingIds || []).includes(e.id));
        const lastClick = mouseWorldPos;
        const result = trimLine(ent, cuttingEdges, lastClick);
        setDrawing((prev) => ({
          ...prev,
          entities: [...prev.entities.filter((e) => e.id !== ent.id), ...result],
          undoStack: [...prev.undoStack, [...prev.entities]],
          redoStack: [],
        }));
        addHistory("response", `TRIM: Object trimmed (${result.length} segment(s) remaining).`);
        addHistory("prompt", "Select next object to trim or Enter to finish:");
      }
    },
    [phase, drawing, mouseWorldPos, addHistory, finishCommand]
  );

  const handleExtendInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_extend_boundary") {
        const valUp = val.toUpperCase();
        if (valUp === "" || valUp === "ALL") {
          const boundaryIds = valUp === "ALL" ? drawing.entities.map((e) => e.id) : (tempData.boundaryIds || []);
          if (boundaryIds.length === 0) {
            const allIds = drawing.entities.map((e) => e.id);
            setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, boundaryIds: allIds }, state: "awaiting_extend_object", prompt: "Select object to extend:" }));
            addHistory("prompt", "All objects as boundaries. Select object to extend:");
          } else {
            setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, boundaryIds }, state: "awaiting_extend_object", prompt: "Select object to extend:" }));
            addHistory("prompt", `${boundaryIds.length} boundary edge(s). Select object to extend:`);
          }
        } else {
          const ids = val.split(/[\s,]+/).filter(Boolean);
          const newIds = [...(tempData.boundaryIds || []), ...ids];
          setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, boundaryIds: newIds } }));
          addHistory("response", `Added ${ids.length} boundary edge(s). Enter to proceed.`);
        }
      } else if (state === "awaiting_extend_object") {
        if (val === "") { finishCommand(); return; }
        const ids = val.split(/[\s,]+/).filter(Boolean);
        const ent = drawing.entities.find((e) => ids.includes(e.id));
        if (!ent) { addHistory("error", "Object not found."); return; }
        const boundaryEdges = drawing.entities.filter((e) => (tempData.boundaryIds || []).includes(e.id));
        const result = extendLine(ent, boundaryEdges, mouseWorldPos);
        if (result) {
          setDrawing((prev) => ({
            ...prev,
            entities: prev.entities.map((e) => e.id === ent.id ? result : e),
            undoStack: [...prev.undoStack, [...prev.entities]],
            redoStack: [],
          }));
          addHistory("response", "EXTEND: Object extended to boundary.");
        } else {
          addHistory("error", "EXTEND: Could not extend to boundary.");
        }
        addHistory("prompt", "Select next object to extend or Enter to finish:");
      }
    },
    [phase, drawing, mouseWorldPos, addHistory, finishCommand]
  );

  const handleHatchInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_hatch_pattern") {
        const pattern = val.toUpperCase().trim() || "ANSI31";
        if (!(pattern in HATCH_PATTERNS)) {
          addHistory("error", `Unknown pattern. Use: ${Object.keys(HATCH_PATTERNS).join(", ")}`);
          return;
        }
        const style: HatchStyle = { ...tempData.style, pattern: pattern as any };
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, style },
          state: "awaiting_hatch_scale",
          prompt: "Specify hatch scale <1>:",
        }));
        addHistory("prompt", `Pattern: ${pattern}. Specify scale <1>:`);
      } else if (state === "awaiting_hatch_scale") {
        const scale = val.trim() === "" ? 1 : parseFloat(val);
        const style: HatchStyle = { ...tempData.style, scale: isNaN(scale) ? 1 : scale };
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, style },
          state: "awaiting_hatch_angle",
          prompt: "Specify hatch angle <0>:",
        }));
        addHistory("prompt", "Specify hatch angle <0>:");
      } else if (state === "awaiting_hatch_angle") {
        const angle = val.trim() === "" ? 0 : parseFloat(val);
        const style: HatchStyle = { ...tempData.style, angle: isNaN(angle) ? 0 : angle };
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, style },
          state: "awaiting_hatch_boundary",
          prompt: "Select closed boundary objects, then Enter:",
        }));
        addHistory("prompt", "Select closed boundary objects (polyline/circle). Click then Enter:");
      } else if (state === "awaiting_hatch_boundary") {
        if (val.trim() === "" || val.toUpperCase() === "END") {
          const selectedIds = tempData.boundaryIds || drawing.selectedIds;
          if (selectedIds.length === 0) {
            addHistory("error", "No boundary objects selected.");
            return;
          }
          const boundaries = extractBoundaryPoints(drawing.entities, selectedIds);
          if (boundaries.length === 0) {
            addHistory("error", "No valid closed boundaries found. Select closed polylines or circles.");
            return;
          }
          const style: HatchStyle = { ...tempData.style, color: layerColor(drawing, drawing.currentLayer) };
          for (const boundary of boundaries) {
            const hatchLines = generateHatchLines(boundary, style);
            const ent: DrawEntity = {
              id: newEntityId("hatch"),
              type: "hatch",
              layer: drawing.currentLayer,
              color: layerColor(drawing, drawing.currentLayer),
              lineType: "Continuous",
              lineWeight: 0.18,
              data: { boundary, style, hatchLines },
            };
            commitEntities([ent]);
          }
          addHistory("response", `HATCH: ${boundaries.length} region(s) hatched with ${tempData.style.pattern}.`);
          finishCommand();
        } else {
          const ids = val.split(/[\s,]+/).filter(Boolean);
          const newIds = [...(tempData.boundaryIds || []), ...ids];
          setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, boundaryIds: newIds } }));
          setDrawing((prev) => ({ ...prev, selectedIds: newIds }));
          addHistory("response", `Added ${ids.length} boundary object(s). Enter to apply hatch.`);
        }
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleBlockInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_block_name") {
        if (!val.trim()) { addHistory("error", "Block name required."); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, blockName: val.trim() },
          state: "awaiting_block_base",
          prompt: "Specify base point:",
        }));
        addHistory("prompt", "Specify insertion base point:");
      } else if (state === "awaiting_block_base") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", "Invalid point."); return; }
        const selIds = drawing.selectedIds;
        if (selIds.length === 0) {
          addHistory("error", "No objects selected. Select objects first, then use BLOCK.");
          finishCommand();
          return;
        }
        const blockEnts = drawing.entities.filter((e) => selIds.includes(e.id));
        setBlockLibrary((prev) => defineBlock(prev, tempData.blockName, pt, blockEnts, `Block: ${tempData.blockName}`));
        addHistory("response", `BLOCK "${tempData.blockName}" defined with ${blockEnts.length} entities.`);
        finishCommand();
      }
    },
    [phase, drawing, addHistory, finishCommand]
  );

  const handleInsertInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_insert_name") {
        const name = val.trim();
        if (!blockLibrary.blocks[name]) {
          addHistory("error", `Block "${name}" not found. Available: ${getBlockNames(blockLibrary).join(", ")}`);
          return;
        }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, blockName: name },
          state: "awaiting_insert_point",
          prompt: "Specify insertion point:",
        }));
        addHistory("prompt", "Specify insertion point:");
      } else if (state === "awaiting_insert_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", "Invalid point."); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, insertPoint: pt },
          state: "awaiting_insert_scale",
          prompt: "Specify scale factor <1>:",
        }));
        addHistory("prompt", "Specify X scale factor <1>:");
      } else if (state === "awaiting_insert_scale") {
        const scale = val.trim() === "" ? 1 : parseFloat(val);
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, scale: isNaN(scale) ? 1 : scale },
          state: "awaiting_insert_rotation",
          prompt: "Specify rotation angle <0>:",
        }));
        addHistory("prompt", "Specify rotation angle <0>:");
      } else if (state === "awaiting_insert_rotation") {
        const rot = val.trim() === "" ? 0 : parseFloat(val);
        const s = tempData.scale || 1;
        const ref = insertBlock(blockLibrary, tempData.blockName, tempData.insertPoint, s, s, isNaN(rot) ? 0 : rot, drawing.currentLayer, layerColor(drawing, drawing.currentLayer));
        if (ref) {
          commitEntities([ref]);
          addHistory("response", `INSERT: Block "${tempData.blockName}" inserted.`);
        } else {
          addHistory("error", "INSERT: Failed to insert block.");
        }
        finishCommand();
      }
    },
    [phase, drawing, blockLibrary, commitEntities, addHistory, finishCommand]
  );

  const handleArrayInput = useCallback(
    (val: string) => {
      const { state, tempData } = phase;
      if (state === "awaiting_object_select") {
        const valUp = val.toUpperCase();
        let ids: string[] = [];
        if (valUp === "LAST" && drawing.entities.length > 0) ids = [drawing.entities[drawing.entities.length - 1].id];
        else if (valUp === "ALL") ids = drawing.entities.map((e) => e.id);
        else if (valUp === "" || valUp === "END") ids = tempData.ids || drawing.selectedIds;
        else ids = val.split(/[\s,]+/).filter(Boolean);
        if (ids.length === 0) { addHistory("error", "No objects selected."); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, ids },
          state: "awaiting_array_type",
          prompt: "Enter array type [Rectangular/Polar] <R>:",
        }));
        addHistory("prompt", "Enter array type [R]ectangular / [P]olar <R>:");
      } else if (state === "awaiting_array_type") {
        const t = val.toUpperCase().trim() || "R";
        if (t === "P" || t === "POLAR") {
          setPhase((prev) => ({
            ...prev,
            tempData: { ...prev.tempData, arrayType: "polar" },
            state: "awaiting_array_center",
            prompt: "Specify center point of array:",
          }));
          addHistory("prompt", "Specify center point of array:");
        } else {
          setPhase((prev) => ({
            ...prev,
            tempData: { ...prev.tempData, arrayType: "rectangular" },
            state: "awaiting_array_rows",
            prompt: "Enter number of rows <2>:",
          }));
          addHistory("prompt", "Enter number of rows <2>:");
        }
      } else if (state === "awaiting_array_rows") {
        const rows = val.trim() === "" ? 2 : parseInt(val);
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, rows: isNaN(rows) ? 2 : rows },
          state: "awaiting_array_cols",
          prompt: "Enter number of columns <2>:",
        }));
        addHistory("prompt", "Enter number of columns <2>:");
      } else if (state === "awaiting_array_cols") {
        const cols = val.trim() === "" ? 2 : parseInt(val);
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, cols: isNaN(cols) ? 2 : cols },
          state: "awaiting_array_row_spacing",
          prompt: "Specify row spacing:",
        }));
        addHistory("prompt", "Specify distance between rows:");
      } else if (state === "awaiting_array_row_spacing") {
        const rowSpacing = parseFloat(val);
        if (isNaN(rowSpacing)) { addHistory("error", "Invalid spacing."); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, rowSpacing },
          state: "awaiting_array_col_spacing",
          prompt: "Specify column spacing:",
        }));
        addHistory("prompt", "Specify distance between columns:");
      } else if (state === "awaiting_array_col_spacing") {
        const colSpacing = parseFloat(val);
        if (isNaN(colSpacing)) { addHistory("error", "Invalid spacing."); return; }
        const ents = drawing.entities.filter((e) => (tempData.ids || []).includes(e.id));
        const copies = rectangularArray(ents, tempData.rows || 2, tempData.cols || 2, tempData.rowSpacing || 0, colSpacing);
        commitEntities(copies);
        addHistory("response", `ARRAY: Rectangular ${tempData.rows}×${tempData.cols} = ${copies.length} new objects.`);
        finishCommand();
      } else if (state === "awaiting_array_center") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", "Invalid point."); return; }
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, center: pt },
          state: "awaiting_array_count",
          prompt: "Enter number of items <6>:",
        }));
        addHistory("prompt", "Enter total number of items <6>:");
      } else if (state === "awaiting_array_count") {
        const count = val.trim() === "" ? 6 : parseInt(val);
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, count: isNaN(count) ? 6 : count },
          state: "awaiting_array_angle",
          prompt: "Specify angle to fill <360>:",
        }));
        addHistory("prompt", "Specify angle to fill <360>:");
      } else if (state === "awaiting_array_angle") {
        const angle = val.trim() === "" ? 360 : parseFloat(val);
        const ents = drawing.entities.filter((e) => (tempData.ids || []).includes(e.id));
        const copies = polarArray(ents, tempData.center, tempData.count || 6, isNaN(angle) ? 360 : angle);
        commitEntities(copies);
        addHistory("response", `ARRAY: Polar ${tempData.count} items over ${angle || 360}° = ${copies.length} new objects.`);
        finishCommand();
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand]
  );

  const handleLeaderInput = useCallback(
    (val: string) => {
      const { state, points } = phase;
      if (state === "awaiting_first_point") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", "Invalid point."); return; }
        setPhase((prev) => ({
          ...prev,
          points: [pt],
          state: "awaiting_leader_next",
          prompt: "Specify next point or Enter for text:",
        }));
        addHistory("prompt", "Specify next point or press Enter to add text:");
      } else if (state === "awaiting_leader_next") {
        if (val.trim() === "") {
          if (points.length < 2) {
            addHistory("error", "Need at least 2 points for a leader.");
            return;
          }
          setPhase((prev) => ({
            ...prev,
            state: "awaiting_leader_text",
            prompt: "Enter annotation text:",
          }));
          addHistory("prompt", "Enter annotation text:");
        } else {
          const pt = parseCoordinates(val, points[points.length - 1]);
          if (!pt) { addHistory("error", "Invalid point."); return; }
          setPhase((prev) => ({
            ...prev,
            points: [...prev.points, pt],
            prompt: "Specify next point or Enter for text:",
          }));
          addHistory("prompt", "Specify next point or press Enter to add text:");
        }
      } else if (state === "awaiting_leader_text") {
        const leaderEnt = createLeaderEntity(
          points,
          val,
          drawing.currentLayer,
          layerColor(drawing, drawing.currentLayer),
          currentDimStyle
        );
        commitEntities([leaderEnt]);
        addHistory("response", `LEADER: Created with ${points.length} points.`);
        finishCommand();
      }
    },
    [phase, drawing, currentDimStyle, commitEntities, addHistory, finishCommand]
  );

  const handleMTextInput = useCallback(
    (val: string) => {
      const { state, points, tempData } = phase;
      if (state === "awaiting_text_insert") {
        const pt = parseCoordinates(val, undefined);
        if (!pt) { addHistory("error", "Invalid point."); return; }
        setPhase((prev) => ({
          ...prev,
          points: [pt],
          state: "awaiting_mtext_width",
          prompt: "Specify width <0 for auto>:",
        }));
        addHistory("prompt", "Specify text width <0>:");
      } else if (state === "awaiting_mtext_width") {
        const w = val.trim() === "" ? 0 : parseFloat(val);
        setPhase((prev) => ({
          ...prev,
          tempData: { ...prev.tempData, width: isNaN(w) ? 0 : w },
          state: "awaiting_mtext_value",
          prompt: "Enter multiline text (\\n for newlines):",
        }));
        addHistory("prompt", "Enter text (use \\n for newlines):");
      } else if (state === "awaiting_mtext_value") {
        const text = val.replace(/\\n/g, "\n");
        const ent = createMTextEntity(
          points[0],
          text,
          currentTextStyle,
          "left",
          tempData.width || 0,
          drawing.currentLayer,
          layerColor(drawing, drawing.currentLayer)
        );
        commitEntities([ent]);
        addHistory("response", `MTEXT: "${text.split("\n")[0]}..." placed.`);
        finishCommand();
      }
    },
    [phase, drawing, currentTextStyle, commitEntities, addHistory, finishCommand]
  );

  const doUndo = useCallback(() => {
    setDrawing((prev) => {
      if (prev.undoStack.length === 0) return prev;
      const stack = [...prev.undoStack];
      const last = stack.pop()!;
      return { ...prev, entities: last, undoStack: stack, redoStack: [prev.entities, ...prev.redoStack] };
    });
    addHistory("response", "Undo.");
  }, [addHistory]);

  const doRedo = useCallback(() => {
    setDrawing((prev) => {
      if (prev.redoStack.length === 0) return prev;
      const [next, ...rest] = prev.redoStack;
      return { ...prev, entities: next, undoStack: [...prev.undoStack, prev.entities], redoStack: rest };
    });
    addHistory("response", "Redo.");
  }, [addHistory]);

  const doZoomAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.width || canvas.offsetWidth;
    const ch = canvas.height || canvas.offsetHeight;
    if (drawing.entities.length === 0) {
      setDrawing((prev) => ({ ...prev, zoom: 1, panX: cw / 2, panY: ch / 2 }));
      addHistory("response", "Zoom All — no entities, reset view.");
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ent of drawing.entities) {
      const d = ent.data as Record<string, number | { x: number; y: number }[]>;
      if (ent.type === "line") {
        minX = Math.min(minX, d.x1 as number, d.x2 as number);
        maxX = Math.max(maxX, d.x1 as number, d.x2 as number);
        minY = Math.min(minY, d.y1 as number, d.y2 as number);
        maxY = Math.max(maxY, d.y1 as number, d.y2 as number);
      } else if (ent.type === "circle" || ent.type === "arc") {
        const r = d.r as number;
        minX = Math.min(minX, (d.cx as number) - r); maxX = Math.max(maxX, (d.cx as number) + r);
        minY = Math.min(minY, (d.cy as number) - r); maxY = Math.max(maxY, (d.cy as number) + r);
      } else if (ent.type === "polyline") {
        for (const pt of d.points as { x: number; y: number }[]) {
          minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
        }
      } else if (ent.type === "text" || ent.type === "point") {
        minX = Math.min(minX, d.x as number); maxX = Math.max(maxX, d.x as number);
        minY = Math.min(minY, d.y as number); maxY = Math.max(maxY, d.y as number);
      }
    }
    if (!isFinite(minX)) { setDrawing((prev) => ({ ...prev, zoom: 1, panX: 0, panY: 0 })); return; }
    const wx = maxX - minX || 1; const wy = maxY - minY || 1;
    const pad = 0.15;
    const zoom = Math.min(
      (cw * (1 - 2 * pad)) / wx,
      (ch * (1 - 2 * pad)) / wy,
      200
    );
    const ecx = (minX + maxX) / 2;
    const ecy = (minY + maxY) / 2;
    const panX = cw / 2 - ecx * zoom;
    const panY = ch / 2 - ecy * zoom;
    setDrawing((prev) => ({ ...prev, zoom, panX, panY }));
    addHistory("response", `Zoom All — ${drawing.entities.length} entities, zoom=${zoom.toFixed(2)}`);
  }, [drawing.entities, addHistory]);

  const doSelectAll = useCallback(() => {
    const allIds = drawing.entities.map((e) => e.id);
    setDrawing((prev) => ({ ...prev, selectedIds: allIds }));
    addHistory("response", `SELECT ALL — ${allIds.length} object(s) selected.`);
    finishCommand();
  }, [drawing.entities, addHistory, finishCommand]);

  const doDeleteSelected = useCallback(() => {
    const ids = drawing.selectedIds;
    if (ids.length === 0) { addHistory("response", "DELETE — no objects selected."); return; }
    setDrawing((prev) => ({
      ...prev,
      undoStack: [...prev.undoStack.slice(-49), prev.entities],
      redoStack: [],
      entities: prev.entities.filter((e) => !ids.includes(e.id)),
      selectedIds: [],
    }));
    addHistory("response", `DELETE — ${ids.length} object(s) erased.`);
    finishCommand();
  }, [drawing.selectedIds, addHistory, finishCommand]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cmdHistory]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F3") { e.preventDefault(); setDrawing((prev) => ({ ...prev, osnapEnabled: !prev.osnapEnabled })); }
      if (e.key === "F8") { e.preventDefault(); setDrawing((prev) => ({ ...prev, orthoMode: !prev.orthoMode })); }
      if (e.key === "F9") { e.preventDefault(); setDrawing((prev) => ({ ...prev, snapMode: !prev.snapMode })); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); doUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); doRedo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); doSelectAll(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); doDeleteSelected(); }
      if (e.key === "Escape") {
        if (phase.state !== "idle") cancelCommand();
        else setDrawing((prev) => ({ ...prev, selectedIds: [] }));
      }
      if ((e.key === "Delete" || e.key === "Backspace") && phase.state === "idle") {
        setDrawing((prev) => {
          if (prev.selectedIds.length === 0) return prev;
          const ids = prev.selectedIds;
          return {
            ...prev,
            entities: prev.entities.filter((en) => !ids.includes(en.id)),
            selectedIds: [],
            undoStack: [...prev.undoStack, [...prev.entities]],
            redoStack: [],
          };
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [drawing.osnapEnabled, drawing.orthoMode, drawing.snapMode, phase, doUndo, doRedo, cancelCommand]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = { w: canvas.width, h: canvas.height };
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, w, h);

    if (drawing.gridVisible) {
      const gs = drawing.gridSpacing * drawing.zoom;
      const originX = drawing.panX % gs;
      const originY = (drawing.panY % gs + gs) % gs;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5;
      for (let x = originX; x < w; x += gs) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = originY; y < h; y += gs) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      const majorGs = gs * 5;
      const majorOriginX = drawing.panX % majorGs;
      const majorOriginY = (drawing.panY % majorGs + majorGs) % majorGs;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 0.8;
      for (let x = majorOriginX; x < w; x += majorGs) {
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
      }
      for (let y = majorOriginY; y < h; y += majorGs) {
        ctx.moveTo(0, y); ctx.lineTo(w, y);
      }
      ctx.stroke();
    }

    const originCx = worldToCanvas(0, 0, drawing.panX, drawing.panY, drawing.zoom, h);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,80,80,0.6)";
    ctx.lineWidth = 1;
    ctx.moveTo(originCx.cx, 0); ctx.lineTo(originCx.cx, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(80,255,80,0.6)";
    ctx.moveTo(0, originCx.cy); ctx.lineTo(w, originCx.cy);
    ctx.stroke();

    const visibleLayers = new Set(
      drawing.layers.filter((l) => l.visible).map((l) => l.name)
    );

    const drawEntity = (ent: DrawEntity, preview = false) => {
      if (!visibleLayers.has(ent.layer)) return;
      ctx.strokeStyle = preview ? "#60a5fa" : ent.color;
      ctx.lineWidth = preview ? 1 : Math.max(0.5, ent.lineWeight * drawing.zoom * 0.5);
      ctx.setLineDash(preview ? [4, 3] : []);
      ctx.fillStyle = "transparent";

      if (ent.type === "line") {
        const { x1, y1, x2, y2 } = ent.data;
        const c1 = worldToCanvas(x1, y1, drawing.panX, drawing.panY, drawing.zoom, h);
        const c2 = worldToCanvas(x2, y2, drawing.panX, drawing.panY, drawing.zoom, h);
        ctx.beginPath();
        ctx.moveTo(c1.cx, c1.cy);
        ctx.lineTo(c2.cx, c2.cy);
        ctx.stroke();
      } else if (ent.type === "circle") {
        const { cx, cy, r } = ent.data;
        const cc = worldToCanvas(cx, cy, drawing.panX, drawing.panY, drawing.zoom, h);
        ctx.beginPath();
        ctx.arc(cc.cx, cc.cy, r * drawing.zoom, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ent.type === "arc") {
        const { cx, cy, r, startAngle, endAngle } = ent.data;
        const cc = worldToCanvas(cx, cy, drawing.panX, drawing.panY, drawing.zoom, h);
        const sa = (-endAngle * Math.PI) / 180;
        const ea = (-startAngle * Math.PI) / 180;
        ctx.beginPath();
        ctx.arc(cc.cx, cc.cy, r * drawing.zoom, sa, ea);
        ctx.stroke();
      } else if (ent.type === "polyline") {
        const pts: Point[] = ent.data.points || [];
        if (pts.length < 2) return;
        ctx.beginPath();
        const c0 = worldToCanvas(pts[0].x, pts[0].y, drawing.panX, drawing.panY, drawing.zoom, h);
        ctx.moveTo(c0.cx, c0.cy);
        for (let i = 1; i < pts.length; i++) {
          const cp = worldToCanvas(pts[i].x, pts[i].y, drawing.panX, drawing.panY, drawing.zoom, h);
          ctx.lineTo(cp.cx, cp.cy);
        }
        ctx.stroke();
      } else if (ent.type === "point") {
        const { x, y } = ent.data;
        const cp = worldToCanvas(x, y, drawing.panX, drawing.panY, drawing.zoom, h);
        ctx.beginPath();
        ctx.arc(cp.cx, cp.cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = ent.color;
        ctx.fill();
      } else if (ent.type === "text") {
        const { x, y, text, height, rotation } = ent.data;
        const cp = worldToCanvas(x, y, drawing.panX, drawing.panY, drawing.zoom, h);
        ctx.save();
        ctx.translate(cp.cx, cp.cy);
        ctx.rotate((-(rotation || 0) * Math.PI) / 180);
        ctx.fillStyle = ent.color;
        ctx.font = `${Math.max(8, (height || 2.5) * drawing.zoom)}px monospace`;
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else if (ent.type === "dimension_linear" || ent.type === "dimension_angular" || ent.type === "dimension_radius" || ent.type === "dimension_diameter") {
        renderDimensionEntity(ctx, ent, drawing.panX, drawing.panY, drawing.zoom, h, currentDimStyle, preview);
      } else if ((ent.type as string) === "leader") {
        renderDimensionEntity(ctx, ent, drawing.panX, drawing.panY, drawing.zoom, h, currentDimStyle, preview);
      } else if (ent.type === "hatch") {
        renderHatchOnCanvas(ctx, ent, drawing.panX, drawing.panY, drawing.zoom, h, preview);
      } else if (ent.type === "mtext") {
        renderTextEntity(ctx, ent, drawing.panX, drawing.panY, drawing.zoom, h, preview);
      } else if ((ent.type as string) === "block_ref") {
        const blockName = ent.data.blockName;
        const block = blockLibrary.blocks[blockName];
        if (block) {
          const { insertPoint, scaleX, scaleY, rotation, basePoint } = ent.data;
          const rad = (rotation * Math.PI) / 180;
          const cosR = Math.cos(rad);
          const sinR = Math.sin(rad);
          const transformPoint = (px: number, py: number): { x: number; y: number } => {
            const lx = (px - basePoint.x) * scaleX;
            const ly = (py - basePoint.y) * scaleY;
            return {
              x: insertPoint.x + lx * cosR - ly * sinR,
              y: insertPoint.y + lx * sinR + ly * cosR,
            };
          };
          ctx.save();
          ctx.strokeStyle = preview ? "#60a5fa" : ent.color;
          ctx.lineWidth = preview ? 1 : Math.max(0.5, 0.5 * drawing.zoom * 0.5);
          ctx.setLineDash(preview ? [4, 3] : []);
          for (const bEnt of block.entities) {
            if (bEnt.type === "line") {
              const p1 = transformPoint(bEnt.data.x1, bEnt.data.y1);
              const p2 = transformPoint(bEnt.data.x2, bEnt.data.y2);
              const c1 = worldToCanvas(p1.x, p1.y, drawing.panX, drawing.panY, drawing.zoom, h);
              const c2 = worldToCanvas(p2.x, p2.y, drawing.panX, drawing.panY, drawing.zoom, h);
              ctx.beginPath(); ctx.moveTo(c1.cx, c1.cy); ctx.lineTo(c2.cx, c2.cy); ctx.stroke();
            } else if (bEnt.type === "circle") {
              const c = transformPoint(bEnt.data.cx, bEnt.data.cy);
              const cc = worldToCanvas(c.x, c.y, drawing.panX, drawing.panY, drawing.zoom, h);
              const r = bEnt.data.r * Math.max(Math.abs(scaleX), Math.abs(scaleY));
              ctx.beginPath(); ctx.arc(cc.cx, cc.cy, r * drawing.zoom, 0, Math.PI * 2); ctx.stroke();
            } else if (bEnt.type === "text") {
              const tp = transformPoint(bEnt.data.x, bEnt.data.y);
              const cp = worldToCanvas(tp.x, tp.y, drawing.panX, drawing.panY, drawing.zoom, h);
              ctx.fillStyle = preview ? "#60a5fa" : bEnt.color;
              ctx.font = `${Math.max(8, (bEnt.data.height || 2.5) * drawing.zoom * Math.max(Math.abs(scaleX), Math.abs(scaleY)))}px monospace`;
              ctx.fillText(bEnt.data.text, cp.cx, cp.cy);
            }
          }
          if (!preview) {
            const ip = worldToCanvas(insertPoint.x, insertPoint.y, drawing.panX, drawing.panY, drawing.zoom, h);
            ctx.fillStyle = "rgba(100,200,255,0.5)";
            ctx.beginPath(); ctx.arc(ip.cx, ip.cy, 3, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      }
    };

    for (const ent of drawing.entities) {
      drawEntity(ent);
    }

    for (const ent of drawing.entities) {
      if (!drawing.selectedIds.includes(ent.id)) continue;
      if (!visibleLayers.has(ent.layer)) continue;
      ctx.save();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 6;
      const { data, type } = ent;
      if (type === "line") {
        const c1 = worldToCanvas(data.x1, data.y1, drawing.panX, drawing.panY, drawing.zoom, h);
        const c2 = worldToCanvas(data.x2, data.y2, drawing.panX, drawing.panY, drawing.zoom, h);
        ctx.beginPath(); ctx.moveTo(c1.cx, c1.cy); ctx.lineTo(c2.cx, c2.cy); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;
        for (const p of [c1, c2]) { ctx.fillStyle = "#00e5ff"; ctx.fillRect(p.cx - 4, p.cy - 4, 8, 8); }
        const mid = worldToCanvas((data.x1 + data.x2) / 2, (data.y1 + data.y2) / 2, drawing.panX, drawing.panY, drawing.zoom, h);
        ctx.fillRect(mid.cx - 4, mid.cy - 4, 8, 8);
      } else if (type === "circle") {
        const cc = worldToCanvas(data.cx, data.cy, drawing.panX, drawing.panY, drawing.zoom, h);
        ctx.beginPath(); ctx.arc(cc.cx, cc.cy, data.r * drawing.zoom, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;
        ctx.fillStyle = "#00e5ff";
        ctx.fillRect(cc.cx - 4, cc.cy - 4, 8, 8);
        for (const a of [0, 90, 180, 270]) {
          const gx = data.cx + data.r * Math.cos(a * Math.PI / 180);
          const gy = data.cy + data.r * Math.sin(a * Math.PI / 180);
          const gc = worldToCanvas(gx, gy, drawing.panX, drawing.panY, drawing.zoom, h);
          ctx.fillRect(gc.cx - 4, gc.cy - 4, 8, 8);
        }
      } else if (type === "polyline") {
        const pts: Point[] = data.points || [];
        if (pts.length >= 2) {
          ctx.beginPath();
          const c0 = worldToCanvas(pts[0].x, pts[0].y, drawing.panX, drawing.panY, drawing.zoom, h);
          ctx.moveTo(c0.cx, c0.cy);
          for (let i = 1; i < pts.length; i++) {
            const cp = worldToCanvas(pts[i].x, pts[i].y, drawing.panX, drawing.panY, drawing.zoom, h);
            ctx.lineTo(cp.cx, cp.cy);
          }
          ctx.stroke();
          ctx.setLineDash([]); ctx.shadowBlur = 0;
          ctx.fillStyle = "#00e5ff";
          for (const pt of pts) {
            const cp = worldToCanvas(pt.x, pt.y, drawing.panX, drawing.panY, drawing.zoom, h);
            ctx.fillRect(cp.cx - 4, cp.cy - 4, 8, 8);
          }
        }
      } else if (type === "arc") {
        const cc = worldToCanvas(data.cx, data.cy, drawing.panX, drawing.panY, drawing.zoom, h);
        const sa = (-data.endAngle * Math.PI) / 180;
        const ea = (-data.startAngle * Math.PI) / 180;
        ctx.beginPath(); ctx.arc(cc.cx, cc.cy, data.r * drawing.zoom, sa, ea); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;
        ctx.fillStyle = "#00e5ff"; ctx.fillRect(cc.cx - 4, cc.cy - 4, 8, 8);
      }
      ctx.restore();
    }

    if (rubberBand) {
      const rb1 = worldToCanvas(rubberBand.x1, rubberBand.y1, drawing.panX, drawing.panY, drawing.zoom, h);
      const rb2 = worldToCanvas(rubberBand.x2, rubberBand.y2, drawing.panX, drawing.panY, drawing.zoom, h);
      ctx.save();
      const crossRight = rubberBand.x2 > rubberBand.x1;
      ctx.strokeStyle = crossRight ? "#00aaff" : "#00ff88";
      ctx.lineWidth = 1;
      ctx.setLineDash(crossRight ? [6, 3] : [3, 3]);
      ctx.fillStyle = crossRight ? "rgba(0,150,255,0.08)" : "rgba(0,255,136,0.08)";
      const rx = Math.min(rb1.cx, rb2.cx); const ry = Math.min(rb1.cy, rb2.cy);
      const rw = Math.abs(rb2.cx - rb1.cx); const rh = Math.abs(rb2.cy - rb1.cy);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

    if (phase.previewEntity) {
      drawEntity(phase.previewEntity, true);
    }

    if (
      phase.state !== "idle" &&
      phase.points.length > 0 &&
      (phase.command === "LINE" || phase.command === "POLYLINE")
    ) {
      const lastPt = phase.points[phase.points.length - 1];
      const c1 = worldToCanvas(lastPt.x, lastPt.y, drawing.panX, drawing.panY, drawing.zoom, h);
      const c2 = worldToCanvas(
        mouseWorldPos.x,
        mouseWorldPos.y,
        drawing.panX,
        drawing.panY,
        drawing.zoom,
        h
      );
      ctx.beginPath();
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(c1.cx, c1.cy);
      ctx.lineTo(c2.cx, c2.cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (snapPoint && drawing.osnapEnabled) {
      const csnap = worldToCanvas(
        snapPoint.point.x,
        snapPoint.point.y,
        drawing.panX,
        drawing.panY,
        drawing.zoom,
        h
      );
      ctx.beginPath();
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.5;
      ctx.rect(csnap.cx - 5, csnap.cy - 5, 10, 10);
      ctx.stroke();

      ctx.fillStyle = "#facc15";
      ctx.font = "9px monospace";
      ctx.fillText(snapPoint.type, csnap.cx + 8, csnap.cy - 4);
    }

    const crossSize = 10;
    const mwp = worldToCanvas(
      mouseWorldPos.x,
      mouseWorldPos.y,
      drawing.panX,
      drawing.panY,
      drawing.zoom,
      h
    );
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.moveTo(mwp.cx - crossSize, mwp.cy);
    ctx.lineTo(mwp.cx + crossSize, mwp.cy);
    ctx.moveTo(mwp.cx, mwp.cy - crossSize);
    ctx.lineTo(mwp.cx, mwp.cy + crossSize);
    ctx.stroke();
  }, [drawing, phase, mouseWorldPos, snapPoint, rubberBand]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        canvasDims.current = { w: rect.width, h: rect.height };
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      let wp = getWorldPoint(cx, cy, drawing);

      if (drawing.orthoMode && phase.state !== "idle" && phase.points.length > 0) {
        wp = applyOrtho(phase.points[phase.points.length - 1], wp);
      }
      if (drawing.snapMode) {
        wp = snapToGrid(wp, drawing.gridSpacing);
      }

      if (drawing.osnapEnabled) {
        const { h } = getCanvasDims();
        const snap = findNearestOsnap(wp, drawing.entities, drawing.osnapTypes, 15 / drawing.zoom);
        setSnapPoint(snap);
      } else {
        setSnapPoint(null);
      }

      setMouseWorldPos(wp);

      if (e.buttons === 4 || (e.buttons === 1 && e.altKey)) {
        setDrawing((prev) => ({
          ...prev,
          panX: prev.panX + e.movementX,
          panY: prev.panY - e.movementY,
        }));
      } else if (e.buttons === 1 && dragStartWorldRef.current && (phase.state === "idle" || phase.state === "awaiting_object_select")) {
        const dx = Math.abs(wp.x - dragStartWorldRef.current.x);
        const dy = Math.abs(wp.y - dragStartWorldRef.current.y);
        if (dx > 1 / drawing.zoom || dy > 1 / drawing.zoom) {
          isDraggingRef.current = true;
          setRubberBand({ x1: dragStartWorldRef.current.x, y1: dragStartWorldRef.current.y, x2: wp.x, y2: wp.y });
        }
      }
    },
    [drawing, phase, getWorldPoint]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (phase.state !== "idle" && phase.state !== "awaiting_object_select") return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const wp = getWorldPoint(cx, cy, drawing);
      isDraggingRef.current = false;
      dragStartWorldRef.current = wp;
    },
    [phase.state, drawing, getWorldPoint]
  );

  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (rubberBand && dragStartWorldRef.current) {
        const { x1, y1, x2, y2 } = rubberBand;
        const selected = windowSelectEntities(drawing.entities, x1, y1, x2, y2);
        setRubberBand(null);
        isDraggingRef.current = false;
        dragStartWorldRef.current = null;

        if (phase.state === "awaiting_object_select") {
          const ids = selected.length > 0 ? selected : [];
          if (ids.length > 0) {
            setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, ids } }));
            setDrawing((prev) => ({ ...prev, selectedIds: ids }));
            addHistory("response", `${ids.length} object(s) selected.`);
          }
        } else if (phase.state === "idle") {
          if (e.shiftKey) {
            setDrawing((prev) => ({ ...prev, selectedIds: [...new Set([...prev.selectedIds, ...selected])] }));
          } else {
            setDrawing((prev) => ({ ...prev, selectedIds: selected }));
          }
          if (selected.length > 0) addHistory("response", `${selected.length} object(s) in selection.`);
        }
        return;
      }
      isDraggingRef.current = false;
      dragStartWorldRef.current = null;
    },
    [rubberBand, drawing, phase.state, addHistory]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (isDraggingRef.current) return;

      let clickPt = snapPoint ? snapPoint.point : mouseWorldPos;
      if (drawing.orthoMode && phase.points.length > 0) {
        clickPt = applyOrtho(phase.points[phase.points.length - 1], clickPt);
      }
      if (drawing.snapMode && !snapPoint) {
        clickPt = snapToGrid(clickPt, drawing.gridSpacing);
      }

      if (phase.state === "idle") {
        const tol = 8 / drawing.zoom;
        const picked = [...drawing.entities].reverse().find((ent) => {
          const layer = drawing.layers.find((l) => l.name === ent.layer);
          if (!layer?.visible || layer?.locked) return false;
          return hitTestEntity(ent, clickPt, tol);
        });
        if (picked) {
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            setDrawing((prev) => ({
              ...prev,
              selectedIds: prev.selectedIds.includes(picked.id)
                ? prev.selectedIds.filter((id) => id !== picked.id)
                : [...prev.selectedIds, picked.id],
            }));
          } else {
            setDrawing((prev) => ({ ...prev, selectedIds: [picked.id] }));
          }
          addHistory("response", `Selected: ${picked.id} (${picked.type})`);
        } else {
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setDrawing((prev) => ({ ...prev, selectedIds: [] }));
          }
          inputRef.current?.focus();
        }
        return;
      }

      if (phase.state === "awaiting_object_select") {
        const tol = 8 / drawing.zoom;
        const picked = [...drawing.entities].reverse().find((ent) => {
          const layer = drawing.layers.find((l) => l.name === ent.layer);
          if (!layer?.visible || layer?.locked) return false;
          return hitTestEntity(ent, clickPt, tol);
        });
        if (picked) {
          const prevIds: string[] = phase.tempData.ids || [];
          const newIds = prevIds.includes(picked.id)
            ? prevIds.filter((id) => id !== picked.id)
            : [...prevIds, picked.id];
          setPhase((prev) => ({ ...prev, tempData: { ...prev.tempData, ids: newIds } }));
          setDrawing((prev) => ({ ...prev, selectedIds: newIds }));
          addHistory("response", `[+] ${picked.id} (${picked.type}) — ${newIds.length} selected. Enter to confirm.`);
        } else {
          addHistory("response", "No object at that point. Click an entity or type ALL/LAST.");
        }
        return;
      }

      const selectStates = [
        "awaiting_trim_cutting", "awaiting_trim_object",
        "awaiting_extend_boundary", "awaiting_extend_object",
        "awaiting_fillet_select_first", "awaiting_fillet_select_second",
        "awaiting_chamfer_select_first", "awaiting_chamfer_select_second",
        "awaiting_hatch_boundary",
      ];
      if (selectStates.includes(phase.state)) {
        const tol = 8 / drawing.zoom;
        const picked = [...drawing.entities].reverse().find((ent) => {
          const layer = drawing.layers.find((l) => l.name === ent.layer);
          if (!layer?.visible || layer?.locked) return false;
          return hitTestEntity(ent, clickPt, tol);
        });
        if (picked) {
          processInput(picked.id);
        } else {
          addHistory("response", "No object at click point.");
        }
        return;
      }

      const coordStr = `${clickPt.x.toFixed(4)},${clickPt.y.toFixed(4)}`;
      addHistory("input", `[Click] ${coordStr}`);
      setInputHistory((prev) => [coordStr, ...prev.slice(0, 49)]);
      processInputWithPoint(coordStr, clickPt);
    },
    [phase, drawing, mouseWorldPos, snapPoint, addHistory, processInput]
  );

  const processInputWithPoint = useCallback(
    (coordStr: string, pt: Point) => {
      const { state, command, points, tempData } = phase;

      if (state === "idle") return;

      const currentPt = pt;

      switch (command) {
        case "LINE": {
          const newPoints = [...points, currentPt];
          if (newPoints.length >= 2) {
            const ent: DrawEntity = {
              id: newEntityId("line"),
              type: "line",
              layer: drawing.currentLayer,
              color: layerColor(drawing, drawing.currentLayer),
              lineType: "Continuous",
              lineWeight: 0.25,
              data: {
                x1: newPoints[newPoints.length - 2].x,
                y1: newPoints[newPoints.length - 2].y,
                x2: currentPt.x,
                y2: currentPt.y,
              },
            };
            commitEntities([ent]);
            addHistory("response", `LINE to (${currentPt.x.toFixed(3)}, ${currentPt.y.toFixed(3)})`);
          }
          setPhase((prev) => ({
            ...prev,
            points: newPoints,
            state: "awaiting_next_point",
            prompt: "Specify next point or [Undo/Close]:",
          }));
          addHistory("prompt", "Specify next point or [Undo/Close]:");
          if (tempData.singlePoint) {
            const ent: DrawEntity = {
              id: newEntityId("point"), type: "point",
              layer: drawing.currentLayer,
              color: layerColor(drawing, drawing.currentLayer),
              lineType: "Continuous", lineWeight: 0.25,
              data: { x: currentPt.x, y: currentPt.y },
            };
            commitEntities([ent]);
            finishCommand();
          }
          break;
        }
        case "CIRCLE": {
          if (state === "awaiting_center") {
            setPhase((prev) => ({ ...prev, points: [currentPt], state: "awaiting_radius", prompt: "Specify radius:" }));
            addHistory("prompt", "Specify radius or [Diameter]:");
          } else if (state === "awaiting_radius") {
            const r = Math.sqrt((currentPt.x - points[0].x) ** 2 + (currentPt.y - points[0].y) ** 2);
            const ent: DrawEntity = {
              id: newEntityId("circle"), type: "circle",
              layer: drawing.currentLayer,
              color: layerColor(drawing, drawing.currentLayer),
              lineType: "Continuous", lineWeight: 0.25,
              data: { cx: points[0].x, cy: points[0].y, r },
            };
            commitEntities([ent]);
            addHistory("response", `CIRCLE r=${r.toFixed(3)}`);
            finishCommand();
          }
          break;
        }
        case "RECTANGLE": {
          if (state === "awaiting_first_point") {
            setPhase((prev) => ({ ...prev, points: [currentPt], state: "awaiting_second_point", prompt: "Specify other corner:" }));
            addHistory("prompt", "Specify other corner point:");
          } else if (state === "awaiting_second_point") {
            const p1 = points[0];
            const minX = Math.min(p1.x, currentPt.x); const minY = Math.min(p1.y, currentPt.y);
            const maxX = Math.max(p1.x, currentPt.x); const maxY = Math.max(p1.y, currentPt.y);
            const rectPts: Point[] = [
              { x: minX, y: minY }, { x: maxX, y: minY },
              { x: maxX, y: maxY }, { x: minX, y: maxY }, { x: minX, y: minY },
            ];
            const ent: DrawEntity = {
              id: newEntityId("polyline"), type: "polyline",
              layer: drawing.currentLayer, color: layerColor(drawing, drawing.currentLayer),
              lineType: "Continuous", lineWeight: 0.25,
              data: { points: rectPts, closed: true },
            };
            commitEntities([ent]);
            addHistory("response", `RECTANGLE drawn.`);
            finishCommand();
          }
          break;
        }
        case "ARC": {
          handleArcInput(coordStr);
          break;
        }
        case "POLYLINE": {
          const newPoints = [...points, currentPt];
          if (newPoints.length >= 2) {
            const ent: DrawEntity = {
              id: newEntityId("line"), type: "line",
              layer: drawing.currentLayer, color: layerColor(drawing, drawing.currentLayer),
              lineType: "Continuous", lineWeight: 0.25,
              data: { x1: newPoints[newPoints.length - 2].x, y1: newPoints[newPoints.length - 2].y, x2: currentPt.x, y2: currentPt.y },
            };
            commitEntities([ent]);
          }
          setPhase((prev) => ({ ...prev, points: newPoints, state: "awaiting_next_point", prompt: "Specify next point or [Close]:" }));
          addHistory("prompt", "Specify next point or [Undo/Close]:");
          break;
        }
        case "DIMLINEAR":
        case "DIMANGULAR":
        case "DIMRADIUS":
        case "DIMDIAMETER": {
          handleDimInput(coordStr, command);
          break;
        }
        case "TEXT": {
          handleTextInput(coordStr);
          break;
        }
        case "MTEXT": {
          handleMTextInput(coordStr);
          break;
        }
        case "LEADER":
        case "QLEADER": {
          handleLeaderInput(coordStr);
          break;
        }
        case "MOVE": {
          if (state === "awaiting_base_point") {
            setPhase((prev) => ({ ...prev, points: [currentPt], state: "awaiting_displacement", prompt: "Specify second point:" }));
            addHistory("prompt", "Specify second point:");
          } else if (state === "awaiting_displacement") {
            const { tempData: td } = phase;
            const dx = currentPt.x - points[0].x; const dy = currentPt.y - points[0].y;
            setDrawing((prev) => ({
              ...prev,
              entities: prev.entities.map((e) => {
                if (!td.ids?.includes(e.id)) return e;
                const d = JSON.parse(JSON.stringify(e.data));
                if (e.type === "line") { d.x1 += dx; d.y1 += dy; d.x2 += dx; d.y2 += dy; }
                else if (e.type === "circle" || e.type === "arc") { d.cx += dx; d.cy += dy; }
                else if (e.type === "polyline") { d.points = d.points.map((p: Point) => ({ x: p.x + dx, y: p.y + dy })); }
                return { ...e, data: d };
              }),
              undoStack: [...prev.undoStack, [...prev.entities]],
              redoStack: [],
            }));
            addHistory("response", `MOVE by (${dx.toFixed(3)}, ${dy.toFixed(3)})`);
            finishCommand();
          }
          break;
        }
        case "MIRROR": {
          if (state === "awaiting_mirror_line_first") {
            setPhase((prev) => ({ ...prev, points: [currentPt], state: "awaiting_mirror_line_second", prompt: "Specify second point of mirror line:" }));
            addHistory("prompt", "Specify second point of mirror line:");
          } else if (state === "awaiting_mirror_line_second") {
            handleMirrorInput(coordStr);
          }
          break;
        }
        default:
          break;
      }
    },
    [phase, drawing, commitEntities, addHistory, finishCommand, handleArcInput, handleDimInput, handleTextInput, handleMTextInput, handleLeaderInput, handleMirrorInput]
  );

  const handleCanvasWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        setDrawing((prev) => {
          const newZoom = Math.max(0.01, Math.min(prev.zoom * factor, 100));
          const wx = (cx - prev.panX) / prev.zoom;
          const { h } = getCanvasDims();
          const wy = (h - cy - prev.panY) / prev.zoom;
          const newPanX = cx - wx * newZoom;
          const newPanY = h - cy - wy * newZoom;
          return { ...prev, zoom: newZoom, panX: newPanX, panY: newPanY };
        });
      } else {
        setDrawing((prev) => ({
          ...prev,
          panX: prev.panX - e.deltaX,
          panY: prev.panY + e.deltaY,
        }));
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = inputValue.trim();
        setInputValue("");
        setHistoryIdx(-1);
        processInput(val);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInputValue("");
        if (phase.state !== "idle") cancelCommand();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextIdx = Math.min(historyIdx + 1, inputHistory.length - 1);
        setHistoryIdx(nextIdx);
        if (inputHistory[nextIdx] !== undefined) setInputValue(inputHistory[nextIdx]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = Math.max(historyIdx - 1, -1);
        setHistoryIdx(nextIdx);
        setInputValue(nextIdx < 0 ? "" : inputHistory[nextIdx] || "");
        return;
      }
    },
    [inputValue, phase, cancelCommand, processInput, historyIdx, inputHistory]
  );

  const exportDXF = useCallback(() => {
    const dxf = generateDXF(drawing.entities, drawing.layers);
    const blob = new Blob([dxf], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formaxis_drawing.dxf";
    a.click();
    URL.revokeObjectURL(url);
    addHistory("response", "DXF exported: formaxis_drawing.dxf");
  }, [drawing, addHistory]);

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "formaxis_drawing.png";
    a.click();
    addHistory("response", "PNG exported: formaxis_drawing.png");
  }, [addHistory]);

  const sendToFormAxis = useCallback(() => {
    const profilePoints: Point[] = [];
    for (const ent of drawing.entities) {
      if (ent.type === "line") {
        profilePoints.push({ x: ent.data.x1, y: ent.data.y1 });
        profilePoints.push({ x: ent.data.x2, y: ent.data.y2 });
      } else if (ent.type === "polyline") {
        profilePoints.push(...(ent.data.points as Point[]));
      }
    }
    const unique = profilePoints.filter(
      (p, i, arr) => !arr.slice(0, i).some((q) => Math.abs(q.x - p.x) < 0.001 && Math.abs(q.y - p.y) < 0.001)
    );
    addHistory(
      "response",
      `FormAxis: ${unique.length} profile points extracted. Use them in the Setup tab for roll-forming calculation.`
    );
  }, [drawing, addHistory]);

  const currentLayerData = drawing.layers.find(
    (l) => l.name === drawing.currentLayer
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#080812] text-zinc-100 overflow-hidden font-mono">
      <div className="h-9 flex-shrink-0 flex items-center gap-1.5 px-3 border-b border-white/[0.06] bg-[#0b0b1a] text-[11px]">
        <span className="text-zinc-500 font-medium mr-2">FormAxis Manual Drawing</span>

        <button
          onClick={() => setDrawing((p) => ({ ...p, gridVisible: !p.gridVisible }))}
          title="Toggle Grid (GRID)"
          className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${drawing.gridVisible ? "bg-blue-500/20 border-blue-500/30 text-blue-300" : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"}`}
        >
          <Grid className="w-3 h-3" /><span>Grid</span>
        </button>

        <button
          onClick={() => setDrawing((p) => ({ ...p, orthoMode: !p.orthoMode }))}
          title="Toggle Ortho (F8)"
          className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${drawing.orthoMode ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"}`}
        >
          <Compass className="w-3 h-3" /><span>Ortho</span>
        </button>

        <button
          onClick={() => setDrawing((p) => ({ ...p, snapMode: !p.snapMode }))}
          title="Toggle Snap (F9)"
          className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${drawing.snapMode ? "bg-green-500/20 border-green-500/30 text-green-300" : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"}`}
        >
          <Grid className="w-3 h-3" /><span>Snap</span>
        </button>

        <button
          onClick={() => setDrawing((p) => ({ ...p, osnapEnabled: !p.osnapEnabled }))}
          title="Toggle OSnap (F3)"
          className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${drawing.osnapEnabled ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-300" : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"}`}
        >
          <Crosshair className="w-3 h-3" /><span>OSnap</span>
        </button>

        <div className="w-px h-4 bg-white/[0.07] mx-1" />

        <div className="flex items-center gap-1">
          <span className="text-zinc-600">Layer:</span>
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: currentLayerData?.color || "#fff" }} />
          <span className="text-zinc-300">{drawing.currentLayer}</span>
        </div>

        <div className="flex items-center gap-1 ml-1">
          <span className="text-zinc-600">Units:</span>
          <span className="text-zinc-300">{drawing.units}</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={doUndo}
          title="Undo (Ctrl+Z)"
          className="px-2 py-0.5 rounded border bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-all"
        >
          Undo
        </button>
        <button
          onClick={doRedo}
          title="Redo (Ctrl+Y)"
          className="px-2 py-0.5 rounded border bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-all"
        >
          Redo
        </button>

        <div className="w-px h-4 bg-white/[0.07] mx-1" />

        <button
          onClick={exportDXF}
          title="Export DXF"
          className="flex items-center gap-1 px-2 py-0.5 rounded border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all"
        >
          <FileText className="w-3 h-3" /><span>DXF</span>
        </button>
        <button
          onClick={exportPNG}
          title="Export PNG"
          className="flex items-center gap-1 px-2 py-0.5 rounded border bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
        >
          <ImageIcon className="w-3 h-3" /><span>PNG</span>
        </button>
        <button
          onClick={sendToFormAxis}
          title="Send geometry to FormAxis profile"
          className="flex items-center gap-1 px-2 py-0.5 rounded border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
        >
          <Send className="w-3 h-3" /><span>→ FormAxis</span>
        </button>
      </div>

      {/* ── COMPREHENSIVE COMMAND TOOLBAR ── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-x-0.5 gap-y-0.5 px-2 py-1 border-b border-white/[0.06] bg-[#090915] text-[10px] overflow-x-auto scrollbar-none">

        {/* DRAW group */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider px-1 flex-shrink-0">Draw</span>
        {[
          { cmd: "LINE",     label: "Line",   color: "blue",   title: "LINE (L)" },
          { cmd: "CIRCLE",   label: "Circle", color: "blue",   title: "CIRCLE (C)" },
          { cmd: "ARC",      label: "Arc",    color: "blue",   title: "ARC (A)" },
          { cmd: "POLYLINE", label: "PLine",  color: "blue",   title: "POLYLINE (PL)" },
          { cmd: "RECTANGLE",label: "Rect",   color: "blue",   title: "RECTANGLE (REC)" },
          { cmd: "TEXT",     label: "Text",   color: "blue",   title: "TEXT (T)" },
          { cmd: "POINT",    label: "Point",  color: "blue",   title: "POINT (PO)" },
        ].map(({ cmd, label, title }) => (
          <button key={cmd} onClick={() => processInput(cmd)} title={title}
            className="px-2 py-0.5 rounded border bg-blue-500/8 border-blue-500/20 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/40 transition-all flex-shrink-0 whitespace-nowrap">
            {label}
          </button>
        ))}

        <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />

        {/* MODIFY group */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider px-1 flex-shrink-0">Modify</span>
        {[
          { cmd: "MOVE",    label: "Move",    title: "MOVE (M)" },
          { cmd: "COPY",    label: "Copy",    title: "COPY (CO)" },
          { cmd: "ROTATE",  label: "Rotate",  title: "ROTATE (RO)" },
          { cmd: "SCALE",   label: "Scale",   title: "SCALE (SC)" },
          { cmd: "MIRROR",  label: "Mirror",  title: "MIRROR (MI)" },
          { cmd: "OFFSET",  label: "Offset",  title: "OFFSET (O)" },
          { cmd: "TRIM",    label: "Trim",    title: "TRIM (TR)" },
          { cmd: "EXTEND",  label: "Extend",  title: "EXTEND (EX)" },
          { cmd: "FILLET",  label: "Fillet",  title: "FILLET (F)" },
          { cmd: "CHAMFER", label: "Chamfer", title: "CHAMFER (CHA)" },
          { cmd: "STRETCH", label: "Stretch", title: "STRETCH (S)" },
        ].map(({ cmd, label, title }) => (
          <button key={cmd} onClick={() => processInput(cmd)} title={title}
            className="px-2 py-0.5 rounded border bg-amber-500/8 border-amber-500/20 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/40 transition-all flex-shrink-0 whitespace-nowrap">
            {label}
          </button>
        ))}

        <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />

        {/* SELECT / DELETE group */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider px-1 flex-shrink-0">Select</span>
        <button onClick={doSelectAll} title="Select All (Ctrl+A)"
          className="px-2 py-0.5 rounded border bg-cyan-500/10 border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 transition-all flex-shrink-0 whitespace-nowrap font-semibold">
          Sel All
        </button>
        <button onClick={() => setDrawing((p) => ({ ...p, selectedIds: [] }))} title="Deselect All (Esc)"
          className="px-2 py-0.5 rounded border bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0 whitespace-nowrap">
          Desel
        </button>
        <button
          onClick={doDeleteSelected}
          title={`Delete selected (Ctrl+D | Del) — ${drawing.selectedIds.length} selected`}
          className={`px-2 py-0.5 rounded border transition-all flex-shrink-0 whitespace-nowrap font-semibold ${
            drawing.selectedIds.length > 0
              ? "bg-red-500/15 border-red-500/35 text-red-300 hover:bg-red-500/25"
              : "bg-white/[0.03] border-white/[0.07] text-zinc-600"
          }`}
        >
          Delete{drawing.selectedIds.length > 0 ? ` (${drawing.selectedIds.length})` : ""}
        </button>
        <button onClick={() => processInput("ERASE")} title="ERASE command — pick objects"
          className="px-2 py-0.5 rounded border bg-orange-500/10 border-orange-500/20 text-orange-300 hover:bg-orange-500/20 transition-all flex-shrink-0 whitespace-nowrap">
          Erase
        </button>

        <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />

        {/* VIEW group */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider px-1 flex-shrink-0">View</span>
        <button onClick={doZoomAll} title="Zoom All — fit all entities (ZA)"
          className="px-2 py-0.5 rounded border bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-all flex-shrink-0 whitespace-nowrap font-semibold">
          Zoom All
        </button>
        <button onClick={() => setDrawing((p) => ({ ...p, zoom: Math.min(p.zoom * 1.5, 200) }))} title="Zoom In"
          className="px-2 py-0.5 rounded border bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0">
          Z+
        </button>
        <button onClick={() => setDrawing((p) => ({ ...p, zoom: Math.max(p.zoom / 1.5, 0.01) }))} title="Zoom Out"
          className="px-2 py-0.5 rounded border bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0">
          Z−
        </button>
        <button onClick={() => setDrawing((p) => ({ ...p, zoom: 1, panX: 0, panY: 0 }))} title="Reset View"
          className="px-2 py-0.5 rounded border bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0">
          Reset
        </button>
        <button onClick={() => processInput("PAN")} title="PAN (P)"
          className="px-2 py-0.5 rounded border bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0">
          Pan
        </button>

        <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />

        {/* ANNOTATE group */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider px-1 flex-shrink-0">Annotate</span>
        {[
          { cmd: "DIMLINEAR",  label: "DimLin",   title: "DIMLINEAR (DL)" },
          { cmd: "DIMRADIUS",  label: "DimRad",   title: "DIMRADIUS (DR)" },
          { cmd: "DIMDIAMETER",label: "DimDia",   title: "DIMDIAMETER (DD)" },
          { cmd: "LEADER",     label: "Leader",   title: "LEADER (LE)" },
          { cmd: "HATCH",      label: "Hatch",    title: "HATCH (H)" },
          { cmd: "MTEXT",      label: "MText",    title: "MTEXT (MT)" },
        ].map(({ cmd, label, title }) => (
          <button key={cmd} onClick={() => processInput(cmd)} title={title}
            className="px-2 py-0.5 rounded border bg-teal-500/8 border-teal-500/20 text-teal-300 hover:bg-teal-500/20 hover:border-teal-400/40 transition-all flex-shrink-0 whitespace-nowrap">
            {label}
          </button>
        ))}

        <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />

        {/* BLOCKS group */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider px-1 flex-shrink-0">Blocks</span>
        <button onClick={() => processInput("BLOCK")} title="BLOCK — Define block from selection (B)"
          className="px-2 py-0.5 rounded border bg-pink-500/8 border-pink-500/20 text-pink-300 hover:bg-pink-500/20 transition-all flex-shrink-0 whitespace-nowrap">
          Block
        </button>
        <button onClick={() => processInput("INSERT")} title="INSERT — Insert a block (I)"
          className="px-2 py-0.5 rounded border bg-pink-500/8 border-pink-500/20 text-pink-300 hover:bg-pink-500/20 transition-all flex-shrink-0 whitespace-nowrap">
          Insert
        </button>
        <button onClick={() => processInput("EXPLODE")} title="EXPLODE — Explode block references (X)"
          className="px-2 py-0.5 rounded border bg-pink-500/8 border-pink-500/20 text-pink-300 hover:bg-pink-500/20 transition-all flex-shrink-0 whitespace-nowrap">
          Explode
        </button>
        <button onClick={() => setShowBlockPanel(!showBlockPanel)} title="Block library panel"
          className={`px-2 py-0.5 rounded border transition-all flex-shrink-0 whitespace-nowrap ${showBlockPanel ? "bg-pink-500/20 border-pink-500/30 text-pink-300" : "bg-white/[0.03] border-white/[0.07] text-zinc-500 hover:text-zinc-200"}`}>
          Lib
        </button>
        <button onClick={() => processInput("ARRAY")} title="ARRAY — Rectangular/Polar array (AR)"
          className="px-2 py-0.5 rounded border bg-amber-500/8 border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-all flex-shrink-0 whitespace-nowrap">
          Array
        </button>

        <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />

        {/* OUTPUT group */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider px-1 flex-shrink-0">Output</span>
        <button onClick={() => setShowPrintDialog(true)} title="PLOT/PRINT — Print/plot layout (Ctrl+P)"
          className="px-2 py-0.5 rounded border bg-emerald-500/8 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-all flex-shrink-0 whitespace-nowrap font-semibold">
          Plot
        </button>

        <div className="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />

        {/* EDIT group */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider px-1 flex-shrink-0">Edit</span>
        <button onClick={doUndo} title="Undo (Ctrl+Z)"
          className="px-2 py-0.5 rounded border bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0">
          ↩ Undo
        </button>
        <button onClick={doRedo} title="Redo (Ctrl+Y)"
          className="px-2 py-0.5 rounded border bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0">
          ↪ Redo
        </button>

        {/* Entity count badge */}
        <div className="ml-auto flex-shrink-0 flex items-center gap-1">
          <span className="text-[9px] text-zinc-600 bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 rounded">
            {drawing.entities.length} obj
          </span>
          {drawing.selectedIds.length > 0 && (
            <span className="text-[9px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 rounded font-bold">
              {drawing.selectedIds.length} sel
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showLayers && (
          <div className="w-48 flex-shrink-0 border-r border-white/[0.06] bg-[#0a0a18] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.06]">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Layers</span>
              <button
                onClick={() => setIsAddingLayer(true)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
                title="Add layer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {isAddingLayer && (
              <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.06]">
                <input
                  value={newLayerName}
                  onChange={(e) => setNewLayerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newLayerName.trim()) {
                      const name = newLayerName.trim();
                      if (!drawing.layers.find((l) => l.name === name)) {
                        setDrawing((prev) => ({
                          ...prev,
                          layers: [...prev.layers, { id: name, name, visible: true, locked: false, color: "#ffffff", lineType: "Continuous", frozen: false }],
                        }));
                        addHistory("response", `Layer "${name}" created.`);
                      }
                      setNewLayerName("");
                      setIsAddingLayer(false);
                    }
                    if (e.key === "Escape") { setIsAddingLayer(false); setNewLayerName(""); }
                  }}
                  autoFocus
                  placeholder="Layer name..."
                  className="flex-1 min-w-0 bg-white/[0.05] border border-white/[0.1] rounded px-1.5 py-0.5 text-[10px] text-zinc-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {drawing.layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-[10px] border-b border-white/[0.03] transition-all ${drawing.currentLayer === layer.name ? "bg-blue-500/10 text-blue-300" : "text-zinc-400 hover:bg-white/[0.04]"}`}
                  onClick={() => setDrawing((prev) => ({ ...prev, currentLayer: layer.name }))}
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span className="flex-1 truncate">{layer.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDrawing((prev) => ({ ...prev, layers: prev.layers.map((l) => l.id === layer.id ? { ...l, visible: !l.visible } : l) })); }}
                    className="text-zinc-600 hover:text-zinc-200 transition-colors"
                    title={layer.visible ? "Hide layer" : "Show layer"}
                  >
                    {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDrawing((prev) => ({ ...prev, layers: prev.layers.map((l) => l.id === layer.id ? { ...l, locked: !l.locked } : l) })); }}
                    className="text-zinc-600 hover:text-zinc-200 transition-colors"
                    title={layer.locked ? "Unlock" : "Lock"}
                  >
                    {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  {layer.name !== "0" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDrawing((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== layer.id), currentLayer: prev.currentLayer === layer.name ? "0" : prev.currentLayer })); }}
                      className="text-red-700 hover:text-red-400 transition-colors"
                      title="Delete layer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-white/[0.06] px-2 py-1.5">
              <div className="text-[9px] text-zinc-600 mb-1">Entities: {drawing.entities.length}</div>
              <div className="flex flex-col gap-0.5">
                {drawing.entities.slice(-5).reverse().map((ent) => (
                  <div key={ent.id} className="flex items-center gap-1 text-[9px] text-zinc-600">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: ent.color }} />
                    <span className="flex-1 truncate">{ent.type}</span>
                    <span className="text-zinc-700">{ent.layer}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showBlockPanel && (
          <div className="w-48 flex-shrink-0 border-r border-white/[0.06] bg-[#0a0a18] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.06]">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Block Library</span>
              <button onClick={() => setShowBlockPanel(false)} className="text-zinc-500 hover:text-zinc-200 text-xs">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {getBlockNames(blockLibrary).map((name) => (
                <div key={name}
                  className="flex items-center gap-1 px-2 py-1.5 text-[10px] border-b border-white/[0.03] text-zinc-400 hover:bg-white/[0.04] cursor-pointer"
                  onClick={() => {
                    processInput(`INSERT`);
                    setTimeout(() => processInput(name), 50);
                  }}
                >
                  <span className="text-pink-400">◆</span>
                  <span className="flex-1 truncate">{name}</span>
                  <span className="text-zinc-600 text-[8px]">{blockLibrary.blocks[name]?.entities.length || 0} ent</span>
                </div>
              ))}
              {getBlockNames(blockLibrary).length === 0 && (
                <div className="px-2 py-3 text-[9px] text-zinc-600 text-center">
                  No blocks defined.<br/>Select objects, then use BLOCK command.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col relative overflow-hidden">
          <canvas
            ref={canvasRef}
            className="flex-1 w-full cursor-crosshair"
            style={{ display: "block" }}
            onMouseMove={handleCanvasMouseMove}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
            onWheel={handleCanvasWheel}
            onContextMenu={(e) => e.preventDefault()}
          />

          <div className="absolute bottom-0 left-0 right-0 bg-[#070710]/90 border-t border-white/[0.06] flex flex-col">
            <div
              className="h-24 overflow-y-auto px-2 py-1 text-[10px] leading-5 bg-[#050510]"
              style={{ fontFamily: "monospace" }}
            >
              {cmdHistory.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.type === "error"
                      ? "text-red-400"
                      : entry.type === "prompt"
                      ? "text-yellow-400"
                      : entry.type === "input"
                      ? "text-blue-400"
                      : "text-zinc-300"
                  }
                >
                  {entry.type === "input" ? `> ${entry.text}` : entry.text}
                </div>
              ))}
              <div ref={historyEndRef} />
            </div>

            <div className="flex items-center gap-2 px-2 py-1.5 border-t border-white/[0.06]">
              <span className="text-yellow-400 text-[10px] font-bold flex-shrink-0">
                {phase.state !== "idle"
                  ? `${phase.command}:`
                  : "Command:"}
              </span>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-zinc-100 text-[11px] focus:outline-none placeholder-zinc-700"
                placeholder={
                  phase.state !== "idle"
                    ? phase.prompt
                    : "Type command (LINE, CIRCLE, ARC, POLYLINE, RECTANGLE, ERASE, MOVE, COPY, ROTATE, SCALE, MIRROR, OFFSET, LAYER, TEXT, DIMLINEAR...)"
                }
              />
              <div className="text-[9px] text-zinc-600 flex-shrink-0 flex items-center gap-2">
                <span>X: {mouseWorldPos.x.toFixed(3)}</span>
                <span>Y: {mouseWorldPos.y.toFixed(3)}</span>
                <span>Z: {drawing.zoom.toFixed(2)}x</span>
                {drawing.orthoMode && <span className="text-amber-400">ORTHO</span>}
                {drawing.snapMode && <span className="text-green-400">SNAP</span>}
                {drawing.osnapEnabled && <span className="text-yellow-400">OSNAP</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPrintDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowPrintDialog(false)}>
          <div className="bg-[#12122a] border border-white/10 rounded-lg w-[500px] max-h-[80vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-200">Plot / Print Layout</h3>
              <button onClick={() => setShowPrintDialog(false)} className="text-zinc-500 hover:text-zinc-200 text-lg">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <label className="text-zinc-500 block mb-1">Paper Size</label>
                <select
                  value={printConfig.paperSize}
                  onChange={(e) => setPrintConfig((p) => ({ ...p, paperSize: e.target.value as any }))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-zinc-200"
                >
                  {Object.entries(PAPER_SIZES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-500 block mb-1">Orientation</label>
                <select
                  value={printConfig.orientation}
                  onChange={(e) => setPrintConfig((p) => ({ ...p, orientation: e.target.value as any }))}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-zinc-200"
                >
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </div>
              <div>
                <label className="text-zinc-500 block mb-1">Scale</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-zinc-400">
                    <input type="checkbox" checked={printConfig.scaleToFit} onChange={(e) => setPrintConfig((p) => ({ ...p, scaleToFit: e.target.checked }))} />
                    Scale to fit
                  </label>
                </div>
                {!printConfig.scaleToFit && (
                  <input type="number" value={printConfig.plotScale} step="0.1" min="0.01"
                    onChange={(e) => setPrintConfig((p) => ({ ...p, plotScale: parseFloat(e.target.value) || 1 }))}
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-zinc-200" />
                )}
              </div>
              <div>
                <label className="flex items-center gap-1 text-zinc-400 mb-1">
                  <input type="checkbox" checked={printConfig.titleBlock} onChange={(e) => setPrintConfig((p) => ({ ...p, titleBlock: e.target.checked }))} />
                  Title Block
                </label>
              </div>
            </div>

            {printConfig.titleBlock && (
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase mb-2">Title Block Data</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {(["title", "projectName", "company", "drawnBy", "checkedBy", "date", "scale", "sheetNumber", "revision"] as const).map((field) => (
                    <div key={field}>
                      <label className="text-zinc-600 block mb-0.5 capitalize">{field.replace(/([A-Z])/g, " $1")}</label>
                      <input
                        value={printConfig.titleBlockData[field]}
                        onChange={(e) => setPrintConfig((p) => ({
                          ...p,
                          titleBlockData: { ...p.titleBlockData, [field]: e.target.value },
                        }))}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-0.5 text-zinc-200 text-[10px]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPrintDialog(false)}
                className="px-3 py-1.5 text-[11px] rounded border border-white/10 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  exportToPDF(drawing.entities, drawing.layers, printConfig);
                  setShowPrintDialog(false);
                  addHistory("response", "PLOT: Generating print layout...");
                }}
                className="px-4 py-1.5 text-[11px] rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                Plot / Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
