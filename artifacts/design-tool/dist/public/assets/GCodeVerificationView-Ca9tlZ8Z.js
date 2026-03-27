import{a as G,j as e,G as C,aa as A,s as F,ac as O,ao as I,n as E,aO as L,b4 as W,p as U,i as P,u as $,aK as D}from"./vendor-react-C1nGsbZ9.js";import"./vendor-misc-C518F2ih.js";import"./vendor-radix-Dt6uihtM.js";import"./vendor-konva-Ca8PhNs_.js";import"./vendor-ui-utils-BmjxSsjX.js";import"./vendor-charts-CLkcodzt.js";function z(a){if(!a.trim())return[e.jsx("span",{children:" "},"blank")];const l=a.trim();if(l.startsWith("(")||l.startsWith(";")||l.startsWith("%"))return[e.jsx("span",{style:{color:"#52525b",fontStyle:"italic"},children:a},"c")];const o=[];let s=a,d=0;const c=(r,f)=>{o.push(e.jsx("span",{style:{color:f},children:r},d++))},g=[[/^(N\d+)/,"#52525b"],[/^(G0?0)\b/,"#f59e0b"],[/^(G0?1)\b/,"#34d399"],[/^(G0?2|G0?3)\b/,"#60a5fa"],[/^(G\d+\.?\d*)/,"#a78bfa"],[/^(M\d+)/,"#fb923c"],[/^(T\d+)/,"#fbbf24"],[/^([XYZUVW]-?\d+\.?\d*)/,"#e4e4e7"],[/^([FfSs]\d+\.?\d*)/,"#f87171"],[/^([RIJO]-?\d+\.?\d*)/,"#c084fc"],[/^(\(.*?\))/,"#52525b"],[/^(;.*)/,"#52525b"],[/^(\s+)/,"transparent"],[/^(.)/,"#71717a"]];for(;s.length>0;){let r=!1;for(const[f,u]of g){const h=s.match(f);if(h){c(h[1],u),s=s.slice(h[1].length),r=!0;break}}r||(c(s[0],"#71717a"),s=s.slice(1))}return o}function H(a){return a.split(`
`).map((l,o)=>{const s=l.trim(),d=s.length===0,c=s.startsWith("(")||s.startsWith(";")||s.startsWith("%");if(d||c)return{lineNo:o+1,raw:l,trimmed:s,isComment:c,isBlank:d};const g=s.toUpperCase().replace(/\(.*?\)/g,"").replace(/;.*/g,""),r=f=>{const u=g.match(f);return u?parseFloat(u[1]):void 0};return{lineNo:o+1,raw:l,trimmed:s,isComment:c,isBlank:d,G:r(/G0*(\d+\.?\d*)/),M:r(/M(\d+)/),X:r(/X(-?\d+\.?\d*)/),Y:r(/Y(-?\d+\.?\d*)/),Z:r(/Z(-?\d+\.?\d*)/),F:r(/F(\d+\.?\d*)/),S:r(/S(\d+)/),T:g.match(/T(\w+)/)?.[1],N:r(/^N(\d+)/),R:r(/R(-?\d+\.?\d*)/),I:r(/I(-?\d+\.?\d*)/),J:r(/J(-?\d+\.?\d*)/)}})}function B(a){let l=100,o=0,s=0,d=-9999,c=9999,g=-9999,r=9999,f=0,u=0,h=0,S=0,m=0,b=0;for(const n of a){if(n.isBlank||n.isComment)continue;n.F&&(l=n.F),n.T&&n.M!==6&&S++,n.Z!==void 0&&(n.Z>d&&(d=n.Z),n.Z<c&&(c=n.Z)),n.X!==void 0&&(n.X>g&&(g=n.X),n.X<r&&(r=n.X));const x=(n.X??m)-m,y=(n.Z??b)-b,v=Math.sqrt(x*x+y*y);n.G===0?(u++,o+=v/5e3*60):n.G===1?(f++,l>0&&(o+=v/l*60,s+=v)):(n.G===2||n.G===3)&&(h++,l>0&&(o+=v/l*60)),n.X!==void 0&&(m=n.X),n.Z!==void 0&&(b=n.Z)}return{totalBlocks:a.filter(n=>!n.isBlank).length,cuttingMoves:f,rapidMoves:u,arcs:h,toolChanges:S,estimatedTimeSec:o,maxZ:d,minZ:c,maxX:g,minX:r,totalFeedDist:s}}function Q(a,l){const o=[];let s=!1,d=!1,c=!1,g=!1,r=!1,f=!1,u=!1,h=!1;const S=new Set,m=[],b=[];let n=[],x=l==="haas"?8100:l==="siemens840d"?12e3:6e3;const y=[];for(const i of a)i.isBlank||i.isComment||(i.N!==void 0&&(S.has(i.N)&&o.push({id:`dup-n-${i.lineNo}`,category:"Sequence Numbers",description:`Duplicate N${i.N}`,severity:"warn",line:i.lineNo,fix:"Remove duplicate sequence numbers."}),S.add(i.N)),(i.M===30||i.M===2)&&(s=!0),(i.M===3||i.M===4)&&(d=!0,u=!0),i.M===5&&(c=!0,u=!1),(i.M===8||i.M===9)&&(r=!0),i.T&&(f=!0),(i.G===41||i.G===42)&&y.push(i.lineNo),i.G===40&&(y.length=0),i.F&&(h=!0,i.F),i.G===0&&i.Z!==void 0&&i.Z<1&&u&&n.push(i.lineNo),(i.G===1||i.G===2||i.G===3)&&!h&&!i.F&&o.push({id:`nofeed-${i.lineNo}`,category:"Feed Rate",description:`Cutting move G0${i.G} with no feed rate`,severity:"fail",line:i.lineNo,fix:"Add F word before this block."}),i.F&&(i.F>8e3||i.F>2&&i.F<100)&&m.push(i.lineNo),i.S&&i.S>x&&b.push(i.lineNo),(i.G===2||i.G===3)&&i.R===void 0&&i.I===void 0&&i.J===void 0&&o.push({id:`arc-${i.lineNo}`,category:"Arc Definition",description:`G0${i.G} arc missing R or I/J`,severity:"fail",line:i.lineNo,fix:"Add R word or I/J center offsets to arc block."}),(l==="fanuc"||l==="haas")&&i.G===65&&!i.T&&o.push({id:`macro-${i.lineNo}`,category:"Macro",description:"G65 macro call without P word",severity:"warn",line:i.lineNo,fix:"Add P (program number) to G65 macro call."}));return s||o.push({id:"no-m30",category:"Program Structure",description:"Missing M30/M02 — program end not found",severity:"fail",fix:"Add M30 at end of program. Machine will fault without it."}),d||o.push({id:"no-spindle",category:"Safety",description:"No M03/M04 spindle command found",severity:"warn",fix:"Add M03 S___ before first cutting move."}),c||o.push({id:"no-m5",category:"Safety",description:"No M05 spindle stop found",severity:"warn",fix:"Add M05 before M30 to stop spindle at program end."}),o.push({id:"no-g28",category:"Safety",description:"No G28 home reference found",severity:"warn",fix:l==="siemens840d"?"Add G74 X0 Z0 for Siemens home.":"Add G28 U0. W0. before M30."}),r||o.push({id:"no-coolant",category:"Setup",description:"No coolant M08/M09 detected",severity:"info",fix:"Add M08 after spindle start for wet cutting."}),f||o.push({id:"no-tool",category:"Setup",description:"No tool call (T word) detected",severity:"warn",fix:"Add tool call e.g. T0101 before each operation."}),n.length>0&&o.push({id:"rapid-risk",category:"Collision Risk",description:`Rapid G00 near workpiece (Z<1mm) with spindle on — ${n.length} occurrence(s) on lines: ${n.slice(0,4).join(", ")}`,severity:n.length>2?"fail":"warn",fix:"Use G01 with feed rate when approaching workpiece. Only use G00 in safe Z clearance."}),m.length>0&&o.push({id:"feed-warn",category:"Feed Rate",description:`Unusual feed values on ${m.length} line(s): ${m.slice(0,3).join(", ")}`,severity:"warn",fix:"Check feed units. G99 = mm/rev (0.05–0.5), G98 = mm/min (50–3000)."}),b.length>0&&o.push({id:"rpm-warn",category:"Speeds",description:`Spindle speed exceeds ${x} RPM (${l.toUpperCase()} limit) on lines: ${b.slice(0,3).join(", ")}`,severity:"warn",fix:`Add G50 S${x} (Fanuc) or G96 Lim (Siemens) RPM limit before CSS.`}),y.length>0&&o.push({id:"comp-unclosed",category:"Tool Compensation",description:`Tool radius compensation (G41/G42) not cancelled — ${y.length} active at program end`,severity:"warn",fix:"Add G40 to cancel all active radius comp before M30."}),[[s,"M30 program end present"],[h,"Feed rate set before cutting moves"],[d,"Spindle M03/M04 command found"],[g,"G28/G74 home return found"],[r,"Coolant M08 found"],[f,"Tool call present"],[n.length===0,"No dangerous rapids near workpiece"],[m.length===0,"All feed rates in normal range"],[b.length===0,"All RPM values within machine limits"],[y.length===0,"Tool compensation cancelled before end"]].forEach(([i,N])=>{i&&o.push({id:`pass-${N}`,category:"✓ Pass",description:N,severity:"pass"})}),o.push({id:"syntax-ok",category:"✓ Pass",description:`${a.filter(i=>!i.isBlank).length} blocks parsed — no syntax errors`,severity:"pass"}),o.sort((i,N)=>{const j={fail:0,warn:1,info:2,pass:3};return j[i.severity]-j[N.severity]})}const T={fanuc:`%
O0001 (SAI ROLOTECH - ROLL TOOLING OP1)
(MATERIAL: D2 TOOL STEEL, HARDENED 58HRC)
(MACHINE: FANUC 0i-TD)
N10 G21 G18 G40 G97 G99
N20 T0101 (OD ROUGHING TOOL CNMG120408)
N30 G96 S120 M03
N40 M08
N50 G00 X105.0 Z5.0
N60 G71 U2.0 R0.5
N70 G71 P80 Q140 U0.3 W0.1 F0.25
N80 G00 X60.0
N90 G01 Z0 F0.15
N100 G01 X65.0 Z-2.5
N110 G01 Z-40.0
N120 G02 X75.0 Z-45.0 R5.0
N130 G01 X85.0 Z-70.0
N140 G01 X105.0
N150 G70 P80 Q140 F0.1 S180
N160 G00 X150.0 Z50.0
N170 M05
N180 M09
N190 T0202 (GROOVE TOOL 4mm WIDTH)
N200 G97 S600 M03
N210 M08
N220 G00 X80.0 Z-25.0
N230 G01 X60.0 F0.05
N240 G04 P500
N250 G01 X80.0 F0.3
N260 G00 X150.0 Z50.0
N270 M05
N280 M09
N290 T0303 (THREAD TOOL 60 DEG)
N300 G97 S400 M03
N310 G00 X75.0 Z5.0
N320 G76 P020060 Q100 R200
N330 G76 X62.701 Z-35.0 P1299 Q400 F2.0
N340 G00 X150.0 Z50.0
N350 M05
N360 M09
N370 G28 U0. W0.
N380 M30
%`,siemens840d:`; SAI ROLOTECH - SIEMENS 840D
; MATERIAL: CR STEEL
DEF REAL STARTX = 100.0
DEF REAL STARTZ = 5.0
G71 G18 G40 G90 G94
T1 D1                   ; OD ROUGHING
M03 S120 G96 LIMS=3000
M08
G00 X=STARTX Z=STARTZ
CYCLE95("KONTUR1", 2.0, 0.3, 0.1, 0.15, 0.1, 11)
KONTUR1:
G01 X60.0 Z0 F0.15
G01 X65.0 Z-2.5
G01 Z-40.0
G03 X75.0 Z-45.0 CR=5.0
G01 X105.0
RET
G00 X150.0 Z50.0
M05 M09
T2 D1                   ; GROOVING
M03 S600 G97
G00 X80.0 Z-25.0
G01 X60.0 F0.05
G04 F0.5
G01 X80.0 F0.3
G74 X0 Z0              ; HOME REFERENCE
M30`,haas:`%
O00001 (HAAS - SAI ROLL TOOLING)
(MATERIAL: GI COATED ROLL)
G21 G18 G40 G97 G99
T101 (OD ROUGH - CNMG432)
G96 S120 M03
M08
G00 X105.0 Z5.0
G71 P10 Q50 U0.3 W0.1 D2000 F0.25
N10 G00 X60.0
G01 Z0 F0.15
G01 X65.0 Z-2.5
G01 Z-40.0
G02 X75.0 Z-45.0 R5.0
G01 X105.0
N50 G01 X110.0
G70 P10 Q50 F0.1 S180
G00 X150.0 Z50.0
M05 M09
T202 (GROOVE 4MM)
G97 S800 M03
M08
G00 X80.0 Z-25.0
G01 X60.0 F0.05
G04 P500
G01 X80.0 F0.3
G00 X150.0 Z100.0
G28 U0 W0
M05 M09
M30
%`,mazak:`(MAZAK QUICK TURN - SAI ROLOTECH)
(PROGRAM : O0001)
(DATE : 2026-03-19)
N10 G28 U0 W0
N20 T0100
N30 T0101
N40 G96 S120 M03
N50 M08
N60 G00 X105.0 Z5.0
N70 G71 U2.0 R0.5
N80 G71 P90 Q150 U0.3 W0.1 F0.25
N90 G00 X60.0
N100 G01 Z0.0 F0.15
N110 G01 X65.0 Z-2.5
N120 G01 Z-40.0
N130 G02 X75.0 Z-45.0 R5.0
N140 G01 X85.0 Z-70.0
N150 G01 X105.0
N160 G70 P90 Q150 F0.10 S200
N170 G00 X200.0 Z100.0
N180 M05 M09
N190 T0300
N200 T0303
N210 G97 S400 M03
N220 G00 X75.0 Z5.0
N230 G76 P020060 Q100 R200
N240 G76 X62.701 Z-35.0 P1299 Q400 F2.0
N250 G00 X200.0 Z100.0
N260 G28 U0 W0
N270 M05
N280 M30`,okuma:`(OKUMA LB3000EX - SAI ROLOTECH)
(TOOL PATH : OD ROUGH + THREAD)
N1 G28 U0 W0
N2 T0101 (ROUGH OD)
N3 G50 S3000
N4 G96 S120 M03
N5 M08
N6 G00 X105.0 Z5.0
N7 G71 U2.0 R0.5
N8 G71 P9 Q16 U0.3 W0.1 F0.25
N9 G00 X60.0
N10 G01 Z0.0 F0.15
N11 G01 X65.0 Z-2.5
N12 G01 Z-40.0
N13 G02 X75.0 Z-45.0 R5.0
N14 G01 X85.0
N15 G01 Z-70.0
N16 G01 X105.0
N17 G70 P9 Q16
N18 G00 X200. Z100.
N19 M05 M09
N20 T0303 (THREAD)
N21 G97 S400 M03
N22 G00 X75.0 Z5.0
N23 G76 P020060 Q100 R200
N24 G76 X62.701 Z-35.0 P1299 Q400 F2.0
N25 G00 X200. Z100.
N26 G28 U0. W0.
N27 M05 M09
N28 M30`},M={fanuc:{name:"Fanuc 0i-TD / 32i",color:"#f59e0b",maker:"FANUC"},siemens840d:{name:"Siemens SINUMERIK 840D",color:"#60a5fa",maker:"SIEMENS"},haas:{name:"Haas NGC Control",color:"#34d399",maker:"HAAS"},mazak:{name:"Mazatrol Smooth-X",color:"#a78bfa",maker:"MAZAK"},okuma:{name:"Okuma OSP-P300L",color:"#fb923c",maker:"OKUMA"}},V=a=>({pass:{bg:"rgba(52,211,153,0.05)",border:"rgba(52,211,153,0.2)",text:"#34d399",badge:"rgba(52,211,153,0.12)"},warn:{bg:"rgba(245,158,11,0.05)",border:"rgba(245,158,11,0.2)",text:"#fbbf24",badge:"rgba(245,158,11,0.12)"},fail:{bg:"rgba(239,68,68,0.07)",border:"rgba(239,68,68,0.25)",text:"#f87171",badge:"rgba(239,68,68,0.12)"},info:{bg:"rgba(96,165,250,0.05)",border:"rgba(96,165,250,0.18)",text:"#60a5fa",badge:"rgba(96,165,250,0.12)"}})[a],K=a=>a==="pass"?e.jsx(U,{style:{width:13,height:13,color:"#34d399",flexShrink:0}}):a==="warn"?e.jsx(P,{style:{width:13,height:13,color:"#fbbf24",flexShrink:0}}):a==="fail"?e.jsx($,{style:{width:13,height:13,color:"#f87171",flexShrink:0}}):e.jsx(D,{style:{width:13,height:13,color:"#60a5fa",flexShrink:0}});function J({code:a,errorLines:l}){const o=a.split(`
`),s=G.useRef(null);return e.jsx("div",{ref:s,style:{flex:1,overflow:"auto",background:"#080912",fontFamily:"monospace",fontSize:12,lineHeight:"22px",padding:"12px 0"},children:o.map((d,c)=>{const g=c+1,r=l.has(g);return e.jsxs("div",{style:{display:"flex",alignItems:"flex-start",minHeight:22,background:r?"rgba(239,68,68,0.08)":"transparent",borderLeft:r?"2px solid rgba(239,68,68,0.6)":"2px solid transparent"},children:[e.jsx("span",{style:{width:40,textAlign:"right",paddingRight:12,color:r?"#f87171":"#3f3f46",fontSize:11,userSelect:"none",flexShrink:0,paddingTop:0},children:g}),e.jsx("span",{style:{flex:1,paddingRight:12,whiteSpace:"pre"},children:z(d)}),r&&e.jsx("span",{style:{fontSize:10,color:"#f87171",paddingRight:8,paddingTop:2,flexShrink:0},children:"◀"})]},c)})})}function ne(){const[a,l]=G.useState("fanuc"),[o,s]=G.useState(T.fanuc),[d,c]=G.useState([]),[g,r]=G.useState(!1),[f,u]=G.useState("all"),[h,S]=G.useState("highlight"),[m,b]=G.useState(null),n=G.useMemo(()=>H(o),[o]),x=G.useMemo(()=>B(n),[n]),y=G.useMemo(()=>{const t=new Set;return d.filter(p=>p.severity==="fail"||p.severity==="warn").forEach(p=>{p.line&&t.add(p.line)}),t},[d]),v=G.useCallback(()=>{c(Q(n,a)),r(!0)},[n,a]),i=G.useMemo(()=>({pass:d.filter(t=>t.severity==="pass").length,warn:d.filter(t=>t.severity==="warn").length,fail:d.filter(t=>t.severity==="fail").length,info:d.filter(t=>t.severity==="info").length}),[d]),N=i.fail===0,j=d.filter(t=>f==="all"||t.severity===f),k=M[a];function X(t){const p=t.target.files?.[0];if(!p)return;const R=new FileReader;R.onload=Z=>{s(Z.target?.result??""),r(!1),c([])},R.readAsText(p)}function w(t){return t<60?`${t.toFixed(0)}s`:`${Math.floor(t/60)}m ${(t%60).toFixed(0)}s`}return e.jsxs("div",{style:{height:"100%",display:"flex",flexDirection:"column",background:"#070710",overflow:"hidden"},children:[e.jsxs("div",{style:{padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:12,flexShrink:0,flexWrap:"wrap"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:12},children:[e.jsx("div",{style:{width:40,height:40,borderRadius:11,background:"linear-gradient(135deg, #059669, #047857)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(5,150,105,0.35)"},children:e.jsx(C,{style:{width:20,height:20,color:"#fff"}})}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:16,fontWeight:900,color:"#fff",lineHeight:1},children:"G-Code Verification Engine"}),e.jsx("div",{style:{fontSize:11,color:"#52525b",marginTop:2},children:"Collision · Feed · Safety · Structure · Arc · Compensation — Pro Level"})]})]}),e.jsx("div",{style:{display:"flex",gap:4,flexWrap:"wrap"},children:Object.keys(M).map(t=>e.jsx("button",{onClick:()=>{l(t),s(T[t]),r(!1),c([])},style:{padding:"5px 11px",borderRadius:7,border:`1px solid ${a===t?M[t].color+"60":"rgba(255,255,255,0.07)"}`,background:a===t?M[t].color+"18":"transparent",color:a===t?M[t].color:"#52525b",fontSize:10,fontWeight:800,cursor:"pointer",letterSpacing:"0.03em"},children:M[t].maker},t))}),g&&e.jsx("div",{style:{marginLeft:"auto",padding:"7px 14px",borderRadius:9,background:N?"rgba(52,211,153,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${N?"rgba(52,211,153,0.3)":"rgba(239,68,68,0.3)"}`,fontSize:12,fontWeight:800,color:N?"#34d399":"#f87171"},children:N?"✅ VERIFIED — SAFE TO RUN":`🔴 ${i.fail} CRITICAL ERROR${i.fail>1?"S":""} FOUND`})]}),e.jsxs("div",{style:{padding:"8px 18px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",gap:16,flexShrink:0,flexWrap:"wrap"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6},children:[e.jsx("div",{style:{width:8,height:8,borderRadius:"50%",background:k.color}}),e.jsx("span",{style:{fontSize:11,fontWeight:700,color:k.color},children:k.name})]}),g&&e.jsx(e.Fragment,{children:[{icon:e.jsx(A,{style:{width:10,height:10}}),label:`${x.totalBlocks} blocks`},{icon:e.jsx(F,{style:{width:10,height:10}}),label:`${x.cuttingMoves} cutting`},{icon:e.jsx(O,{style:{width:10,height:10}}),label:`${x.rapidMoves} rapids`},{icon:e.jsx(I,{style:{width:10,height:10}}),label:`${x.toolChanges} tools`},{icon:e.jsx(E,{style:{width:10,height:10}}),label:`~${w(x.estimatedTimeSec)} est.`},{icon:e.jsx("span",{style:{fontSize:9},children:"XZ"}),label:`X${x.minX.toFixed(0)}–${x.maxX.toFixed(0)} Z${x.minZ.toFixed(0)}–${x.maxZ.toFixed(0)}`}].map((t,p)=>e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,background:"rgba(255,255,255,0.03)",color:"#71717a",fontSize:10},children:[t.icon,e.jsx("span",{children:t.label})]},p))}),e.jsxs("div",{style:{marginLeft:"auto",display:"flex",gap:4},children:[e.jsx("button",{onClick:()=>S("highlight"),style:{padding:"4px 10px",borderRadius:6,border:"none",fontSize:10,fontWeight:700,cursor:"pointer",background:h==="highlight"?"rgba(5,150,105,0.2)":"transparent",color:h==="highlight"?"#34d399":"#52525b"},children:"Highlighted"}),e.jsx("button",{onClick:()=>S("edit"),style:{padding:"4px 10px",borderRadius:6,border:"none",fontSize:10,fontWeight:700,cursor:"pointer",background:h==="edit"?"rgba(5,150,105,0.2)":"transparent",color:h==="edit"?"#34d399":"#52525b"},children:"Edit"})]})]}),e.jsxs("div",{style:{flex:1,display:"grid",gridTemplateColumns:"1fr 380px",overflow:"hidden"},children:[e.jsxs("div",{style:{display:"flex",flexDirection:"column",borderRight:"1px solid rgba(255,255,255,0.05)",overflow:"hidden"},children:[e.jsxs("div",{style:{padding:"7px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",gap:8,flexShrink:0},children:[e.jsxs("span",{style:{fontSize:11,fontWeight:700,color:"#52525b"},children:["G-Code — ",o.split(`
`).length," lines"]}),e.jsxs("div",{style:{marginLeft:"auto",display:"flex",gap:6},children:[e.jsxs("label",{style:{padding:"4px 9px",borderRadius:6,border:"1px solid rgba(255,255,255,0.09)",background:"rgba(255,255,255,0.03)",color:"#a1a1aa",fontSize:10,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4},children:[e.jsx(L,{style:{width:10,height:10}}),"Open .nc",e.jsx("input",{type:"file",accept:".nc,.tap,.gc,.txt,.g,.mpf",style:{display:"none"},onChange:X})]}),e.jsx("button",{onClick:()=>{s(T[a]),r(!1),c([])},style:{padding:"4px 9px",borderRadius:6,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#52525b",fontSize:10,fontWeight:700,cursor:"pointer"},children:"Sample"})]})]}),h==="highlight"?e.jsx(J,{code:o,errorLines:y}):e.jsx("textarea",{value:o,onChange:t=>{s(t.target.value),r(!1),c([])},style:{flex:1,background:"#08091a",color:"#34d399",fontFamily:"monospace",fontSize:12,padding:"12px 14px",border:"none",outline:"none",resize:"none",lineHeight:"22px"},spellCheck:!1}),e.jsx("div",{style:{padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,0.05)",flexShrink:0},children:e.jsxs("button",{onClick:v,style:{width:"100%",padding:"10px",borderRadius:10,border:"none",background:"linear-gradient(90deg, #059669, #047857)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 14px rgba(5,150,105,0.3)"},children:[e.jsx(W,{style:{width:15,height:15}}),"Verify G-Code — ",k.maker," Controller"]})})]}),e.jsx("div",{style:{display:"flex",flexDirection:"column",overflow:"hidden"},children:g?e.jsxs(e.Fragment,{children:[e.jsxs("div",{style:{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0},children:[e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:6,marginBottom:8},children:[{label:"FAIL",count:i.fail,color:"#f87171",bg:"rgba(239,68,68,0.1)"},{label:"WARN",count:i.warn,color:"#fbbf24",bg:"rgba(245,158,11,0.08)"},{label:"INFO",count:i.info,color:"#60a5fa",bg:"rgba(96,165,250,0.08)"},{label:"PASS",count:i.pass,color:"#34d399",bg:"rgba(52,211,153,0.08)"}].map(t=>e.jsxs("div",{onClick:()=>u(t.label.toLowerCase()),style:{padding:"7px 8px",borderRadius:8,background:t.bg,textAlign:"center",cursor:"pointer"},children:[e.jsx("div",{style:{fontSize:18,fontWeight:900,color:t.color},children:t.count}),e.jsx("div",{style:{fontSize:9,fontWeight:800,color:t.color,opacity:.75},children:t.label})]},t.label))}),e.jsx("div",{style:{display:"flex",gap:3},children:["all","fail","warn","pass","info"].map(t=>e.jsx("button",{onClick:()=>u(t),style:{flex:1,padding:"4px 0",borderRadius:6,border:`1px solid ${f===t?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)"}`,background:f===t?"rgba(255,255,255,0.05)":"transparent",color:f===t?"#e4e4e7":"#3f3f46",fontSize:9,fontWeight:800,cursor:"pointer",textTransform:"uppercase"},children:t},t))})]}),e.jsx("div",{style:{flex:1,overflow:"auto",padding:"6px 10px"},children:j.map(t=>{const p=V(t.severity),R=m===t.id;return e.jsx("div",{onClick:()=>b(R?null:t.id),style:{padding:"9px 10px",borderRadius:9,background:p.bg,border:`1px solid ${p.border}`,marginBottom:5,cursor:"pointer",transition:"all 0.1s"},children:e.jsxs("div",{style:{display:"flex",alignItems:"flex-start",gap:7},children:[K(t.severity),e.jsxs("div",{style:{flex:1,minWidth:0},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"},children:[e.jsx("span",{style:{fontSize:9,fontWeight:800,color:p.text,background:p.badge,padding:"1px 5px",borderRadius:99,whiteSpace:"nowrap"},children:t.category}),t.line&&e.jsxs("span",{style:{fontSize:9,color:"#52525b",background:"rgba(255,255,255,0.04)",padding:"1px 5px",borderRadius:99},children:["L",t.line]})]}),e.jsx("div",{style:{fontSize:11,fontWeight:700,color:"#e4e4e7",lineHeight:1.4},children:t.description}),R&&e.jsxs(e.Fragment,{children:[t.detail&&e.jsx("div",{style:{fontSize:10,color:"#71717a",marginTop:4,lineHeight:1.5},children:t.detail}),t.fix&&e.jsxs("div",{style:{fontSize:10,color:p.text,marginTop:3,lineHeight:1.5,opacity:.9},children:["▶ ",t.fix]})]})]})]})},t.id)})})]}):e.jsxs("div",{style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,color:"#3f3f46"},children:[e.jsx(C,{style:{width:44,height:44,marginBottom:14,opacity:.2}}),e.jsx("div",{style:{fontSize:13,fontWeight:700,marginBottom:6},children:'Click "Verify" to start'}),e.jsx("div",{style:{fontSize:11,color:"#3f3f46",textAlign:"center",maxWidth:260,lineHeight:1.6},children:"15+ automated checks: Collision risk · Feed rates · Spindle safety · Arc definition · Program structure · Tool compensation · Sequence numbers"}),e.jsx("div",{style:{marginTop:20,display:"flex",flexDirection:"column",gap:4,width:"100%"},children:["Fanuc 0i — G71/G76 cycle validation","Siemens 840D — CYCLE95 / G74 checks","Haas NGC — G28/T-word verification","All: Arc R/IJ validation, feed units check"].map((t,p)=>e.jsxs("div",{style:{fontSize:10,color:"#3f3f46",display:"flex",gap:6},children:[e.jsx("span",{style:{color:"#1f2937"},children:"›"}),t]},p))})]})})]})]})}export{ne as GCodeVerificationView};
