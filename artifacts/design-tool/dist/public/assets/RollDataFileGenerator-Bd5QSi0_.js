import{u as fe,r as T,j as t,R as Z,T as L}from"./index-CDIkzOpI.js";import{J as $e}from"./jszip.min-DznGbdbE.js";import{L as be}from"./layers-DXT8FilA.js";import{f as ue}from"./Home-VMXksuzV.js";import{C as ye}from"./chevron-left-B-ZYBn_5.js";import{C as ge}from"./chevron-right-DpAmQTAz.js";import{D as we}from"./download-B4c2QkZF.js";import{a as Re}from"./shield-check-CXZmOpo-.js";import{C as Se}from"./circle-check-big-PiMfOU_S.js";import"./appVersion-C8WTK2hK.js";import"./zap-D-9Fl8bu.js";import"./loader-circle-CNJkOcBD.js";import"./bot-B6zI301z.js";import"./circle-check-CjwI9fN6.js";import"./wrench-CsjxEwq3.js";import"./cog-8L7nAlJc.js";import"./monitor-BBmWGnps.js";import"./star-CjGK7BdO.js";import"./trending-up-DXtPHY2t.js";import"./arrow-left-CFp2STmV.js";import"./keyboard-BkcHF25v.js";import"./chevron-down-DFa6AEQH.js";import"./file-code-2-BjbIrCF3.js";import"./shield-C-49bP6q.js";import"./box-FnBUfeaq.js";import"./circle-play-J6lIUr0n.js";function Y(l,n,c,s,r=!1){if(!l||l.length===0)return"";const h=[];let m=!0;return l.forEach(i=>{if(i.type==="line"){const k=c+i.startX*n,j=s+(r?-i.startY:i.startY)*n,b=c+i.endX*n,N=s+(r?-i.endY:i.endY)*n;m&&(h.push(`M ${k.toFixed(2)} ${j.toFixed(2)}`),m=!1),h.push(`L ${b.toFixed(2)} ${N.toFixed(2)}`)}else if(i.type==="arc"&&i.centerX!==void 0&&i.centerY!==void 0&&i.radius!==void 0){const k=c+i.centerX*n,j=s+(r?-i.centerY:i.centerY)*n,b=i.radius*n,N=(i.startAngle||0)*(Math.PI/180),y=(i.endAngle||360)*(Math.PI/180),z=k+b*Math.cos(N),e=j+(r?b*Math.sin(N):-b*Math.sin(N)),a=k+b*Math.cos(y),p=j+(r?b*Math.sin(y):-b*Math.sin(y));let f=y-N;f<0&&(f+=Math.PI*2);const o=f>Math.PI?1:0,d=r?1:0;m?(h.push(`M ${z.toFixed(2)} ${e.toFixed(2)}`),m=!1):h.push(`L ${z.toFixed(2)} ${e.toFixed(2)}`),h.push(`A ${b.toFixed(2)} ${b.toFixed(2)} 0 ${o} ${d} ${a.toFixed(2)} ${p.toFixed(2)}`)}}),h.join(" ")}function X(l){let n=1/0,c=-1/0,s=1/0,r=-1/0;return l.forEach(h=>{ve(h).forEach(i=>{n=Math.min(n,i.x),c=Math.max(c,i.x),s=Math.min(s,i.y),r=Math.max(r,i.y)})}),isFinite(n)?{minX:n,maxX:c,minY:s,maxY:r,w:c-n,h:r-s}:{minX:-50,maxX:50,minY:-10,maxY:10,w:100,h:20}}function ve(l){const n=[];if(l.type==="line")n.push({x:l.startX,y:l.startY},{x:l.endX,y:l.endY});else if(l.type==="arc"&&l.centerX!==void 0&&l.centerY!==void 0&&l.radius!==void 0){const c=(l.startAngle||0)*Math.PI/180;let r=(l.endAngle||360)*Math.PI/180-c;r<=0&&(r+=Math.PI*2);for(let h=0;h<=12;h++){const m=c+r*h/12;n.push({x:l.centerX+l.radius*Math.cos(m),y:l.centerY+l.radius*Math.sin(m)})}}return n}function $(l,n=2){return isFinite(l)?l.toFixed(n):"—"}function J(l,n,c,s,r,h,m){const e=148.33333333333334,a=60+40/2,p=X(c),f=s?.rollProfile?.upperRoll||[],o=s?.rollProfile?.lowerRoll||[],d=X(f.length>0?f:c),R=X(o.length>0?o:c),D=720/(p.w+40)*.8,O=e/(p.h+20)*.75,S=Math.min(D,O,3),x=720/(d.w+40)*.8,u=e/(d.h+20)*.75,g=Math.min(x,u,3),I=720/(R.w+40)*.8,P=e/(R.h+20)*.75,F=Math.min(I,P,3),w=800/2,v=a+e*.5,E=a+e*1.5,C=a+e*2.5,K=w-(d.minX+d.maxX)/2*g,Q=v-(d.minY+d.maxY)/2*g,A=Y(f.length>0?f:c,g,K,Q,!1),ee=w-(p.minX+p.maxX)/2*S,te=E-(p.minY+p.maxY)/2*S,_=Y(c,S,ee,te,!1),le=w-(R.minX+R.maxX)/2*F,se=C-(R.minY+R.maxY)/2*F,U=Y(o.length>0?o:c,F,le,se,!0),H=l+1,G=s?.upperRollOD||s?.rollProfile?.rollDiameter||0,ae=s?.upperRollID||s?.rollProfile?.shaftDiameter||0,W=s?.upperRollWidth||s?.rollProfile?.rollWidth||0,B=s?.lowerRollOD||s?.rollProfile?.rollDiameter||0,ne=s?.lowerRollID||s?.rollProfile?.shaftDiameter||0,M=s?.lowerRollWidth||s?.rollProfile?.rollWidth||0,oe=s?.rollGap??0,ie=s?.mfgSpec?.rollMaterial||"EN31 / D3",re=s?.mfgSpec?.rollHardness||"58–62 HRC",ce=s?.mfgSpec?.surfaceTreatment||"Hard Chrome / Nitride",de=s?.mfgSpec?.toleranceOD||"±0.02 mm",xe=s?.mfgSpec?.toleranceFace||"±0.01 mm",pe=s?.behavior?.phase||"MAIN",he=s?.behavior?.upperRollAction||"Upper forming roll",me=s?.behavior?.lowerRollAction||"Lower forming roll";return`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <style>
      text { font-family: Arial, sans-serif; }
      .title { font-size:14px; font-weight:bold; fill:#1a2744; }
      .subtitle { font-size:10px; fill:#334155; }
      .label { font-size:9px; fill:#475569; }
      .value { font-size:10px; font-weight:bold; fill:#1e293b; }
      .zone-label { font-size:11px; font-weight:bold; }
      .dim { font-size:8px; fill:#1d4ed8; }
      .warn { font-size:8px; fill:#d97706; }
      .up-roll { stroke:#1d4ed8; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .strip { stroke:#059669; stroke-width:2.5; fill:rgba(16,185,129,0.08); stroke-linecap:round; stroke-linejoin:round; }
      .dn-roll { stroke:#dc2626; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .centerline { stroke:#94a3b8; stroke-width:0.8; stroke-dasharray:8,4,2,4; }
      .dim-line { stroke:#1d4ed8; stroke-width:0.7; }
      .zone-bg-up { fill:#eff6ff; }
      .zone-bg-strip { fill:#f0fdf4; }
      .zone-bg-dn { fill:#fef2f2; }
      .border { stroke:#1e293b; stroke-width:1.5; fill:white; }
      .inner-border { stroke:#334155; stroke-width:0.8; fill:none; }
      .sep { stroke:#e2e8f0; stroke-width:1; }
      .title-bg { fill:#1e3a5f; }
      .title-text { fill:white; }
    </style>
    <!-- Grid pattern -->
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8edf4" stroke-width="0.4"/>
    </pattern>
  </defs>

  <!-- Sheet border -->
  <rect x="0" y="0" width="800" height="600" class="border"/>
  <rect x="8" y="8" width="784" height="584" class="inner-border"/>

  <!-- Title bar -->
  <rect x="8" y="8" width="784" height="50" class="title-bg"/>
  <text x="20" y="30" class="title" fill="white">SAI ROLOTECH SMART ENGINES — ROLL DATA SHEET</text>
  <text x="20" y="48" class="subtitle" fill="#93c5fd">Project: ${r}  |  Material: ${h}  |  Thickness: ${$(m)} mm</text>
  <text x="784" y="30" text-anchor="end" class="title" fill="#fbbf24">ST-${String(H).padStart(2,"0")}</text>
  <text x="784" y="48" text-anchor="end" class="subtitle" fill="#93c5fd">${n}  |  Phase: ${pe}</text>

  <!-- Background grid -->
  <rect x="8" y="60" width="784" height="485" fill="url(#grid)"/>

  <!-- Zone backgrounds -->
  <rect x="8" y="${a}" width="784" height="${e}" class="zone-bg-up" opacity="0.6"/>
  <rect x="8" y="${a+e}" width="784" height="${e}" class="zone-bg-strip" opacity="0.6"/>
  <rect x="8" y="${a+e*2}" width="784" height="${e}" class="zone-bg-dn" opacity="0.6"/>

  <!-- Zone separators -->
  <line x1="8" y1="${a+e}" x2="792" y2="${a+e}" class="sep"/>
  <line x1="8" y1="${a+e*2}" x2="792" y2="${a+e*2}" class="sep"/>

  <!-- Zone labels (left side) -->
  <rect x="8" y="${a}" width="70" height="${e}" fill="#dbeafe" opacity="0.8"/>
  <text transform="translate(43, ${a+e*.5}) rotate(-90)" text-anchor="middle" class="zone-label" fill="#1d4ed8">UP-${H}</text>
  <rect x="8" y="${a+e}" width="70" height="${e}" fill="#dcfce7" opacity="0.8"/>
  <text transform="translate(43, ${a+e*1.5}) rotate(-90)" text-anchor="middle" class="zone-label" fill="#059669">STRIP</text>
  <rect x="8" y="${a+e*2}" width="70" height="${e}" fill="#fee2e2" opacity="0.8"/>
  <text transform="translate(43, ${a+e*2.5}) rotate(-90)" text-anchor="middle" class="zone-label" fill="#dc2626">DN-${H}</text>

  <!-- Right spec panel -->
  <rect x="650" y="${a}" width="142" height="${e*3}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.8"/>

  <!-- UP Roll specs -->
  <text x="655" y="${a+14}" class="label" font-weight="bold" fill="#1d4ed8">UPPER ROLL (UP-${H})</text>
  <text x="655" y="${a+26}" class="label">OD: <tspan class="value">${$(G)} mm</tspan></text>
  <text x="655" y="${a+38}" class="label">ID/Bore: <tspan class="value">${$(ae)} mm</tspan></text>
  <text x="655" y="${a+50}" class="label">Width: <tspan class="value">${$(W)} mm</tspan></text>
  <text x="655" y="${a+62}" class="label">${he.substring(0,25)}</text>

  <!-- Strip specs -->
  <text x="655" y="${a+e+14}" class="label" font-weight="bold" fill="#059669">STRIP PROFILE</text>
  <text x="655" y="${a+e+26}" class="label">Width: <tspan class="value">${$(p.w)} mm</tspan></text>
  <text x="655" y="${a+e+38}" class="label">Height: <tspan class="value">${$(p.h)} mm</tspan></text>
  <text x="655" y="${a+e+50}" class="label">Roll Gap: <tspan class="value">${$(oe)} mm</tspan></text>
  <text x="655" y="${a+e+62}" class="label">Pass-line: <tspan class="value">✓</tspan></text>

  <!-- DN Roll specs -->
  <text x="655" y="${a+e*2+14}" class="label" font-weight="bold" fill="#dc2626">LOWER ROLL (DN-${H})</text>
  <text x="655" y="${a+e*2+26}" class="label">OD: <tspan class="value">${$(B)} mm</tspan></text>
  <text x="655" y="${a+e*2+38}" class="label">ID/Bore: <tspan class="value">${$(ne)} mm</tspan></text>
  <text x="655" y="${a+e*2+50}" class="label">Width: <tspan class="value">${$(M)} mm</tspan></text>
  <text x="655" y="${a+e*2+62}" class="label">${me.substring(0,25)}</text>

  <!-- Center lines (vertical) -->
  <line x1="${800/2}" y1="${a}" x2="${800/2}" y2="${a+e*3}" class="centerline"/>
  <!-- Center line (horizontal) per zone -->
  <line x1="80" y1="${v}" x2="648" y2="${v}" class="centerline"/>
  <line x1="80" y1="${E}" x2="648" y2="${E}" class="centerline"/>
  <line x1="80" y1="${C}" x2="648" y2="${C}" class="centerline"/>

  <!-- UP Roll profile -->
  ${A?`<path d="${A}" class="up-roll"/>`:`<text x="${800/2}" y="${v+5}" text-anchor="middle" class="label" fill="#94a3b8">Upper Roll Profile (generate roll tooling first)</text>`}

  <!-- Strip cross-section profile -->
  ${_?`<path d="${_}" class="strip"/>`:`<text x="${800/2}" y="${E+5}" text-anchor="middle" class="label" fill="#94a3b8">Strip Profile (define profile in Setup)</text>`}

  <!-- DOWN Roll profile -->
  ${U?`<path d="${U}" class="dn-roll"/>`:`<text x="${800/2}" y="${C+5}" text-anchor="middle" class="label" fill="#94a3b8">Lower Roll Profile (generate roll tooling first)</text>`}

  <!-- Dimension: UP Roll width -->
  ${W>0?`
  <line x1="${w-W*g*.5}" y1="${v+e*.35}" x2="${w+W*g*.5}" y2="${v+e*.35}" class="dim-line"/>
  <line x1="${w-W*g*.5}" y1="${v+e*.28}" x2="${w-W*g*.5}" y2="${v+e*.4}" class="dim-line"/>
  <line x1="${w+W*g*.5}" y1="${v+e*.28}" x2="${w+W*g*.5}" y2="${v+e*.4}" class="dim-line"/>
  <text x="${w}" y="${v+e*.35+10}" text-anchor="middle" class="dim">Ø${$(G)} / w:${$(W)}</text>`:""}

  <!-- Dimension: Strip width -->
  <text x="${w}" y="${E+e*.35}" text-anchor="middle" class="dim">W: ${$(p.w)} mm  H: ${$(p.h)} mm</text>

  <!-- Dimension: DN Roll width -->
  ${M>0?`<text x="${w}" y="${C-e*.35}" text-anchor="middle" class="dim">Ø${$(B)} / w:${$(M)}</text>`:""}

  <!-- Footer / Title Block -->
  <rect x="8" y="543" width="784" height="55" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="0.8"/>

  <!-- Footer grid (5 cols) -->
  ${[0,1,2,3,4].map(V=>`<line x1="${8+784*V/5}" y1="543" x2="${8+784*V/5}" y2="598" stroke="#e2e8f0" stroke-width="0.6"/>`).join("")}

  <text x="20" y="557" class="label" fill="#64748b">MATERIAL</text>
  <text x="20" y="571" class="value">${ie}</text>

  <text x="${20+784*1/5}" y="557" class="label" fill="#64748b">HARDNESS</text>
  <text x="${20+784*1/5}" y="571" class="value">${re}</text>

  <text x="${20+784*2/5}" y="557" class="label" fill="#64748b">SURFACE</text>
  <text x="${20+784*2/5}" y="571" class="value">${ce}</text>

  <text x="${20+784*3/5}" y="557" class="label" fill="#64748b">TOL OD / FACE</text>
  <text x="${20+784*3/5}" y="571" class="value">${de} / ${xe}</text>

  <text x="${20+784*4/5}" y="557" class="label" fill="#64748b">DATE / REV</text>
  <text x="${20+784*4/5}" y="571" class="value">${new Date().toLocaleDateString("en-IN")} / A</text>

  <!-- Footer bottom row -->
  <text x="20" y="588" class="label" fill="#94a3b8">SAI ROLOTECH SMART ENGINES v2.2.11  |  Station ${H} of ${n}</text>
  <text x="784" y="588" text-anchor="end" class="label" fill="#94a3b8">ST-${String(H).padStart(2,"0")}_${n.replace(/\s+/g,"_").toUpperCase()}.svg</text>
</svg>`}function q({index:l,label:n,selected:c,onClick:s,hasRollData:r}){return t.jsxs("button",{onClick:s,className:`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${c?"bg-blue-500/20 border-blue-500/50 text-blue-200":"bg-zinc-900/40 border-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`,children:[t.jsxs("span",{className:`text-[10px] font-black w-8 shrink-0 ${c?"text-blue-400":"text-zinc-600"}`,children:["ST",String(l+1).padStart(2,"0")]}),t.jsx("span",{className:"text-[10px] truncate",children:n}),t.jsx("span",{className:`ml-auto shrink-0 ${r?"text-green-500":"text-zinc-700"}`,children:r?t.jsx(Se,{className:"w-3 h-3"}):t.jsx(L,{className:"w-3 h-3"})})]})}function qe(){const{stations:l,rollTooling:n,geometry:c,materialThickness:s}=fe(),[r,h]=T.useState(0),[m,i]=T.useState("C-CHANNEL LINE-01"),[k,j]=T.useState(!1),[b,N]=T.useState(null),y=T.useCallback(o=>{const d=l[o],R=n[o]||null,D=d?.label||`Station ${o+1}`,O=d?.segments||[];return J(o,D,O,R,m,"CRCA",s||1.5)},[l,n,c,s,m]),z=T.useMemo(()=>l.length===0?J(0,"Demo Station 1",[{type:"line",startX:-80,startY:0,endX:-50,endY:0},{type:"arc",startX:-50,startY:0,endX:-40,endY:10,centerX:-50,centerY:10,radius:10,startAngle:270,endAngle:360},{type:"line",startX:-40,startY:10,endX:-40,endY:40},{type:"line",startX:-40,startY:40,endX:40,endY:40},{type:"line",startX:40,startY:40,endX:40,endY:10},{type:"arc",startX:40,startY:10,endX:50,endY:0,centerX:50,centerY:10,radius:10,startAngle:180,endAngle:270},{type:"line",startX:50,startY:0,endX:80,endY:0}],null,m,"CRCA",1.5):y(Math.min(r,l.length-1)),[y,r,l.length,m]),e=T.useCallback(async o=>{N(o);try{const d=y(o),D=(l[o]?.label||`Station_${o+1}`).replace(/\s+/g,"_").toUpperCase(),O=`ST${String(o+1).padStart(2,"0")}_${D}.svg`,S=new Blob([d],{type:"image/svg+xml"}),x=document.createElement("a");x.href=URL.createObjectURL(S),x.download=O,x.click(),URL.revokeObjectURL(x.href)}finally{N(null)}},[y,l]),a=T.useCallback(async()=>{j(!0);try{const o=new $e,d=o.folder("Roll_Data_Files"),R=Math.max(l.length,1);for(let x=0;x<R;x++){const u=y(x),I=(l[x]?.label||`Station_${x+1}`).replace(/\s+/g,"_").toUpperCase(),P=`ST${String(x+1).padStart(2,"0")}_${I}.svg`;d.file(P,u)}const D=["Station,Label,Upper OD,Upper ID,Upper Width,Lower OD,Lower ID,Lower Width,Roll Gap,Phase,Material"];for(let x=0;x<l.length;x++){const u=n[x],g=l[x];D.push([x+1,g?.label||`ST-${x+1}`,u?.upperRollOD||"",u?.upperRollID||"",u?.upperRollWidth||"",u?.lowerRollOD||"",u?.lowerRollID||"",u?.lowerRollWidth||"",u?.rollGap||"",u?.behavior?.phase||"MAIN",u?.mfgSpec?.rollMaterial||"EN31"].join(","))}d.file("Roll_Data_Index.csv",D.join(`
`));const O=await o.generateAsync({type:"blob"}),S=document.createElement("a");S.href=URL.createObjectURL(O),S.download=`${m.replace(/\s+/g,"_")}_Roll_Data_Files.zip`,S.click(),URL.revokeObjectURL(S.href)}finally{j(!1)}},[y,l,n,m]),p=Math.max(l.length,1),f=Math.min(r,p-1);return t.jsxs("div",{className:"flex flex-col h-full bg-zinc-950 overflow-hidden",children:[t.jsxs("div",{className:"flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/50 shrink-0",children:[t.jsx(be,{className:"w-4 h-4 text-blue-400 shrink-0"}),t.jsx("span",{className:"text-sm font-bold text-zinc-200",children:"Roll Data File Generator"}),t.jsx("span",{className:"text-[9px] text-zinc-500 hidden sm:block",children:"Har station ke liye alag SVG — UP roll / Strip profile / DOWN roll"}),t.jsxs("div",{className:"ml-auto flex items-center gap-2",children:[t.jsx("input",{value:m,onChange:o=>i(o.target.value),placeholder:"Project name...",className:"text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-0.5 w-40"}),t.jsxs("button",{onClick:a,disabled:k,className:"flex items-center gap-1.5 px-3 py-1 rounded border bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-bold transition-all disabled:opacity-50",children:[k?t.jsx(Z,{className:"w-3 h-3 animate-spin"}):t.jsx(ue,{className:"w-3 h-3"}),"Download ZIP (All ",p," Files)"]})]})]}),l.length===0&&t.jsxs("div",{className:"flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[9px] text-amber-400",children:[t.jsx(L,{className:"w-3 h-3 shrink-0"}),"Demo mode — pehle Setup → Flower Pattern → Roll Tooling generate karo. Tabhi real roll data files export honge."]}),l.length>0&&n.length===0&&t.jsxs("div",{className:"flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[9px] text-amber-400",children:[t.jsx(L,{className:"w-3 h-3 shrink-0"}),'Stations mil gaye — lekin Roll Tooling abhi generate nahi hua. Roll Tooling tab mein jaake "Generate" karo phir vapas ao.']}),t.jsxs("div",{className:"flex flex-1 overflow-hidden",children:[t.jsxs("div",{className:"w-44 shrink-0 border-r border-zinc-800/60 bg-zinc-900/30 flex flex-col overflow-hidden",children:[t.jsx("div",{className:"px-2 py-1.5 border-b border-zinc-800/40",children:t.jsxs("span",{className:"text-[9px] text-zinc-500 uppercase tracking-widest",children:["Stations (",p,")"]})}),t.jsx("div",{className:"flex-1 overflow-y-auto p-1.5 space-y-0.5",children:l.length>0?l.map((o,d)=>t.jsx(q,{index:d,label:o.label||`Station ${d+1}`,selected:f===d,onClick:()=>h(d),hasRollData:!!n[d]},d)):t.jsx(q,{index:0,label:"Demo Station 1",selected:!0,onClick:()=>{},hasRollData:!1})}),t.jsxs("div",{className:"p-2 border-t border-zinc-800/40 flex gap-1",children:[t.jsx("button",{onClick:()=>h(o=>Math.max(0,o-1)),disabled:f===0,className:"flex-1 flex items-center justify-center py-1 rounded border border-zinc-700/40 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 transition-all",children:t.jsx(ye,{className:"w-3.5 h-3.5"})}),t.jsxs("span",{className:"text-[9px] text-zinc-600 flex items-center justify-center w-12",children:[f+1,"/",p]}),t.jsx("button",{onClick:()=>h(o=>Math.min(p-1,o+1)),disabled:f===p-1,className:"flex-1 flex items-center justify-center py-1 rounded border border-zinc-700/40 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 transition-all",children:t.jsx(ge,{className:"w-3.5 h-3.5"})})]}),t.jsxs("button",{onClick:()=>e(f),disabled:b!==null,className:"mx-2 mb-2 flex items-center justify-center gap-1.5 py-1.5 rounded border bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25 text-[10px] font-bold transition-all disabled:opacity-50",children:[b===f?t.jsx(Z,{className:"w-3 h-3 animate-spin"}):t.jsx(we,{className:"w-3 h-3"}),"Download ST-",String(f+1).padStart(2,"0")]})]}),t.jsxs("div",{className:"flex-1 overflow-hidden flex flex-col",children:[t.jsxs("div",{className:"flex items-center gap-2 px-3 py-1 border-b border-zinc-800/40 bg-zinc-900/20 shrink-0",children:[t.jsx(Re,{className:"w-3 h-3 text-zinc-500"}),t.jsxs("span",{className:"text-[9px] text-zinc-500",children:["Preview: ST-",String(f+1).padStart(2,"0")," — ",l[f]?.label||"Demo Station"]}),t.jsxs("div",{className:"ml-auto flex gap-2 text-[8px] text-zinc-600",children:[t.jsxs("span",{className:"flex items-center gap-1",children:[t.jsx("span",{className:"w-3 h-0.5 bg-blue-500 inline-block"})," UP Roll"]}),t.jsxs("span",{className:"flex items-center gap-1",children:[t.jsx("span",{className:"w-3 h-0.5 bg-emerald-500 inline-block"})," Strip"]}),t.jsxs("span",{className:"flex items-center gap-1",children:[t.jsx("span",{className:"w-3 h-0.5 bg-red-500 inline-block"})," DN Roll"]})]})]}),t.jsx("div",{className:"flex-1 overflow-auto bg-zinc-800/30 p-4 flex items-center justify-center",children:t.jsx("div",{className:"bg-white rounded shadow-2xl max-w-full",style:{maxHeight:"calc(100vh - 160px)"},dangerouslySetInnerHTML:{__html:z}})})]})]})]})}export{qe as RollDataFileGenerator};
