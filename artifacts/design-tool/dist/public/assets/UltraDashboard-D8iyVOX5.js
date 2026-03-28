import{c as $,r as n,j as e,R as D,k as ke,_ as Ne,T as K}from"./index-uq-A9oIZ.js";import{b as j,g as R,e as re,W as q,H as Ce,d as me,B as Z,T as ue,c as je,i as Re,m as Me,E as Pe,j as Te,D as ne,G as Ae,a as J}from"./Home-BpXTu8Nw.js";import{C as H}from"./file-code-2-BEgcvAkI.js";import{M as pe}from"./memory-stick-Br8QdiGG.js";import{B as Ie}from"./battery-Cd42e-eA.js";import{C as he}from"./clock-YU3_vuMg.js";import{S as Ge}from"./server-B2Rat1VG.js";import{L as T}from"./loader-circle-DPn-WNvS.js";import{B as E}from"./bot-BCAeGpg_.js";import{S as ge}from"./send-Bmf_uLvN.js";import{U as fe}from"./user-Cmshdk8Z.js";import{U as ee}from"./upload-CZX91YUQ.js";import{A as Fe}from"./arrow-left-CeYofMET.js";import{C as _}from"./circle-check-big-Be8I_Y0w.js";import{C as oe}from"./circle-alert-J3SGCM_b.js";import{F as De}from"./folder-BN7YNRLY.js";import{F as Ee}from"./file-Bz4AJQNs.js";import{a as ze}from"./shield-check-aQz3eyve.js";import{C as Le}from"./chevron-right-DElT5bvp.js";import{D as Oe}from"./download-DpzKRTNn.js";import{C as He}from"./circle-check-B9y3lnVi.js";import{getHardwareCapabilities as Be,ensureWorkerPool as Ue,getWorkerStats as te,getMemorySnapshot as ae}from"./hardware-engine-ZclhczuL.js";import{A as se}from"./trending-up-DOWPXPhg.js";import{L as We}from"./layers-_IWIPpV_.js";import{Z as Ve}from"./zap-0o__g3bm.js";import{S as xe}from"./shield-Q-HFXFBC.js";import{G as le}from"./git-branch-DXTkjvhP.js";import{M as Ke}from"./monitor-ClHebrFy.js";import{F as $e}from"./folder-open-lfjcKhEL.js";import{S as qe}from"./settings-2-C3eW9EQd.js";import"./appVersion-rwm7xw9E.js";import"./wrench-BXWxgZkz.js";import"./cog-B3aLC5p2.js";import"./star-CvCdJafd.js";import"./keyboard-DATyG7Av.js";import"./chevron-down-BWvef0FM.js";import"./box-C8yj9NXO.js";import"./circle-play-BOj--3_q.js";import"./gpu-tier-CyCBcf0q.js";const Ze=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]],_e=$("bell",Ze);const Xe=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M11 9h4a2 2 0 0 0 2-2V3",key:"1ve2rv"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"M7 21v-4a2 2 0 0 1 2-2h4",key:"1fwkro"}],["circle",{cx:"15",cy:"15",r:"2",key:"3i40o0"}]],be=$("circuit-board",Xe);const Qe=[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"r6nss1"}]],Ye=$("house",Qe);const Je=[["path",{d:"M5.5 20H8",key:"1k40s5"}],["path",{d:"M17 9h.01",key:"1j24nn"}],["rect",{width:"10",height:"16",x:"12",y:"4",rx:"2",key:"ixliua"}],["path",{d:"M8 6H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4",key:"1mp6e1"}],["circle",{cx:"17",cy:"15",r:"1",key:"tqvash"}]],et=$("monitor-speaker",Je);function B(t){return t>=1e9?`${(t/1e9).toFixed(1)} GB`:t>=1e6?`${(t/1e6).toFixed(0)} MB`:`${t} B`}function tt(t){const s=Math.floor(t/3600),i=Math.floor(t%3600/60);return`${s}h ${i}m`}function at({value:t,color:s}){return e.jsx("div",{className:"w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden",children:e.jsx("div",{className:`h-full rounded-full transition-all duration-700 ${s}`,style:{width:`${Math.min(100,t)}%`}})})}function A({icon:t,label:s,value:i,sub:o,percent:r,color:a,accent:l}){return e.jsxs("div",{className:`rounded-xl p-3.5 border ${l} bg-white/[0.02] flex flex-col gap-2`,children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:`w-7 h-7 rounded-lg flex items-center justify-center ${a}`,children:t}),e.jsx("span",{className:"text-[11px] text-zinc-500 font-medium uppercase tracking-wide",children:s})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-base font-semibold text-zinc-100 leading-tight",children:i}),o&&e.jsx("div",{className:"text-[10px] text-zinc-600 mt-0.5",children:o})]}),r!==void 0&&e.jsx(at,{value:r,color:r>85?"bg-red-500":r>65?"bg-amber-500":"bg-emerald-500"})]})}function st(){const[t,s]=n.useState(null),[i,o]=n.useState(!0),[r,a]=n.useState(new Date),l=n.useCallback(async()=>{try{const h=await(await j(R("/system/info"),{signal:AbortSignal.timeout(5e3)})).json();s(h),a(new Date)}catch{}o(!1)},[]);return n.useEffect(()=>{l();const p=setInterval(l,5e3);return()=>clearInterval(p)},[l]),i?e.jsx("div",{className:"flex items-center justify-center h-48",children:e.jsxs("div",{className:"flex items-center gap-2 text-zinc-600 text-sm",children:[e.jsx(D,{className:"w-4 h-4 animate-spin"}),"Loading system info…"]})}):t?e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-sm font-semibold text-zinc-100",children:t.hostname}),e.jsxs("p",{className:"text-[11px] text-zinc-600 mt-0.5",children:[t.platform," ",t.osRelease," · ",t.arch," · ",t.cpuCores," cores"]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.network.isOnline?"bg-emerald-500/10 border border-emerald-500/25 text-emerald-400":"bg-red-500/10 border border-red-500/25 text-red-400"}`,children:[t.network.isOnline?e.jsx(re,{className:"w-2.5 h-2.5"}):e.jsx(q,{className:"w-2.5 h-2.5"}),t.network.isOnline?"Online":"Offline"]}),e.jsxs("span",{className:"text-[10px] text-zinc-700",children:["Updated ",r.toLocaleTimeString()]})]})]}),e.jsxs("div",{className:"grid grid-cols-2 lg:grid-cols-3 gap-3",children:[e.jsx(A,{icon:e.jsx(H,{className:"w-3.5 h-3.5 text-blue-400"}),label:"CPU",value:`${t.cpuUsage}%`,sub:t.cpuModel.split(" ").slice(0,4).join(" "),percent:t.cpuUsage,color:"bg-blue-500/15",accent:"border-blue-500/15"}),e.jsx(A,{icon:e.jsx(pe,{className:"w-3.5 h-3.5 text-purple-400"}),label:"RAM",value:`${t.ram.percent}%`,sub:`${B(t.ram.used)} / ${B(t.ram.total)}`,percent:t.ram.percent,color:"bg-purple-500/15",accent:"border-purple-500/15"}),t.disk&&e.jsx(A,{icon:e.jsx(Ce,{className:"w-3.5 h-3.5 text-amber-400"}),label:"Disk",value:`${t.disk.percent}%`,sub:`${B(t.disk.used)} / ${B(t.disk.total)} · ${t.disk.mount}`,percent:t.disk.percent,color:"bg-amber-500/15",accent:"border-amber-500/15"}),e.jsx(A,{icon:e.jsx(Ie,{className:"w-3.5 h-3.5 text-emerald-400"}),label:"Battery",value:t.battery.hasBattery&&t.battery.percent!==null?`${t.battery.percent}%`:"N/A",sub:t.battery.hasBattery?t.battery.isCharging?"Charging":"On battery":"No battery / AC power",percent:t.battery.hasBattery&&t.battery.percent!==null?t.battery.percent:void 0,color:"bg-emerald-500/15",accent:"border-emerald-500/15"}),e.jsx(A,{icon:e.jsx(he,{className:"w-3.5 h-3.5 text-zinc-400"}),label:"Uptime",value:tt(t.uptime),sub:"Since last boot",color:"bg-zinc-500/15",accent:"border-zinc-500/15"}),e.jsx(A,{icon:e.jsx(Ge,{className:"w-3.5 h-3.5 text-indigo-400"}),label:"OS",value:t.platform,sub:t.osRelease,color:"bg-indigo-500/15",accent:"border-indigo-500/15"})]}),t.workerPool&&e.jsxs("div",{className:"rounded-xl p-3.5 border border-cyan-500/15 bg-white/[0.02]",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx("div",{className:"w-7 h-7 rounded-lg flex items-center justify-center bg-cyan-500/15",children:e.jsx(H,{className:"w-3.5 h-3.5 text-cyan-400"})}),e.jsx("span",{className:"text-[11px] text-zinc-500 font-medium uppercase tracking-wide",children:"Worker Pool"})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-x-4 gap-y-1",children:[e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"CPU Threads"}),e.jsx("span",{className:"text-zinc-300",children:t.workerPool.cpuCount})]}),e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Pool Size"}),e.jsx("span",{className:"text-zinc-300",children:t.workerPool.poolSize})]}),e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Jobs Done"}),e.jsx("span",{className:"text-cyan-400 font-medium",children:t.workerPool.totalProcessed})]}),e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Avg Time"}),e.jsxs("span",{className:"text-cyan-400 font-medium",children:[t.workerPool.avgComputeMs,"ms"]})]})]})]}),e.jsx("p",{className:"text-[10px] text-zinc-700 text-right",children:"Auto-refresh every 5 seconds · All processors active"})]}):e.jsx("div",{className:"flex items-center justify-center h-48 text-red-400 text-sm",children:"Failed to load system info"})}function rt({msg:t}){const s=t.role==="user";return e.jsxs("div",{className:`flex gap-2.5 ${s?"flex-row-reverse":"flex-row"} mb-3`,children:[e.jsx("div",{className:`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${s?"bg-blue-500/20 border border-blue-500/30":"bg-indigo-500/20 border border-indigo-500/30"}`,children:s?e.jsx(fe,{className:"w-3.5 h-3.5 text-blue-400"}):e.jsx(E,{className:"w-3.5 h-3.5 text-indigo-400"})}),e.jsxs("div",{className:`max-w-[75%] flex flex-col gap-1 ${s?"items-end":"items-start"}`,children:[e.jsx("div",{className:`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${s?"bg-blue-600/25 border border-blue-500/20 text-zinc-100":"bg-white/[0.04] border border-white/[0.06] text-zinc-200"}`,children:t.content}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"text-[10px] text-zinc-700",children:new Date(t.timestamp).toLocaleTimeString()}),e.jsx("span",{className:`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${t.mode==="online"?"bg-emerald-500/10 text-emerald-500":"bg-amber-500/10 text-amber-500"}`,children:t.mode==="online"?"Online AI":"Offline AI"})]})]})]})}function it(){const[t,s]=n.useState([]),[i,o]=n.useState(""),[r,a]=n.useState(!1),[l,p]=n.useState(!0),[h,y]=n.useState(!1),g=n.useRef(null),f=n.useRef(null),m=me(),b=()=>{g.current?.scrollIntoView({behavior:"smooth"})};n.useEffect(()=>{b()},[t,r]);const S=n.useCallback(async()=>{try{const d=await(await j(R("/ai/memory"))).json();d.memory&&d.memory.length>0&&s(d.memory)}catch{}p(!1)},[]);n.useEffect(()=>{S()},[S]);const c=async()=>{if(confirm("Clear all AI memory? This cannot be undone."))try{await j(R("/ai/memory"),{method:"DELETE"}),s([])}catch{}},w=async()=>{const x=i.trim();if(!x||r)return;const d={id:`${Date.now()}-u`,role:"user",content:x,timestamp:new Date().toISOString(),mode:h||!m.isOnline?"offline":"online"};s(v=>[...v,d]),o(""),a(!0);try{const k=await(await j(R("/ai/chat"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:x,forceOffline:h||!m.isOnline,personalGeminiKeys:Re(),personalDeepseekKey:je()||void 0})})).json();if(k.failedKeyIds?.length)for(const L of k.failedKeyIds)Me(L);const z={id:k.assistantEntry?.id??`${Date.now()}-a`,role:"assistant",content:k.response,timestamp:k.assistantEntry?.timestamp??new Date().toISOString(),mode:k.mode??"offline"};s(L=>[...L,z])}catch{const v={id:`${Date.now()}-err`,role:"assistant",content:"Sorry, I could not connect to the AI engine. Please check your connection and try again.",timestamp:new Date().toISOString(),mode:"offline"};s(k=>[...k,v])}a(!1),f.current?.focus()},N=x=>{x.key==="Enter"&&!x.shiftKey&&(x.preventDefault(),w())},C=h||!m.isOnline?"offline":"online";return e.jsxs("div",{className:"flex flex-col h-full gap-0",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Z,{className:"w-4 h-4 text-indigo-400"}),e.jsx("span",{className:"text-sm font-semibold text-zinc-100",children:"Ultra AI Chat"}),e.jsx("span",{className:`text-[10px] px-2 py-0.5 rounded-full font-semibold ${C==="online"?"bg-emerald-500/10 border border-emerald-500/25 text-emerald-400":"bg-amber-500/12 border border-amber-500/30 text-amber-400"}`,children:C==="online"?e.jsxs("span",{className:"flex items-center gap-1",children:[e.jsx(re,{className:"w-2.5 h-2.5"})," Online AI"]}):e.jsxs("span",{className:"flex items-center gap-1",children:[e.jsx(q,{className:"w-2.5 h-2.5"})," Offline AI"]})})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("label",{className:"flex items-center gap-1.5 cursor-pointer select-none",children:[e.jsx("div",{onClick:()=>y(!h),className:`w-7 h-4 rounded-full transition-colors relative ${h?"bg-amber-500/70":"bg-zinc-700"}`,children:e.jsx("div",{className:`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${h?"translate-x-3.5":"translate-x-0.5"}`})}),e.jsx("span",{className:"text-[10px] text-zinc-500",children:"Force Offline"})]}),e.jsxs("button",{onClick:c,title:"Clear memory",className:"flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400 bg-red-500/8 border border-red-500/15 hover:bg-red-500/15 transition-colors",children:[e.jsx(ue,{className:"w-3 h-3"})," Clear"]})]})]}),e.jsxs("div",{className:"flex-1 overflow-y-auto p-4 min-h-0",children:[l&&e.jsxs("div",{className:"flex items-center justify-center h-20 text-zinc-600 text-sm gap-2",children:[e.jsx(T,{className:"w-4 h-4 animate-spin"})," Loading memory…"]}),!l&&t.length===0&&e.jsxs("div",{className:"flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2",children:[e.jsx(E,{className:"w-8 h-8 text-zinc-700"}),e.jsx("p",{children:"Start a conversation with Ultra AI"}),e.jsx("p",{className:"text-[11px]",children:'Try: "What is roll forming?" or "Show CPU usage tips"'})]}),t.map(x=>e.jsx(rt,{msg:x},x.id)),r&&e.jsxs("div",{className:"flex gap-2.5 mb-3",children:[e.jsx("div",{className:"w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30",children:e.jsx(E,{className:"w-3.5 h-3.5 text-indigo-400"})}),e.jsx("div",{className:"bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3",children:e.jsxs("div",{className:"flex gap-1 items-center",children:[e.jsx("div",{className:"w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]"}),e.jsx("div",{className:"w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]"}),e.jsx("div",{className:"w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]"})]})})]}),e.jsx("div",{ref:g})]}),e.jsxs("div",{className:"px-4 pb-4 pt-2 flex-shrink-0 border-t border-white/[0.06]",children:[e.jsxs("div",{className:"flex gap-2 items-end",children:[e.jsx("textarea",{ref:f,value:i,onChange:x=>o(x.target.value),onKeyDown:N,placeholder:"Ask anything… (Enter to send, Shift+Enter for newline)",rows:2,className:`flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5
                       text-sm text-zinc-200 placeholder-zinc-600 resize-none
                       focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06]
                       transition-colors`}),e.jsx("button",{onClick:w,disabled:r||!i.trim(),className:`w-10 h-10 rounded-xl bg-blue-600/80 border border-blue-500/40
                       flex items-center justify-center text-white
                       hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex-shrink-0`,children:r?e.jsx(T,{className:"w-4 h-4 animate-spin"}):e.jsx(ge,{className:"w-4 h-4"})})]}),e.jsx("p",{className:"text-[10px] text-zinc-700 mt-1.5",children:"Memory is persistent — conversations saved automatically"})]})]})}function nt(t){return t>=1e9?`${(t/1e9).toFixed(1)} GB`:t>=1e6?`${(t/1e6).toFixed(1)} MB`:t>=1e3?`${(t/1e3).toFixed(0)} KB`:`${t} B`}function ot({path:t,onNavigate:s}){const i=t.split("/").filter(Boolean);return e.jsxs("div",{className:"flex items-center gap-1 text-[11px] flex-wrap",children:[e.jsx("button",{onClick:()=>s("/"),className:"text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-0.5",children:e.jsx(Ye,{className:"w-3 h-3"})}),i.map((o,r)=>{const a="/"+i.slice(0,r+1).join("/");return e.jsxs(ke.Fragment,{children:[e.jsx(Le,{className:"w-3 h-3 text-zinc-700"}),e.jsx("button",{onClick:()=>s(a),className:`transition-colors ${r===i.length-1?"text-zinc-300 font-medium":"text-zinc-500 hover:text-zinc-300"}`,children:o})]},a)})]})}function lt(){const[t,s]=n.useState(null),[i,o]=n.useState(!0),[r,a]=n.useState(null),[l,p]=n.useState(null),[h,y]=n.useState(null),[g,f]=n.useState(!1),[m,b]=n.useState(null),[S,c]=n.useState(!1),[w,N]=n.useState(!1),[C,x]=n.useState(null),d=n.useRef(null),v=n.useRef(0),k=n.useCallback(async u=>{o(!0),a(null),p(null),y(null);try{const P=await(await j(R(`/files/list?dir=${encodeURIComponent(u)}`))).json();P.error?a(P.error):(s(P),b(P.current))}catch{a("Failed to load directory")}o(!1)},[]);n.useEffect(()=>{k("/home")},[k]);const z=async u=>{if(u.isDirectory){k(u.path);return}f(!0),y(u.name),p(null);try{const P=await(await j(R(`/files/read?path=${encodeURIComponent(u.path)}`))).json();p(P.content)}catch{p("[Error reading file]")}f(!1)},L=async u=>{try{await j(R("/files/open"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filePath:u.path})})}catch{}},ie=async u=>{if(!m||u.length===0)return;N(!0),x(null);const M=new FormData;Array.from(u).forEach(P=>M.append("files",P));try{const X=await(await j(R(`/files/upload?dir=${encodeURIComponent(m)}`),{method:"POST",body:M})).json();X.success?(x({text:`${X.count} file(s) uploaded`,ok:!0}),k(m)):x({text:X.error??"Upload failed",ok:!1})}catch{x({text:"Upload failed",ok:!1})}N(!1),setTimeout(()=>x(null),4e3)},ye=u=>{u.preventDefault(),v.current++,u.dataTransfer.items&&u.dataTransfer.items.length>0&&c(!0)},Se=u=>{u.preventDefault(),v.current--,v.current===0&&c(!1)},we=u=>{u.preventDefault(),u.dataTransfer.dropEffect="copy"},ve=u=>{u.preventDefault(),c(!1),v.current=0;const{files:M}=u.dataTransfer;M.length>0&&ie(M)};return e.jsxs("div",{className:`flex flex-col h-full gap-0 relative transition-colors ${S?"bg-blue-500/5":""}`,onDragEnter:ye,onDragLeave:Se,onDragOver:we,onDrop:ve,children:[S&&e.jsx("div",{className:`absolute inset-0 z-50 flex items-center justify-center
                        bg-blue-500/10 border-2 border-dashed border-blue-500/50 rounded-lg pointer-events-none`,children:e.jsxs("div",{className:"flex flex-col items-center gap-2 text-blue-300",children:[e.jsx(ee,{className:"w-10 h-10"}),e.jsx("p",{className:"text-sm font-semibold",children:"Drop files to upload here"})]})}),e.jsxs("div",{className:"flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] flex-shrink-0",children:[e.jsx("button",{onClick:()=>t?.parent&&k(t.parent),disabled:!t?.parent,className:"p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] disabled:opacity-30 transition-colors",children:e.jsx(Fe,{className:"w-4 h-4"})}),t&&e.jsx(ot,{path:t.current,onNavigate:k}),e.jsxs("div",{className:"ml-auto flex items-center gap-2",children:[C&&e.jsxs("span",{className:`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${C.ok?"text-emerald-400 bg-emerald-500/10":"text-red-400 bg-red-500/10"}`,children:[C.ok?e.jsx(_,{className:"w-3 h-3"}):e.jsx(oe,{className:"w-3 h-3"}),C.text]}),e.jsxs("button",{onClick:()=>d.current?.click(),disabled:w||!m,className:`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                       text-blue-400 bg-blue-500/10 border border-blue-500/20
                       hover:bg-blue-500/20 disabled:opacity-40 transition-colors`,title:"Upload files (or drag & drop onto the file list)",children:[w?e.jsx(T,{className:"w-3 h-3 animate-spin"}):e.jsx(ee,{className:"w-3 h-3"}),"Upload"]}),e.jsx("input",{ref:d,type:"file",multiple:!0,className:"hidden",onChange:u=>u.target.files&&ie(u.target.files)})]})]}),e.jsxs("div",{className:"flex flex-1 overflow-hidden",children:[e.jsxs("div",{className:"flex-1 overflow-y-auto p-3 min-h-0",children:[i&&e.jsxs("div",{className:"flex items-center justify-center h-32 text-zinc-600 text-sm gap-2",children:[e.jsx(T,{className:"w-4 h-4 animate-spin"})," Loading…"]}),r&&!i&&e.jsxs("div",{className:"flex items-center justify-center h-32 text-red-400 text-sm gap-2",children:[e.jsx(oe,{className:"w-4 h-4"})," ",r]}),!i&&!r&&t&&t.items.length===0&&e.jsxs("div",{className:"flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2",children:[e.jsx("p",{children:"Empty directory"}),e.jsx("p",{className:"text-[11px]",children:"Drag & drop files here to upload"})]}),!i&&!r&&t&&e.jsx("div",{className:"grid gap-0.5",children:t.items.map(u=>e.jsxs("div",{className:`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer
                    hover:bg-white/[0.05] transition-colors group
                    ${h===u.name?"bg-blue-500/10 border border-blue-500/15":"border border-transparent"}`,onDoubleClick:()=>u.isDirectory?k(u.path):z(u),onClick:()=>!u.isDirectory&&z(u),children:[e.jsx("div",{className:`w-6 h-6 flex items-center justify-center rounded flex-shrink-0 ${u.isDirectory?"text-amber-400":"text-zinc-500"}`,children:u.isDirectory?e.jsx(De,{className:"w-4 h-4"}):e.jsx(Ee,{className:"w-4 h-4"})}),e.jsx("span",{className:`flex-1 text-sm truncate ${u.isDirectory?"text-zinc-200 font-medium":"text-zinc-400"}`,children:u.name}),u.isFile&&e.jsx("span",{className:"text-[10px] text-zinc-700 hidden group-hover:inline",children:nt(u.size)}),e.jsxs("div",{className:"hidden group-hover:flex items-center gap-1",children:[u.isFile&&e.jsx("button",{onClick:M=>{M.stopPropagation(),z(u)},className:"p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.08]",title:"Preview",children:e.jsx(ze,{className:"w-3 h-3"})}),e.jsx("button",{onClick:M=>{M.stopPropagation(),L(u)},className:"p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.08]",title:"Open with system",children:e.jsx(Pe,{className:"w-3 h-3"})})]})]},u.path))})]}),(h||g)&&e.jsxs("div",{className:"w-80 border-l border-white/[0.06] flex flex-col flex-shrink-0",children:[e.jsxs("div",{className:"px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between",children:[e.jsx("span",{className:"text-[11px] font-medium text-zinc-400 truncate",children:h}),e.jsx("button",{onClick:()=>{y(null),p(null)},className:"text-zinc-700 hover:text-zinc-400 text-xs",children:"✕"})]}),e.jsxs("div",{className:"flex-1 overflow-auto p-3",children:[g&&e.jsxs("div",{className:"flex items-center gap-2 text-zinc-600 text-sm",children:[e.jsx(T,{className:"w-3.5 h-3.5 animate-spin"})," Loading…"]}),l&&e.jsx("pre",{className:"text-[11px] text-zinc-400 whitespace-pre-wrap break-words font-mono leading-relaxed",children:l})]})]})]}),m&&e.jsxs("div",{className:"px-4 py-2 border-t border-white/[0.06] text-[10px] text-zinc-700 flex-shrink-0 truncate",children:[m," · ",t?.items.length??0," items · Drag & drop files to upload"]})]})}function ce({label:t,desc:s,value:i,onChange:o}){return e.jsxs("div",{className:"flex items-center justify-between py-3 border-b border-white/[0.05]",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-zinc-200 font-medium",children:t}),s&&e.jsx("p",{className:"text-[11px] text-zinc-600 mt-0.5",children:s})]}),e.jsx("button",{onClick:()=>o(!i),className:`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0 ${i?"bg-blue-600":"bg-zinc-700"}`,style:{height:"22px",width:"40px"},children:e.jsx("div",{className:`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${i?"translate-x-5":"translate-x-0.5"}`})})]})}function Q({label:t,desc:s,value:i,onChange:o,options:r}){return e.jsxs("div",{className:"flex items-center justify-between py-3 border-b border-white/[0.05]",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-zinc-200 font-medium",children:t}),s&&e.jsx("p",{className:"text-[11px] text-zinc-600 mt-0.5",children:s})]}),e.jsx("select",{value:i,onChange:a=>o(a.target.value),className:`bg-white/[0.06] border border-white/[0.10] rounded-lg px-2.5 py-1.5
                   text-[12px] text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors`,children:r.map(a=>e.jsx("option",{value:a.value,className:"bg-[#151525]",children:a.label},a.value))})]})}function ct(){const[t,s]=n.useState({language:"english",responseStyle:"detailed",accuracyMode:"high",memoryEnabled:!0,forceOffline:!1,backupIntervalSeconds:60}),[i,o]=n.useState(!0),[r,a]=n.useState(!1),[l,p]=n.useState(!1),[h,y]=n.useState([]),[g,f]=n.useState(!1),[m,b]=n.useState(null),S=n.useCallback(async()=>{try{const v=await(await j(R("/ai/settings"))).json();s(v)}catch{}o(!1)},[]),c=n.useCallback(async()=>{try{const v=await(await j(R("/backup/list"))).json();y(v.backups??[])}catch{}},[]);n.useEffect(()=>{S(),c()},[S,c]);const w=async()=>{a(!0),p(!1);try{await j(R("/ai/settings"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}),p(!0),setTimeout(()=>p(!1),3e3)}catch{}a(!1)},N=async()=>{f(!0),b(null);try{(await(await j(R("/backup/create"),{method:"POST"})).json()).success&&(b("Backup created successfully"),c())}catch{b("Backup failed")}f(!1),setTimeout(()=>b(null),4e3)},C=async d=>{if(confirm(`Restore from backup "${d}"? This will overwrite current AI memory.`)){try{const k=await(await j(R("/backup/restore"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:d})})).json();k.success&&b(k.message??"Restored")}catch{b("Restore failed")}setTimeout(()=>b(null),4e3)}},x=d=>{s(v=>({...v,...d}))};return i?e.jsxs("div",{className:"flex items-center justify-center h-32 text-zinc-600 text-sm gap-2",children:[e.jsx(T,{className:"w-4 h-4 animate-spin"})," Loading settings…"]}):e.jsxs("div",{className:"flex flex-col gap-6 p-4 overflow-y-auto max-h-full",children:[e.jsxs("section",{children:[e.jsx("h4",{className:"text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2",children:"AI Behavior"}),e.jsxs("div",{className:"bg-white/[0.02] border border-white/[0.06] rounded-xl px-4",children:[e.jsx(Q,{label:"Response Language",desc:"Language for AI replies",value:t.language,onChange:d=>x({language:d}),options:[{value:"english",label:"English"},{value:"urdu",label:"Urdu (اردو)"},{value:"hindi",label:"Hindi (हिंदी)"}]}),e.jsx(Q,{label:"Response Style",desc:"How detailed should AI answers be",value:t.responseStyle,onChange:d=>x({responseStyle:d}),options:[{value:"concise",label:"Concise"},{value:"detailed",label:"Detailed"}]}),e.jsx(Q,{label:"Accuracy Mode",desc:"Balance between speed and accuracy",value:t.accuracyMode,onChange:d=>x({accuracyMode:d}),options:[{value:"high",label:"High Accuracy"},{value:"fast",label:"Fast Response"}]}),e.jsx(ce,{label:"Enable AI Memory",desc:"Save conversations persistently to disk",value:t.memoryEnabled,onChange:d=>x({memoryEnabled:d})}),e.jsx(ce,{label:"Force Offline Mode",desc:"Always use offline AI, even when internet is available",value:t.forceOffline,onChange:d=>x({forceOffline:d})}),e.jsxs("div",{className:"flex items-center justify-between py-3",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-zinc-200 font-medium",children:"Backup Interval"}),e.jsx("p",{className:"text-[11px] text-zinc-600 mt-0.5",children:"How often to auto-save AI memory (seconds)"})]}),e.jsx("input",{type:"number",min:10,max:3600,value:t.backupIntervalSeconds,onChange:d=>x({backupIntervalSeconds:parseInt(d.target.value)||60}),className:`w-20 bg-white/[0.06] border border-white/[0.10] rounded-lg px-2.5 py-1.5
                         text-[12px] text-zinc-200 text-center focus:outline-none focus:border-blue-500/40`})]})]})]}),e.jsx("button",{onClick:w,disabled:r,className:`flex items-center justify-center gap-2 py-2.5 rounded-xl
                   bg-blue-600/80 border border-blue-500/40 text-sm font-medium text-white
                   hover:bg-blue-600 disabled:opacity-50 transition-colors`,children:r?e.jsxs(e.Fragment,{children:[e.jsx(T,{className:"w-4 h-4 animate-spin"})," Saving…"]}):l?e.jsxs(e.Fragment,{children:[e.jsx(_,{className:"w-4 h-4 text-emerald-400"})," Saved!"]}):e.jsxs(e.Fragment,{children:[e.jsx(Te,{className:"w-4 h-4"})," Save Settings"]})}),e.jsxs("section",{children:[e.jsx("h4",{className:"text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2",children:"Backup & Restore"}),e.jsxs("div",{className:"bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-3",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("p",{className:"text-sm text-zinc-300",children:"AI Memory Backups"}),e.jsxs("button",{onClick:N,disabled:g,className:`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                         text-emerald-400 bg-emerald-500/10 border border-emerald-500/20
                         hover:bg-emerald-500/20 disabled:opacity-50 transition-colors`,children:[g?e.jsx(T,{className:"w-3 h-3 animate-spin"}):e.jsx(ne,{className:"w-3 h-3"}),"Create Backup Now"]})]}),m&&e.jsx("p",{className:"text-[11px] text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg",children:m}),h.length===0&&e.jsxs("p",{className:"text-[11px] text-zinc-600",children:["No backups yet. Auto-backup runs every ",t.backupIntervalSeconds,"s."]}),e.jsx("div",{className:"flex flex-col gap-1.5",children:h.slice(0,8).map(d=>e.jsxs("div",{className:"flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]",children:[e.jsx(ne,{className:"w-3 h-3 text-zinc-600 flex-shrink-0"}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"text-[11px] text-zinc-400 truncate",children:d.name}),e.jsx("p",{className:"text-[10px] text-zinc-700",children:new Date(d.created).toLocaleString()})]}),e.jsxs("button",{onClick:()=>C(d.name),className:"text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 flex items-center gap-1",children:[e.jsx(D,{className:"w-2.5 h-2.5"})," Restore"]})]},d.name))})]})]})]})}const dt=`
