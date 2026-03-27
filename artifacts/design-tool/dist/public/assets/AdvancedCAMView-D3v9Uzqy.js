import{a as x,j as e,ag as X,t as Y,a6 as Q,b8 as K}from"./vendor-react-BGzTyFj6.js";import"./vendor-misc-CTX_4kJC.js";import"./vendor-radix-ClGl1ulJ.js";import"./vendor-konva-Ca8PhNs_.js";import"./vendor-ui-utils-BmjxSsjX.js";import"./vendor-charts-BAxxm6Kp.js";import"./vendor-3d-BOpJTylD.js";import"./vendor-state-DINDFsLw.js";const E=[{id:"adaptive",name:"Adaptive Clearing",icon:"⚡",type:"mill",shortDesc:"Constant chip load — iMachining/HSMWorks style. Varies stepover to maintain engagement angle.",adv:["Constant chip load","Full depth-of-cut always","30–50% faster than conventional","Works on hardened steel","Less heat → longer tool life"],bestFor:"Pockets, cavities, complex cores. All hardness levels.",engagement:"8–15% tool Ø (keep thin chip)"},{id:"trochoidal",name:"Trochoidal Milling",icon:"🌀",type:"mill",shortDesc:"Circular arcs advancing through slot. Eliminates full-width engagement — ideal for SS/Ti.",adv:["No full-width engagement","High-speed slotting","Better chip evacuation","SS, Ti, Inconel friendly","Low vibration"],bestFor:"Slots, stainless steel, titanium, thin walls",engagement:"Arc radius = 55–65% tool Ø"},{id:"contour",name:"Z-Level Contour",icon:"📐",type:"mill",shortDesc:"2D offsets at each Z level. Classic, reliable, universal. Best surface finish on vertical walls.",adv:["Consistent surface finish","Simple post-processing","Works on any controller","Predictable cutting forces"],bestFor:"Vertical walls, profile finishing, 2.5D milling",engagement:"Full radial (Ae = D), light axial (Ap = 5–10%)"},{id:"pencil",name:"Pencil Tracing",icon:"✏️",type:"mill",shortDesc:"Auto-finds corners missed by large tools. Single-pass clean with ball-nose — eliminates hand finishing.",adv:["Automatic corner detection","No manual offset needed","Accurate ±0.01mm","Eliminates benching"],bestFor:"Corner finishing after roughing",engagement:"Single light pass"},{id:"spiral",name:"Spiral Pocket",icon:"🔄",type:"mill",shortDesc:"Center-out spiral. No plunge into material — smooth entry, constant load.",adv:["No tool plunge","Smooth continuous cut","Good chip control","Low entry forces"],bestFor:"Circular pockets, face milling",engagement:"Radial: 50% core, 70% outer"},{id:"hsm",name:"HSM High-Speed",icon:"🚀",type:"mill",shortDesc:"Light axial, high feed, high RPM. Thin-chip strategy keeps heat in chip not workpiece.",adv:["Light ap (10% D), high Ae (50%)","Reduced heat in workpiece","Excellent Al surface finish","Long tool life on Al/Brass"],bestFor:"Aluminium, brass, thin walls, die inserts",engagement:"Low Ap, high Ae"},{id:"g71rough",name:"G71 OD Roughing",icon:"⚙️",type:"turn",shortDesc:"Fanuc/Mazak standard roughing cycle — removes material in uniform U-depth passes.",adv:["Single-block program","Automatic feed retract","Works with G70 finish","Universal Fanuc/Haas/Mazak"],bestFor:"OD/ID turning roughing",engagement:"U = depth/pass (1.5–3mm)"},{id:"g71finish",name:"G70 Finish Pass",icon:"🏁",type:"turn",shortDesc:"Follows G71 roughing with G70 finishing pass at tighter feed/speed.",adv:["Automatically uses G71 contour","Single command finish","Ra 0.8–1.6μm achievable","Separate speed/feed control"],bestFor:"OD finish pass after G71 roughing",engagement:"Light finish, Fz = 0.05–0.1 mm/rev"},{id:"g76thread",name:"G76 Threading",icon:"🔩",type:"turn",shortDesc:"Multi-pass threading with compound infeed. Built-in spring passes, chip breaking, tapered feed.",adv:["Automatic spring passes","60°/55° insert standard","Self-calculating depth","Compound infeed → longer insert"],bestFor:"Metric, UN, BSPT threads — all pitches",engagement:"Compound infeed: P word controls passes"},{id:"g72face",name:"G72 Face Roughing",icon:"🔲",type:"turn",shortDesc:"Face-direction roughing cycle — removes material in axial (Z) passes across face.",adv:["Axial passes, not radial","Ideal for large diameter facing","Single block program","Paired with G70 finish"],bestFor:"Large face, disc turning, facing operations",engagement:"W = depth/pass, retract angle = R"}],b={AL:{name:"Aluminium",Vc:300,Fz:.06,ap:.8,ae:.5,hardness:80},Brass:{name:"Brass",Vc:250,Fz:.05,ap:.75,ae:.45,hardness:100},MS:{name:"Mild Steel",Vc:100,Fz:.04,ap:.7,ae:.15,hardness:150},CR:{name:"CR Steel",Vc:90,Fz:.04,ap:.7,ae:.12,hardness:180},CI:{name:"Cast Iron",Vc:110,Fz:.05,ap:.65,ae:.3,hardness:200},HSLA:{name:"HSLA Steel",Vc:75,Fz:.03,ap:.6,ae:.1,hardness:260},SS:{name:"Stainless 304",Vc:60,Fz:.03,ap:.55,ae:.08,hardness:200},Ti:{name:"Titanium Ti-6Al-4V",Vc:45,Fz:.02,ap:.4,ae:.05,hardness:340}};function z(t,p,a,g,d,c){const h=b[p],u=h.Vc,s=h.Fz,n=Math.round(1e3*u/(Math.PI*t)),o=t*h.ae,r=t*h.ap,l=Math.round(n*s*4),m=Math.ceil(a/r),M=t*.3;if(c==="siemens840d")return`; ADAPTIVE CLEARING — SIEMENS 840D
; Tool: D${t}mm | Mat: ${b[p].name}
G71 G18 G40 G94 G90
T1 D1
G00 G17 G90
M03 S${n} G96 LIMS=${n+200}
M08
; --- HELICAL ENTRY ---
G00 X${(g/2).toFixed(2)} Y${(d/2).toFixed(2)} Z5.0
${Array.from({length:m},(C,F)=>{const y=-r*(F+1);return`; Pass ${F+1} — Z${y.toFixed(2)}
POCKET3(RTP=5, RFP=0, SDIS=2, DP=${Math.abs(y).toFixed(2)}, LENG=${d}, WID=${g}, CRAD=${(t*.4).toFixed(2)}, FAL=0.2, FALD=0.1, FFD=${l}, FFF=${Math.round(l*.6)}, VARI=0, MIDA=${o.toFixed(2)})`}).join(`
`)}
G00 Z50.0
M05 M09
M30`;if(c==="heidenhain")return`BEGIN PGM ADAPTIVE MM
; Tool: T${t}R${(t/2).toFixed(1)} | ${b[p].name}
TOOL CALL 1 Z S${n}
L Z+50 R0 FMAX
M13                      ; Spindle + Coolant
; --- CYCL DEF 256 RECTANGULAR POCKET ---
CYCL DEF 256 RECTANGULAR POCKET ~
  Q218=${d} ~   ; LENGTH
  Q219=${g} ~   ; WIDTH
  Q368=0.2 ~            ; FINISH ALLOW
  Q224=0 ~              ; ROTATION
  Q315=${l} ~        ; FEED ROUGH
  Q316=${Math.round(l*.6)} ~ ; FEED FINISH
  Q300=${a} ~       ; DEPTH
  Q333=${r.toFixed(2)} ; MAX DEPTH CUT
CYCL CALL
M05 M09
END PGM ADAPTIVE MM`;const T=c==="haas"?"(HAAS NGC)":c==="mazak"?"(MAZAK SMOOTH)":"(FANUC 0i-MD)";return`%
${c==="haas"?"O00001":"O0001"} (ADAPTIVE CLEARING — ${b[p].name.toUpperCase()})
${T}
(TOOL: D${t}mm ENDMILL — 4 FLUTE)
(Vc=${u} m/min | Fz=${s}mm/t | Ap=${r.toFixed(1)}mm | Ae=${o.toFixed(1)}mm)
(EST. CYCLE TIME: ${Math.round(m*g*d/(l*o/t))}min)
${c==="haas"?"G21 G17 G40 G49 G80 G90 G94":"G21 G17 G40 G80 G90 G94"}
T${c==="haas"?"1 M06":"01"}
G43 H01 Z100.0
G00 X${(g/2).toFixed(2)} Y${(d/2).toFixed(2)}
M03 S${n}
M08
; --- HELICAL PLUNGE (avoid direct plunge) ---
G00 Z5.0
${Array.from({length:m},(C,F)=>{const y=-r*(F+1);return`; === PASS ${F+1}/${m} — Z${y.toFixed(2)} ===
G03 X${(g/2+M).toFixed(2)} Y${(d/2).toFixed(2)} Z${y.toFixed(2)} I${M.toFixed(2)} J0 F${Math.round(l*.4)}
G01 X${o.toFixed(2)} F${l}
G01 Y${(d-o).toFixed(2)}
G01 X${(g-o).toFixed(2)}
G01 Y${o.toFixed(2)}
G01 X${(o*2).toFixed(2)}
; (Adaptive step: ae=${o.toFixed(1)}mm = ${Math.round(h.ae*100)}% D)`}).join(`
`)}
G00 Z100.0
M05
M09
G91 G28 Z0.
${c==="haas"?"G28 X0. Y0.":"G28 U0."}
M30
%`}function _(t,p,a,g,d){const c=b[p],h=Math.round(1e3*c.Vc/(Math.PI*t)),u=Math.round(h*c.Fz*4),s=t*.5,n=t*.55,o=Math.ceil(g/s);return`%
O0002 (TROCHOIDAL MILLING — ${b[p].name.toUpperCase()})
(SLOT: W${a}mm × L${g}mm)
(TOOL: D${t}mm — Circle radius = ${n.toFixed(1)}mm)
G21 G17 G40 G90
T02
G43 H02 Z100.0
G00 X${(a/2).toFixed(2)} Y0 S${h} M03
M08
G00 Z2.0
G01 Z-${(t*.8).toFixed(1)} F${Math.round(u*.3)}
; --- TROCHOIDAL PASSES ---
${Array.from({length:Math.min(o,12)},(r,l)=>{const m=s*l;return`G03 X${(a/2+n).toFixed(2)} Y${m.toFixed(2)} I${n.toFixed(2)} J0 F${u}
G03 X${(a/2).toFixed(2)} Y${(m+s).toFixed(2)} I${(-n).toFixed(2)} J0 F${u}`}).join(`
`)}
G01 Z50.0 F3000
M05 M09
G28 U0. W0.
M30
%`}function O(t,p,a,g,d){const c=b[p],h=Math.round(1e3*c.Vc/(Math.PI*a)),u=c.Fz*5,s=c.Fz*2,n=2,o=d==="siemens840d"?"SIEMENS 840D":d==="haas"?"HAAS":d==="mazak"?"MAZAK":"FANUC";return`%
O0003 (G71 OD ROUGHING + G70 FINISH — ${b[p].name.toUpperCase()})
(CONTROLLER: ${o})
(DIA: Ø${a}mm | LENGTH: ${g}mm | TOOL: ${t}mm CCMT)
G21 G18 G40 G97 G99
T0101 (OD ROUGHING CNMG${t<20?"120408":"160608"})
G96 S${Math.round(c.Vc)} M03
M08
G00 X${(a+10).toFixed(1)} Z5.0
; --- G71 ROUGHING CYCLE ---
G71 U${n.toFixed(1)} R0.5
G71 P10 Q80 U0.3 W0.1 F${u.toFixed(3)}
; --- CONTOUR DEFINITION (N10 to N80) ---
N10 G00 X${(a*.4).toFixed(1)}
    G01 Z0 F${s.toFixed(3)}
    G01 X${(a*.5).toFixed(1)} Z-2.5
    G01 Z-${(g*.3).toFixed(1)}
    G02 X${(a*.65).toFixed(1)} Z-${(g*.35).toFixed(1)} R${(a*.075).toFixed(1)}
    G01 Z-${(g*.7).toFixed(1)}
    G01 X${(a*.85).toFixed(1)} Z-${(g*.85).toFixed(1)}
N80 G01 X${(a+5).toFixed(1)}
; --- G70 FINISH PASS ---
G70 P10 Q80 F${s.toFixed(3)} S${Math.round(c.Vc*1.3)}
G00 X${(a+30).toFixed(1)} Z50.0
M05 M09
; --- GROOVING (optional) ---
T0202 (GROOVE TOOL 3mm)
G97 S${Math.min(h,800)} M03
G00 X${(a+5).toFixed(1)} Z-${(g*.45).toFixed(1)}
G01 X${(a*.55).toFixed(1)} F0.04
G04 P300
G01 X${(a+5).toFixed(1)} F0.3
G00 X${(a+30).toFixed(1)} Z50.0
M05 M09
G28 U0. W0.
M30
%`}function J(t,p,a,g){const d=p-1.0825*t,c=(p-d)/2,h=g==="siemens840d"?`; SIEMENS 840D — USE CYCLE97 INSTEAD
; CYCLE97(TP=${t}, TDEP=${c.toFixed(3)}, IANG=30, NST=5, NWT=2, VARI=1)`:"";return`%
O0004 (G76 THREADING CYCLE — M${p}×${t})
(CONTROLLER: ${g.toUpperCase()})
(MAJOR Ø: ${p}mm | MINOR Ø: ${d.toFixed(3)}mm | PITCH: ${t}mm)
(THREAD DEPTH: ${c.toFixed(3)}mm | LENGTH: ${a}mm)
${h}
G21 G18 G40 G97 G99
T0303 (THREADING TOOL 60°)
G97 S${Math.min(Math.round(600/t),1200)} M03
M08
G00 X${(p+5).toFixed(1)} Z5.0
; --- G76 THREADING CYCLE ---
; P = spring passes | thread angle | min infeed
; Q = minimum depth of cut (×0.001mm)
; R = finish allowance (×0.001mm)
G76 P030060 Q${Math.round(c*.1*1e3)} R${Math.round(.05*1e3)}
; X = minor diameter | Z = thread end | P = depth×1000 | Q = 1st infeed×1000 | F = pitch
G76 X${d.toFixed(3)} Z-${a.toFixed(1)} P${Math.round(c*1e3)} Q${Math.round(c*.4*1e3)} F${t.toFixed(3)}
G00 X${(p+30).toFixed(1)} Z50.0
M05 M09
G28 U0. W0.
M30
%
; ─── THREAD VERIFICATION ────────────────────────
; Major dia: ${p}.000 mm
; Minor dia: ${d.toFixed(3)} mm
; Pitch:     ${t} mm
; Depth:     ${c.toFixed(3)} mm
; Go gauge:  ${(p-.015).toFixed(3)} mm
; No-go:     ${(p+.015).toFixed(3)} mm`}function q({id:t,toolDia:p,pocketW:a=200,pocketL:g=150}){const s=[];if(t==="adaptive"){s.push(e.jsx("rect",{x:40,y:30,width:280,height:160,fill:"none",stroke:"rgba(255,255,255,0.07)"},"bnd"));for(let n=0;n<7;n++){const o=18+n*15,r=[];for(let l=0;l<Math.PI*2;l+=.05){const m=Math.sin(l*6+n*1.1)*2;r.push(`${180+(o+m)*Math.cos(l)},${110+(o+m)*Math.sin(l)*.7}`)}s.push(e.jsx("polygon",{points:r.join(" "),fill:"none",stroke:`hsla(${155+n*15}, 65%, 52%, 0.85)`,strokeWidth:1.8},`ad${n}`))}}else if(t==="trochoidal"){s.push(e.jsx("rect",{x:40,y:82,width:280,height:56,fill:"rgba(255,255,255,0.02)",stroke:"rgba(255,255,255,0.06)"},"sl"));for(let n=0;n<7;n++){const o=65+n*30;s.push(e.jsx("circle",{cx:o,cy:110,r:22,fill:"none",stroke:`hsla(${200+n*12}, 70%, 58%, 0.9)`,strokeWidth:1.8},`tc${n}`)),s.push(e.jsx("circle",{cx:o+7,cy:103,r:5,fill:`hsla(${200+n*12}, 80%, 65%, 0.8)`},`td${n}`))}s.push(e.jsx("text",{x:42,y:152,fill:"#f59e0b",fontSize:"9",fontWeight:"bold",fontFamily:"sans-serif",children:"arc r = 55% D"},"tl"))}else if(t==="contour")[0,18,36,54,72].forEach((n,o)=>{s.push(e.jsx("rect",{x:40+n,y:30+n,width:280-n*2,height:160-n*2,rx:4,fill:"none",stroke:`rgba(245,158,11,${.9-o*.15})`,strokeWidth:1.5},`co${o}`))});else if(t==="spiral"){const n=[];for(let o=0,r=3;o<Math.PI*14&&!(r>Math.min(180,110)-30);o+=.05,r+=.85)n.push(`${180+r*Math.cos(o)},${110+r*Math.sin(o)*.7}`);s.push(e.jsx("polyline",{points:n.join(" "),fill:"none",stroke:"rgba(167,139,250,0.85)",strokeWidth:1.8},"sp"))}else if(t==="hsm"){for(let n=0;n<7;n++){const o=35+n*150/7;s.push(e.jsx("line",{x1:45,y1:o,x2:315,y2:o,stroke:`rgba(96,165,250,${.9-n*.08})`,strokeWidth:2},`hs${n}`))}s.push(e.jsx("text",{x:44,y:210,fill:"#60a5fa",fontSize:"9",fontWeight:"bold",fontFamily:"sans-serif",children:"High-speed — light ap, heavy Ae"},"hsl"))}else if(t==="pencil")s.push(e.jsx("rect",{x:40,y:30,width:280,height:160,fill:"none",stroke:"rgba(255,255,255,0.06)"},"pb")),[[40,30],[320,30],[320,190],[40,190]].forEach(([n,o],r)=>{s.push(e.jsx("circle",{cx:n,cy:o,r:18,fill:"none",stroke:"rgba(251,191,36,0.8)",strokeWidth:2},`pc${r}`)),s.push(e.jsx("circle",{cx:n,cy:o,r:4,fill:"#fbbf24"},`pd${r}`))});else if(t==="g71rough"||t==="g71finish"||t==="g72face"){const n=t==="g72face"?6:7;for(let r=0;r<n;r++){const l=t==="g71rough"?`rgba(245,158,11,${.9-r*.1})`:t==="g71finish"?`rgba(52,211,153,${.9-r*.05})`:`rgba(96,165,250,${.9-r*.09})`;if(t==="g72face")s.push(e.jsx("line",{x1:50,y1:35+r*18,x2:310,y2:35+r*18,stroke:l,strokeWidth:1.8},`gl${r}`));else{const m=50+r*22;s.push(e.jsx("line",{x1:m,y1:35,x2:m,y2:185,stroke:l,strokeWidth:1.8},`gl${r}`))}}const o="M50,35 L70,50 L80,"+220/2+" L90,160 L310,180";s.push(e.jsx("path",{d:o,fill:"none",stroke:"#34d399",strokeWidth:2.5},"prof"))}else if(t==="g76thread")for(let n=0;n<6;n++){const o=50+n*140/5;s.push(e.jsx("line",{x1:50,y1:o,x2:310,y2:o-(n+1)*5,stroke:`rgba(167,139,250,${.9-n*.1})`,strokeWidth:1.8},`thr${n}`));const r=[];for(let l=65;l<305;l+=18)r.push(`M${l},${o-n*4} L${l+9},${o-n*4-8} L${l+18},${o-n*4}`);s.push(e.jsx("path",{d:r.join(" "),fill:"none",stroke:"rgba(167,139,250,0.5)",strokeWidth:1},`tt${n}`))}return e.jsxs("svg",{width:"100%",viewBox:"0 0 360 220",style:{borderRadius:10,display:"block",background:"#07090f"},children:[s,e.jsx("circle",{cx:186,cy:100,r:8,fill:"rgba(245,158,11,0.9)",stroke:"#fff",strokeWidth:1.5}),e.jsx("text",{x:196,y:104,fill:"rgba(255,255,255,0.25)",fontSize:"9",fontFamily:"sans-serif",children:"● Tool"})]})}const G={fanuc:{name:"Fanuc 0i / 32i-B",color:"#f59e0b",maker:"FANUC"},siemens840d:{name:"SINUMERIK 840D sl",color:"#60a5fa",maker:"SIEMENS"},haas:{name:"Haas NGC",color:"#34d399",maker:"HAAS"},mazak:{name:"Mazatrol Smooth-X",color:"#a78bfa",maker:"MAZAK"},heidenhain:{name:"Heidenhain TNC640",color:"#fb923c",maker:"HEIDENHAIN"}};function le(){const[t,p]=x.useState("adaptive"),[a,g]=x.useState("fanuc"),[d,c]=x.useState("MS"),[h,u]=x.useState(16),[s,n]=x.useState(20),[o,r]=x.useState(80),[l,m]=x.useState(60),[M,T]=x.useState(2),[C,F]=x.useState(30),[y,D]=x.useState(25),[v,P]=x.useState(""),[L,k]=x.useState(!1),[j,W]=x.useState("all"),f=E.find(i=>i.id===t)??E[0],S=b[d],R=Math.round(1e3*S.Vc/(Math.PI*h)),N=Math.round(R*S.Fz*4),I=h*S.ap,H=h*S.ae,w=H*I*N/1e3;function U(){let i="";t==="adaptive"?i=z(h,d,s,o,l,a):t==="trochoidal"?i=_(h,d,o,l):t==="contour"||t==="pencil"||t==="spiral"||t==="hsm"?i=z(h,d,s,o,l,a).replace("ADAPTIVE CLEARING",t.toUpperCase().replace(/-/g," ")):t==="g71rough"||t==="g71finish"?i=O(h,d,o*2,l*2,a):t==="g76thread"?i=J(M,C,y,a):t==="g72face"&&(i=O(h,d,o*2,l*2,a).replace("G71","G72").replace("OD ROUGHING","FACE ROUGHING")),P(i)}function Z(){navigator.clipboard.writeText(v),k(!0),setTimeout(()=>k(!1),1500)}function V(){const i=a==="siemens840d"?"mpf":a==="heidenhain"?"h":"nc",$=new Blob([v],{type:"text/plain"}),A=document.createElement("a");A.href=URL.createObjectURL($),A.download=`SAI_${t}_${d}.${i}`,A.click()}const B=E.filter(i=>j==="all"||i.type===j);return e.jsxs("div",{style:{height:"100%",display:"grid",gridTemplateColumns:"260px 1fr",overflow:"hidden",background:"#070710"},children:[e.jsxs("div",{style:{borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",overflow:"hidden"},children:[e.jsxs("div",{style:{padding:"14px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:10},children:[e.jsx("div",{style:{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg, #2563eb,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(37,99,235,0.35)"},children:e.jsx(X,{style:{width:18,height:18,color:"#fff"}})}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:14,fontWeight:900,color:"#fff"},children:"Advanced CAM"}),e.jsx("div",{style:{fontSize:10,color:"#52525b"},children:"iMachining-style Pro"})]})]}),e.jsx("div",{style:{display:"flex",gap:3},children:["all","mill","turn"].map(i=>e.jsx("button",{onClick:()=>W(i),style:{flex:1,padding:"4px 0",borderRadius:6,border:"none",fontSize:10,fontWeight:700,cursor:"pointer",background:j===i?"rgba(37,99,235,0.2)":"transparent",color:j===i?"#60a5fa":"#52525b"},children:i==="all"?"All":i==="mill"?"Mill":"Turn"},i))})]}),e.jsx("div",{style:{flex:1,overflow:"auto"},children:B.map(i=>e.jsxs("div",{onClick:()=>p(i.id),style:{padding:"11px 14px",borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer",background:t===i.id?"rgba(37,99,235,0.09)":"transparent",borderLeft:t===i.id?"3px solid #3b82f6":"3px solid transparent",transition:"all 0.1s"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:2},children:[e.jsx("span",{style:{fontSize:15},children:i.icon}),e.jsx("span",{style:{fontSize:11,fontWeight:700,color:t===i.id?"#60a5fa":"#c4c4cc"},children:i.name}),e.jsx("span",{style:{marginLeft:"auto",fontSize:8,fontWeight:800,color:i.type==="mill"?"#a78bfa":"#fbbf24",background:i.type==="mill"?"rgba(167,139,250,0.1)":"rgba(245,158,11,0.1)",padding:"1px 5px",borderRadius:99,letterSpacing:"0.05em"},children:i.type.toUpperCase()})]}),e.jsx("div",{style:{fontSize:10,color:"#52525b",lineHeight:1.4},children:i.shortDesc.slice(0,70)})]},i.id))})]}),e.jsxs("div",{style:{display:"flex",flexDirection:"column",overflow:"hidden"},children:[e.jsxs("div",{style:{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap"},children:[e.jsx("span",{style:{fontSize:10,fontWeight:800,color:"#52525b",textTransform:"uppercase",letterSpacing:"0.06em"},children:"Post-Processor:"}),Object.keys(G).map(i=>e.jsx("button",{onClick:()=>g(i),style:{padding:"4px 10px",borderRadius:6,border:`1px solid ${a===i?G[i].color+"55":"rgba(255,255,255,0.06)"}`,background:a===i?G[i].color+"15":"transparent",color:a===i?G[i].color:"#52525b",fontSize:10,fontWeight:800,cursor:"pointer"},children:G[i].maker},i)),e.jsx("span",{style:{fontSize:10,color:"#3f3f46",marginLeft:4},children:G[a].name})]}),e.jsxs("div",{style:{flex:1,overflow:"auto",padding:16},children:[e.jsx("div",{style:{borderRadius:14,padding:16,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",marginBottom:14},children:e.jsxs("div",{style:{display:"flex",gap:14},children:[e.jsxs("div",{style:{flex:1},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:8},children:[e.jsx("span",{style:{fontSize:26},children:f.icon}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:15,fontWeight:900,color:"#fff"},children:f.name}),e.jsx("div",{style:{fontSize:11,color:"#71717a"},children:f.bestFor})]})]}),e.jsx("p",{style:{fontSize:12,color:"#a1a1aa",margin:"0 0 10px",lineHeight:1.6},children:f.shortDesc}),e.jsx("div",{style:{display:"flex",flexWrap:"wrap",gap:5},children:f.adv.map((i,$)=>e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:6,background:"rgba(52,211,153,0.07)",border:"1px solid rgba(52,211,153,0.12)"},children:[e.jsx(Y,{style:{width:10,height:10,color:"#34d399"}}),e.jsx("span",{style:{fontSize:10,color:"#a1a1aa"},children:i})]},$))}),e.jsxs("div",{style:{marginTop:10,padding:"8px 10px",borderRadius:8,background:"rgba(37,99,235,0.07)",border:"1px solid rgba(37,99,235,0.15)",fontSize:11,color:"#a1a1aa"},children:[e.jsx("span",{style:{fontWeight:700,color:"#60a5fa"},children:"Engagement: "}),f.engagement]})]}),e.jsx("div",{style:{width:220,flexShrink:0},children:e.jsx(q,{id:t,toolDia:h,pocketW:o,pocketL:l})})]})}),e.jsxs("div",{style:{borderRadius:14,padding:16,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",marginBottom:14},children:[e.jsxs("div",{style:{fontSize:12,fontWeight:800,color:"#fff",marginBottom:12,display:"flex",alignItems:"center",gap:6},children:[e.jsx(Q,{style:{width:13,height:13,color:"#52525b"}}),"Parameters"]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(5, 1fr)",gap:10,marginBottom:12},children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:9,fontWeight:700,color:"#52525b",marginBottom:3,textTransform:"uppercase"},children:"Material"}),e.jsx("select",{value:d,onChange:i=>c(i.target.value),style:{width:"100%",padding:"7px 6px",borderRadius:7,background:"#0c0d1f",border:"1px solid rgba(255,255,255,0.09)",color:"#e4e4e7",fontSize:11,outline:"none"},children:Object.entries(b).map(([i,$])=>e.jsxs("option",{value:i,children:[i," — ",$.name]},i))})]}),[{label:"Tool Ø (mm)",val:h,set:u,min:2,max:80},f.type==="turn"&&t==="g76thread"?{label:"Pitch (mm)",val:M,set:T,min:.5,max:6,step:.25}:{label:"Depth (mm)",val:s,set:n,min:1,max:200},f.type==="turn"&&t==="g76thread"?{label:"Major Ø (mm)",val:C,set:F,min:6,max:200}:{label:f.type==="turn"?"Part Ø (mm)":"Pocket W (mm)",val:o,set:r,min:10,max:500},f.type==="turn"&&t==="g76thread"?{label:"Thread L (mm)",val:y,set:D,min:5,max:200}:{label:f.type==="turn"?"Part L (mm)":"Pocket L (mm)",val:l,set:m,min:10,max:500}].filter(Boolean).map((i,$)=>e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:9,fontWeight:700,color:"#52525b",marginBottom:3,textTransform:"uppercase"},children:i.label}),e.jsx("input",{type:"number",value:i.val,min:i.min,max:i.max,step:i.step??1,onChange:A=>i.set(parseFloat(A.target.value)||0),style:{width:"100%",padding:"7px 6px",borderRadius:7,background:"#0c0d1f",border:"1px solid rgba(255,255,255,0.09)",color:"#e4e4e7",fontSize:12,outline:"none",boxSizing:"border-box"}})]},$))]}),f.type==="mill"&&e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:8},children:[{label:"Vc (m/min)",value:S.Vc.toFixed(0),color:"#60a5fa"},{label:"RPM",value:R.toLocaleString(),color:"#f59e0b"},{label:"Feed (mm/min)",value:N.toLocaleString(),color:"#34d399"},{label:"Fz (mm/t)",value:S.Fz.toFixed(3),color:"#a78bfa"},{label:"Ap (mm)",value:I.toFixed(2),color:"#fb923c"},{label:"Ae (mm)",value:H.toFixed(2),color:"#34d399"},{label:"MRR (cm³/min)",value:w.toFixed(1),color:"#f87171"},{label:"Est. passes",value:Math.ceil(s/I).toString(),color:"#71717a"}].map((i,$)=>e.jsxs("div",{style:{padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)",border:`1px solid ${i.color}20`,textAlign:"center"},children:[e.jsx("div",{style:{fontSize:9,color:"#52525b",marginBottom:1},children:i.label}),e.jsx("div",{style:{fontSize:16,fontWeight:900,color:i.color},children:i.value})]},$))})]}),e.jsxs("div",{style:{borderRadius:14,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"},children:[e.jsxs("div",{style:{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:8},children:[e.jsx("span",{style:{fontSize:12,fontWeight:800,color:"#fff"},children:"Generated G-Code"}),e.jsx("span",{style:{fontSize:10,color:"#52525b"},children:G[a].name}),e.jsxs("div",{style:{marginLeft:"auto",display:"flex",gap:6},children:[v&&e.jsxs(e.Fragment,{children:[e.jsx("button",{onClick:Z,style:{padding:"5px 10px",borderRadius:7,border:"1px solid rgba(255,255,255,0.09)",background:"rgba(255,255,255,0.03)",color:L?"#34d399":"#a1a1aa",fontSize:10,fontWeight:700,cursor:"pointer"},children:L?"✓ Copied":"Copy"}),e.jsxs("button",{onClick:V,style:{padding:"5px 10px",borderRadius:7,border:"none",background:"rgba(37,99,235,0.15)",color:"#60a5fa",fontSize:10,fontWeight:700,cursor:"pointer"},children:["Download .",a==="siemens840d"?"mpf":a==="heidenhain"?"h":"nc"]})]}),e.jsxs("button",{onClick:U,style:{padding:"5px 12px",borderRadius:7,border:"none",background:"linear-gradient(90deg, #2563eb, #1d4ed8)",color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:5},children:[e.jsx(K,{style:{width:11,height:11}}),"Generate"]})]})]}),v?e.jsx("pre",{style:{margin:0,padding:"14px 16px",fontFamily:"monospace",fontSize:11.5,color:"#34d399",background:"#08091a",overflow:"auto",maxHeight:340,lineHeight:1.75},children:v}):e.jsxs("div",{style:{padding:30,textAlign:"center",color:"#3f3f46",fontSize:12},children:["Configure parameters and click ",e.jsx("strong",{style:{color:"#60a5fa"},children:"Generate"})," to create G-code"]})]})]})]})]})}export{le as AdvancedCAMView};
