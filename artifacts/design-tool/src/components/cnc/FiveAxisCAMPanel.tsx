import React, { useState, useMemo, useCallback } from "react";
import {
  computeWorkPlane,
  generate3Plus2Milling,
  generate5AxisSimultaneousRoughing,
  generate5AxisFinishing,
  generate5AxisSwarfCutting,
  getDefaultFiveAxisParams,
  type FiveAxisParams,
  type FiveAxisOperation,
  type ToolAxisStrategy,
  type FiveAxisOperationType,
} from "./FiveAxisToolpathEngine";
import {
  generateYAxisMilling,
  generateBAxisDrilling,
  generateCAxisPolarInterpolation,
  getDefaultMultiAxisTurningParams,
  getDefaultYAxisMillingParams,
  getDefaultBAxisDrillingParams,
  getDefaultCAxisPolarParams,
  type MultiAxisTurningOperation,
} from "./MultiAxisTurning";
import {
  postProcess,
  getDefaultPostProcessorConfig,
  getControllerDisplayName,
  type PostProcessorConfig,
  type PostProcessorType,
  type PostProcessorOutput,
} from "./FiveAxisPostProcessors";
import {
  runFiveAxisCollisionCheck,
  getDefaultToolAssembly,
  getDefaultPartBounds,
  type FiveAxisCollisionResult,
} from "./FiveAxisCollisionEngine";

type ActiveTab = "milling" | "turning" | "postproc" | "collision";