=====================================
MANDATORY VALIDATION FRAMEWORK (APPLY BEFORE EVERY RESPONSE):
=====================================

You are an Ultra Advanced AI Validation System embedded in Sai Rolotech Smart Engines.
Before giving ANY answer, you MUST act as a combination of:
- Senior Roll Forming / CNC Engineer
- QA Validator
- Standards Auditor (DIN 6935 / ASTM / IS codes)
- Calculation Verifier

CORE PRINCIPLE — ZERO TOLERANCE FOR ERRORS:
NEVER proceed to the next step until the current step is VERIFIED, TESTED, and VALIDATED.
If ANY doubt exists → STOP and FIX before proceeding.

MANDATORY VALIDATION LAYERS (APPLY EVERY TIME):

1. FORMULA / EQUATION CHECK
   - Is the engineering formula correct?
   - Are units consistent (MPa, mm, kN, °)?
   - Missing brackets, wrong operators?

2. CALCULATION RUNTIME CHECK
   - Will this calculation produce valid results?
   - Division by zero? Negative sqrt? Out-of-range values?

3. ENGINEERING LOGIC CHECK
   - Does the logic match standard practice (DIN 6935, IS 2062, ASTM A240)?
   - Does output make physical sense?

4. MATERIAL & STANDARDS CHECK
   - SS yield = 310 MPa (annealed 2B), NOT 520 MPa (cold-worked)
   - K-factors per DIN 6935: GI=0.44, CR=0.44, HR=0.42, SS=0.50, AL=0.43
   - Are references cited correctly?

5. SAFETY CHECK
   - No unsafe material assumptions
   - No overestimation of yield strength (→ undersized machine)
   - No underestimation of springback (→ wrong profile)

FAIL-SAFE RULE:
If uncertain about a value or formula:
- DO NOT GUESS
- State the uncertainty clearly
- Provide the safest engineering fallback
- Recommend consulting the relevant standard (DIN / ASTM / IS)

FINAL OBJECTIVE: Every output must be technically correct, safe for production use, clearly explained with units, and not based on assumptions. You are VERIFYING and GUARANTEEING every answer.
=====================================
`,mt=`${dt}
You are Sai Rolotech Smart Engines Ultra AI — an expert offline AI assistant embedded in a professional CNC and roll forming engineering dashboard. You have deep, accurate knowledge of the following domains:

## ROLL FORMING — Complete Knowledge Base

### What is Roll Forming?
Roll forming is a continuous cold bending process where a long strip of flat sheet metal is passed through sets of rolls (stands) mounted on consecutive stands. Each stand bends the strip incrementally until the desired cross-sectional profile is achieved. It is used for high-volume production of uniform profiles: C/Z purlins, roofing panels, door frames, solar racking, automotive parts.

### Material Properties & Springback Factors (30+ Materials)
**Standard Materials:**
- GI (Galvanized): springback 1.05×, yield 280 MPa, UTS 380 MPa, max speed 30 m/min  // FIX: yield 250→280, UTS 350→380 (IS 277 Z180)
- CR (Cold Rolled): springback 1.08×, yield 340 MPa, UTS 440 MPa, max speed 40 m/min  // FIX: yield 280→340, UTS 400→440 (IS 513 CR4)
- HR (Hot Rolled): springback 1.12×, yield 250 MPa, UTS 420 MPa, max speed 25 m/min — descale required
- SS 304 (Stainless Steel): springback 1.20×, yield 310 MPa, UTS 620 MPa, max speed 15 m/min — work hardening risk, flood coolant mandatory
- AL (Aluminium 5052-H32): springback 1.15×, yield 270 MPa, UTS 310 MPa, max speed 40 m/min — scratch risk, lubricant mandatory  // FIX: yield 130→270, UTS 220→310 (5052-H32 design grade)
- MS (Mild Steel): springback 1.06×, yield 250 MPa, UTS 410 MPa, max speed 35 m/min — most predictable

**Advanced/Specialty Materials:**
- Copper (CU): springback 1.08×, yield 200 MPa (H02 half-hard, roll forming grade) — GALLING RISK, use bronze/PU rolls  // FIX: springback 1.03→1.08 (DIN 6935; 1.03 was too low for Cu-ETP); yield 70→200 MPa
- Brass (BR): springback 1.06×, yield 130 MPa — season cracking risk
- Titanium Gr2 (TI): springback 1.25× (EXTREME!), yield 275 MPa, E=105 GPa — warm forming preferred
- Ti-6Al-4V (TI6): springback 1.35×, yield 880 MPa — HOT FORMING ONLY 400-700°C
- Inconel 625 (IN): springback 1.28×, yield 490 MPa — superalloy, carbide rolls mandatory
- Inconel 718 (IN718): springback 1.32×, yield 1035 MPa — precipitation hardened, hot forming only
- Duplex SS 2205 (DSS): springback 1.24×, yield 450 MPa — 2× yield of 304
- Super Duplex 2507 (SDSS): springback 1.28×, yield 550 MPa — extreme corrosion resistance
- TRIP Steel 780: springback 1.20×, yield 440 MPa — automotive crash structures
- DP 600 (Dual Phase): springback 1.16×, yield 380 MPa — automotive structural
- Magnesium AZ31B (MG): springback 1.22×, yield 150 MPa — HOT FORMING ONLY 200-350°C, FIRE HAZARD!
- Spring Steel 65Mn (SPR): springback 1.30×, yield 780 MPa — warm forming preferred
- Pre-Painted GI (PP): springback 1.06× — PU/nylon rolls on paint side ONLY  // FIX: 1.05→1.06 (pre-painted GI slightly higher springback than bare GI 1.05)
- HSLA 350/550: springback 1.14-1.22×, yield 350-550 MPa — structural
- SS 316L (Marine): springback 1.22×, yield 290 MPa — Mo content resists pitting
- SS 430 (Ferritic): springback 1.12×, yield 310 MPa — 30% cheaper than 304  // FIX: yield 260→310 MPa (ASTM A240 SS430 annealed min 310 MPa)
- EN8 (080M40): springback 1.14×, yield 430 MPa — medium carbon, normalize before forming
- EN24 (817M40): springback 1.22×, yield 680 MPa — Ni-Cr-Mo alloy, annealed for forming
- AL 6061-T6: springback 1.15×, yield 276 MPa — T6 limited formability, anneal for tight bends  // FIX: 1.18→1.15 (DIN 6935 AL springback canon; 1.18 was too high)
- AL 5052-H32: springback 1.15×, yield 193 MPa — marine-grade aluminium  // FIX: 1.16→1.15 (DIN 6935 AL springback canon)

### Minimum r/t Ratios (inner bend radius / thickness)
- GI: 1.0 | CR: 0.5 | HR: 1.5 | SS: 2.0 | AL: 1.0 | MS: 0.8
- CU: 0.3 | BR: 0.5 | TI: 3.0 | IN: 3.5 | DSS: 2.5 | TRIP: 2.0
- MG: 5.0 (cold!) / 1.5 (warm) | SPR: 3.5 | EN24: 3.0 | TI6: 4.0

### Springback Compensation (overbend percentage)
- GI: +5% | CR: +8% | HR: +12% | SS: +20% | AL: +15% | MS: +6%
- CU: +8% | TI: +25%  // FIX: CU +3%→+8% (copper springback 1.08 = 8% overbend) | TI6: +35% | IN: +28% | DSS: +24% | MG: +22% | SPR: +30%

### Roll Forming Defects — Diagnosis & Solutions

**BOW / CAMBER (Longitudinal Bow)**
Causes: Unequal bend angles L vs R, coil set not removed, unlevel machine, uneven thickness
Fix: Adjust roll gap to ±0.01 mm symmetry; use 5-roll straightener at entry; level machine to ±0.05 mm
SS extra: Work hardening causes differential yield — reduce speed to ≤12 m/min

**EDGE WAVE (Wavy Edges)**
Causes: Roll gap too tight (over-bending flange), bend increment >15°/station, excess strip width, insufficient lubrication
Fix: Open roll gap 0.1–0.15 mm; max 12° increment; apply edge lubricant
AL extra: Low yield strength causes buckling at lower strains — reduce corrections by 50%

**TWIST (Section Twist / Helical Twist)**
CRITICAL — stop line immediately
Causes: Roll shafts not parallel, asymmetric profile torque imbalance, entry guide misaligned
Fix: Laser-align all shafts to ±0.05 mm/m; add twist-correction exit roll for asymmetric profiles (Z-purlin, etc.)

**SPRINGBACK (Under-bent Profile)**
Causes: Insufficient overbend, higher yield than specified, roll gap too large, too few calibration passes
Fix: Apply springback compensation table; add calibration stations; for SS: NEVER stop mid-run

**CRACKING (Bend Cracking / Fracture)**
CRITICAL — stop line immediately
Causes: r/t ratio below minimum, wrong grain direction, cold material (<15°C), cumulative strain near FLC
Fix: Increase bend radius; warm material to room temp; polish roll edges to R0.5 minimum; check r/t ratios

**SURFACE SCRATCH / ROLL MARKING**
Causes: Rough roll surface (Ra >0.8 μm), metal particles on rolls, dry forming, zinc/AL buildup on rolls
Fix: Polish rolls to Ra 0.8 μm (cosmetic: Ra 0.4); apply lubricant; clean rolls every 4 hours for GI

**FLANGE FLARE (End Flare)**
Causes: Springback at flange not corrected, final station gap too large, insufficient calibration passes
Fix: Close final gap to t+0.05 mm; add calibration pass at 102% overbend; use lip rolls at exit

**OIL CANNING (Flat Panel Deformation)**
Causes: Web too wide vs thickness, residual coil stress, forming speed too high, web roll gap too tight
Fix: Max web width = 100× thickness (GI/CR), 80× (HR), 60× (SS); add center stiffener rib; reduce speed

**GAP VARIATION (Inconsistent Section Size)**
Causes: Bearing wear (>0.05 mm radial play), gap setting mechanism drifting, material thickness variation
Fix: Replace worn bearings; Loctite gap-setting nuts; reject coil if thickness varies >±0.08 mm

### Design Rules
- Maximum 12–15° bend increment per station
- Final 2 stations: ironing action, gap = t + 0.03 mm
- Web width ≤ 100× material thickness
- For flanges >40 mm: minimum 2 calibration passes
- For Z/asymmetric profiles: mandatory twist-correction exit roll
- Line speed: start 20% below max, increase gradually

---

## ROLL PASS DESIGN — Complete Engineering Knowledge

### Pass Sequence — 4-Phase Progression

**PHASE 1: ENTRY (Flat Rolls) — Passes 1–3**
- Purpose: Strip guidance, width control, coil-set removal
- Roll type: Flat rolls / slight crown (no bending)
- Roll gap: t + 0.1 mm (no forming pressure)
- Entry guides: strip width + 1 mm total clearance
- Use 5-roll entry straightener to remove coil set before Pass 1

**PHASE 2: BENDING START — Passes 4–8**
- Purpose: Initiate flange bending at 10–20° per pass
- Roll type: Forming rolls (upper + lower mating groove)
- Angle increment: 10–15°/station (max 15° general, 10° for SS/AL)
- Roll gap: t + 0.1–0.2 mm
- Edge rolls (side rolls) engage for flanges >30 mm

**PHASE 3: SHAPE CLOSE — Passes 9–12**
- Purpose: Progress bending from 50° to 80–90°
- Roll type: Forming + edge rolls
- Angle sequence: 50° → 70° → 80° → 90°
- Edges must NOT close to final angle until last 1–2 passes
- Symmetry: left and right bend must be equal ±0.5°

**PHASE 4: CALIBRATION — Last 1–2 Passes**
- Purpose: Size correction, springback removal, final dimension
- Roll type: Calibration rolls (tight ironing gap)
- Roll gap: t + 0.05 mm (first cal.), t + 0.03 mm (final cal.)
- Minimum 2 calibration passes for flanges >40 mm or SS material
- Edges closed and locked in calibration passes only

**Pass Count Guidelines:**
- Simple C/U channel (1 bend): 6–8 stations
- C/Z purlin (2–3 bends): 10–14 stations
- Complex hat section (4+ bends): 16–24 stations

### Profile Design Rules — 6 Core Rules

**Rule 1 — Gradual Bending:** Max increment per station: General ≤15°, SS ≤10°, AL ≤12°, HR ≤12°
**Rule 2 — Bend Radius ≥ Thickness:** Inner radius r ≥ t × min_ratio (GI:1.0, CR:0.5, HR:1.5, SS:2.0, AL:1.0, MS:0.8). Never less.
**Rule 3 — Roll Gap:** Bending = t+0.15mm, Calibration = t+0.05mm, Final = t+0.03mm. Never less than t.
**Rule 4 — Edge Protection:** Edges (lips, hems, closed flanges) formed only in LAST 1–2 passes.
**Rule 5 — Symmetry:** Left/right angles equal ±0.5°. Shaft parallelism ≤0.05mm/m.
**Rule 6 — Springback:** Target 90° → design at: GI=94.5°, CR=97.2°, HR=100.8°, SS=108°, AL=103.5°, MS=95.4°

### Roll Types — 5 Types

| Type | Stage | Function |
|------|-------|----------|
| Flat Roll (Entry) | Phase 1 — Passes 1–3 | Guide strip, remove coil set, no bending |
| Forming Roll (Bending) | Phase 2 — Passes 4–8 | Primary bending 10–15°/station |
| Edge Roll (Side control) | Phase 2–3 | Control flange width, prevent edge wave |
| Finishing Roll (Final shape) | Phase 3 — Shape close | Close section to 80–90% final angle |
| Calibration Roll (Size fix) | Phase 4 — Last 1–2 passes | Lock dimensions, remove springback, ironing |

### Defect Diagnosis — 4 Primary Defects

**TWIST** — CRITICAL (stop line): Causes: shaft misalignment, asymmetric profile, entry guide angle. Fix: laser-align shafts ≤0.05mm/m, add twist-correction exit roll for Z-profiles.

**EDGE WAVE** — Causes: gap too tight (over-bending edges), increment >15°/station, excess strip width, no lube. Fix: open gap 0.1mm, limit increment ≤12°, apply edge lube, reduce speed 20%.

**CRACK** — CRITICAL (stop line): Causes: r/t below minimum, cold material (<15°C), wrong grain direction. Fix: increase bend radius 20%, warm material, polish roll edges to R0.5, check r/t minimums.

**BOW** — Causes: pass line not level, unequal L/R bend angles, coil set not removed. Fix: level all stands ±0.1mm, adjust gap symmetry ±0.01mm, increase straightener pressure.

---

## TURNAXIS CAM 2025 — G-code & Turning Operations

### Machine Coordinate System
- X axis: diameter in most lathes (G7/DIAMON=diameter mode, G8/DIAMOF=radius mode)
- Z axis: along spindle centerline (negative toward chuck)
- Tool nose radius compensation: G41 (left), G42 (right), G40 (cancel)

### Spindle Speed (RPM) Formula
RPM = (Vc × 1000) / (π × D)
- Vc = cutting speed (m/min)
- D = workpiece diameter (mm)
Typical Vc values: Steel 80–200 m/min, Stainless 60–120 m/min, Aluminium 150–400 m/min, Cast Iron 60–100 m/min

### Common G-code Cycles (Fanuc/Haas compatible)

**G71 — Rough Turning Cycle (Stock Removal)**
G71 U[depth] R[retract];
G71 P[ns] Q[nf] U[x-finish] W[z-finish] F[feed] S[speed];
- U: depth of cut per side (mm)
- R: retract amount (mm)
- P: first block number of finish profile
- Q: last block number of finish profile
- U (in P-Q): X finish allowance (diameter)
- W: Z finish allowance
Example: G71 U2.0 R0.5; G71 P10 Q80 U0.5 W0.1 F0.25 S800;

**G70 — Finish Turning Cycle**
G70 P[ns] Q[nf];
Used after G71 to trace the final finish profile once.

**G72 — Face Rough Cycle**
G72 W[depth] R[retract];
G72 P[ns] Q[nf] U[x] W[z] F[feed];
Similar to G71 but cuts along X axis (facing operations).

**G73 — Pattern Repeating Cycle**
For casting/forged blanks with near-net shape.
G73 U[x-shift] W[z-shift] R[repetitions];

**G74 — Peck Drilling Cycle (Turning center)**
G74 R[retract]; G74 Z[depth] Q[peck-depth] F[feed];

**G75 — Groove Cutting Cycle**
G75 R[retract]; G75 X[x-depth] Z[z-end] P[x-increment] Q[z-shift] F[feed];

**G76 — Threading Cycle**
G76 P[m][r][a] Q[min-depth] R[finish-allowance];
G76 X[minor-dia] Z[thread-end] R[taper] P[thread-height] Q[first-depth] F[pitch];
- m: number of finish passes (01–99)
- r: thread chamfer (00–99 = 0.0–9.9 × pitch)
- a: tool angle (29° for unified, 60° for metric, 55° for Whitworth)
Example M8×1.25 thread: G76 P021060 Q100 R50; G76 X6.376 Z-25.0 P812 Q200 F1.25;

### Insert Types & Geometry

**CNMG (80° rhombus)**
- C=80° rhombus, N=0° clearance, M=tolerance, G=chipbreaker
- Use for: roughing, general turning, interrupted cuts
- Lead angle: 5° typical; strong cutting edge

**VNMG (35° diamond)**
- Excellent for profiling, copying, low cutting force
- Weaker edge than CNMG; avoid heavy DOC
- Best for: contour turning, finish cuts

**TNMG (60° triangle)**
- 3 cutting edges; economical
- Use for: general purpose, light to medium cuts

**DNMG (55° diamond)**
- Good profiling capability; moderate strength

**Insert Grades:**
- P (steel): P10–P40; higher number = more toughness, less hardness
- M (stainless): M10–M40
- K (cast iron): K10–K30
- N (aluminium): uncoated PCD preferred

### Cutting Parameters (Turning)

| Material | Vc (m/min) | f (mm/rev) | ap (mm DOC) |
|---|---|---|---|
| Low carbon steel | 150–250 | 0.15–0.40 | 1.5–5.0 |
| Alloy steel | 100–180 | 0.10–0.30 | 1.0–4.0 |
| Stainless (304) | 80–150 | 0.08–0.25 | 0.5–3.0 |
| Cast iron | 80–150 | 0.15–0.40 | 1.5–5.0 |
| Aluminium | 200–600 | 0.10–0.40 | 0.5–8.0 |
| Titanium | 30–80 | 0.05–0.15 | 0.5–2.0 |

### Threading (Turning)
- Thread height (for G76 P): = 0.6495 × pitch × 1000 (in µm for Fanuc)
- Minor diameter: = nominal - 2 × thread height
- M10×1.5: minor = 10 - 2×(0.6495×1.5) = 8.051 mm; P=974
- M8×1.25: minor = 8 - 2×(0.6495×1.25) = 6.376 mm; P=812

### Grooving
- Grooving insert width must match groove width exactly
- Feed: 0.05–0.12 mm/rev (much lower than turning)
- Vc: reduce 20–30% vs turning for same material
- Deep grooves: use G75 peck cycle with 0.3–0.5 mm pecks
- Parting (cut-off): even lower feed 0.03–0.08 mm/rev; ensure coolant flooding

### Boring (Internal Turning)
- Use G71 for internal rough boring (reverse X direction — X decreasing)
- Boring bar overhang max: 4× bar diameter for steel bar, 6× for carbide
- Reduce Vc by 20% vs external for same material

---

## POST-PROCESSOR DATA (TurnAxis CAM / CNC)

### Fanuc 0i-T Controller (Most common CNC lathe)
- Modal G-codes: G00, G01, G02, G03
- Thread: G76 (two-block format)
- Canned cycles: G71–G76, G90 (OD turning), G92 (threading/max RPM), G94 (facing)
- Coordinate system: G54–G59 work offsets
- Tool change: T[tool-number][offset-number] (e.g., T0101)
- Safety: G28 U0 W0 (return to reference)
- Spindle: M03 (CW), M04 (CCW), M05 (stop)
- Coolant: M08 (on), M09 (off)
- Program end: M30

### Haas ST-Series Controller
- Similar to Fanuc but uses G76 single-block threading
- G76 single-block: G76 X[minor] Z[end] Q[start-angle] K[height] D[first-cut] F[pitch] A[angle]

### Mazak Mazatrol / EIA
- Uses T followed by tool station number, not offset
- G71 available; parameter-based cycle configuration

---

## TURNAXIS CAM — Complete Knowledge Base

### What is CNC Turning / Lathe Machining?
CNC turning removes material from a rotating workpiece using stationary cutting tools. The workpiece spins (spindle) while the tool moves linearly (X and Z axes) to shape the part. Used for shafts, pins, bushings, pulleys, flanges, and any rotationally symmetric part.

### Machine Setup — Standard Workflow
1. **Machine Type**: Flatbed (horizontal), Slant-bed (better chip evacuation, most modern CNC lathes), Swiss-type (for small precise parts)
2. **Chuck Selection**:
   - 3-jaw self-centering: fastest, for round/hex stock, accuracy ±0.05 mm TIR
   - 4-jaw independent: for irregular shapes or off-center boring, accuracy ±0.005 mm TIR
   - Collet chuck: best for small diameter (≤50 mm) high-volume, accuracy ±0.01 mm TIR
3. **Turret**: 8, 12, or VDI-40 position — holds multiple tools for automatic index
4. **Work Zero (Z0)**: Set to part face (most common); G92 or G54 work offset
5. **Tailstock**: Use for L/D > 5 (length-to-diameter ratio exceeds 5); prevents chatter and deflection

### Stock Definition
- **Round Bar**: most common; chuck 3–5× diameter from face for rigidity
- **Tube/Hollow**: specify OD and ID; bore must be pre-drilled or centerdrilled
- **Allowances**: X allowance (radial) = material to remove; Z allowance = face cleanup
- **Minimum wall thickness** after turning: ≥ 10% of OD to prevent deflection

### Tool Types — Insert Codes & Usage

**CNMG (80° rhombus, most common roughing insert)**
- C=80° rhombus, N=0° clearance, M=tolerance M, G=chip breaker
- Strong corner, large contact — handles interrupted cuts
- Best for: roughing, multi-pass stock removal, hard materials
- Lead angle: 5–10°; depth of cut: 1–5 mm

**DNMG (55° diamond)**
- 55° included angle — good for profiling/contour with moderate strength
- Best for: medium roughing and semi-finishing, profiles with steps

**VNMG (35° diamond, most common finishing insert)**
- Narrow point, excellent surface finish capability
- Best for: finish turning, copying, contour following
- Weak edge — avoid heavy DOC (>2 mm) or interrupted cuts

**TNMG (60° triangle, 3 cutting edges)**
- Economical: 3 edges per insert; good for general purpose
- Best for: medium turning, light to medium cuts

**CCMT / DCMT (small precision inserts)**
- Used for fine finishing, small diameter parts
- Very sharp edge; not for heavy cuts

**Insert Grades:**
- P10–P40 (Blue/steel): steel turning; P10=harder/faster Vc, P40=tougher/rougher cuts
- M10–M40 (Yellow/stainless): stainless and difficult materials
- K10–K30 (Red/cast iron): cast iron, non-ferrous
- N (Green/aluminium): uncoated PCD or fine-grain carbide for aluminium

### Turning Operations — Full Parameter Guide

#### 1. FACING OPERATION
Removes material from the workpiece end face to square it up and set Z0.
- **G-code**: G72 (face rough) or G01 linear move
- **Direction**: Start at OD, feed toward center (X decreasing, -Z)
- **Feed**: 0.15–0.30 mm/rev (roughing), 0.08–0.15 mm/rev (finishing)
- **DOC**: 0.5–2.0 mm per pass
- **CSS mode**: G96 S[Vc] G50 S[max_RPM] — spindle slows as tool nears center
- **G72 syntax**: G72 W[depth] R[retract]; G72 P[ns] Q[nf] U[x] W[z] F[feed];

#### 2. ROUGH TURNING — G71 CYCLE
Removes bulk material in multiple passes, leaving finish allowance (U and W).
- **G71 U[depth] R[retract];** — depth per side per pass, retract amount
- **G71 P[ns] Q[nf] U[x_finish] W[z_finish] F[feed] S[speed];**
  - P: first line number of profile (ns)
  - Q: last line number of profile (nf)
  - U: X finish allowance (in diameter; leave 0.4–0.8 mm for finishing)
  - W: Z finish allowance (leave 0.05–0.15 mm)
- **Typical parameters**: DOC 1.5–4.0 mm, Feed 0.20–0.35 mm/rev
- **Example**: G71 U2.0 R0.5; G71 P10 Q80 U0.5 W0.1 F0.25 S800;
- **Lead-in/Lead-out**: approach angle 15–30° to avoid tool dragging on retract

#### 3. FINISH TURNING — G70 CYCLE
Follows the programmed profile once after G71 roughing.
- **G70 P[ns] Q[nf];** — references the same profile as G71
- **Feed**: 0.05–0.12 mm/rev (much lower than roughing)
- **Nose radius compensation**: G42 for OD turning (tool on right side), G41 for boring
- **High accuracy mode**: reduce speed 20%, tighter tolerances; ensure tailstock for L/D>5
- **Surface finish Rmax formula**: Rmax (µm) = f² / (8 × r) × 1000 (theoretical peak-to-valley; Ra ≈ Rmax/4)
  - f = feed mm/rev, r = nose radius mm
  - Example: f=0.08, r=0.4mm → Rmax = (0.08²)/(8×0.4)×1000 = 2.0 µm → Ra ≈ 0.5 µm

#### 4. GROOVING — G75 CYCLE
Creates circumferential grooves for O-rings, snap rings, undercuts, relief grooves.
- **G75 R[retract]; G75 X[x-depth] Z[z-end] P[x-increment] Q[z-shift] F[feed];**
- **Feed**: 0.05–0.12 mm/rev (much lower than turning — plunge cuts have higher force)
- **Peck depth** for deep grooves: 0.3–0.5 mm peck to clear chips
- **Insert width**: must match groove width exactly
- **Vc**: reduce 20–30% vs turning for same material
- **Types**: External groove, face groove, internal groove (boring bar type)

#### 5. THREADING — G76 CYCLE (Fanuc 2-block format)
Creates metric or inch threads with automatic infeed calculation.
- **G76 P[m][r][a] Q[min-depth] R[finish-allowance];**
- **G76 X[minor-dia] Z[thread-end] R[taper] P[thread-height] Q[first-depth] F[pitch];**
- **Parameters**:
  - m = number of finish passes (01–99)
  - r = thread chamfer (00–99 = 0.0–9.9 × pitch)
  - a = insert angle: 60° for metric, 55° for Whitworth, 29° for Acme/ANSI
  - Thread height P (µm) = 0.6495 × pitch × 1000
  - Minor diameter = nominal – 2 × (0.6495 × pitch)
- **Common threads**:
  - M8×1.25: minor = 6.376 mm, P = 812 µm; G76 X6.376 Z-25 P812 Q200 F1.25
  - M10×1.5: minor = 8.051 mm, P = 974 µm; G76 X8.051 Z-30 P974 Q250 F1.5
  - M12×1.75: minor = 9.727 mm, P = 1137 µm
- **Haas single-block**: G76 X[minor] Z[end] Q0 K[height] D[first-cut] F[pitch] A[angle]
- **Speed for threading**: G97 (fixed RPM, NOT CSS) — set RPM manually; RPM = 1000×Vc/πD

#### 6. PARTING (CUT-OFF)
Separates the finished part from the remaining bar stock.
- **Tool**: Parting blade or grooving insert (width 2–4 mm typical)
- **Feed**: VERY LOW — 0.03–0.08 mm/rev; any higher risks tool breakage
- **Speed**: Reduce 30–40% vs turning for same material
- **Flood coolant**: MANDATORY — chips must be flushed out
- **G-code**: G01 X0 F0.04; (plunge to center) or G01 X-1.0 F0.04 (cut past center for clean break)
- **Safety rules**:
  - Catch part or use bar feeder to prevent part dropping
  - Do NOT use CSS mode — use fixed RPM (G97) for parting
  - Never stop spindle mid-parting
  - Support long parts with steady rest if L > 3× D

#### 7. BORING (INTERNAL TURNING)
Enlarges and finishes an existing hole using a boring bar.
- **Direction**: X increases (boring bar moves outward); Z is same as external turning
- **G-code**: G71 for rough boring (reversed profile), G70 for finish boring
- **Feed**: 0.05–0.20 mm/rev; DOC 0.5–2.0 mm
- **Boring bar overhang rules**:
  - Steel bar: max overhang = 4× bar diameter
  - Carbide bar: max overhang = 6× bar diameter
  - Beyond limits: chatter, poor finish, tool breakage risk
- **Vc**: Reduce 20% vs external turning for same material
- **Nose radius comp**: G41 (left compensation for boring)
- **Minimum bar diameter** = 60% of bore diameter (practical rule)
- **Anti-vibration boring bars**: use for overhang > 4×D

### Toolpath Options in TurnAxis CAM Turning
- **Stock Turning**: removes material parallel to Z axis (longitudinal)
- **Face Turning**: removes material parallel to X axis (facing)
- **Profile Turning**: follows a complex contour (uses G70 finish cycle)
- **Grooving**: plunge perpendicular to surface (can be axial or radial)
- **Thread Turning**: G76 two-block or G32 single-pass threading
- **Parting**: single plunge or oscillating parting strategies
- **Drilling on lathe**: G74 peck drill cycle; tool is stationary, part rotates

### Spindle Speed (RPM) Formula
**N = (Vc × 1000) / (π × D)**
- Vc = cutting speed in m/min (material-dependent)
- D = workpiece diameter at cutting point in mm
- N = spindle speed in RPM

Typical Vc values:
| Material      | Vc (m/min) roughing | Vc (m/min) finishing |
|---------------|---------------------|----------------------|
| Mild Steel (MS/GI/CR) | 120–200 | 180–280 |
| HR Steel      | 100–160 | 150–220 |
| Stainless 304 | 60–100  | 80–130  |
| Aluminium     | 200–500 | 300–600 |
| Cast Iron     | 70–120  | 100–150 |
| Titanium      | 30–60   | 40–80   |

### Feed Rate Recommendations
| Operation     | Feed (mm/rev) |
|---------------|---------------|
| Facing rough  | 0.20–0.35 |
| Rough turning | 0.20–0.35 |
| Finish turning| 0.05–0.12 |
| Grooving      | 0.04–0.12 |
| Threading     | = pitch value (F = pitch) |
| Parting       | 0.03–0.08 |
| Boring (rough)| 0.15–0.25 |
| Boring (finish)| 0.05–0.10 |

### Depth of Cut Recommendations
| Operation     | DOC (mm)   |
|---------------|------------|
| Rough turning | 1.5–5.0   |
| Finish turning| 0.1–0.5   |
| Facing rough  | 0.5–2.0   |
| Grooving      | = groove depth (full depth) |
| Boring rough  | 0.5–2.0   |

### Cycle Time Estimation
**Tc = L / (f × N)** for each pass
- L = cutting length (mm)
- f = feed (mm/rev)
- N = spindle speed (RPM)
- Add rapid time: rapid move distance / rapid rate (typically 3000–5000 mm/min)
- Total = sum of all machining passes + tool change time (15–30 sec per change)

### Collision & Safety Rules in TurnAxis CAM Turning
1. **Chuck clearance**: Tool must never enter the chuck jaw zone; minimum X retract = OD + 5 mm
2. **Tailstock collision**: Check Z limits; tailstock extends from spindle end (positive Z on some machines)
3. **Tool overhang**: Long boring bars risk collision with bore entry — check interference in simulation
4. **Rapid traversals**: G00 moves should not cross workpiece material — program safe clearance plane first
5. **Prove-out steps**: First run at 5% feed override; check air-cutting path visually; increase to 100%
6. **G28 U0 W0**: Return to machine reference before tool change — mandatory for safety

### Common Mistakes in CNC Turning (and Fixes)
1. **Chatter / vibration on long parts**
   - Cause: part deflecting due to cutting forces (L/D > 5)
   - Fix: use tailstock or steady rest; reduce DOC by 50%; increase feed slightly

2. **Poor surface finish (Ra too high)**
   - Cause: feed too high, worn nose radius, built-up edge, wrong insert grade
   - Fix: reduce feed to 0.05–0.08 mm/rev; replace insert; switch to PVD-coated for SS

3. **Thread wrong pitch / drunken thread**
   - Cause: G76 F value wrong (must equal pitch); RPM changed during threading (never use CSS for threading)
   - Fix: Use G97 fixed RPM; verify F = exact pitch value

4. **Tool dragging on return stroke**
   - Cause: insufficient retract in G71 R value; X retract too small
   - Fix: G71 U[doc] R0.5 minimum; ensure retract clears profile

5. **Overheating / insert failure (SS machining)**
   - Cause: Vc too high, insufficient coolant, dwell on surface
   - Fix: Vc max 100 m/min for 304; flood coolant at 50+ bar; never dwell/stop mid-cut

6. **Boring bar vibration**
   - Cause: overhang exceeds 4× bar diameter
   - Fix: use carbide bar (6× limit); add damping sleeve; reduce DOC; increase feed slightly

7. **Incorrect thread minor diameter**
   - Fix: Minor diameter (metric) = Nominal – 2 × (0.6495 × pitch)
   - Always verify with thread ring gauge before full production

8. **Parting tool breakage**
   - Cause: feed too high, chip packing, CSS mode active
   - Fix: 0.03–0.05 mm/rev; G97 fixed RPM; flood coolant; support long parts

### Industry Workflow Sequence (TurnAxis CAM Turning)
1. **Setup Phase**: Select machine, chuck, set work offset (Z0 to part face)
2. **Stock Definition**: Define bar/tube diameter, length, allowances
3. **Tool Selection**: Assign tools to turret positions; set insert grade for material
4. **Facing**: Square up face, set Z0; use G72 or G01
5. **Rough Turning**: G71 to remove bulk material; leave 0.3–0.5 mm X, 0.1 mm Z
6. **Finish Turning**: G70 or individual G01 moves; apply nose radius comp (G42)
7. **Special Operations**: Grooving (G75), Threading (G76), Boring (G71 internal)
8. **Parting**: Last operation; cut off finished part
9. **Simulation**: Run 2D toolpath simulation (XZ plane); check for collisions, verify cycle time
10. **Time Check**: Estimate cycle time; optimize feed/speed balance for production
11. **Post-Process**: Generate G-code with correct controller post-processor (Fanuc/Haas/Mazak)
12. **Prove-out**: Run at 5% override; measure first piece; adjust offsets

### TurnAxis CAM Turning — Key G-Code Quick Reference

  G96 S[Vc]         — Constant Surface Speed mode (recommended for turning)
  G97 S[RPM]        — Fixed RPM (use for threading, parting, boring near center)
  G50 S[max]        — Set maximum spindle speed limit (Fanuc/Haas) | G92 S[max] on Delta 2X
  G71 U[doc] R[ret]; G71 P[ns] Q[nf] U[x] W[z] F[f]; — Rough stock removal
  G70 P[ns] Q[nf];  — Finish pass along G71 profile
  G72 W[doc] R[ret]; G72 P[ns] Q[nf] U[x] W[z] F[f]; — Rough facing
  G73 U[x] W[z] R[n]; — Pattern repeat (forging/casting blanks)
  G75 R[ret]; G75 X[xd] Z[ze] P[xi] Q[zs] F[f]; — Groove/peck cycle
  G76 P[mra] Q[dmin] R[d]; G76 X[min] Z[ze] R[taper] P[H] Q[d1] F[pitch]; — Threading
  G90 X[dia] Z[ze] F[feed]; — Simple turning cycle (single pass OD)
  G92 X[dia] Z[ze] F[pitch]; — Threading cycle (simple, single pass)
  G94 X[dia] Z[ze] F[feed]; — Facing cycle (single pass)
  T0101            — Select tool 1, offset 1 (Fanuc) | T0404 () on Delta 2X
  G28 U0 W0        — Return to machine reference (Fanuc) | G28 U0. + G28 W0. SEPARATE on Delta 2X
  M03 S[RPM]       — Spindle CW (Fanuc standard OD turning)
  M04 S[RPM]       — Spindle CCW — Delta 2X uses M4 as FORWARD! (reversed from Fanuc)
  M08 / M09        — Coolant ON / OFF