export function FiveAxisCAMPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("milling");
  const [millingType, setMillingType] = useState<FiveAxisOperationType>("3plus2_positional");
  const [params, setParams] = useState<FiveAxisParams>(getDefaultFiveAxisParams());
  const [aAngle, setAAngle] = useState(30);
  const [bAngle, setBAngle] = useState(0);
  const [surfaceWidth, setSurfaceWidth] = useState(100);
  const [surfaceHeight, setSurfaceHeight] = useState(100);
  const [curvature, setCurvature] = useState(15);
  const [wallHeight, setWallHeight] = useState(30);
  const [axisStrategy, setAxisStrategy] = useState<ToolAxisStrategy["type"]>("surface_normal");
  const [leadAngle, setLeadAngle] = useState(3);
  const [tiltAngle, setTiltAngle] = useState(0);

  const [turningOp, setTurningOp] = useState<"y_axis" | "b_axis" | "c_axis">("y_axis");

  const [postConfig, setPostConfig] = useState<PostProcessorConfig>(getDefaultPostProcessorConfig());
  const [generatedOp, setGeneratedOp] = useState<FiveAxisOperation | null>(null);
  const [generatedTurningOp, setGeneratedTurningOp] = useState<MultiAxisTurningOperation | null>(null);
  const [postOutput, setPostOutput] = useState<PostProcessorOutput | null>(null);
  const [collisionResult, setCollisionResult] = useState<FiveAxisCollisionResult | null>(null);

  const strategy: ToolAxisStrategy = useMemo(() => {
    switch (axisStrategy) {
      case "lead_tilt":
        return { type: "lead_tilt", leadAngleDeg: leadAngle, tiltAngleDeg: tiltAngle };
      case "toward_point":
        return { type: "toward_point", guidePoint: { x: 0, y: 0, z: -50 } };
      case "away_from_point":
        return { type: "away_from_point", guidePoint: { x: 0, y: 0, z: 0 } };
      case "toward_line":
        return { type: "toward_line", guideLine: { start: { x: 0, y: 0, z: -100 }, end: { x: 0, y: 0, z: 100 } } };
      case "away_from_line":
        return { type: "away_from_line", guideLine: { start: { x: 0, y: 0, z: -100 }, end: { x: 0, y: 0, z: 100 } } };
      default:
        return { type: "surface_normal" };
    }
  }, [axisStrategy, leadAngle, tiltAngle]);

  const handleGenerateMilling = useCallback(() => {
    let op: FiveAxisOperation;
    switch (millingType) {
      case "3plus2_positional": {
        const wp = computeWorkPlane(aAngle, bAngle, { x: 0, y: 0, z: 0 });
        op = generate3Plus2Milling(wp, params, surfaceWidth, surfaceHeight, 10);
        break;
      }
      case "5axis_roughing":
      case "5axis_multiaxis_rough":
        op = generate5AxisSimultaneousRoughing(params, strategy, surfaceWidth, surfaceHeight, curvature, 10);
        break;
      case "5axis_finishing":
      case "5axis_flowline":
        op = generate5AxisFinishing(params, strategy, surfaceWidth, surfaceHeight, curvature);
        break;
      case "5axis_swarf":
        op = generate5AxisSwarfCutting(params, wallHeight, [], []);
        break;
      default:
        op = generate5AxisFinishing(params, strategy, surfaceWidth, surfaceHeight, curvature);
    }
    setGeneratedOp(op);
    setPostOutput(null);
    setCollisionResult(null);
  }, [millingType, params, aAngle, bAngle, surfaceWidth, surfaceHeight, curvature, wallHeight, strategy]);

  const handleGenerateTurning = useCallback(() => {
    const turningParams = getDefaultMultiAxisTurningParams();
    let top: MultiAxisTurningOperation;
    switch (turningOp) {
      case "y_axis":
        top = generateYAxisMilling(turningParams, getDefaultYAxisMillingParams());
        break;
      case "b_axis":
        top = generateBAxisDrilling(turningParams, getDefaultBAxisDrillingParams());
        break;
      case "c_axis":
        top = generateCAxisPolarInterpolation(turningParams, getDefaultCAxisPolarParams());
        break;
      default:
        top = generateYAxisMilling(turningParams, getDefaultYAxisMillingParams());
    }
    setGeneratedTurningOp(top);
  }, [turningOp]);

  const handlePostProcess = useCallback(() => {
    if (!generatedOp) return;
    const output = postProcess(generatedOp, postConfig);
    setPostOutput(output);
  }, [generatedOp, postConfig]);

  const handleCollisionCheck = useCallback(() => {
    if (!generatedOp) return;
    const tool = getDefaultToolAssembly();
    tool.cutterDiameter = params.toolDiameter;
    tool.cornerRadius = params.cornerRadius;
    const partBounds = getDefaultPartBounds();
    const result = runFiveAxisCollisionCheck(generatedOp, tool, partBounds, []);
    setCollisionResult(result);
  }, [generatedOp, params]);

  const handleDownload = useCallback(() => {
    const content = postOutput?.gcode ?? generatedTurningOp?.gcode?.join("\n") ?? "";
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${postOutput?.programName ?? "multi_axis"}.nc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [postOutput, generatedTurningOp]);

  const updateParam = (key: keyof FiveAxisParams, val: number) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0c0c14]">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.06] flex-shrink-0">
        {(["milling", "turning", "postproc", "collision"] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              activeTab === tab
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "milling" ? "5-Axis Mill" :
             tab === "turning" ? "Multi-Axis Turn" :
             tab === "postproc" ? "Post Proc" : "Collision"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {activeTab === "milling" && (
          <>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1 font-medium">Operation Type</label>
              <select
                value={millingType}
                onChange={e => setMillingType(e.target.value as FiveAxisOperationType)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1.5"
              >
                <option value="3plus2_positional">3+2 Positional Milling</option>
                <option value="5axis_multiaxis_rough">5-Axis Simultaneous Roughing</option>
                <option value="5axis_finishing">5-Axis Flow-Line Finishing</option>
                <option value="5axis_swarf">5-Axis Swarf Cutting</option>
              </select>
            </div>

            {millingType === "3plus2_positional" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-0.5">A Angle (°)</label>
                  <input type="number" value={aAngle} onChange={e => setAAngle(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-0.5">B Angle (°)</label>
                  <input type="number" value={bAngle} onChange={e => setBAngle(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                </div>
              </div>
            )}

            {millingType !== "3plus2_positional" && millingType !== "5axis_swarf" && (
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1 font-medium">Tool Axis Control</label>
                <select
                  value={axisStrategy}
                  onChange={e => setAxisStrategy(e.target.value as ToolAxisStrategy["type"])}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1.5"
                >
                  <option value="surface_normal">Surface Normal</option>
                  <option value="lead_tilt">Lead / Tilt Angles</option>
                  <option value="toward_point">Toward Point</option>
                  <option value="away_from_point">Away From Point</option>
                  <option value="toward_line">Toward Line</option>
                  <option value="away_from_line">Away From Line</option>
                </select>

                {axisStrategy === "lead_tilt" && (
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">Lead (°)</label>
                      <input type="number" value={leadAngle} onChange={e => setLeadAngle(parseFloat(e.target.value) || 0)}
                        min={0} max={30} step={0.5}
                        className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">Tilt (°)</label>
                      <input type="number" value={tiltAngle} onChange={e => setTiltAngle(parseFloat(e.target.value) || 0)}
                        min={-30} max={30} step={0.5}
                        className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Tool Ø (mm)</label>
                <input type="number" value={params.toolDiameter} onChange={e => updateParam("toolDiameter", parseFloat(e.target.value) || 10)}
                  min={1} max={50} step={0.5}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Corner R (mm)</label>
                <input type="number" value={params.cornerRadius} onChange={e => updateParam("cornerRadius", parseFloat(e.target.value) || 0)}
                  min={0} max={25} step={0.5}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Feed (mm/min)</label>
                <input type="number" value={params.feedRate} onChange={e => updateParam("feedRate", parseFloat(e.target.value) || 2000)}
                  min={100} max={20000} step={100}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">RPM</label>
                <input type="number" value={params.spindleRpm} onChange={e => updateParam("spindleRpm", parseFloat(e.target.value) || 12000)}
                  min={100} max={40000} step={500}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Stepover (mm)</label>
                <input type="number" value={params.stepover} onChange={e => updateParam("stepover", parseFloat(e.target.value) || 3)}
                  min={0.1} max={25} step={0.1}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Stepdown (mm)</label>
                <input type="number" value={params.stepdown} onChange={e => updateParam("stepdown", parseFloat(e.target.value) || 2)}
                  min={0.1} max={10} step={0.1}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
              </div>
            </div>

            {millingType !== "3plus2_positional" && millingType !== "5axis_swarf" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-0.5">Surface W (mm)</label>
                  <input type="number" value={surfaceWidth} onChange={e => setSurfaceWidth(parseFloat(e.target.value) || 100)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-0.5">Surface H (mm)</label>
                  <input type="number" value={surfaceHeight} onChange={e => setSurfaceHeight(parseFloat(e.target.value) || 100)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-0.5">Curvature (mm)</label>
                  <input type="number" value={curvature} onChange={e => setCurvature(parseFloat(e.target.value) || 15)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                </div>
              </div>
            )}

            {millingType === "5axis_swarf" && (
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Wall Height (mm)</label>
                <input type="number" value={wallHeight} onChange={e => setWallHeight(parseFloat(e.target.value) || 30)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
              </div>
            )}

            <button
              onClick={handleGenerateMilling}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold py-2 rounded transition-colors"
            >
              Generate 5-Axis Toolpath
            </button>

            {generatedOp && (
              <div className="bg-zinc-900/50 border border-zinc-700/50 rounded p-2 space-y-1">
                <div className="text-[10px] text-violet-300 font-semibold">{generatedOp.operationName}</div>
                <div className="text-[9px] text-zinc-400">
                  Moves: {generatedOp.moves.length} ({generatedOp.moves.filter(m => m.type === "cut").length} cuts)
                </div>
                <div className="text-[9px] text-zinc-400">
                  Est. Cycle: {(generatedOp.estimatedCycleTimeSec / 60).toFixed(1)} min
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "turning" && (
          <>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1 font-medium">Operation</label>
              <select
                value={turningOp}
                onChange={e => setTurningOp(e.target.value as "y_axis" | "b_axis" | "c_axis")}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1.5"
              >
                <option value="y_axis">Y-Axis Cross Milling</option>
                <option value="b_axis">B-Axis Angled Drilling</option>
                <option value="c_axis">C-Axis Polar Interpolation</option>
              </select>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800 rounded p-2">
              <div className="text-[9px] text-zinc-500 mb-1">
                {turningOp === "y_axis" && "Cross-milling flats, slots, and features on turned parts using the Y-axis of a mill-turn center."}
                {turningOp === "b_axis" && "Angled hole drilling using the B-axis tilting spindle with peck cycle."}
                {turningOp === "c_axis" && "Polar interpolation for milling holes, slots, and pockets on the face of turned parts using C-axis rotation."}
              </div>
            </div>

            <button
              onClick={handleGenerateTurning}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold py-2 rounded transition-colors"
            >
              Generate Multi-Axis Turning
            </button>

            {generatedTurningOp && (
              <div className="bg-zinc-900/50 border border-zinc-700/50 rounded p-2 space-y-1">
                <div className="text-[10px] text-orange-300 font-semibold">{generatedTurningOp.name}</div>
                <div className="text-[9px] text-zinc-400">
                  Moves: {generatedTurningOp.moves.length} | Cycle: {(generatedTurningOp.estimatedCycleTimeSec / 60).toFixed(1)} min
                </div>
                <div className="text-[9px] text-zinc-400">
                  G-code: {generatedTurningOp.gcode.length} lines
                </div>
                <button
                  onClick={handleDownload}
                  className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-[10px] py-1 rounded mt-1"
                >
                  Download NC
                </button>
                <details className="mt-1">
                  <summary className="text-[9px] text-zinc-500 cursor-pointer">Preview G-code</summary>
                  <pre className="text-[8px] text-green-400 bg-black/50 p-1.5 rounded mt-1 max-h-40 overflow-auto font-mono whitespace-pre">
                    {generatedTurningOp.gcode.slice(0, 40).join("\n")}
                    {generatedTurningOp.gcode.length > 40 ? `\n... (${generatedTurningOp.gcode.length - 40} more lines)` : ""}
                  </pre>
                </details>
              </div>
            )}
          </>
        )}

        {activeTab === "postproc" && (
          <>
            {!generatedOp && (
              <div className="text-[10px] text-zinc-600 text-center py-4">
                Generate a 5-axis milling operation first.
              </div>
            )}

            {generatedOp && (
              <>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1 font-medium">Controller</label>
                  <select
                    value={postConfig.type}
                    onChange={e => setPostConfig(prev => ({ ...prev, type: e.target.value as PostProcessorType }))}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1.5"
                  >
                    <option value="siemens_840d">{getControllerDisplayName("siemens_840d")}</option>
                    <option value="fanuc_30i">{getControllerDisplayName("fanuc_30i")}</option>
                    <option value="heidenhain_tnc">{getControllerDisplayName("heidenhain_tnc")}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Program Name</label>
                    <input type="text" value={postConfig.programName}
                      onChange={e => setPostConfig(prev => ({ ...prev, programName: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Program #</label>
                    <input type="number" value={postConfig.programNumber}
                      onChange={e => setPostConfig(prev => ({ ...prev, programNumber: parseInt(e.target.value) || 1001 }))}
                      className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Rotary Axes</label>
                    <select value={postConfig.rotaryAxisConfig}
                      onChange={e => setPostConfig(prev => ({ ...prev, rotaryAxisConfig: e.target.value as "ab" | "ac" | "bc" }))}
                      className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1">
                      <option value="ab">A/B</option>
                      <option value="ac">A/C</option>
                      <option value="bc">B/C</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Coolant</label>
                    <select value={postConfig.coolantType}
                      onChange={e => setPostConfig(prev => ({ ...prev, coolantType: e.target.value as PostProcessorConfig["coolantType"] }))}
                      className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] rounded px-2 py-1">
                      <option value="flood">Flood</option>
                      <option value="mist">Mist</option>
                      <option value="through_spindle">Through Spindle</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <input type="checkbox" checked={postConfig.tcpmEnabled}
                      onChange={e => setPostConfig(prev => ({ ...prev, tcpmEnabled: e.target.checked }))}
                      className="w-3 h-3 accent-violet-500" />
                    TCPM/RTCP
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <input type="checkbox" checked={postConfig.safetyBlock}
                      onChange={e => setPostConfig(prev => ({ ...prev, safetyBlock: e.target.checked }))}
                      className="w-3 h-3 accent-violet-500" />
                    Safety Block
                  </label>
                </div>

                <button
                  onClick={handlePostProcess}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold py-2 rounded transition-colors"
                >
                  Post-Process ({getControllerDisplayName(postConfig.type)})
                </button>

                {postOutput && (
                  <div className="bg-zinc-900/50 border border-zinc-700/50 rounded p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-blue-300 font-semibold">{postOutput.programName}</div>
                      <button onClick={handleDownload}
                        className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-[9px] px-2 py-0.5 rounded">
                        Download .NC
                      </button>
                    </div>
                    <div className="text-[9px] text-zinc-400">
                      {postOutput.lineCount} lines | {getControllerDisplayName(postOutput.controller)}
                    </div>
                    {postOutput.warnings.length > 0 && (
                      <div className="space-y-0.5">
                        {postOutput.warnings.map((w, i) => (
                          <div key={i} className="text-[9px] text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded">
                            {w}
                          </div>
                        ))}
                      </div>
                    )}
                    <details className="mt-1">
                      <summary className="text-[9px] text-zinc-500 cursor-pointer">Preview G-code</summary>
                      <pre className="text-[8px] text-green-400 bg-black/50 p-1.5 rounded mt-1 max-h-48 overflow-auto font-mono whitespace-pre">
                        {postOutput.gcode.split("\n").slice(0, 50).join("\n")}
                        {postOutput.gcode.split("\n").length > 50 ? `\n... (${postOutput.gcode.split("\n").length - 50} more lines)` : ""}
                      </pre>
                    </details>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "collision" && (
          <>
            {!generatedOp && (
              <div className="text-[10px] text-zinc-600 text-center py-4">
                Generate a 5-axis milling operation first.
              </div>
            )}

            {generatedOp && (
              <>
                <div className="bg-zinc-900/30 border border-zinc-800 rounded p-2 text-[9px] text-zinc-500">
                  Checks tool holder, shank, and cutter against part geometry and fixtures at every toolpath point.
                  Also verifies rotary axis travel limits.
                </div>

                <button
                  onClick={handleCollisionCheck}
                  className="w-full bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold py-2 rounded transition-colors"
                >
                  Run Collision Check
                </button>

                {collisionResult && (
                  <div className="bg-zinc-900/50 border border-zinc-700/50 rounded p-2 space-y-1.5">
                    <div className={`text-[11px] font-bold ${
                      collisionResult.overallStatus === "safe" ? "text-green-400" :
                      collisionResult.overallStatus === "warning" ? "text-amber-400" : "text-red-400"
                    }`}>
                      {collisionResult.overallStatus === "safe" ? "SAFE" :
                       collisionResult.overallStatus === "warning" ? "WARNING" : "CRITICAL"}
                    </div>
                    <div className="text-[9px] text-zinc-400">{collisionResult.summary}</div>
                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      <div className="text-zinc-500">Total Moves:</div>
                      <div className="text-zinc-300">{collisionResult.totalMoves}</div>
                      <div className="text-zinc-500">Checked:</div>
                      <div className="text-zinc-300">{collisionResult.checkedMoves}</div>
                      <div className="text-zinc-500">Gouges:</div>
                      <div className={collisionResult.gougeCount > 0 ? "text-red-400" : "text-green-400"}>
                        {collisionResult.gougeCount}
                      </div>
                      <div className="text-zinc-500">Holder Hits:</div>
                      <div className={collisionResult.holderCollisionCount > 0 ? "text-red-400" : "text-green-400"}>
                        {collisionResult.holderCollisionCount}
                      </div>
                      <div className="text-zinc-500">Fixture Hits:</div>
                      <div className={collisionResult.fixtureCollisionCount > 0 ? "text-amber-400" : "text-green-400"}>
                        {collisionResult.fixtureCollisionCount}
                      </div>
                      <div className="text-zinc-500">Axis Limits:</div>
                      <div className={collisionResult.axisLimitViolations > 0 ? "text-amber-400" : "text-green-400"}>
                        {collisionResult.axisLimitViolations}
                      </div>
                      <div className="text-zinc-500">Min Clearance:</div>
                      <div className="text-zinc-300">{collisionResult.minClearance.toFixed(2)}mm</div>
                    </div>

                    {collisionResult.collisionZones.length > 0 && (
                      <details>
                        <summary className="text-[9px] text-zinc-500 cursor-pointer">
                          {collisionResult.collisionZones.length} collision zone(s)
                        </summary>
                        <div className="space-y-1 mt-1">
                          {collisionResult.collisionZones.slice(0, 10).map((zone, i) => (
                            <div key={i} className={`text-[8px] px-1.5 py-0.5 rounded ${
                              zone.severity === "gouge" ? "text-red-300 bg-red-900/20" :
                              zone.severity === "holder_collision" || zone.severity === "shank_collision" ? "text-red-300 bg-red-900/20" :
                              "text-amber-300 bg-amber-900/20"
                            }`}>
                              {zone.description}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