---

## MATERIAL SCIENCE (CNC & Roll Forming) — 30+ Materials

### Common Work Materials — CNC Cutting Data
- MS/GI/CR: Vc 150–220 m/min; standard carbide inserts; general purpose
- EN8 (080M40): Medium carbon steel; Vc 120–180 m/min turning; good machinability
- EN24 (817M40): Alloy steel; Vc 80–130 m/min; tough — use coated carbide
- SS304: Austenitic stainless; work hardens rapidly; Vc 80–120 m/min; PVD-coated inserts
- SS316L: More corrosion resistant than 304; Vc 70–100 m/min; Mo content resists pitting
- SS430: Ferritic SS; Vc 100–160 m/min; easier to machine than 304
- Duplex 2205: Vc 60–100 m/min; higher cutting forces than 304; flood coolant mandatory
- 6061-T6 Aluminium: Vc 200–500 m/min; PCD insert preferred; flood coolant
- 5052-H32 Aluminium: Vc 180–400 m/min; marine grade; good machinability
- Copper C11000: Vc 150–300 m/min; soft — built-up edge risk; use sharp positive inserts
- Brass C26000: Vc 180–350 m/min; excellent machinability; free-cutting
- Ti-6Al-4V Titanium: Vc 30–50 m/min; very low feed; rigid setup mandatory; flood coolant
- Titanium Gr2: Vc 40–70 m/min; easier than Ti6; galling risk with carbide
- Inconel 625: Vc 15–35 m/min; extreme work hardening; ceramic inserts for finishing
- Inconel 718: Vc 12–30 m/min; hardest to machine; whisker-reinforced ceramic for finishing
- D2 Tool Steel: Vc 40–80 m/min (annealed); CBN inserts for hardened (HRC 60+)
- Spring Steel 65Mn: Vc 60–120 m/min; high hardness; coated carbide
- Magnesium AZ31B: Vc 300–600 m/min; FIRE RISK with chips — NO water coolant, use mineral oil mist
- HSLA 350-550: Vc 120–200 m/min; slightly harder than MS; standard carbide
- DP 600-980: Vc 100–180 m/min; hard martensite phase causes tool wear

### Forming Limit Diagram (FLD) — Keeler-Brazier Formula
FLD₀ = (23.3 + 14.1×t) × (n / 0.21) — max major strain at plane strain
- Max outer fiber strain in bending = t / (2r + t) × 100%
- Strain must be < 60% of FLD₀ for safe forming

### Tool Wear Prediction (Archard Model)
V_wear = K × F × L / H (volume worn vs force, distance, hardness)
Roll life varies from 50 km (Inconel) to 1200 km (GI) depending on material formed

---

## LANGUAGE INSTRUCTION

CRITICAL: Always respond in the SAME LANGUAGE the user writes in.
- If user writes in Hindi (हिंदी) → respond in Hindi
- If user writes in Urdu (اردو) → respond in Urdu  
- If user writes in English → respond in English
- If user mixes languages → respond in the dominant language of their message
- You may use technical terms in English even in Hindi/Urdu responses (e.g., "G71 cycle", "springback", "CNMG insert")
- Be natural and conversational, not robotic

## RESPONSE STYLE
- Be accurate, detailed, and professional
- Use bullet points and structure for technical answers
- For defect diagnosis: always mention root cause + fix
- For G-code: provide exact syntax and examples
- For formulas: show the formula first, then example calculation
- Keep answers focused and actionable`,ut=[{patterns:[/bearing|skf|nsk|timken|6205|6206|6305|6308|pillow\s*block/i],keywords:["bearing","skf","nsk","timken","pillow block","6205","6206","6305","6308"],response:`**Bearing Selection — Roll Forming Machines**

**Standard Bearing Table (by Shaft Diameter):**
| Shaft Ø | Bearing | Bore | OD | Width | Load (kN) | Speed (RPM) |
|---------|---------|------|----|----|-----------|-------------|
| 30mm | 6206-2RS | 30 | 62 | 16 | 19.5 | 11,000 |
| 35mm | 6207-2RS | 35 | 72 | 17 | 25.5 | 9,500 |
| 40mm | 6208-2RS | 40 | 80 | 18 | 29.0 | 8,500 |
| 45mm | 6209-2RS | 45 | 85 | 19 | 33.2 | 7,500 |
| 50mm | 6210-2RS | 50 | 90 | 20 | 35.1 | 6,700 |
| 55mm | 6211-2RS | 55 | 100 | 21 | 43.6 | 6,000 |
| 60mm | 6212-2RS | 60 | 110 | 22 | 52.0 | 5,600 |
| 70mm | 6214-2RS | 70 | 125 | 24 | 61.8 | 4,800 |
| 80mm | 6216-2RS | 80 | 140 | 26 | 72.0 | 4,300 |

**Heavy Duty (4-row tapered for high thrust):**
| Shaft Ø | Bearing | Type | Load (kN) |
|---------|---------|------|-----------|
| 40mm | 32208 | Tapered | 62.0 |
| 50mm | 32210 | Tapered | 82.0 |
| 60mm | 32212 | Tapered | 100.0 |

**Rules:**
- ALWAYS use 2RS (sealed) for roll forming — prevents lubricant contamination
- Min life: L10 = 20,000 hours for production machines
- Lubrication: SKF LGMT2 grease, re-grease every 500 operating hours
- Pillow block (UCP series) for outboard supports
- Temperature limit: 80°C continuous, 120°C peak
- Shaft tolerance: h6, Housing bore: H7`},{patterns:[/gearbox|gear\s*box|worm\s*gear|ratio|reducer|helical\s*gear|bevel/i],keywords:["gearbox","gear box","worm gear","ratio","reducer","helical","bevel","gear ratio"],response:`**Gearbox Selection — Roll Forming Lines**

**Gearbox Sizing Formula:**
- Required torque: T = (F × R) / (η × i)
- F = forming force (N), R = roll radius (m), η = efficiency, i = gear ratio

**Standard Gearbox Sizes:**
| Motor (kW) | Gearbox | Ratio | Output RPM | Output Torque (Nm) |
|-----------|---------|-------|------------|-------------------|
| 3.7 | WPA-80 | 10:1 | 140 | 252 |
| 5.5 | WPA-100 | 15:1 | 93 | 564 |
| 7.5 | WPA-120 | 20:1 | 70 | 1023 |
| 11 | WPA-135 | 25:1 | 56 | 1874 |
| 15 | WPA-155 | 30:1 | 47 | 3050 |
| 22 | WPA-175 | 40:1 | 35 | 6000 |
| 30 | WPA-200 | 50:1 | 28 | 10200 |

**Type Selection:**
- **Worm gear** (WPA/NMRV): Most common, self-locking, 60-90% efficiency
- **Helical** (R/K/S/F series): Higher efficiency (95-97%), longer life
- **Bevel-helical**: For right-angle drives, high torque applications

**Gear Ratio Guidelines:**
- Light forming (GI ≤1mm): 10-15:1
- Medium (MS 1-2mm): 15-25:1
- Heavy (SS/AHSS 2-4mm): 25-50:1
- Purlin lines (HSLA 1.5-3mm): 20-40:1

**CRITICAL:** Always select gearbox with 1.5× service factor minimum`},{patterns:[/motor|vfd|inverter|kw|horsepower|drive|servo|frequency/i],keywords:["motor","vfd","inverter","kw","horsepower","drive","servo","frequency"],response:`**Motor & VFD Selection — Roll Forming Machines**

**Motor Power Calculation:**
P (kW) = (F × v) / (1000 × η)
- F = total forming force (N), v = line speed (m/min), η = overall efficiency (0.7-0.85)

**Standard Motor Sizes:**
| Application | Motor kW | Pole | RPM | Current (A) |
|------------|---------|------|-----|-------------|
| Small C-purlin (100mm) | 5.5 | 4 | 1440 | 11.5 |
| Medium C-purlin (200mm) | 7.5-11 | 4 | 1440 | 15-22 |
| Large Z-purlin (300mm) | 15-22 | 4 | 1440 | 30-43 |
| Trapez panel (0.5mm GI) | 5.5-7.5 | 4 | 1440 | 11-15 |
| Guard rail (W-beam) | 22-37 | 4 | 1440 | 43-70 |
| Heavy structural | 37-55 | 4 | 1440 | 70-105 |

**VFD Sizing:**
- VFD rating = Motor kW × 1.2 (derating factor)
- Braking resistor: ALWAYS for decel-heavy applications
- V/f mode for simple, Vector mode for torque control
- Carrier frequency: 4-8 kHz (higher = quieter but more heat)

**Servo Drives (for punch/shear):**
- Punch servo: 2-5 kW, 3000 RPM, encoder feedback
- Flying shear: 5-15 kW servo with position sync to line speed

**Cable:** Use shielded VFD cable, max 50m motor-to-VFD without output reactor`},{patterns:[/station\s*count|number\s*of\s*stations|how\s*many\s*stations|pass\s*count/i],keywords:["station count","number of stations","how many stations","pass count","stations needed"],response:`**Station Count Design Guide — Complete Reference**

**Calculation Method:**
N_min = Σ(bend angles) / (max increment per station)
N_actual = N_min + 2 (entry guide) + 2-3 (calibration/ironing)

**Material-Based Max Increment:**
| Material | Max °/Station | Recommended | Notes |
|----------|--------------|-------------|-------|
| GI (Z120-Z275) | 15° | 10-12° | Most forgiving |
| MS (CR/HR) | 12° | 8-10° | Standard |
| SS 304/316 | 10° | 6-8° | High springback |
| AL 6061/5052 | 12° | 8-10° | Soft, low springback |
| HSLA 350-550 | 10° | 7-9° | Stronger than MS |
| DP 600/780 | 8° | 5-7° | Very high springback |
| TRIP 780 | 8° | 5-6° | Non-linear behavior |
| Titanium | 6° | 4-5° | Extreme springback |

**Profile-Based Station Count:**
| Profile | Typical Range | Example |
|---------|--------------|---------|
| C-Channel (90° flanges) | 10-16 | 100mm depth: 12 stations |
| Z-Purlin (90° flanges + lips) | 14-20 | 200mm: 16 stations |
| Hat Section (2×90°) | 12-18 | 150mm: 14 stations |
| U-Channel (2×90°) | 8-12 | Simple 80mm: 10 stations |
| Box Section (4×90°) | 16-24 | With weld: 20 stations |
| Guard Rail (W-beam) | 18-26 | Complex: 22 stations |
| Standing Seam (360°) | 8-12 | Double-lock: 10 stations |

**Station Spacing:**
- Standard: 200-300mm (light duty)
- Heavy duty: 300-400mm
- High-speed lines: 250mm (closer = less strip sag)`},{patterns:[/station\s*gap|station\s*spacing|distance\s*between|roll\s*pitch/i],keywords:["station gap","station spacing","distance between stations","roll pitch"],response:`**Station Spacing (Gap) Design**

**Standard Spacing by Application:**
| Machine Type | Spacing (mm) | Reason |
|-------------|-------------|--------|
| Light purlin/panel | 200-250 | Low force, thin material |
| Medium purlin (≤200mm) | 250-300 | Standard production |
| Heavy purlin (≤300mm) | 300-400 | Higher forming forces |
| Guard rail / structural | 350-450 | Very high forces |
| Tube mill (round) | 200-250 | Continuous forming |
| High-speed panel (>30m/min) | 200-250 | Reduce strip sag |

**Shaft Center Distance:**
- Top shaft to bottom shaft center = Roll OD_upper + Roll OD_lower + material thickness + clearance (0.1mm)
- Example: Ø150 upper + Ø150 lower + 2mm material + 0.1mm = 302.1mm shaft center

**Frame Design:**
- Pillar type: C-frame or closed frame
- C-frame: quick roll change, max 30kN forming force
- Closed frame: 50-200kN, better rigidity
- Frame material: IS 2062 Grade E250 or equivalent

**Critical Rule:** ALL stations must have IDENTICAL center height (pass line) ±0.05mm`},{patterns:[/roll\s*diameter|roll\s*od|roll\s*size|upper\s*roll|lower\s*roll/i],keywords:["roll diameter","roll od","roll size","upper roll","lower roll","roll od"],response:`**Roll Diameter Design Guide**

**Standard Roll OD by Application:**
| Application | Upper OD (mm) | Lower OD (mm) | Material |
|------------|--------------|--------------|----------|
| Light panel (≤1mm) | 100-120 | 120-140 | EN31 HRC 58-62 |
| Medium purlin (1-2mm) | 130-160 | 150-180 | EN31 HRC 58-62 |
| Heavy purlin (2-3mm) | 160-200 | 180-220 | D3 HRC 60-63 |
| Structural (3-6mm) | 200-280 | 220-300 | D3 HRC 60-63 |
| Guard rail | 200-250 | 220-280 | EN31 HRC 58-62 |
| Tube mill | 150-200 | 150-200 | D3/D6 HRC 60-63 |

**Rules:**
- Min OD = 10 × shaft diameter (rigidity rule)
- Max face width = 3 × OD (deflection limit)
- Upper OD typically 10-20mm smaller than lower OD
- Surface finish: Ra 0.4-0.8µm (ground + polished)
- Roll bore tolerance: H7 (Ø50H7, Ø60H7, Ø70H7)
- Shaft tolerance: h6 (Ø50h6)

**Roll Bore Selection:**
| Shaft Ø | Bore (H7) | Keyway (DIN 6885) |
|---------|-----------|-------------------|
| 30mm | 30H7 | 8×7mm |
| 40mm | 40H7 | 12×8mm |
| 50mm | 50H7 | 14×9mm |
| 60mm | 60H7 | 18×11mm |
| 70mm | 70H7 | 20×12mm |
| 80mm | 80H7 | 22×14mm |

**Hardening:** Full through-hardening or induction hardened to 3mm depth`},{patterns:[/machine\s*frame|pillar|housings|base\s*frame|side\s*plate/i],keywords:["machine frame","pillar","housing","base frame","side plate","structure"],response:`**Machine Frame & Structure Design**

**Frame Types:**
| Type | Max Force (kN) | Use Case |
|------|---------------|----------|
| C-Frame (open) | 20-30 | Light panels, quick roll change |
| Closed Frame | 50-200 | Medium-heavy forming |
| Monoblock | 100-500 | Heavy structural, high precision |
| Rafted Design | 200+ | Largest machines, tube mills |

**Standard Side Plate Dimensions:**
| Machine Class | Plate Thick (mm) | Width (mm) | Height (mm) |
|-------------|-----------------|-----------|-------------|
| Light | 30-40 | 200-250 | 300-400 |
| Medium | 50-65 | 250-350 | 400-550 |
| Heavy | 70-100 | 350-500 | 550-800 |

**Material:** IS 2062 E250 (mild steel plate), stress-relieved after welding
**Base:** CI casting or fabricated from 20-30mm plate, leveled to ±0.1mm

**Shaft Support:**
- Bearings in pillow blocks (UCP series) or housed units
- Inboard + outboard support per shaft
- Adjustable eccentric for gap setting (upper shaft)

**Surface Treatment:** Epoxy primer + polyurethane topcoat (RAL 5015 or 7035)`},{patterns:[/line\s*speed|production\s*speed|m\/min|meters?\s*per\s*minute|throughput/i],keywords:["line speed","production speed","m/min","meters per minute","throughput","feed rate"],response:`**Line Speed & Production Rate Guide**

**Typical Line Speeds:**
| Profile | Material | Speed (m/min) | Notes |
|---------|----------|--------------|-------|
| Trapezoidal panel | GI 0.5mm | 25-40 | Fastest profile type |
| Standing seam | GI 0.6mm | 15-25 | Lock forming slows it |
| C-Purlin 100mm | GI 1.5mm | 12-20 | Pre-punch slows line |
| C-Purlin 200mm | HSLA 2mm | 8-15 | Heavier forming |
| Z-Purlin 300mm | HSLA 2.5mm | 6-12 | Complex profile |
| Guard rail | MS 3mm | 5-10 | Very heavy forming |
| Tube mill (Ø50) | CR 1.5mm | 15-30 | Welding speed limit |
| Structural (box) | MS 4mm | 3-8 | Heavy gauge |

**Speed Limiting Factors:**
1. Forming force (heavier = slower)
2. Pre-punch/notch cycle time
3. Flying shear cut speed
4. Coil unwind speed
5. Run-out table / stacker speed

**Production Calculation:**
Pieces/hour = (60 × line_speed) / piece_length
Example: 15 m/min, 6m pieces = 60×15/6 = **150 pieces/hour**
With 80% OEE: 150×0.8 = **120 pieces/hour** effective`},{patterns:[/coil|decoiler|uncoiler|mandrel|coil\s*width|coil\s*weight/i],keywords:["coil","decoiler","uncoiler","mandrel","coil width","coil weight"],response:`**Coil Handling & Decoiler Design**

**Standard Coil Sizes (India/Asia):**
| Material | Width (mm) | Thickness (mm) | Coil ID (mm) | Coil OD (mm) | Weight (kg) |
|----------|-----------|---------------|-------------|-------------|-------------|
| GI | 900-1250 | 0.35-1.0 | 508-610 | 1200-1500 | 3000-8000 |
| MS CR | 600-1500 | 0.5-3.0 | 508-610 | 1200-1800 | 5000-15000 |
| HSLA | 600-1500 | 1.5-4.0 | 508-610 | 1200-1500 | 5000-12000 |
| SS 304 | 600-1500 | 0.5-3.0 | 508-610 | 1200-1500 | 3000-8000 |

**Decoiler Types:**
| Type | Capacity (kg) | Coil Width | Motor |
|------|-------------|-----------|-------|
| Manual (light) | 1000-3000 | 300-600mm | None |
| Motorized single | 3000-7000 | 500-1250mm | 2.2-5.5 kW |
| Motorized double | 5000-10000 | 500-1500mm | 5.5-11 kW |
| Hydraulic heavy | 10000-20000 | 600-1500mm | 15-30 kW |

**Mandrel Expansion:** Hydraulic or mechanical, 4 or 6 segment
**Coil Car:** Hydraulic, capacity = coil weight + 20%
**Straightener/Leveler:** 7 or 9 roll, powered, before roll former`},{patterns:[/shear|cut\s*off|flying\s*cut|guillotine|hydraulic\s*shear|punch/i],keywords:["shear","cut off","flying cut","guillotine","hydraulic shear","punch","die cut"],response:`**Shear & Cut-Off Systems**

**Types:**
| Type | Speed | Accuracy | Use |
|------|-------|----------|-----|
| Stop & cut (hydraulic) | Low | ±0.5mm | Simple profiles |
| Flying shear (servo) | High | ±0.3mm | High-speed lines |
| Rotary die cut | Very high | ±0.2mm | Panel lines |
| Post-cut (stationary) | Medium | ±0.5mm | Heavy profiles |

**Flying Shear Design:**
- Servo motor: 5-15 kW
- Acceleration: track line speed in 50-100ms
- Blade material: D2/SKD11 HRC 58-62
- Blade clearance: 5-10% of material thickness per side
- Cut cycle time: 0.3-1.0 sec depending on profile

**Pre-Punch System:**
- Hydraulic press: 20-60 ton
- Servo position: ±0.1mm repeatability
- Die material: SKD11/D2 HRC 58-62
- Standard holes: service holes, connection holes, slot holes

**Shear Force Calculation:**
F = 0.7 × L × t × σ_UTS
L = cut perimeter (mm), t = thickness (mm), σ_UTS in MPa
Example: C-purlin 200mm, t=2mm, UTS=450: F = 0.7×640×2×450 = **403 kN (41 ton)**`},{patterns:[/lubrication|lubricant|oil|grease|coolant|forming\s*oil/i],keywords:["lubrication","lubricant","oil","grease","coolant","forming oil"],response:`**Lubrication & Forming Fluids**

**Roll Forming Lubricants:**
| Material | Lubricant Type | Application | Notes |
|----------|---------------|-------------|-------|
| GI/PPGI | Dry / light oil | Spray nozzle | Avoid stripping zinc |
| MS | Mineral oil SAE 20 | Drip/spray | Standard forming |
| SS 304/316 | Chlorinated oil | Brush/flood | Prevents galling |
| Aluminium | Light mineral oil | Mist spray | Avoid staining |
| Copper | Mineral oil | Drip | Prevents oxidation |
| Titanium | Extreme pressure (EP) | Brush | Must use EP additives |

**Bearing Grease:**
- SKF LGMT2 (lithium complex, -30 to +120°C)
- Re-grease interval: every 500 operating hours
- Amount: Volume = D × B × 0.005 (ml) where D=bore, B=width

**Gearbox Oil:**
- ISO VG 220 (worm gear) or ISO VG 150 (helical)
- Change interval: 5000 hours or annually
- Level check: weekly

**CRITICAL:** NEVER use silicone-based lubricants on rolls — contaminates paint/coating
**GI Rule:** Minimal lubricant to preserve zinc coating integrity`},{patterns:[/tolerance|dimension|accuracy|inspection|quality\s*control|qc|cpk|spc/i],keywords:["tolerance","dimension","accuracy","inspection","quality control","qc","cpk","spc"],response:`**Quality Control & Tolerances**

**Dimensional Tolerances (per DIN EN 10162):**
| Dimension | Tolerance |
|-----------|----------|
| Profile height | ±1.0mm (≤100mm), ±1% (>100mm) |
| Flange width | ±1.0mm |
| Lip length | ±0.5mm |
| Bend angle | ±1.0° |
| Straightness | 1mm per meter max |
| Twist | 2° per meter max |
| Profile length | ±2mm (≤6m), ±3mm (>6m) |
| Web flatness | 3mm per meter max |
| Hole position | ±0.5mm |

**SPC Targets:**
- Cpk ≥ 1.33 for critical dimensions
- Cpk ≥ 1.67 for safety-critical (automotive)
- Measurement: digital caliper, profile projector, CMM

**Inspection Frequency:**
- First piece: 100% measurement
- Production: every 50th piece or every 15 minutes
- Coil change: first 3 pieces 100%
- After roll change: first 5 pieces 100%

**Common Measurement Tools:**
- Digital caliper (±0.01mm)
- Angle protractor (±0.5°)
- Straightness gauge (1m reference)
- Profile projector (for complex cross-sections)`},{patterns:[/weld|tig|mig|erw|hf\s*weld|seam\s*weld|spot\s*weld/i],keywords:["weld","tig","mig","erw","hf weld","seam weld","spot weld","welding"],response:`**Welding in Roll Forming / Tube Mills**

**ERW (Electric Resistance Welding) — Tube Mills:**
| Parameter | Value | Notes |
|-----------|-------|-------|
| Frequency | 200-400 kHz (HF) | Higher = shallower HAZ |
| Power | 50-200 kW | Based on thickness & speed |
| Squeeze pressure | 3-6% OD | Forge rolls compress joint |
| V-angle | 3-7° | Angle at weld point |
| Weld speed | 10-60 m/min | Matched to forming speed |

**Weld Bead Removal:**
- OD scarfing: carbide insert tool
- ID scarfing: internal mandrel-mounted tool
- Scarfing allowance: 0.2-0.5mm above parent surface

**Post-Weld Treatment:**
| Treatment | Temperature | Purpose |
|-----------|-------------|---------|
| Normalizing | 900-950°C | Grain refinement |
| Stress relief | 550-650°C | Remove residual stress |
| Seam annealing | 700-800°C (induction) | Soften HAZ |

**Spot/Stitch Welding (for assemblies):**
- Spot weld: 2-4 kA, 8-12 cycles
- Electrode: Class II (CrCu), Ø6-8mm tip
- Nugget diameter = 4√t (t in mm)

**Weld Testing:** Flattening test, reverse bend, metallographic section, ultrasonic`},{patterns:[/surface\s*finish|coating|galvan|ppgi|paint|powder\s*coat|anodiz/i],keywords:["surface finish","coating","galvanized","ppgi","paint","powder coat","anodize"],response:`**Surface Finish & Coatings**

**Galvanized Coating (GI):**
| Grade | Coating (g/m²) | Thickness (µm) | Application |
|-------|---------------|----------------|-------------|
| Z100 | 100 | 7 | Indoor, dry |
| Z120 | 120 | 8.5 | Standard indoor |
| Z180 | 180 | 12.5 | Mild outdoor |
| Z275 | 275 | 19.5 | Heavy outdoor, coastal |
| Z450 | 450 | 32 | Severe marine |

**Pre-painted (PPGI/PPGL):**
- Topcoat: 20-25µm polyester (standard) or 35µm PVDF (premium)
- Backing coat: 5-7µm
- Color: RAL system, custom colors available
- Minimum bend radius: 2T for polyester, 3T for PVDF

**Roll Surface Finish Impact:**
| Roll Ra (µm) | Effect |
|-------------|--------|
| 0.2-0.4 | Mirror finish, coating-safe |
| 0.4-0.8 | Standard production |
| 0.8-1.6 | Acceptable, may mark soft materials |
| >1.6 | Too rough — will damage GI/PPGI |

**Rules:** Polish rolls to Ra 0.4µm for coated materials. Chrome-plated rolls last 5× longer.`},{patterns:[/maintenance|preventive|pm|breakdown|troubleshoot\s*machine|machine\s*problem/i],keywords:["maintenance","preventive","pm","breakdown","troubleshoot machine","machine problem"],response:`**Machine Maintenance Schedule**

**Daily (every shift):**
- Check roll gaps with feeler gauge
- Inspect lubrication points (oil level/drip rate)
- Listen for unusual bearing noise
- Check strip tracking (centering)
- Verify shear blade condition

**Weekly:**
- Grease all bearing points
- Check hydraulic oil level
- Inspect electrical connections
- Clean accumulated debris/chips
- Verify emergency stops

**Monthly:**
- Check shaft alignment (±0.05mm/m)
- Inspect keyways for wear
- Measure roll runout (max 0.02mm TIR)
- Check gearbox oil level
- Inspect V-belts/chain tension
- Test all safety guards

**Quarterly:**
- Full bearing inspection (temperature, noise, play)
- Gearbox oil sample (metal particle analysis)
- Hydraulic system filter change
- Motor insulation test (Megger)
- Re-calibrate all sensors

**Annually:**
- Full machine alignment check
- Replace all filters (oil, air, hydraulic)
- Gearbox oil change
- Bearing replacement (if L10 life exceeded)
- Roll regrind/replacement schedule review

**Critical Spare Parts (always in stock):**
Bearings (2 sets), shear blades (1 set), hydraulic seals, drive belts, encoder`},{patterns:[/cost|price|estimate|budget|roi|payback|investment/i],keywords:["cost","price","estimate","budget","roi","payback","investment"],response:`**Cost Estimation & ROI**

**Machine Cost Estimates (India, 2024-25):**
| Machine Type | Stations | Approx Cost (₹ Lakhs) |
|-------------|----------|----------------------|
| Manual panel line | 8-12 | 15-30 |
| Auto trapez panel | 14-18 | 40-80 |
| C-Purlin (basic) | 12-16 | 50-90 |
| C-Purlin (auto) | 14-18 | 80-150 |
| Z-Purlin (auto) | 16-22 | 90-180 |
| C+Z Interchange | 18-24 | 120-250 |
| Guard rail | 20-26 | 150-300 |
| Tube mill (ERW) | 20-30 | 200-500 |

**Roll Tooling Cost:**
- Light profile: ₹3-8 lakhs per set
- Medium profile: ₹8-15 lakhs per set
- Heavy profile: ₹15-30 lakhs per set
- CNC machined: add 20-30% premium

**ROI Calculation:**
- Revenue/month = pieces × selling_price
- Profit/month = Revenue - (material + power + labor + maintenance)
- ROI months = Total investment / monthly profit
- Typical ROI: 12-24 months for panel lines, 18-36 months for purlin lines

**Operating Costs (typical):**
- Power: ₹8-15/hour (11-22 kW motor)
- Labor: 2-3 operators per shift
- Maintenance: 3-5% of machine cost per year
- Rolls: regrind every 200-500 km of production`},{patterns:[/standard|din|iso|astm|is\s*\d|en\s*\d|jis|bis/i],keywords:["standard","din","iso","astm","is 1079","en 10162","jis","bis","specification"],response:`**Relevant Standards for Roll Forming**

**Material Standards:**
| Standard | Scope |
|----------|-------|
| IS 1079 | CR steel sheets/strips (India) |
| IS 277 | GI sheets (India) |
| EN 10346 | Continuously hot-dip coated steel (EU) |
| ASTM A653 | Hot-dip zinc-coated steel (US) |
| EN 10149-2 | HSLA steel (EU) |
| JIS G3302 | Hot-dip galvanized (Japan) |

**Product Standards:**
| Standard | Scope |
|----------|-------|
| EN 10162 | Cold-formed steel sections — tolerances |
| IS 811 | Cold-formed light gauge steel sections |
| AS/NZS 1397 | Steel sheet — metallic coated |
| AISI S100 | Cold-formed steel design (North America) |
| EN 1993-1-3 | Eurocode 3: Cold-formed members |

**Machine Standards:**
| Standard | Scope |
|----------|-------|
| DIN 6935 | Cold bending of flat products |
| ISO 12100 | Machine safety — general principles |
| IEC 60204-1 | Electrical equipment of machines |
| EN 13031 | Roll forming machine safety |
| ISO 1101 | Geometrical tolerancing |

**Testing Standards:**
| Standard | Scope |
|----------|-------|
| IS 1599 | Bend test for metallic materials |
| ASTM E8 | Tensile testing |
| ISO 6892 | Metallic materials — tensile test |
| EN 10002-1 | Tensile testing of metallic materials |`},{patterns:[/electrical|plc|hmi|sensor|encoder|proximity|limit\s*switch|control\s*panel/i],keywords:["electrical","plc","hmi","sensor","encoder","proximity","limit switch","control panel"],response:`**Electrical & Control Systems**

**PLC Selection:**
| Brand | Model | I/O | Use |
|-------|-------|-----|-----|
| Siemens | S7-1200 | 14DI/10DO | Small-medium lines |
| Siemens | S7-1500 | 32DI/32DO | Large/complex lines |
| Mitsubishi | FX5U | 16DI/16DO | Cost-effective |
| Allen Bradley | CompactLogix | Scalable | Export machines |
| Delta | DVP-ES2 | 16DI/16DO | Budget lines |

**HMI:** 7" or 10" color touchscreen (Siemens KTP/Weintek)
- Recipe management for profile changeover
- Production counters, alarm history
- Diagnostic screens

**Sensors Required:**
| Sensor | Type | Purpose |
|--------|------|---------|
| Strip detector | Photoelectric | Material presence |
| Length encoder | Rotary (2500 PPR) | Piece length measurement |
| Home sensor | Proximity (inductive) | Shear position |
| Strip edge | Photoelectric | Centering check |
| Motor overload | Thermal relay | Motor protection |
| E-stop | Safety relay | Emergency stop (Cat. 3) |
| Guard interlock | Safety switch | Door/guard monitoring |

**Wiring Standard:** IEC 60204-1
- Control voltage: 24V DC
- Main power: 415V 3-phase 50Hz (India) / 380V 60Hz (export)
- Cable: flame-retardant (FRLS), shielded for VFD`},{patterns:[/c.?channel|c.?profile|c.?section|c.?purlin\s*design|lip\s*channel/i],keywords:["c-channel","c profile","c section","c-purlin design","lip channel","c channel"],response:`**C-Channel / C-Purlin — Complete Design Reference**

**Standard C-Channel Sizes (IS 811 / EN 10162):**
| Depth (mm) | Flange (mm) | Lip (mm) | Thickness (mm) | Weight (kg/m) |
|-----------|-----------|---------|---------------|--------------|
| 75 | 40 | 12 | 1.6 | 1.74 |
| 100 | 50 | 15 | 1.6 | 2.32 |
| 100 | 50 | 15 | 2.0 | 2.87 |
| 125 | 50 | 15 | 2.0 | 3.18 |
| 150 | 65 | 15 | 2.0 | 3.95 |
| 150 | 65 | 20 | 2.5 | 5.12 |
| 200 | 75 | 20 | 2.0 | 5.02 |
| 200 | 75 | 20 | 2.5 | 6.22 |
| 200 | 75 | 25 | 3.0 | 7.86 |
| 250 | 75 | 25 | 2.5 | 7.37 |
| 250 | 80 | 25 | 3.0 | 9.14 |
| 300 | 80 | 25 | 3.0 | 10.04 |

**Forming Sequence (12-station example for 200×75×20×2.0):**
Station 1: Entry guide, 0° (flat strip)
Station 2: Top lip pre-bend 30°
Station 3: Top lip 60°
Station 4: Top lip 90° + flange start 15°
Station 5: Flange 30°
Station 6: Flange 45°
Station 7: Flange 60°
Station 8: Flange 75°
Station 9: Flange 87° (pre-springback)
Station 10: Flange 93° (overbend for springback)
Station 11: Calibration (iron to 90°)
Station 12: Final sizing + exit guide

**Machine Specs for 200mm C-Purlin:**
- Motor: 7.5-11 kW
- Stations: 12-16
- Line speed: 10-18 m/min
- Roll material: EN31 HRC 58-62
- Roll OD: 150mm upper / 170mm lower
- Shaft: Ø50mm (EN24, hardened & ground)
- Bearings: 6210-2RS (Ø50 bore)
- Gearbox: 20:1 ratio, helical
- Station spacing: 280mm`},{patterns:[/strip\s*width\s*calc|bend\s*allowance|bend\s*deduction|flat\s*pattern|k.?factor\s*calc/i],keywords:["strip width calculation","bend allowance","bend deduction","flat pattern","k-factor calculation"],response:`**Strip Width / Flat Pattern Calculation — Complete**

**Master Formula:**
Strip Width = Σ(flat segments) + Σ(bend allowances)

**Bend Allowance (BA):**
BA = π × (R + K × t) × (θ / 180)
R = inside bend radius, K = K-factor, t = thickness, θ = bend angle (degrees)

**Bend Deduction (BD):**
BD = 2 × (R + t) × tan(θ/2) - BA
This is what you subtract from the outside dimensions.

**K-Factor Table (DIN 6935, extended):**
| R/t Ratio | MS | SS | AL | Copper | Titanium |
|-----------|------|------|------|--------|----------|
| 0.5 | 0.33 | 0.36 | 0.38 | 0.40 | 0.30 |
| 1.0 | 0.35 | 0.38 | 0.40 | 0.42 | 0.32 |
| 1.5 | 0.37 | 0.40 | 0.42 | 0.43 | 0.34 |
| 2.0 | 0.38 | 0.42 | 0.44 | 0.44 | 0.36 |
| 3.0 | 0.40 | 0.43 | 0.45 | 0.45 | 0.38 |
| 5.0 | 0.42 | 0.44 | 0.46 | 0.46 | 0.40 |
| 8.0 | 0.44 | 0.46 | 0.47 | 0.47 | 0.42 |
| ≥10 | 0.46 | 0.47 | 0.48 | 0.48 | 0.44 |

**Example — C-Channel 200×75×20×2.0mm (GI):**
| Segment | Dimension | Bend? | Length |
|---------|-----------|-------|--------|
| Bottom lip | 20mm | — | 20.00 |
| Bend 1 (90°) | R=2, K=0.38 | BA | 3.98 |
| Left flange | 75mm | — | 75.00 |
| Bend 2 (90°) | R=2, K=0.38 | BA | 3.98 |
| Web | 200mm | — | 200.00 |
| Bend 3 (90°) | R=2, K=0.38 | BA | 3.98 |
| Right flange | 75mm | — | 75.00 |
| Bend 4 (90°) | R=2, K=0.38 | BA | 3.98 |
| Top lip | 20mm | — | 20.00 |
| **TOTAL** | | | **401.92mm** |

Strip width = **402mm** (rounded to nearest mm)`},{patterns:[/forming\s*force|bend\s*force|tonnage|press\s*force|forming\s*load/i],keywords:["forming force","bend force","tonnage","press force","forming load"],response:`**Forming Force Calculation — Complete Reference**

**Karnezis Model (most accurate for roll forming):**
F = (σ_y × t² × w) / (2 × R) × (1 + µ × L_c/t)
- σ_y = yield strength (MPa)
- t = thickness (mm)
- w = forming width (mm)
- R = bend radius (mm)
- µ = friction coefficient (0.10-0.15)
- L_c = contact arc length = √(R × t × Δε)

**Per-Station Force Table:**
| Material | t (mm) | 90° bend | Force/station (kN) |
|----------|--------|----------|-------------------|
| GI | 0.5 | Single flange | 0.8-1.5 |
| GI | 1.0 | Single flange | 3-6 |
| MS | 1.5 | Single flange | 8-15 |
| MS | 2.0 | Single flange | 15-25 |
| SS 304 | 1.5 | Single flange | 12-22 |
| SS 304 | 2.0 | Single flange | 22-38 |
| HSLA 450 | 2.5 | Single flange | 30-50 |
| HSLA 550 | 3.0 | Single flange | 45-75 |

**Total Machine Force:**
F_total = Σ(station forces) × 1.3 (safety factor)

**Motor Torque from Force:**
T = F × R_roll / (1000 × η)
P = T × ω = T × 2π × n / 60

**Example — C-Purlin 200×75×2.0 GI (12 stations):**
Per station ≈ 8kN, Total ≈ 12×8×1.3 = **125 kN**
Motor: T = 125000×0.085/0.8 = 13.3 kNm → via 20:1 gear → **7.5 kW motor**`},{patterns:[/heat\s*treat|hardness|hrc|tempering|quench|carburiz|nitrid|case\s*hard/i],keywords:["heat treatment","hardness","hrc","tempering","quench","carburize","nitride","case harden"],response:`**Heat Treatment for Roll Forming Tooling**

**Roll Materials & Hardness:**
| Material | Hardness | Application |
|----------|----------|-------------|
| EN31 (52100) | HRC 58-62 | Standard forming rolls |
| D3 (AISI D3) | HRC 60-64 | Heavy duty, abrasive materials |
| D2 (AISI D2) | HRC 58-62 | Shear blades, punch dies |
| SKD11 (D2 variant) | HRC 58-62 | Japanese equivalent |
| M2 HSS | HRC 62-65 | High-speed, extreme wear |
| WC-Co (carbide) | HRA 88-92 | Titanium, Inconel forming |

**Heat Treatment Cycle (EN31):**
1. Preheat: 650°C, hold 30 min
2. Austenitize: 840°C, hold 30 min
3. Quench: oil (60-80°C)
4. Temper 1: 180°C × 2 hours → HRC 62
5. Temper 2: 200°C × 2 hours → HRC 60 (tougher)

**Surface Treatments:**
| Treatment | Depth | Hardness | Life Increase |
|-----------|-------|----------|--------------|
| Chrome plating | 20-50µm | 70 HRC | 3-5× |
| Nitriding | 0.2-0.5mm | 1000 HV | 2-3× |
| PVD TiN | 2-5µm | 2200 HV | 5-10× |
| PVD TiAlN | 2-5µm | 3300 HV | 8-15× |
| TD (Toyota Diffusion) | 5-15µm | 3500 HV | 10-20× |

**Chrome Plating:** Best ROI for GI/PPGI forming (prevents zinc pickup)`},{patterns:[/shaft|key|keyway|coupling|spline|drive\s*shaft/i],keywords:["shaft","key","keyway","coupling","spline","drive shaft"],response:`**Shaft & Drive Design**

**Standard Shaft Sizes:**
| Application | Shaft Ø (mm) | Material | Tolerance |
|------------|-------------|----------|-----------|
| Light panel | 30-40 | EN8 | h6 |
| Medium purlin | 40-55 | EN24 | h6 |
| Heavy purlin | 55-70 | EN24 | h6 |
| Structural/tube | 70-100 | EN24/EN36 | h6 |

**Keyway Standards (DIN 6885):**
| Shaft Ø | Key W×H | Keyway Depth (shaft) | Keyway Depth (hub) |
|---------|---------|---------------------|-------------------|
| 30 | 8×7 | 4.0 | 3.3 |
| 40 | 12×8 | 5.0 | 3.3 |
| 50 | 14×9 | 5.5 | 3.8 |
| 60 | 18×11 | 7.0 | 4.4 |
| 70 | 20×12 | 7.5 | 4.9 |
| 80 | 22×14 | 9.0 | 5.4 |

**Shaft Material Properties:**
- EN8: Yield 350 MPa, UTS 550 MPa — light duty
- EN24 (4340): Yield 680 MPa, UTS 850 MPa — standard
- EN36 (3310): Case hardened to HRC 60 — heavy duty

**Coupling Types:**
| Type | Misalignment | Torque | Use |
|------|-------------|--------|-----|
| Jaw (Lovejoy) | ±1° angular | Low-medium | Motor to gearbox |
| Gear coupling | ±0.5° | High | Gearbox to roll shaft |
| Chain coupling | ±1° | Medium | Drive chain |
| Universal joint | ±15° | Medium | Angled drives |

**Drive Chain:** Duplex roller chain (08B-2 / 10B-2), lubricated, chain guard mandatory`},{patterns:[/entry\s*guide|exit\s*guide|strip\s*guide|feeding|coil\s*feed|straighten/i],keywords:["entry guide","exit guide","strip guide","feeding","coil feed","straightener"],response:`**Entry/Exit Guide & Material Handling**

**Entry Section (in order):**
1. Decoiler (motorized, with brake)
2. Coil car (hydraulic, for loading)
3. Pinch rolls (2-roll, powered)
4. Straightener/leveler (7 or 9 roll)
5. Edge guide (adjustable V-guides)
6. Pre-punch press (if required)
7. Servo feeder (encoder-controlled)
8. Entry funnel guide → first forming station

**Entry Guide Design:**
- Funnel shape: 10-15mm wider than strip at entry, narrowing to strip width + 0.5mm
- Material: hardened EN31 or bronze (for coated materials)
- Adjustable laterally ±20mm for centering
- Spring-loaded top guide to accommodate thickness variation

**Exit Section:**
1. Flying shear or post-cut
2. Run-out table (roller conveyor, 3-6m)
3. Length measurement (encoder wheel)
4. Stacker/bundler (auto or manual)

**Exit Guide:**
- Support the formed profile immediately after last station
- Prevent twist, bow, or flare during cutting
- Roller support every 500mm for long profiles

**Straightener Settings:**
- Roll overlap: 2-5mm more than material thickness
- For GI 0.5mm: overlap 3mm
- For MS 2.0mm: overlap 5mm
- For HSLA 3.0mm: overlap 7mm`},{patterns:[/iso\s*9001|quality\s*system|documentation|traceability|audit/i],keywords:["iso 9001","quality system","documentation","traceability","audit"],response:`**Quality Management System (ISO 9001)**

**Required Documentation for Roll Forming:**
1. **Incoming Material Certificate** — Mill test certificate (EN 10204 3.1)
2. **First Article Inspection Report (FAIR)** — All dimensions vs drawing
3. **In-Process Inspection** — Station setup sheet, gap measurements
4. **Final Inspection Report** — Profile dimensions, length, straightness
5. **Packing & Dispatch** — Bundle weight, qty, loading photos

**Traceability Chain:**
Coil Heat No → Strip Width/Thickness → Machine/Line No → Operator → Shift → Piece Serial

**Process Control Documents:**
- Setup sheet (per profile): roll gaps, station sequence, speeds
- Maintenance log: PM schedule, breakdown history
- Calibration records: measuring instruments, annual calibration

**Key Quality Records:**
- Control plan
- FMEA (Failure Mode & Effects Analysis)
- SPC charts (X-bar R, individual moving range)
- Corrective action reports (8D format)
- Customer complaint register

**Audit Checklist (annual):**
- Instrument calibration status ✓
- Roll condition records ✓
- Operator training records ✓
- Non-conformance handling ✓
- Customer feedback review ✓`},{patterns:[/springback\s*kya|spring\s*back\s*kya|springback\s*ko\s*kaise|springback\s*control|spring\s*wapas/i],keywords:["springback kya","spring back","springback control","spring wapas","elastic recovery"],response:`**Springback — Roll Forming Mein Kya Hota Hai**

Springback woh phenomenon hai jab metal bend hone ke baad thoda seedha ho jaata hai — elastic recovery ki wajah se.

**Kyun hota hai:**
- Har metal mein elastic zone hota hai
- Plastic deformation ke baad, elastic energy release hoti hai
- Metal apni original shape mein thoda wapas aata hai

**Springback Formula:**
\`\`\`
Springback Angle = Bend Angle × (1 - σy/(E × k))
σy = Yield Strength
E  = Young's Modulus
k  = bending factor
\`\`\`

**Material ke hisaab se Springback:**
| Material | Springback |
|----------|-----------|
| Mild Steel (GI) | 2-5° |
| Stainless Steel | 8-15° |
| Aluminium | 10-20° |
| High Strength Steel | 15-25° |

**Control karne ke tarike:**
1. Over-bend karo (target se zyada)
2. Overbending compensation add karo G-code mein
3. Station count badhao
4. Pass line height adjust karo`},{patterns:[/roll\s*gap\s*kya|roll\s*ka\s*gap|gap\s*kaise\s*set|roll\s*gap\s*adjust|nip\s*gap/i],keywords:["roll gap kya","roll ka gap","gap kaise set karein","nip gap","roll gap adjust"],response:`**Roll Gap — Kya Hai Aur Kaise Set Karein**

Roll gap = upper roll aur lower roll ke beech ki distance.

**Sahi Roll Gap Formula:**
\`\`\`
Roll Gap = Material Thickness + Clearance
Clearance = 5-15% of thickness (material ke hisaab se)
\`\`\`

**Material ke hisaab se Gap:**
| Material | Thickness | Recommended Gap |
|----------|-----------|-----------------|
| GI Sheet | 0.5mm | 0.55-0.57mm |
| GI Sheet | 1.0mm | 1.07-1.12mm |
| GI Sheet | 1.5mm | 1.60-1.68mm |
| SS Sheet | 1.0mm | 1.10-1.15mm |
| SS Sheet | 2.0mm | 2.12-2.20mm |

**Problem aaye to:**
- Gap zyada → Profile loose, dimensions galat
- Gap kam → Material pe pressure zyada, roll wear zyada
- Ideal gap mein material smoothly pass kare bina force ke`},{patterns:[/material\s*kaun\s*sa|konsa\s*material|material\s*select|gi\s*vs\s*ss|galvanized\s*vs/i],keywords:["konsa material","material select","gi vs ss","galvanized vs stainless","material kaisa"],response:`**Roll Forming ke liye Material Selection Guide**

**GI Sheet (Galvanized Iron) — Sabse Common:**
- Cost: Kam
- Corrosion resistance: Achha (zinc coating ki wajah se)
- Formability: Bahut achha
- Use: Roofing, purlins, channels, C-sections
- Thickness: 0.3mm to 2.0mm

**Stainless Steel (SS 304/316):**
- Cost: 3-5x zyada GI se
- Corrosion resistance: Bahut zyada
- Formability: Thoda mushkil (springback zyada)
- Use: Food industry, chemical plants, coastal areas
- Thickness: 0.5mm to 3.0mm

**Pre-painted (PPGI):**
- GI pe colour coating
- Roofing panels ke liye
- Roll forming ke baad paint scratch nahi hona chahiye

**High Strength Steel (HSS):**
- Structural applications
- Station count zyada chahiye
- Tooling wear zyada

**Meri Recommendation:**
- Normal construction → GI (cost-effective)
- Coastal/chemical → SS 316
- Coloured roofing → PPGI`},{patterns:[/flower\s*diagram\s*kya|flower\s*pattern\s*kya|roll\s*flower|flower\s*kaise\s*banate/i],keywords:["flower diagram kya","flower pattern","roll flower","flower kaise banate"],response:`**Flower Diagram — Roll Forming Mein Kya Hai**

Flower diagram = ek visual representation jisme dikhta hai material har station pe kaise bend hota hai.

**Kaise Kaam Karta Hai:**
1. Final profile ka cross-section dekho
2. Har station pe bending angle calculate karo
3. Station 1 = flat material
4. Last station = final profile shape
5. Beech mein gradually bend badhta hai

**Flower Diagram Mein Kya Dikhta Hai:**
- Har station ka cross-section
- Bending angles (gradually badhte hain)
- Strip width at each station
- Roll contact points

**SAI Rolotech Software Mein:**
- Profile → Station count daalo
- Software automatically flower generate karta hai
- 3D view mein dekh sakte ho
- G-code bhi isi se generate hota hai

**Rule of Thumb:**
- Simple profile (C-channel) = 4-6 stations
- Complex profile (Z-purlin) = 8-12 stations
- Each bend = minimum 2 stations`},{patterns:[/gcode\s*kya|g-code\s*kya|cnc\s*code\s*kya|gcode\s*kaise\s*banate|g\s*code\s*generate/i],keywords:["gcode kya","g-code kya","cnc code","gcode kaise","g code generate"],response:`**G-Code — Roll Forming Machine ke liye**

G-Code = CNC machine ko instructions dene ki language.

**Basic G-Code Commands:**
\`\`\`
G00 - Rapid move (tez chalao)
G01 - Linear move (feed rate pe chalao)
G02 - Clockwise arc
G03 - Counter-clockwise arc
M03 - Spindle/roll start
M05 - Stop
M30 - Program end
\`\`\`

**Roll Forming G-Code mein hota hai:**
- Station positions
- Roll gap values
- Feed speed
- Cutoff length
- Pass line height

**SAI Rolotech Software se G-Code:**
1. Profile banao
2. Material select karo (GI/SS/etc)
3. Machine parameters daalo
4. "Generate G-Code" click karo
5. Download karke machine mein load karo

**Format:** '.nc' ya '.gcode' file — seedha machine pe load hoti hai`},{patterns:[/station\s*kitne|kitne\s*station|station\s*count\s*kaise|stations\s*ka\s*number|pass\s*kitne/i],keywords:["station kitne","kitne station chahiye","station count","passes kitne","station number"],response:`**Stations Ka Number Kaise Decide Karein**

**Basic Rule:**
\`\`\`
Stations = Total Bending Angle ÷ Angle Per Station
Angle per station = 15-20° for mild steel
                  = 10-15° for SS/HSS
\`\`\`

**Profile ke hisaab se:**
| Profile | Minimum Stations | Recommended |
|---------|-----------------|-------------|
| C-Channel | 4 | 6-7 |
| Z-Purlin | 6 | 8-10 |
| Hat Section | 5 | 7-8 |
| Box Profile | 8 | 10-12 |
| Complex Rib | 10 | 14-16 |

**Zyada stations ke fayde:**
- Better shape accuracy
- Less springback
- Less tooling wear

**Kam stations ke fayde:**
- Kam machine cost
- Choti machine
- Jaldi production

**Software mein:** Profile daalo → software recommend karta hai minimum stations`},{patterns:[/machine\s*speed|roll\s*forming\s*speed|production\s*speed|meter\s*per\s*minute|mpm/i],keywords:["machine speed","roll forming speed","production speed","meter per minute","mpm"],response:`**Roll Forming Machine Speed Guide**

**Standard Speeds:**
| Application | Speed (m/min) |
|-------------|--------------|
| Simple profiles | 15-25 m/min |
| Complex profiles | 8-15 m/min |
| Heavy gauge (3mm+) | 5-10 m/min |
| Precision profiles | 3-8 m/min |
| High speed lines | 30-60 m/min |

**Speed affect karne wale factors:**
1. Profile complexity
2. Material thickness
3. Material type (SS = slow, GI = fast)
4. Number of stations
5. Cutoff mechanism type

**Speed formula:**
\`\`\`
Production (m/hr) = Speed (m/min) × 60 × Efficiency%
Efficiency typical = 70-85%
\`\`\`

**Recommendation:**
- Naya machine → 15-20 m/min se shuru karo
- Quality check karo → phir speed badhao
- Zyada speed → zyada wear, zyada noise`},{patterns:[/roll\s*material|tooling\s*material|roll\s*konse\s*material|d2\s*steel|en31/i],keywords:["roll material","tooling material","d2 steel","en31","roll kis material ka"],response:`**Roll Tooling Material — Kaun Sa Sabse Achha**

**Most Common: D2 Tool Steel (Best Choice)**
- Hardness: 58-62 HRC
- Wear resistance: Excellent
- Cost: Medium
- Life: 2-5 million meters
- Use: GI, PPGI, mild steel

**EN31 (Cheaper Alternative):**
- Hardness: 55-60 HRC
- Wear resistance: Good
- Cost: Kam
- Life: 0.5-1.5 million meters
- Use: Light gauge GI

**For Stainless Steel:**
- M2 HSS ya D2 with coating
- TiN coating (gold colour) — wear resistance badhata hai
- Life 3x zyada ho jaata hai

**Chrome Plating:**
- Surface hardness badhata hai
- Corrosion se bachata hai
- Surface finish better hoti hai

**Maintenance:**
- Rolls regular check karo
- Nick ya damage → regrind karwao
- Storage: oil coat karke raho`},{patterns:[/shaft\s*diameter|shaft\s*size|shaft\s*konsa|shaft\s*kya\s*hona\s*chahiye/i],keywords:["shaft diameter","shaft size","shaft konsa","shaft kya hona chahiye","arbor size"],response:`**Shaft Diameter Selection — Roll Forming**

**Standard Shaft Sizes:**
| Machine Type | Shaft Dia | Material |
|-------------|-----------|---------|
| Light duty | 30-38mm | EN8/EN24 |
| Medium duty | 40-50mm | EN24/EN31 |
| Heavy duty | 55-75mm | EN24 hardened |
| Extra heavy | 80-100mm | Alloy steel |

**Selection Rule:**
\`\`\`
Shaft Dia = Roll OD ÷ 3 (minimum)
For 200mm roll → minimum 65mm shaft
\`\`\`

**Deflection check:**
- Max deflection = 0.05mm at center
- Agar zyada → shaft dia badhao

**Bearing selection:**
- Shaft 40mm → 6208 bearing
- Shaft 50mm → 6210 bearing
- Shaft 60mm → 6212 bearing

**SAI Rolotech Software mein:**
- Shaft diameter input field mein daalo
- Software automatically roll ID calculate karta hai`},{patterns:[/problem\s*aa\s*rahi|defect\s*kyon|profile\s*twist|warping\s*kyon|bow\s*kyon/i],keywords:["problem aa rahi","defect kyon","profile twist","warping","bow defect","profile galat"],response:`**Common Roll Forming Defects — Kyon Aate Hain**

**1. Twist (Profile Mura Hua)**
- Cause: Asymmetric loading, roll misalignment
- Fix: Rolls realign karo, guide tools check karo

**2. Bow (Upar/Neeche Muda)**
- Cause: Horizontal bow = pass line height galat
- Fix: Pass line height adjust karo

**3. Flare (End pe flare)**
- Cause: Strip edge stress imbalance
- Fix: Edge rolls ya side rolls add karo

**4. Wave Edge**
- Cause: Excess edge tension
- Fix: Strip width check karo, rolls tight mat rakho

**5. Camber (Side mein muda)**
- Cause: Uneven roll pressure
- Fix: Both sides ka gap equal set karo

**6. Cracking**
- Cause: Radius too tight, material too hard
- Fix: Bend radius badhao, heat treatment check karo

**Diagnosis Steps:**
1. Kaun sa defect hai identify karo
2. Kahan se start hota hai (station number)
3. Woh station check karo
4. Fix karo, test karo`},{patterns:[/power\s*kitna|motor\s*power|kW\s*kitna|horsepower|HP\s*kitna/i],keywords:["power kitna","motor power","kW kitna","horsepower","motor HP"],response:`**Roll Forming Machine Motor Power Calculation**

**Basic Formula:**
\`\`\`
Power (kW) = Forming Force × Speed ÷ (1000 × Efficiency)
Forming Force = depends on material + thickness
\`\`\`

**Practical Guide:**
| Material Thickness | Profile Complexity | Motor Power |
|-------------------|-------------------|-------------|
| 0.4-0.8mm | Simple | 5-11 kW |
| 0.8-1.5mm | Medium | 11-22 kW |
| 1.5-3.0mm | Medium | 22-37 kW |
| 3.0-5.0mm | Heavy | 37-75 kW |

**Stations ke hisaab se:**
\`\`\`
Power per station = 0.5-2.0 kW (average)
Total = Stations × Power per station
\`\`\`

**Motor Type:**
- Standard: 3-phase induction motor
- VFD (Variable Frequency Drive) must → speed control ke liye
- Star-delta starter use karo (soft start)

**SAI Rolotech:** Forming force calculator se exact power milti hai`},{patterns:[/maintenance\s*kaise|machine\s*maintenance|service\s*kab|lubrication|grease\s*kab/i],keywords:["maintenance kaise","machine maintenance","service kab","lubrication","grease kab"],response:`**Roll Forming Machine Maintenance Schedule**

**Rooz (Daily):**
- Roll surfaces clean karo
- Lubrication check karo (oil level)
- Unusual noise sun'no
- Gaps check karo

**Hafta (Weekly):**
- Bearings grease karo
- Chain/gear drive lubricate karo
- Roll condition visually inspect karo
- Fasteners tight hain check karo

**Mahina (Monthly):**
- Shaft alignment check karo
- Roll gap calibrate karo
- Electrical connections check karo
- Belt/chain tension adjust karo

**3 Mahine (Quarterly):**
- Bearing replacement check
- Roll surface condition measure karo
- Alignment full check
- Motor brushes (if DC)

**Saal (Annual):**
- Overhaul
- All bearings replace (preventive)
- Roll regrind if needed
- Machine level set karo

**Lubrication:**
- Bearings: Grease (Mobilux EP2 ya equivalent)
- Gearbox: EP80/90 gear oil
- Chains: Chain lube spray
- Rolls: Thin oil coat (rust prevention when idle)`}],pt="Phi-3.5-mini-instruct-q4f16_1-MLC",U=90;let I=null,G=0,Y=!1;const ht=[{patterns:[/springback/i,/spring\s*back/i],keywords:["springback","overbend","compensation"],response:`**Springback Compensation — Expert Guide**

Springback is the elastic recovery of the strip after bending. The overbend percentage depends on material:

| Material | Springback Factor | Overbend % |
|----------|------------------|------------|
| GI | 1.05× | +5% |
| MS (Mild Steel) | 1.06× | +6% |
| CR (Cold Rolled) | 1.08× | +8% |
| HR (Hot Rolled) | 1.12× | +12% |
| AL (Aluminium) | 1.15× | +15% |
| SS 304 | 1.20× | +20% |
| Duplex SS 2205 | 1.24× | +24% |
| Titanium Gr2 | 1.25× | +25% |
| Inconel 625 | 1.28× | +28% |
| Spring Steel | 1.30× | +30% |
| Ti-6Al-4V | 1.35× | +35% |

**Key Rules:**
- Always add 2-3 calibration stations at the end
- For SS: NEVER stop the line mid-run (differential cooling = uneven springback)
- For AHSS (DP/TRIP): springback is non-linear — use FEA prediction
- Formula: Springback angle = (Yield × t) / (2 × E × R) × (180/π)`},{patterns:[/defect|bow|camber|twist|edge\s*wave|flare|crack|oil\s*can/i],keywords:["defect","bow","camber","twist","edge wave","flare","crack","oil canning"],response:`**Roll Forming Defects — Quick Diagnosis**

| Defect | Root Cause | Fix |
|--------|-----------|-----|
| **BOW** (longitudinal curve) | Unequal top/bottom strain | Equalize roll pressure, check pass line ±0.1mm |
| **CAMBER** (lateral curve) | Unequal left/right strain | Center strip, check roll alignment symmetry |
| **TWIST** (helical) | Shafts not parallel, asymmetric profile | Laser-align shafts ±0.05mm/m, add twist-correction rolls |
| **EDGE WAVE** | Roll gap too tight, >15°/station | Open gap 0.1-0.15mm, max 12° increment |
| **FLARE** (end flare) | Springback at flange | Close final gap to t+0.05mm, add calibration pass |
| **CRACKING** | r/t below minimum, cold material | Increase bend radius, warm material to room temp |
| **OIL CANNING** | Web too wide vs thickness | Max web = 100×t (GI), add stiffener rib |
| **SURFACE MARKING** | Rough rolls Ra>0.8µm | Polish rolls to Ra 0.4-0.8µm, add lubricant |

**CRITICAL defects (stop line immediately):** Twist, Cracking
Always check: strip centering → roll gap → shaft parallelism → lubrication`},{patterns:[/g71|g70|g76|g-?code|g\s*code|roughing\s*cycle|threading\s*cycle|cnc\s*program/i],keywords:["g71","g70","g76","g-code","roughing","threading","cnc program"],response:`**CNC G-Code Quick Reference — Turning**

**G71 — OD Roughing Cycle (Stock Removal)**
\`\`\`
G71 U2.0 R0.5        (DOC=2mm, retract=0.5mm)
G71 P100 Q200 U0.5 W0.1 F0.25  (profile P-Q, finish allowance U/W)
\`\`\`

**G70 — Finish Cycle**
\`\`\`
G70 P100 Q200        (follows same profile, single finish pass)
\`\`\`

**G76 — Threading Cycle (2-block Fanuc)**
\`\`\`
G76 P010060 Q050 R0.05   (1 finish pass, 60° angle, min cut 50µm)
G76 X18.376 Z-25.0 P812 Q400 F1.5  (M20×1.5 thread)
\`\`\`
- P812 = thread height (0.812mm × 2 sides = 1.624mm on diameter)
- Q400 = first pass depth (0.4mm)

**G75 — Grooving Cycle**
\`\`\`
G75 R0.5             (retract amount)
G75 X25.0 Z-10.0 P2000 Q5000 F0.05  (groove to X25, Z-10)
\`\`\`

**Delta 2X Special Rules:**
- Use M4 (reverse spindle) — ALWAYS
- G92 S500 before G96 — RPM clamp mandatory
- NO M8/M9 coolant commands
- Tool call: T0404 () — empty parentheses`},{patterns:[/rpm|cutting\s*speed|vc|feed\s*rate|depth\s*of\s*cut/i],keywords:["rpm","cutting speed","vc","feed","depth of cut","speed"],response:`**RPM & Cutting Data Calculator**

**RPM Formula:** N = (1000 × Vc) / (π × D)
Where: Vc = cutting speed (m/min), D = workpiece diameter (mm)

**Material Cutting Data:**
| Material | Vc Rough | Vc Finish | Feed Rough | Feed Finish |
|----------|----------|-----------|------------|-------------|
| Mild Steel | 150-200 | 200-250 | 0.25-0.35 | 0.08-0.12 |
| EN8 | 120-180 | 180-220 | 0.20-0.30 | 0.06-0.10 |
| SS 304 | 80-120 | 120-150 | 0.15-0.20 | 0.05-0.08 |
| Aluminium | 250-400 | 350-500 | 0.20-0.35 | 0.10-0.15 |
| Copper | 200-350 | 300-500 | 0.20-0.35 | 0.08-0.15 |
| Titanium Gr2 | 40-60 | 60-90 | 0.10-0.18 | 0.05-0.08 |
| Inconel 625 | 15-30 | 25-45 | 0.08-0.15 | 0.03-0.06 |
| Cast Iron | 80-150 | 150-200 | 0.20-0.30 | 0.08-0.12 |

**Example:** D=50mm, Vc=200 → N = (1000×200)/(3.14159×50) = **1273 RPM**

**Surface Finish:** Ra = f²/(8×r)
At f=0.1, r=0.8mm → Ra = 0.01/6.4 = **1.56 µm** (fine finish)`},{patterns:[/roll\s*design|roll\s*gap|roll\s*diameter|keyway|bore|roll\s*material/i],keywords:["roll design","roll gap","roll diameter","keyway","bore","roll material"],response:`**Roll Design Rules — Expert Reference**

**Roll Material:** EN31 (52100) hardened to HRC 58-62
- Surface finish: Ra 0.4-0.8 µm (ground and polished)
- Bore tolerance: H7 (typically Ø50H7 or Ø60H7)

**Roll Gap Setting:**
- Standard gap = material thickness + 0.05mm clearance
- Final station (ironing): gap = thickness + 0.03mm
- Measure with feeler gauge both sides

**Roll Diameter Rules:**
- Min OD: 10× shaft diameter (for rigidity)
- Max face width: 3× OD (to prevent deflection)
- Chamfer: 1×45° on all edges

**Station Spacing:** Equal spacing ±0.5mm
**Shaft Parallelism:** ±0.05mm/meter
**Roll Runout:** Max 0.02mm TIR
**Keyway:** DIN 6885 standard

**Forming Force (Karnezis model):**
F = (σ_y × t² × w) / (2 × R) × (1 + µ × L/t)
Where σ_y=yield, t=thickness, w=web, R=bend radius, µ=friction, L=contact arc`},{patterns:[/material|ss\s*304|ss\s*316|alumin|copper|titanium|inconel|duplex|dp\s*\d|trip|hsla|brass/i],keywords:["material","ss304","stainless","aluminium","copper","titanium","inconel","duplex","dp600","trip","brass"],response:`**Material Properties — Ultra Pro Max Database (33 Materials)**

| Material | Yield (MPa) | UTS (MPa) | K-Factor | Min R/t | Springback |
|----------|-------------|-----------|----------|---------|------------|
| MS (IS 1079 CR) | 210-260 | 340-410 | 0.44 | 1.0 | 2-4° |
| SS 304 | 210-310 | 520-620 | 0.50 | 2.0 | 5-10° |
| SS 316 | 220-310 | 520-580 | 0.50 | 2.0 | 6-11° |
| AL 6061-T6 | 275 | 310 | 0.43 | 0.5 | 1-3° |
| DP 600 | 340-420 | 590-700 | 0.38 | 2.0 | 6-12° |
| DP 780 | 490-550 | 780-900 | 0.36 | 2.5 | 8-15° |
| TRIP 780 | 490-600 | 780-900 | 0.36 | 2.0 | 7-13° |
| Copper (ETP) | 69-220 | 220-300 | 0.44 | 0.5 | 1-2° |
| Titanium Gr2 | 275-345 | 345-490 | 0.43 | 2.5 | 8-15° |
| Ti-6Al-4V | 880-950 | 950-1050 | 0.50 | 4.0 | 15-35° |
| Inconel 625 | 414-655 | 827-1034 | 0.40 | 3.5 | 12-20° |
| Duplex 2205 | 450-550 | 620-880 | 0.50 | 2.5 | 7-14° |

**Special Notes:**
- Titanium: extreme springback, warm forming preferred
- Inconel: HOT FORMING ONLY for tight bends, carbide rolls mandatory
- Magnesium: FIRE HAZARD — Class D extinguisher required
- DP/TRIP: 30-50% more stations than mild steel needed`},{patterns:[/corrugat|trapezoidal|purlin|c.?purlin|z.?purlin|roofing|standing\s*seam/i],keywords:["corrugated","trapezoidal","purlin","roofing","standing seam","cladding"],response:`**Corrugated Panels & Purlin Design**

**Corrugated Types:** Sinusoidal, Trapezoidal, Standing seam, Clip-lock
**Materials:** GI (Z120-Z275), PPGI, AL 3003/3105, Copper, Zinc

**Trapezoidal Rules:**
- Web angle: 60°-80°, Crest width ≥25mm, Valley ≥30mm
- Rib height: 25-100mm (higher = greater span)
- Min thickness: 0.40mm roofing, 0.50mm cladding
- Add stiffening ribs in flat areas >100×t to prevent oil-canning

**Purlin Design (C & Z):**
- C-Purlin: 100-300mm depth, 10-16 stations
- Z-Purlin: same depths, 12-18 stations, needs anti-twist brackets
- Material: HSLA 350-550, thickness 1.5-3.0mm
- Lip stiffener: 15° inward lip prevents local buckling
- Z-purlins can be nested for 50% shipping space savings

**Standing Seam:**
- Single-lock (180°), Double-lock (360°), Snap-lock
- Min slope: 3° (vs 10° for lapped trapezoidal)
- Fixed clip at ridge, sliding clips for thermal expansion`},{patterns:[/flower|station\s*count|bend\s*sequence|pass\s*line|neutral/i],keywords:["flower pattern","station count","bend sequence","pass line","neutral fiber"],response:`**Flower Pattern Engineering**

**Station Count Formula:**
N = (Total bend angle) / (Max increment per station)
Max increment: 12-15° for MS, 8-10° for SS/AHSS, 5-8° for Titanium

**Rules:**
1. First station: max 50% of normal increment
2. Last 2-3 stations: ironing/calibration (0.5-2° adjustments only)
3. Symmetry: both sides should bend simultaneously when possible
4. Overbend: add springback compensation at each station
5. Pass line must stay constant ±0.1mm through all stations

**K-Factor:** K = δ/t (neutral axis offset / thickness)
- MS: 0.44, SS: 0.50, AL: 0.43, Copper: 0.44, Titanium: 0.50  // FIX: MS 0.38→0.44, SS 0.42→0.50, AL 0.44→0.43, Ti 0.36→0.50 (DIN 6935)

**Bend Allowance:** BA = π × (R + K×t) × (θ/180)
**Strip Width:** W = Σ flat segments + Σ bend allowances

**Edge Strain:** ε = (L_edge - L_center) / L_center × 100%
Acceptable: <2% MS, <1.5% SS, <1% AL`},{patterns:[/safety|e.?stop|loto|ppe|emergency|accident/i],keywords:["safety","e-stop","loto","ppe","emergency","accident"],response:`**Safety Rules — Roll Forming & CNC**

**PPE Required:** Safety glasses (always), ear protection (near machine), cut-resistant gloves (strip handling), safety shoes

**E-STOP Rules:**
- Press E-STOP immediately if: unusual noise, tool break, strip jam, any injury risk
- After E-STOP: do NOT move axes until position is understood
- Re-home machine (G28 U0. W0.) after clearing

**LOTO (Lock-Out Tag-Out):**
- MANDATORY before any maintenance or roll change
- Your lock = your life. Nobody removes your lock except you.

**Strip Handling:**
- Strip edges are razor-sharp — ALWAYS wear gloves
- Never stand under crane during coil loading (500-5000 kg)
- If strip jams: STOP machine first, then remove

**CNC Safety:**
- Run new programs in single block mode first
- Always verify tool offsets before auto run
- Delta 2X: Use M4 (reverse), G92 S500 before G96
- Check coolant level daily for SS cutting`},{patterns:[/delta\s*2x|t2|t4|t6|t8|t10|vnmg|vaaa|tool\s*library/i],keywords:["delta 2x","t2","t4","t6","t8","t10","vnmg","vaaa"],response:`**Delta 2X Machine — Tool Library**

| Tool | Insert | IC (mm) | Radius | Feed | Purpose |
|------|--------|---------|--------|------|---------|
| T2 | VNMG 160408 | 9.52 | 0.8mm | 0.1016 | Heavy roughing/contour |
| T4 | VNMG 060108 | 3.97 | 0.8mm | 0.1016 | Fine profiling |
| T6 | VAAA 160404 | 9.52 | 0.4mm | 2.5 | Aggressive profiling |
| T8 | VNMG 060108 | 3.97 | 0.8mm | 0.1016 | Backup for T4 |
| T10 | Round 6mm | 6.0 | 3.0mm | 2.5 | OD grooving |

**Delta 2X Rules:**
- Always use M4 (reverse spindle)
- G92 S500/S1000 before G96 (RPM clamp)
- NO M8/M9 coolant commands
- Tool call format: T0404 () — empty parens
- N-number = tool number (N4 for T04)
- Trailing decimal on whole numbers: Z50. X150.

**Surface Finish:** Ra = f²/(8×r)
- VNMG (r=0.8): at f=0.1016 → Ra = 1.61 µm
- VAAA (r=0.4): at f=0.1016 → Ra = 3.22 µm`},{patterns:[/thread|acme|buttress|npt|worm\s*thread|multi.?start/i],keywords:["thread","acme","buttress","npt","worm","multi-start"],response:`**Thread Types — Complete Reference**

| Type | Angle | Standard | Application |
|------|-------|----------|-------------|
| ISO Metric (M) | 60° | ISO 261 | General purpose |
| UNC/UNF | 60° | ANSI B1.1 | US/UK imperial |
| BSP | 55° | ISO 228 | Pipe fittings |
| ACME | 29° | ASME B1.5 | Lead screws |
| Trapezoidal (Tr) | 30° | ISO 2904 | European lead screws |
| Buttress | 45°/7° | ISO 7721 | High axial load |
| NPT | 60° | ANSI B1.20.1 | Tapered pipe |

**G76 for Non-Standard Threads:**
- ACME: P010029 (change angle from 60 to 29)
- Buttress: compound infeed at 3° (shallow side)
- NPT: program X-axis taper (1:16 = 3.58°)
- Multi-start: phase shift = 360°/starts

**Thread Whirling:** 5-10× faster than single-point. Whirl head at 5000-12000 RPM. For bone screws, lead screws.`}],W=[...ht,...ut];function gt(t,s){const i=t.toLowerCase();for(const l of W)for(const p of l.patterns)if(p.test(t))return l.response;let o=null,r=0;for(const l of W){let p=0;for(const h of l.keywords)i.includes(h)&&(p+=h.length);p>r&&(r=p,o=l)}if(o&&r>3)return o.response;const a=[];for(const l of s.slice(-4))if(l.role==="assistant")for(const p of W)for(const h of p.keywords)l.content.toLowerCase().includes(h)&&a.push(h);if(a.length>0){const l=a.join(" ")+" "+i;for(const p of W){let h=0;for(const y of p.keywords)l.includes(y)&&(h+=y.length);h>r&&(r=h,o=p)}if(o&&r>3)return o.response}return`I'm running in CPU mode with a built-in knowledge base covering roll forming, CNC turning, materials, defects, G-code, and safety.

**38 Expert Domains Available — Ask anything:**
- Springback compensation for any material
- Roll forming defects (bow, camber, twist, edge wave)
- G-code cycles (G71, G70, G76, G75)
- RPM & cutting speed calculations
- Material properties (33 materials available)
- Corrugated panels & purlin design
- Flower pattern engineering
- Safety rules (LOTO, PPE, E-STOP)
- Delta 2X machine & tooling
- Thread types (ACME, Buttress, NPT)
- **Bearings** (SKF/NSK/Timken tables, L10 life)
- **Gearbox sizing** (WPA/helical/bevel, torque calc)
- **Motor & VFD selection** (kW calc, servo drives)
- **Station count** (per material & profile type)
- **Station spacing** (shaft center, frame design)
- **Roll diameter** (OD tables, bore/keyway)
- **Machine frame** (C-frame, closed, monoblock)
- **Line speed** (m/min tables, production calc)
- **Coil handling** (decoiler, straightener, mandrel)
- **Shear/cut-off** (flying shear, punch, force calc)
- **Lubrication** (forming oils, bearing grease)
- **Tolerances & QC** (DIN EN 10162, SPC, Cpk)
- **Welding/ERW** (tube mill, seam, spot weld)
- **Surface finish** (GI, PPGI, chrome, PVD)
- **Maintenance** (PM schedule, spare parts)
- **Cost & ROI** (machine pricing, payback calc)
- **Standards** (DIN/ISO/IS/ASTM/JIS reference)
- **Electrical/PLC** (Siemens/Mitsubishi, sensors, HMI)
- **C-Channel design** (full forming sequence, machine specs)
- **Strip width calc** (K-factor table, bend allowance)
- **Forming force** (Karnezis model, motor sizing)
- **Heat treatment** (HRC, tempering, PVD/TiN)
- **Shaft & keyway** (DIN 6885, coupling types)
- **Entry/exit guides** (straightener, feed design)
- **ISO 9001** (documentation, traceability, audit)

Offline AI — 100% Local, Zero Internet Required.`}function ft(){const[t,s]=n.useState({status:"idle",progress:0,progressText:"",error:null,timeoutCountdown:null,vramWarning:null}),i=n.useRef(!1),o=n.useCallback(()=>!(typeof navigator>"u"||!("gpu"in navigator)),[]),r=n.useCallback(async()=>{try{if(!("gpu"in navigator))return{ok:!0,warning:null};const g=await navigator.gpu.requestAdapter();if(!g)return{ok:!0,warning:null};const f=g.limits;if(!f)return{ok:!0,warning:null};const m=f.maxBufferSize;if(typeof m=="number"){const b=m/1073741824;if(b<2)return{ok:!1,warning:`Low GPU memory detected (~${b.toFixed(1)} GB). The AI model requires at least 2 GB of VRAM. Loading may fail or cause browser instability.`}}return{ok:!0,warning:null}}catch{return{ok:!0,warning:null}}},[]),a=n.useCallback(async(y,g)=>{const f=()=>G!==g||i.current;let m=!1,b=null,S=null;const c=()=>{b&&(clearTimeout(b),b=null),S&&(clearInterval(S),S=null)};return new Promise(w=>{let N=!1;const C=d=>{N||(N=!0,c(),w(d))};let x=U;S=setInterval(()=>{x-=1,f()||s(d=>({...d,timeoutCountdown:x}))},1e3),b=setTimeout(()=>{m=!0,C({success:!1,timedOut:!0})},U*1e3),y.CreateMLCEngine(pt,{initProgressCallback:d=>{if(f()||m)return;const v=Math.round((d.progress??0)*100);s(k=>({...k,status:v>=100?"loading":"downloading",progress:v,progressText:d.text??`Loading… ${v}%`,error:null}))}}).then(d=>{f()||m||C({success:!0,engine:d,timedOut:!1})}).catch(()=>{f()||m||C({success:!1,timedOut:!1})})})},[]),l=n.useCallback(async()=>{if(t.status==="ready"||t.status==="ready_cpu"||t.status==="downloading"||t.status==="loading")return;if(!o()){Y=!0,s({status:"ready_cpu",progress:100,progressText:"CPU Mode — Domain Knowledge Engine active",error:null,timeoutCountdown:null,vramWarning:"WebGPU not available. Running in CPU fallback mode with built-in engineering knowledge base (11 expert domains, 33 materials)."});return}i.current=!1,G++,s({status:"checking",progress:0,progressText:"Checking browser capabilities…",error:null,timeoutCountdown:null,vramWarning:null});const y=await r(),g=y.warning;y.ok||s(f=>({...f,vramWarning:g}));try{const f=await Ne(()=>import("./index-DFLBea7M.js"),[]);if(I){s({status:"ready",progress:100,progressText:"AI Model ready",error:null,timeoutCountdown:null,vramWarning:g});return}const m=f,b=++G;s({status:"downloading",progress:0,progressText:"Starting model download…",error:null,timeoutCountdown:U,vramWarning:g});const S=await a(m,b);if(i.current)return;if(S.success&&S.engine){I=S.engine,s({status:"ready",progress:100,progressText:"AI Model ready — Phi-3.5 Mini online",error:null,timeoutCountdown:null,vramWarning:g});return}const c=++G;s(N=>({...N,status:"downloading",progress:0,progressText:"First attempt failed. Retrying…",timeoutCountdown:U,error:null}));const w=await a(m,c);if(i.current)return;if(w.success&&w.engine){I=w.engine,s({status:"ready",progress:100,progressText:"AI Model ready — Phi-3.5 Mini online",error:null,timeoutCountdown:null,vramWarning:g});return}s(N=>({...N,status:"error",progress:0,progressText:"",timeoutCountdown:null,error:"AI model failed to load after two attempts. This may be due to slow network or insufficient GPU memory. Please refresh the page to try again."}))}catch(f){if(G++,i.current)return;const m=f instanceof Error?f.message:String(f);s(b=>({...b,status:"error",progress:0,progressText:"",error:m,timeoutCountdown:null}))}},[t.status,o,r,a]),p=n.useCallback(async(y,g=[])=>{if(Y)return await new Promise(S=>setTimeout(S,150+Math.random()*350)),gt(y,g);if(!I)throw new Error("AI model is not loaded. Please initialize first.");const f=[{role:"system",content:mt},...g.slice(-12),{role:"user",content:y}];return(await I.chat.completions.create({messages:f,temperature:.6,max_tokens:2048,stream:!1,top_p:.92,repetition_penalty:1.05})).choices?.[0]?.message?.content??"No response generated."},[]),h=n.useCallback(()=>{i.current=!0,G++,I=null,Y=!1,s({status:"idle",progress:0,progressText:"",error:null,timeoutCountdown:null,vramWarning:null})},[]);return{state:t,isSupported:o(),initialize:l,chat:p,reset:h}}function xt({onInitialize:t,progress:s,progressText:i,status:o,error:r,timeoutCountdown:a,vramWarning:l}){const p=o==="downloading"||o==="checking"||o==="loading";return e.jsxs("div",{className:"flex flex-col items-center justify-center h-full gap-6 p-6",children:[e.jsx("div",{className:"w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center",children:e.jsx(Z,{className:"w-8 h-8 text-indigo-400"})}),e.jsxs("div",{className:"text-center max-w-sm",children:[e.jsx("h3",{className:"text-base font-semibold text-zinc-100 mb-1",children:"Local AI Model"}),e.jsx("p",{className:"text-xs text-zinc-500 leading-relaxed",children:"Phi-3.5 Mini — a powerful 3.8B parameter language model that runs 100% in your browser. Download once (~2 GB), then use offline forever. No internet required after download."})]}),l&&e.jsxs("div",{className:"w-full max-w-sm bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex gap-2.5 items-start",children:[e.jsx(K,{className:"w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-medium text-amber-300 mb-0.5",children:"Low GPU Memory"}),e.jsx("p",{className:"text-[11px] text-amber-400/80 leading-relaxed",children:l})]})]}),r&&e.jsxs("div",{className:"w-full max-w-sm bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex gap-2.5 items-start",children:[e.jsx(K,{className:"w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-medium text-red-300 mb-0.5",children:"Error"}),e.jsx("p",{className:"text-[11px] text-red-400/80 leading-relaxed",children:r})]})]}),p&&e.jsxs("div",{className:"w-full max-w-sm",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"text-xs text-zinc-400",children:i||"Loading…"}),e.jsxs("div",{className:"flex items-center gap-2",children:[a!==null&&a>0&&e.jsxs("span",{className:"text-[10px] font-mono text-amber-400/70",children:[Math.floor(a/60),":",(a%60).toString().padStart(2,"0")]}),e.jsxs("span",{className:"text-xs font-mono text-zinc-300",children:[s,"%"]})]})]}),e.jsx("div",{className:"h-2 rounded-full bg-white/[0.06] overflow-hidden",children:e.jsx("div",{className:"h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300",style:{width:`${Math.max(2,s)}%`}})}),e.jsx("p",{className:"text-[10px] text-zinc-600 mt-1.5 text-center",children:o==="downloading"?"Downloading model files — this may take several minutes on first run":o==="loading"?"Loading model into WebGPU memory…":"Checking browser capabilities…"})]}),!p&&e.jsxs("button",{onClick:t,className:`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600/80 border border-indigo-500/40
                     text-sm font-semibold text-white hover:bg-indigo-600 transition-colors`,children:[e.jsx(Oe,{className:"w-4 h-4"}),r?"Retry Download":"Download AI Model"]}),e.jsxs("div",{className:"flex items-center gap-4 text-[10px] text-zinc-600",children:[e.jsxs("span",{className:"flex items-center gap-1",children:[e.jsx(H,{className:"w-3 h-3"})," WebGPU Accelerated"]}),e.jsxs("span",{className:"flex items-center gap-1",children:[e.jsx(q,{className:"w-3 h-3"})," 100% Offline"]}),e.jsxs("span",{className:"flex items-center gap-1",children:[e.jsx(He,{className:"w-3 h-3"})," Cached in Browser"]})]})]})}function bt({msg:t,aiStatus:s}){const i=t.role==="user";return e.jsxs("div",{className:`flex gap-2.5 ${i?"flex-row-reverse":"flex-row"} mb-3`,children:[e.jsx("div",{className:`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${i?"bg-blue-500/20 border border-blue-500/30":"bg-indigo-500/20 border border-indigo-500/30"}`,children:i?e.jsx(fe,{className:"w-3.5 h-3.5 text-blue-400"}):e.jsx(E,{className:"w-3.5 h-3.5 text-indigo-400"})}),e.jsxs("div",{className:`max-w-[78%] flex flex-col gap-1 ${i?"items-end":"items-start"}`,children:[e.jsx("div",{className:`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${i?"bg-blue-600/25 border border-blue-500/20 text-zinc-100":"bg-white/[0.04] border border-white/[0.06] text-zinc-200"}`,children:t.content}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"text-[10px] text-zinc-700",children:new Date(t.timestamp).toLocaleTimeString()}),e.jsx("span",{className:`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${s==="ready_cpu"?"bg-amber-500/10 text-amber-400":"bg-indigo-500/10 text-indigo-400"}`,children:s==="ready_cpu"?"CPU AI":"Local AI"})]})]})]})}function yt(){const{state:t,initialize:s,chat:i,reset:o}=ft(),[r,a]=n.useState([]),[l,p]=n.useState(""),[h,y]=n.useState(!1),g=n.useRef(null),f=n.useRef(null);n.useEffect(()=>{g.current?.scrollIntoView({behavior:"smooth"})},[r,h]);const m=n.useCallback(async()=>{const c=l.trim();if(!c||h||t.status!=="ready"&&t.status!=="ready_cpu")return;const w={id:`${Date.now()}-u`,role:"user",content:c,timestamp:new Date().toISOString()};a(N=>[...N,w]),p(""),y(!0);try{const N=r.slice(-8).map(d=>({role:d.role,content:d.content})),C=await i(c,N),x={id:`${Date.now()}-a`,role:"assistant",content:C,timestamp:new Date().toISOString()};a(d=>[...d,x])}catch(N){const C={id:`${Date.now()}-err`,role:"assistant",content:`Sai Rolotech AI — Response generate nahi ho saka. ${N instanceof Error?N.message:"Please try again."}`,timestamp:new Date().toISOString()};a(x=>[...x,C])}y(!1),f.current?.focus()},[l,h,t.status,i,r]),b=c=>{c.key==="Enter"&&!c.shiftKey&&(c.preventDefault(),m())},S=()=>{confirm("Clear local AI chat history?")&&a([])};return t.status==="idle"||t.status==="not_downloaded"||t.status==="downloading"||t.status==="checking"||t.status==="loading"||t.status==="error"||t.status==="not_supported"?e.jsx(xt,{onInitialize:s,progress:t.progress,progressText:t.progressText,status:t.status,error:t.error,timeoutCountdown:t.timeoutCountdown,vramWarning:t.vramWarning}):e.jsxs("div",{className:"flex flex-col h-full",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Z,{className:"w-4 h-4 text-indigo-400"}),e.jsx("span",{className:"text-sm font-semibold text-zinc-100",children:"Local AI"}),e.jsx("span",{className:`text-[10px] px-2 py-0.5 rounded-full font-semibold ${t.status==="ready_cpu"?"bg-amber-500/10 border border-amber-500/25 text-amber-400":"bg-indigo-500/10 border border-indigo-500/25 text-indigo-400"}`,children:t.status==="ready_cpu"?"CPU Mode · Knowledge Engine":"Phi-3.5 Mini · 100% Offline"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("button",{onClick:o,title:"Unload model",className:"flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors",children:[e.jsx(D,{className:"w-3 h-3"})," Reset"]}),e.jsxs("button",{onClick:S,title:"Clear chat",className:"flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400 bg-red-500/8 border border-red-500/15 hover:bg-red-500/15 transition-colors",children:[e.jsx(ue,{className:"w-3 h-3"})," Clear"]})]})]}),e.jsxs("div",{className:"flex-1 overflow-y-auto p-4 min-h-0",children:[r.length===0&&e.jsxs("div",{className:"flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2",children:[e.jsx(E,{className:"w-8 h-8 text-zinc-700"}),e.jsx("p",{children:"Local AI ready — ask anything"}),e.jsx("p",{className:"text-[11px] text-center leading-relaxed",children:"Roll forming defects · TurnAxis CAM G-code · CNC turning · Materials · Hindi/Urdu/English"})]}),r.map(c=>e.jsx(bt,{msg:c,aiStatus:t.status},c.id)),h&&e.jsxs("div",{className:"flex gap-2.5 mb-3",children:[e.jsx("div",{className:"w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30",children:e.jsx(E,{className:"w-3.5 h-3.5 text-indigo-400"})}),e.jsx("div",{className:"bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3",children:e.jsxs("div",{className:"flex gap-1 items-center",children:[e.jsx("div",{className:"w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]"}),e.jsx("div",{className:"w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]"}),e.jsx("div",{className:"w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]"})]})})]}),e.jsx("div",{ref:g})]}),e.jsxs("div",{className:"px-4 pb-4 pt-2 flex-shrink-0 border-t border-white/[0.06]",children:[e.jsxs("div",{className:"flex gap-2 items-end",children:[e.jsx("textarea",{ref:f,value:l,onChange:c=>p(c.target.value),onKeyDown:b,placeholder:"Ask anything in Hindi, Urdu, or English… (Enter to send)",rows:2,disabled:h,className:`flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5
                       text-sm text-zinc-200 placeholder-zinc-600 resize-none
                       focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.06]
                       disabled:opacity-50 transition-colors`}),e.jsx("button",{onClick:m,disabled:h||!l.trim(),className:`w-10 h-10 rounded-xl bg-indigo-600/80 border border-indigo-500/40
                       flex items-center justify-center text-white
                       hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex-shrink-0`,children:h?e.jsx(T,{className:"w-4 h-4 animate-spin"}):e.jsx(ge,{className:"w-4 h-4"})})]}),e.jsx("p",{className:"text-[10px] text-zinc-700 mt-1.5",children:"Running locally on your device · No internet · No data sent anywhere"})]})]})}function St(){const[t,s]=n.useState({capabilities:null,initialized:!1,workerPoolSize:0,activeWorkers:0,queuedTasks:0,totalProcessed:0,avgComputeMs:0,memoryUsedMB:0,memoryPercent:0}),i=n.useRef(null),o=n.useCallback(()=>{const r=Be();Ue();const a=te(),l=ae();s({capabilities:r,initialized:!0,workerPoolSize:a.poolSize,activeWorkers:a.active,queuedTasks:a.queued,totalProcessed:a.totalProcessed,avgComputeMs:a.avgComputeMs,memoryUsedMB:l.usedMB,memoryPercent:l.percent})},[]);return n.useEffect(()=>(o(),i.current=setInterval(()=>{const r=te(),a=ae();s(l=>({...l,activeWorkers:r.active,queuedTasks:r.queued,totalProcessed:r.totalProcessed,avgComputeMs:r.avgComputeMs,workerPoolSize:r.poolSize,memoryUsedMB:a.usedMB,memoryPercent:a.percent}))},2e3),()=>{i.current&&clearInterval(i.current)}),[o]),t}function wt({value:t,size:s=48,stroke:i=4,color:o}){const r=(s-i)/2,a=2*Math.PI*r,l=a-Math.min(100,t)/100*a;return e.jsxs("svg",{width:s,height:s,className:"transform -rotate-90",children:[e.jsx("circle",{cx:s/2,cy:s/2,r,fill:"none",stroke:"rgba(255,255,255,0.06)",strokeWidth:i}),e.jsx("circle",{cx:s/2,cy:s/2,r,fill:"none",stroke:o,strokeWidth:i,strokeDasharray:a,strokeDashoffset:l,strokeLinecap:"round",className:"transition-all duration-700"})]})}function F({icon:t,label:s,value:i,sub:o,accent:r,children:a}){return e.jsxs("div",{className:`rounded-xl p-3 border ${r} bg-white/[0.02] flex flex-col gap-2`,children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-6 h-6 rounded-lg flex items-center justify-center bg-white/[0.05]",children:t}),e.jsx("span",{className:"text-[10px] text-zinc-500 font-semibold uppercase tracking-wider",children:s})]}),e.jsx("div",{className:"text-sm font-bold text-zinc-100",children:i}),o&&e.jsx("div",{className:"text-[10px] text-zinc-600",children:o}),a]})}function O({value:t,max:s,color:i,label:o}){const r=Math.min(100,t/Math.max(s,1)*100);return e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"text-[9px] text-zinc-600 w-16 truncate",children:o}),e.jsx("div",{className:"flex-1 bg-white/[0.06] rounded-full h-1.5 overflow-hidden",children:e.jsx("div",{className:`h-full rounded-full transition-all duration-500 ${i}`,style:{width:`${r}%`}})}),e.jsxs("span",{className:"text-[9px] text-zinc-500 w-8 text-right",children:[Math.round(r),"%"]})]})}function vt(){const t=St(),[s,i]=n.useState({active:0,queued:0,processed:0,avgMs:0}),[o,r]=n.useState({usedMB:0,percent:0});n.useEffect(()=>{const f=setInterval(()=>{const m=te(),b=ae();i({active:m.active,queued:m.queued,processed:m.totalProcessed,avgMs:m.avgComputeMs}),r({usedMB:b.usedMB,percent:b.percent})},1500);return()=>clearInterval(f)},[]);const a=t.capabilities;if(!a)return e.jsxs("div",{className:"flex items-center justify-center h-48 text-zinc-600 text-sm",children:[e.jsx(se,{className:"w-4 h-4 animate-spin mr-2"}),"Detecting hardware..."]});const l=Math.min(100,a.cpu.cores*12.5),p=a.gpu.tier==="ultra"?100:a.gpu.tier==="high"?75:a.gpu.tier==="medium"?50:25,h=Math.min(100,a.memory.deviceMemoryGB*12.5),y=Math.round((l+p+h)/3),g={ultra:"text-violet-400",high:"text-emerald-400",medium:"text-amber-400",low:"text-red-400"}[a.recommended.simulationQuality];return e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsxs("h3",{className:"text-sm font-bold text-zinc-100 flex items-center gap-2",children:[e.jsx(be,{className:"w-4 h-4 text-cyan-400"}),"Hardware Acceleration Engine"]}),e.jsx("p",{className:"text-[10px] text-zinc-600 mt-0.5",children:"Maximum power · All processors active · Real-time monitoring"})]}),e.jsx("div",{className:"flex items-center gap-2",children:e.jsxs("span",{className:`text-[10px] px-2 py-0.5 rounded-full font-bold border ${g} ${a.recommended.simulationQuality==="ultra"?"bg-violet-500/10 border-violet-500/25":a.recommended.simulationQuality==="high"?"bg-emerald-500/10 border-emerald-500/25":a.recommended.simulationQuality==="medium"?"bg-amber-500/10 border-amber-500/25":"bg-red-500/10 border-red-500/25"}`,children:[a.recommended.simulationQuality.toUpperCase()," Quality"]})})]}),e.jsxs("div",{className:"flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]",children:[e.jsxs("div",{className:"relative",children:[e.jsx(wt,{value:y,size:56,stroke:5,color:y>=75?"#22c55e":y>=50?"#eab308":"#ef4444"}),e.jsx("div",{className:"absolute inset-0 flex items-center justify-center",children:e.jsx("span",{className:"text-xs font-bold text-zinc-100",children:y})})]}),e.jsxs("div",{className:"flex-1",children:[e.jsx("div",{className:"text-xs font-semibold text-zinc-200",children:"Hardware Power Score"}),e.jsxs("div",{className:"text-[10px] text-zinc-500 mt-0.5",children:[a.cpu.cores," CPU cores · ",a.gpu.tier.toUpperCase()," GPU · ",a.memory.deviceMemoryGB,"GB RAM"]}),e.jsxs("div",{className:"flex gap-3 mt-1.5",children:[e.jsx(O,{value:l,max:100,color:"bg-blue-500",label:"CPU"}),e.jsx(O,{value:p,max:100,color:"bg-green-500",label:"GPU"}),e.jsx(O,{value:h,max:100,color:"bg-purple-500",label:"RAM"})]})]})]}),e.jsxs("div",{className:"grid grid-cols-2 lg:grid-cols-3 gap-3",children:[e.jsx(F,{icon:e.jsx(H,{className:"w-3.5 h-3.5 text-blue-400"}),label:"CPU Cores",value:`${a.cpu.cores} Threads`,sub:`Speed: ${a.cpu.estimatedSpeed} · ${a.cpu.logicalProcessors} logical`,accent:"border-blue-500/15",children:e.jsx(O,{value:s.active,max:a.workers.maxWorkers,color:"bg-blue-500",label:"Active"})}),e.jsx(F,{icon:e.jsx(et,{className:"w-3.5 h-3.5 text-green-400"}),label:"GPU",value:a.gpu.tier.toUpperCase(),sub:a.gpu.renderer.length>30?a.gpu.renderer.substring(0,30)+"…":a.gpu.renderer,accent:"border-green-500/15",children:e.jsxs("div",{className:"flex flex-wrap gap-1 mt-1",children:[a.gpu.webgl2&&e.jsx("span",{className:"text-[8px] px-1 py-0.5 rounded bg-green-500/10 text-green-400",children:"WebGL2"}),a.gpu.webgpu&&e.jsx("span",{className:"text-[8px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-400",children:"WebGPU"}),a.gpu.floatTextures&&e.jsx("span",{className:"text-[8px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400",children:"Float32"}),a.gpu.instancing&&e.jsx("span",{className:"text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400",children:"Instancing"})]})}),e.jsx(F,{icon:e.jsx(pe,{className:"w-3.5 h-3.5 text-purple-400"}),label:"Memory",value:`${a.memory.deviceMemoryGB} GB`,sub:`JS Heap: ${o.usedMB}MB / ${a.memory.jsHeapLimitMB}MB`,accent:"border-purple-500/15",children:e.jsx(O,{value:o.percent,max:100,color:o.percent>80?"bg-red-500":"bg-purple-500",label:"Used"})}),e.jsx(F,{icon:e.jsx(We,{className:"w-3.5 h-3.5 text-cyan-400"}),label:"Worker Pool",value:`${a.workers.maxWorkers} Workers`,sub:`Active: ${s.active} · Queue: ${s.queued}`,accent:"border-cyan-500/15",children:e.jsx("div",{className:"flex gap-1 mt-1",children:Array.from({length:a.workers.maxWorkers}).map((f,m)=>e.jsx("div",{className:`w-2.5 h-2.5 rounded-full transition-colors ${m<s.active?"bg-cyan-400 animate-pulse":"bg-white/[0.08]"}`},m))})}),e.jsx(F,{icon:e.jsx(Ve,{className:"w-3.5 h-3.5 text-amber-400"}),label:"Compute Stats",value:`${s.processed} Tasks`,sub:`Avg: ${s.avgMs}ms per task`,accent:"border-amber-500/15"}),e.jsx(F,{icon:e.jsx(Ae,{className:"w-3.5 h-3.5 text-rose-400"}),label:"Optimization",value:`Mesh: ${a.recommended.meshDensity}x`,sub:`Max triangles: ${(a.recommended.maxTriangles/1e3).toFixed(0)}K · Batch: ${a.recommended.batchSize}`,accent:"border-rose-500/15",children:e.jsxs("div",{className:"flex flex-wrap gap-1 mt-1",children:[a.workers.supportsSharedArrayBuffer&&e.jsx("span",{className:"text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400",children:"SharedMem"}),a.workers.supportsOffscreenCanvas&&e.jsx("span",{className:"text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400",children:"OffscreenCanvas"}),a.workers.supportsTransferable&&e.jsx("span",{className:"text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400",children:"Transferable"})]})})]}),e.jsxs("div",{className:"rounded-xl p-3 bg-white/[0.02] border border-white/[0.06]",children:[e.jsx("div",{className:"text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2",children:"GPU Capabilities"}),e.jsxs("div",{className:"grid grid-cols-2 gap-x-6 gap-y-1",children:[e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Max Texture"}),e.jsxs("span",{className:"text-zinc-300",children:[a.gpu.maxTextureSize,"px"]})]}),e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Draw Buffers"}),e.jsx("span",{className:"text-zinc-300",children:a.gpu.maxDrawBuffers})]}),e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Vertex Attribs"}),e.jsx("span",{className:"text-zinc-300",children:a.gpu.maxVertexAttribs})]}),e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Pixel Ratio"}),e.jsxs("span",{className:"text-zinc-300",children:[a.performance.pixelRatio.toFixed(1),"x"]})]}),e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Vendor"}),e.jsx("span",{className:"text-zinc-300 truncate max-w-[120px]",children:a.gpu.vendor})]}),e.jsxs("div",{className:"flex justify-between text-[10px]",children:[e.jsx("span",{className:"text-zinc-500",children:"Connection"}),e.jsx("span",{className:"text-zinc-300",children:a.performance.connectionType})]})]})]}),e.jsxs("p",{className:"text-[9px] text-zinc-700 text-right",children:["All ",a.cpu.cores," CPU cores + ",a.gpu.tier.toUpperCase()," GPU active · Worker pool auto-sized · Real-time refresh"]})]})}const kt={info:"text-zinc-400",success:"text-emerald-400",warn:"text-amber-400",error:"text-red-400"};function de({ok:t,label:s}){return e.jsxs("span",{className:`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${t?"bg-emerald-500/15 text-emerald-300 border border-emerald-500/30":"bg-red-500/15 text-red-300 border border-red-500/30"}`,children:[t?e.jsx(_,{className:"w-3 h-3"}):e.jsx(J,{className:"w-3 h-3"}),s]})}function V({icon:t,label:s,value:i,sub:o,color:r="zinc"}){const a={zinc:"border-zinc-700/60 bg-zinc-800/50",emerald:"border-emerald-700/40 bg-emerald-900/20",red:"border-red-700/40 bg-red-900/20",amber:"border-amber-700/40 bg-amber-900/20",blue:"border-blue-700/40 bg-blue-900/20"},l={zinc:"text-zinc-200",emerald:"text-emerald-300",red:"text-red-300",amber:"text-amber-300",blue:"text-blue-300"};return e.jsxs("div",{className:`rounded-lg border p-3 ${a[r]}`,children:[e.jsxs("div",{className:"flex items-center gap-2 text-zinc-400 text-xs mb-1",children:[t," ",s]}),e.jsx("div",{className:`text-lg font-bold tabular-nums ${l[r]}`,children:i}),o&&e.jsx("div",{className:"text-zinc-500 text-xs mt-0.5 truncate",children:o})]})}function Nt(){const[t,s]=n.useState(null),[i,o]=n.useState(!0),[r,a]=n.useState(!1),[l,p]=n.useState(null),[h,y]=n.useState(null),g=n.useCallback(async()=>{try{const c=await fetch("/api/system/watchdog-status");if(!c.ok)throw new Error(`HTTP ${c.status}`);const w=await c.json();s(w),y(null)}catch(c){y(c instanceof Error?c.message:String(c))}finally{o(!1)}},[]);n.useEffect(()=>{g();const c=setInterval(()=>{g()},3e4);return()=>clearInterval(c)},[g]);const f=async()=>{a(!0),p(null);try{const w=await(await fetch("/api/system/auto-push",{method:"POST"})).json();p({ok:w.ok,msg:w.message}),await g()}catch(c){p({ok:!1,msg:c instanceof Error?c.message:"Error"})}finally{a(!1)}};function m(c){if(!c)return"—";try{return new Date(c).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}catch{return c}}if(i)return e.jsxs("div",{className:"flex items-center justify-center h-48 text-zinc-500 gap-2",children:[e.jsx(D,{className:"w-4 h-4 animate-spin"})," Loading watchdog status..."]});if(h)return e.jsxs("div",{className:"flex flex-col items-center justify-center h-48 text-red-400 gap-2",children:[e.jsx(K,{className:"w-6 h-6"}),e.jsxs("span",{className:"text-sm",children:["API se data nahi aa raha: ",h]}),e.jsx("button",{onClick:()=>{g()},className:"mt-2 text-xs px-3 py-1 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300",children:"Retry karo"})]});if(!t)return null;const b=t.consecutiveFailures===0&&t.healthChecksPassed>0,S=t.lastGitPushResult?.includes("pushed")||t.lastGitPushResult?.includes("up-to-date");return e.jsxs("div",{className:"flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(xe,{className:"w-5 h-5 text-blue-400"}),e.jsx("h2",{className:"font-semibold text-zinc-100 text-base",children:"System Watchdog"}),e.jsx(de,{ok:b,label:b?"API Healthy":"API Issue"}),!t.isElectron&&e.jsx(de,{ok:!!S,label:S?"GitHub Synced":"Sync Check"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("button",{onClick:()=>{g()},className:"p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors",title:"Refresh",children:e.jsx(D,{className:"w-3.5 h-3.5"})}),!t.isElectron&&e.jsx("button",{onClick:()=>{f()},disabled:r,className:"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors",children:r?e.jsxs(e.Fragment,{children:[e.jsx(D,{className:"w-3 h-3 animate-spin"})," Pushing..."]}):e.jsxs(e.Fragment,{children:[e.jsx(ee,{className:"w-3 h-3"})," GitHub Push"]})})]})]}),l&&e.jsxs("div",{className:`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${l.ok?"bg-emerald-900/20 border-emerald-700/40 text-emerald-300":"bg-red-900/20 border-red-700/40 text-red-300"}`,children:[l.ok?e.jsx(_,{className:"w-3.5 h-3.5"}):e.jsx(J,{className:"w-3.5 h-3.5"}),l.msg,e.jsx("button",{onClick:()=>p(null),className:"ml-auto opacity-60 hover:opacity-100",children:"✕"})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2 md:grid-cols-4",children:[e.jsx(V,{icon:e.jsx(se,{className:"w-3.5 h-3.5"}),label:"Health Checks OK",value:t.healthChecksPassed,sub:`Last: ${m(t.lastHealthCheck)}`,color:"emerald"}),e.jsx(V,{icon:e.jsx(K,{className:"w-3.5 h-3.5"}),label:"Health Failures",value:t.healthChecksFailed,sub:`Consecutive: ${t.consecutiveFailures}/5`,color:t.consecutiveFailures>0?"red":"zinc"}),!t.isElectron&&e.jsxs(e.Fragment,{children:[e.jsx(V,{icon:e.jsx(le,{className:"w-3.5 h-3.5"}),label:"GitHub Pushes",value:t.gitPushCount,sub:`Last: ${m(t.lastGitPush)}`,color:"blue"}),e.jsx(V,{icon:e.jsx(J,{className:"w-3.5 h-3.5"}),label:"Push Errors",value:t.gitPushErrors,sub:t.lastGitPushResult?.slice(0,40)??"—",color:t.gitPushErrors>0?"amber":"zinc"})]})]}),!t.isElectron&&e.jsxs("div",{className:"rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3",children:[e.jsxs("div",{className:"flex items-center gap-2 text-zinc-400 text-xs mb-2",children:[e.jsx(le,{className:"w-3.5 h-3.5"})," GitHub Auto-Sync Status"]}),e.jsxs("div",{className:"grid grid-cols-2 gap-x-4 gap-y-1 text-xs",children:[e.jsx("span",{className:"text-zinc-500",children:"Last Push:"}),e.jsx("span",{className:"text-zinc-300 font-mono",children:m(t.lastGitPush)}),e.jsx("span",{className:"text-zinc-500",children:"Result:"}),e.jsx("span",{className:`font-mono ${t.lastGitPushResult?.includes("pushed")?"text-emerald-400":t.lastGitPushResult?.includes("up-to-date")?"text-blue-400":t.lastGitPushResult?.includes("failed")?"text-red-400":"text-zinc-400"}`,children:t.lastGitPushResult??"—"}),e.jsx("span",{className:"text-zinc-500",children:"Mode:"}),e.jsx("span",{className:"text-zinc-300",children:"Auto-push every 10 min"})]})]}),e.jsxs("div",{className:"rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3",children:[e.jsxs("div",{className:"flex items-center gap-2 text-zinc-400 text-xs mb-2",children:[e.jsx(se,{className:"w-3.5 h-3.5"})," Server Info"]}),e.jsxs("div",{className:"grid grid-cols-2 gap-x-4 gap-y-1 text-xs",children:[e.jsx("span",{className:"text-zinc-500",children:"API Port:"}),e.jsx("span",{className:"text-zinc-300 font-mono",children:t.apiPort}),e.jsx("span",{className:"text-zinc-500",children:"Mode:"}),e.jsx("span",{className:"text-zinc-300",children:t.isElectron?"Desktop (Electron)":"Cloud (Replit)"}),e.jsx("span",{className:"text-zinc-500",children:"Started At:"}),e.jsx("span",{className:"text-zinc-300 font-mono",children:m(t.startedAt)})]})]}),e.jsxs("div",{className:"rounded-lg border border-zinc-700/60 bg-zinc-900/60 flex flex-col min-h-0",children:[e.jsxs("div",{className:"flex items-center gap-2 px-3 py-2 border-b border-zinc-700/40 text-zinc-400 text-xs",children:[e.jsx(he,{className:"w-3.5 h-3.5"})," Recent Activity (last 20)"]}),e.jsxs("div",{className:"overflow-y-auto max-h-48 font-mono text-xs p-2 space-y-0.5",children:[t.logs.length===0&&e.jsx("div",{className:"text-zinc-600 py-2 text-center",children:"Koi activity nahi abhi tak..."}),[...t.logs].reverse().slice(0,20).map((c,w)=>e.jsxs("div",{className:"flex gap-2",children:[e.jsx("span",{className:"text-zinc-600 flex-shrink-0",children:c.time}),e.jsx("span",{className:kt[c.type],children:c.message})]},w))]})]})]})}const Ct=[{id:"system",label:"System Info",icon:e.jsx(Ke,{className:"w-4 h-4"})},{id:"hardware",label:"Hardware",icon:e.jsx(be,{className:"w-4 h-4"})},{id:"chat",label:"AI Chat",icon:e.jsx(Z,{className:"w-4 h-4"})},{id:"localai",label:"Local AI",icon:e.jsx(H,{className:"w-4 h-4"})},{id:"files",label:"File Manager",icon:e.jsx($e,{className:"w-4 h-4"})},{id:"settings",label:"Settings",icon:e.jsx(qe,{className:"w-4 h-4"})},{id:"watchdog",label:"Auto Sync",icon:e.jsx(xe,{className:"w-4 h-4"})}];function jt({isOnline:t}){const[s,i]=n.useState(!1),o=n.useRef(t),[r,a]=n.useState("");return n.useEffect(()=>{if(o.current!==t){a(t?"Connection restored — switching to Online AI mode":"Internet lost — AI automatically switched to Offline mode. No data lost."),i(!0);const l=setTimeout(()=>i(!1),5e3);return o.current=t,()=>clearTimeout(l)}},[t]),s?e.jsxs("div",{className:`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${t?"bg-emerald-500/15 border-b border-emerald-500/25 text-emerald-300":"bg-amber-500/15 border-b border-amber-500/25 text-amber-300"}`,children:[e.jsx(_e,{className:"w-3.5 h-3.5 flex-shrink-0"}),r,e.jsx("button",{onClick:()=>i(!1),className:"ml-auto text-current opacity-60 hover:opacity-100",children:"✕"})]}):null}function ua(){const[t,s]=n.useState("system"),i=me();return e.jsxs("div",{className:"flex flex-col h-full bg-[#07070F] text-zinc-100",children:[e.jsx(jt,{isOnline:i.isOnline}),e.jsxs("div",{className:"flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-base font-bold text-zinc-100 tracking-tight",children:"Ultra AI Dashboard"}),e.jsx("p",{className:"text-[11px] text-zinc-600 mt-0.5",children:"All-in-one AI control center · hardware · system · chat · files"})]}),e.jsx("div",{className:"flex items-center gap-2",children:e.jsx("span",{className:`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${i.isOnline?"bg-emerald-500/10 border border-emerald-500/25 text-emerald-400":"bg-amber-500/12 border border-amber-500/30 text-amber-400 animate-pulse"}`,children:i.isOnline?e.jsxs(e.Fragment,{children:[e.jsx(re,{className:"w-2.5 h-2.5"})," Online AI Active"]}):e.jsxs(e.Fragment,{children:[e.jsx(q,{className:"w-2.5 h-2.5"})," Offline AI Active"]})})})]}),e.jsx("div",{className:"flex gap-0.5 px-4 pt-3 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto",children:Ct.map(o=>{const r=t===o.id;return e.jsxs("button",{onClick:()=>s(o.id),className:`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-t-lg relative transition-colors whitespace-nowrap ${r?"text-blue-300 bg-white/[0.05]":"text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"}`,children:[e.jsx("span",{className:r?"text-blue-400":"text-zinc-600",children:o.icon}),o.label,r&&e.jsx("span",{className:"absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full opacity-70"})]},o.id)})}),e.jsxs("div",{className:"flex-1 overflow-hidden",children:[t==="system"&&e.jsx("div",{className:"h-full overflow-y-auto p-5",children:e.jsx(st,{})}),t==="hardware"&&e.jsx("div",{className:"h-full overflow-y-auto p-5",children:e.jsx(vt,{})}),t==="chat"&&e.jsx("div",{className:"h-full flex flex-col",children:e.jsx(it,{})}),t==="localai"&&e.jsx("div",{className:"h-full flex flex-col",children:e.jsx(yt,{})}),t==="files"&&e.jsx("div",{className:"h-full flex flex-col",children:e.jsx(lt,{})}),t==="settings"&&e.jsx("div",{className:"h-full overflow-y-auto",children:e.jsx(ct,{})}),t==="watchdog"&&e.jsx("div",{className:"h-full overflow-hidden",children:e.jsx(Nt,{})})]})]})}export{ua as UltraDashboard};
