import React, { useState } from "react";
import { Database, Download, CheckCircle, FileText, Send, Copy, Package, ClipboardList, Truck, BarChart2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ERPSystem = "tally" | "erpnext" | "sap" | "odoo" | "csv";
type DocType = "po" | "bom" | "jobcard" | "challan" | "invoice";

interface BOMItem {
  id: string; partName: string; material: string; thickness: number;
  qty: number; unit: string; weight: number; ratePerKg: number; process: string; hsnCode: string;
}

const ERPSYSTEMS: { id: ERPSystem; name: string; color: string; logo: string; desc: string; ext: string }[] = [
  { id: "tally",   name: "Tally Prime",    color: "#2563eb", logo: "T", desc: "India standard — XML voucher",  ext: "xml"  },
  { id: "erpnext", name: "ERPNext / Frappe",color: "#059669", logo: "E", desc: "Open-source — REST API JSON", ext: "json" },
  { id: "sap",     name: "SAP MM / PP",    color: "#f59e0b", logo: "S", desc: "SAP IDOC-compatible CSV",       ext: "csv"  },
  { id: "odoo",    name: "Odoo 17",        color: "#7c3aed", logo: "O", desc: "Odoo JSON import format",       ext: "json" },
  { id: "csv",     name: "Universal CSV",  color: "#52525b", logo: "C", desc: "Excel / any ERP import",       ext: "csv"  },
];

const DEFAULT_BOM: BOMItem[] = [
  { id: "RM-001", partName: "GI Strip Coil 1.2mm",     material: "GI",       thickness: 1.2, qty: 500,  unit: "KG",  weight: 1.0,  ratePerKg: 62,  process: "Roll Forming",    hsnCode: "72104100" },
  { id: "RM-002", partName: "CR Steel Coil 2.0mm",     material: "CR Steel", thickness: 2.0, qty: 200,  unit: "KG",  weight: 1.0,  ratePerKg: 68,  process: "CNC Press",        hsnCode: "72092710" },
  { id: "RM-003", partName: "MS Tube 50×50×2.0",       material: "MS",       thickness: 2.0, qty: 120,  unit: "MTR", weight: 2.93, ratePerKg: 58,  process: "Tube Mill",        hsnCode: "73062920" },
  { id: "RM-004", partName: "SS 304 Sheet 1.5mm",      material: "SS 304",   thickness: 1.5, qty: 80,   unit: "KG",  weight: 1.0,  ratePerKg: 180, process: "Laser / Bending",  hsnCode: "72193300" },
  { id: "FG-001", partName: "C-Channel 100×50×1.5",    material: "GI",       thickness: 1.5, qty: 250,  unit: "MTR", weight: 1.82, ratePerKg: 62,  process: "Roll Forming",     hsnCode: "72169990" },
  { id: "FG-002", partName: "Angle 50×50×3.0mm",       material: "MS",       thickness: 3.0, qty: 400,  unit: "MTR", weight: 2.24, ratePerKg: 58,  process: "Cold Bending",     hsnCode: "72162100" },
  { id: "FG-003", partName: "Z-Purlin 150×50×2.0",     material: "GI",       thickness: 2.0, qty: 180,  unit: "MTR", weight: 2.95, ratePerKg: 65,  process: "Roll Forming",     hsnCode: "72169990" },
  { id: "HW-001", partName: "M12 Hex Bolt GR8.8",      material: "HT Steel", thickness: 0,   qty: 2000, unit: "NOS", weight: 0.06, ratePerKg: 120, process: "Purchase",         hsnCode: "73181100" },
  { id: "HW-002", partName: "Welding Wire ER70S-6 1mm",material: "MS Wire",  thickness: 0,   qty: 50,   unit: "KG",  weight: 1.0,  ratePerKg: 95,  process: "Purchase",         hsnCode: "83112000" },
  { id: "HW-003", partName: "Paint — Epoxy Primer",    material: "Coating",  thickness: 0,   qty: 30,   unit: "LTR", weight: 1.2,  ratePerKg: 180, process: "Finishing",        hsnCode: "32091010" },
];

// ─── Document generators ──────────────────────────────────────────────────────

function genTallyXML(bom: BOMItem[], poNo: string, vendorName: string): string {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,"");
  const netAmt = bom.reduce((s,i) => s + i.qty * i.weight * i.ratePerKg, 0);
  const items = bom.map(i => `
    <ALLINVENTORYENTRIES.LIST>
      <STOCKITEMNAME>${i.partName}</STOCKITEMNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ACTUALQTY>${i.qty} ${i.unit}</ACTUALQTY>
      <BILLEDQTY>${i.qty} ${i.unit}</BILLEDQTY>
      <RATE>${i.ratePerKg}/${i.unit}</RATE>
      <AMOUNT>${(i.qty * i.weight * i.ratePerKg).toFixed(2)}</AMOUNT>
      <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>Main Store</GODOWNNAME>
        <BATCHNAME>Primary Batch</BATCHNAME>
        <ACTUALQTY>${i.qty} ${i.unit}</ACTUALQTY>
        <BILLEDQTY>${i.qty} ${i.unit}</BILLEDQTY>
        <AMOUNT>${(i.qty * i.weight * i.ratePerKg).toFixed(2)}</AMOUNT>
      </BATCHALLOCATIONS.LIST>
    </ALLINVENTORYENTRIES.LIST>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>SAI Rolotech Pvt Ltd</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER REMOTEID="${poNo}" VCHTYPE="Purchase Order" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${date}</DATE>
            <VOUCHERTYPENAME>Purchase Order</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${poNo}</VOUCHERNUMBER>
            <REFERENCE>${poNo}</REFERENCE>
            <PARTYLEDGERNAME>${vendorName}</PARTYLEDGERNAME>
            <NARRATION>Auto-generated PO by SAI Rolotech Smart Engines</NARRATION>
            <BASICBUYERNAME>SAI Rolotech Pvt Ltd</BASICBUYERNAME>
            <BASICSHIPDELIVERYNAME>Factory - Unit 1</BASICSHIPDELIVERYNAME>
            ${items}
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>Purchase @18% GST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>${netAmt.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function genERPNextJSON(bom: BOMItem[], poNo: string, vendorName: string): string {
  const net = bom.reduce((s,i) => s + i.qty * i.weight * i.ratePerKg, 0);
  return JSON.stringify({
    doctype: "Purchase Order",
    naming_series: "PO-.YYYY.-",
    company: "SAI Rolotech Pvt Ltd",
    supplier: vendorName,
    transaction_date: new Date().toISOString().slice(0,10),
    schedule_date: new Date(Date.now() + 7*86400000).toISOString().slice(0,10),
    currency: "INR",
    conversion_rate: 1,
    buying_price_list: "Standard Buying",
    items: bom.map(i => ({
      item_code: i.id,
      item_name: i.partName,
      description: `${i.material} — ${i.process} — HSN: ${i.hsnCode}`,
      hsn_sac: i.hsnCode,
      qty: i.qty,
      stock_uom: i.unit,
      uom: i.unit,
      rate: parseFloat((i.ratePerKg * i.weight).toFixed(2)),
      amount: parseFloat((i.qty * i.weight * i.ratePerKg).toFixed(2)),
      warehouse: "Stores - SAI",
      expected_delivery_date: new Date(Date.now() + 10*86400000).toISOString().slice(0,10),
    })),
    taxes: [
      { charge_type: "On Net Total", account_head: "CGST - SAI", rate: 9, tax_amount: parseFloat((net * 0.09).toFixed(2)) },
      { charge_type: "On Net Total", account_head: "SGST - SAI", rate: 9, tax_amount: parseFloat((net * 0.09).toFixed(2)) },
    ],
    total: parseFloat(net.toFixed(2)),
    net_total: parseFloat(net.toFixed(2)),
    grand_total: parseFloat((net * 1.18).toFixed(2)),
    status: "Draft",
  }, null, 2);
}

function genSAPCSV(bom: BOMItem[], poNo: string, vendorName: string): string {
  const hdr = "EBELN,EBELP,LIFNR,MATNR,TXZ01,MENGE,MEINS,NETPR,NETWR,MWSKZ,WERKS,LGORT,EINDT";
  const rows = bom.map((i, idx) => {
    const delDate = new Date(Date.now() + 10*86400000).toISOString().slice(0,10).replace(/-/g,"");
    return `${poNo},${String(idx+1).padStart(5,"0")},${vendorName.replace(/\s/g,"_").toUpperCase().slice(0,10)},${i.id},"${i.partName}",${i.qty},${i.unit},${(i.ratePerKg * i.weight).toFixed(2)},${(i.qty * i.weight * i.ratePerKg).toFixed(2)},V0,SAI1,WH01,${delDate}`;
  });
  return [hdr, ...rows].join("\n");
}

function genOdooJSON(bom: BOMItem[], poNo: string, vendorName: string): string {
  return JSON.stringify({
    model: "purchase.order", method: "create",
    args: [{ name: poNo, partner_ref: vendorName,
      order_line: bom.map(i => ({
        product_id: { name: i.partName, default_code: i.id },
        name: i.partName,
        product_qty: i.qty,
        product_uom: { name: i.unit },
        price_unit: parseFloat((i.ratePerKg * i.weight).toFixed(2)),
        date_planned: new Date(Date.now() + 10*86400000).toISOString(),
      })),
    }],
  }, null, 2);
}

function genCSV(bom: BOMItem[]): string {
  const hdr = "Part No,Part Name,Material,Thickness (mm),Qty,Unit,Wt/Unit (kg),Rate/kg (₹),Total (₹),HSN Code,Process";
  const rows = bom.map(i => `${i.id},"${i.partName}",${i.material},${i.thickness || "N/A"},${i.qty},${i.unit},${i.weight},${i.ratePerKg},${(i.qty*i.weight*i.ratePerKg).toFixed(2)},${i.hsnCode},${i.process}`);
  return [hdr, ...rows].join("\n");
}

function genJobCard(bom: BOMItem[], poNo: string): string {
  const fgItems = bom.filter(i => i.id.startsWith("FG"));
  const date = new Date().toLocaleDateString("en-IN");
  const lines = [
    "═══════════════════════════════════════════════════════════════════",
    "                   SAI ROLOTECH SMART ENGINES",
    "                         PRODUCTION JOB CARD",
    "═══════════════════════════════════════════════════════════════════",
    `  Job Card No : JC-${poNo.replace("PO-","").replace("PO","").trim()}`,
    `  Date        : ${date}`,
    `  PO Ref      : ${poNo}`,
    `  Machine     : Roll Forming Line 1 + Tube Mill`,
    `  Operator    : _______________  Shift: ___`,
    "───────────────────────────────────────────────────────────────────",
    "  ITEMS TO PRODUCE:",
    "───────────────────────────────────────────────────────────────────",
    ...fgItems.map((i, idx) =>
      `  ${idx+1}. ${i.partName.padEnd(35)} | ${String(i.qty).padStart(5)} ${i.unit} | ${i.process}`
    ),
    "───────────────────────────────────────────────────────────────────",
    "  TOOLING SETUP:",
    "  Roll Set      : _______________  Profile Code: ___________",
    "  Straightener  : Rolls=_____  Pressure=_____bar",
    "  Cut-off Die   : _______________  Blade Condition: Good / Replace",
    "  Speed (RPM)   : _____  Feed Rate: _____m/min",
    "───────────────────────────────────────────────────────────────────",
    "  QUALITY CHECKS:",
    "  [ ] First-off dimensional check — per drawing",
    "  [ ] Profile gauge approved by QC",
    "  [ ] Material test certificate attached",
    "  [ ] Surface finish — no burr, scratch, oil stain",
    "───────────────────────────────────────────────────────────────────",
    "  PRODUCTION LOG:",
    "  Start Time: _______  End Time: _______  Break: _______",
    "  Good Qty  : _______  Rejection: _______  Reason: _______________",
    "───────────────────────────────────────────────────────────────────",
    "  SIGN-OFF:",
    "  Production Incharge: _______________  Date: ___________",
    "  Quality Inspector  : _______________  Date: ___________",
    "═══════════════════════════════════════════════════════════════════",
  ];
  return lines.join("\n");
}

function genChallan(bom: BOMItem[], poNo: string, vendorName: string): string {
  const net = bom.reduce((s,i)=>s+i.qty*i.weight*i.ratePerKg,0);
  const gst = net * 0.18;
  const date = new Date().toLocaleDateString("en-IN");
  const lines = [
    "═══════════════════════════════════════════════════════════════════",
    "                   SAI ROLOTECH SMART ENGINES",
    "               DELIVERY / DISPATCH CHALLAN",
    "═══════════════════════════════════════════════════════════════════",
    `  Challan No   : DC-${poNo.replace("PO","DC")}`,
    `  Date         : ${date}`,
    `  PO Reference : ${poNo}`,
    `  From         : SAI Rolotech Pvt Ltd, Unit-1`,
    `  To           : ${vendorName}`,
    "───────────────────────────────────────────────────────────────────",
    "  S.No  Part No    Description                   Qty     Unit",
    "───────────────────────────────────────────────────────────────────",
    ...bom.map((i, idx) =>
      `  ${String(idx+1).padStart(3)}.  ${i.id.padEnd(10)} ${i.partName.slice(0,30).padEnd(30)} ${String(i.qty).padStart(6)}  ${i.unit}`
    ),
    "───────────────────────────────────────────────────────────────────",
    `  Gross Value  : ₹${net.toLocaleString("en-IN",{maximumFractionDigits:2})}`,
    `  CGST 9%      : ₹${(gst/2).toLocaleString("en-IN",{maximumFractionDigits:2})}`,
    `  SGST 9%      : ₹${(gst/2).toLocaleString("en-IN",{maximumFractionDigits:2})}`,
    `  TOTAL        : ₹${(net+gst).toLocaleString("en-IN",{maximumFractionDigits:2})}`,
    "───────────────────────────────────────────────────────────────────",
    "  Transport Details:",
    "  Vehicle No   : _______________  LR/BL No: _______________",
    "  Driver Name  : _______________  Mobile  : _______________",
    "  Transporter  : _______________",
    "───────────────────────────────────────────────────────────────────",
    "  Received By  : _______________  Sign: ___________  Date: ______",
    "  Dispatched By: _______________  Sign: ___________  Date: ______",
    "═══════════════════════════════════════════════════════════════════",
    "  This is a computer-generated document — SAI Rolotech Smart Engines",
  ];
  return lines.join("\n");
}

// ─── BOM Row ──────────────────────────────────────────────────────────────────

function BOMRow({ item, idx, onUpdate }: { item: BOMItem; idx: number; onUpdate: (id: string, f: keyof BOMItem, v: any) => void }) {
  const total = item.qty * item.weight * item.ratePerKg;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 72px 56px 56px 46px 64px 64px 80px 80px", gap: 5, padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center", background: idx % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", fontFamily: "monospace" }}>{item.id}</div>
      <div style={{ fontSize: 11, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.partName}>{item.partName}</div>
      <div style={{ fontSize: 10, color: "#a1a1aa" }}>{item.material}</div>
      <div style={{ fontSize: 10, color: "#71717a", textAlign: "right" }}>{item.thickness || "—"}</div>
      <input type="number" value={item.qty} onChange={e => onUpdate(item.id, "qty", parseFloat(e.target.value)||0)}
        style={{ width: "100%", padding: "3px 5px", borderRadius: 5, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.08)", color: "#fbbf24", fontSize: 11, textAlign: "right", outline: "none", boxSizing: "border-box" }} />
      <div style={{ fontSize: 9, color: "#52525b", textAlign: "center" }}>{item.unit}</div>
      <input type="number" value={item.weight} step={0.01} onChange={e => onUpdate(item.id, "weight", parseFloat(e.target.value)||0)}
        style={{ width: "100%", padding: "3px 5px", borderRadius: 5, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.07)", color: "#c4c4cc", fontSize: 11, textAlign: "right", outline: "none", boxSizing: "border-box" }} />
      <input type="number" value={item.ratePerKg} onChange={e => onUpdate(item.id, "ratePerKg", parseFloat(e.target.value)||0)}
        style={{ width: "100%", padding: "3px 5px", borderRadius: 5, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.07)", color: "#c4c4cc", fontSize: 11, textAlign: "right", outline: "none", boxSizing: "border-box" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textAlign: "right" }}>₹{total.toLocaleString("en-IN",{maximumFractionDigits:0})}</div>
      <div style={{ fontSize: 9, color: "#52525b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.process}</div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function ERPIntegrationView() {
  const [bom, setBom] = useState<BOMItem[]>(DEFAULT_BOM);
  const [erpSys, setErpSys] = useState<ERPSystem>("erpnext");
  const [docType, setDocType] = useState<DocType>("po");
  const [poNo, setPoNo] = useState("PO-2026-0019");
  const [vendor, setVendor] = useState("Shyam Steel Industries");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"bom" | "export" | "schedule">("bom");

  const updateItem = (id: string, f: keyof BOMItem, v: any) => setBom(prev => prev.map(i => i.id === id ? { ...i, [f]: v } : i));

  const net = bom.reduce((s,i) => s + i.qty * i.weight * i.ratePerKg, 0);
  const gst = net * 0.18;
  const grand = net + gst;

  function generateDoc() {
    let out = "";
    if (docType === "jobcard") { out = genJobCard(bom, poNo); setOutput(out); setActiveTab("export"); return; }
    if (docType === "challan") { out = genChallan(bom, poNo, vendor); setOutput(out); setActiveTab("export"); return; }
    switch (erpSys) {
      case "tally":   out = genTallyXML(bom, poNo, vendor); break;
      case "erpnext": out = genERPNextJSON(bom, poNo, vendor); break;
      case "sap":     out = genSAPCSV(bom, poNo, vendor); break;
      case "odoo":    out = genOdooJSON(bom, poNo, vendor); break;
      case "csv":     out = genCSV(bom); break;
    }
    setOutput(out);
    setActiveTab("export");
  }

  function download() {
    const erp = ERPSYSTEMS.find(e => e.id === erpSys)!;
    const ext = docType === "jobcard" || docType === "challan" ? "txt" : erp.ext;
    const prefix = docType === "jobcard" ? "JobCard" : docType === "challan" ? "Challan" : erp.name.replace(/\s/g,"");
    const b = new Blob([output], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b);
    a.download = `SAI_${prefix}_${poNo}.${ext}`; a.click();
  }

  function copy() { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  const schedule = [
    { op: "PO Release / Material Issue",       day: "Day 0",   resp: "Purchase / Store",  dept: "#60a5fa" },
    { op: "Raw Material GRN + Inspection",     day: "Day 1",   resp: "QC + Store",        dept: "#a78bfa" },
    { op: "Roll Tooling Setup + First-Off",    day: "Day 1–2", resp: "Production",        dept: "#f59e0b" },
    { op: "Roll Forming Production Run",       day: "Day 2–5", resp: "Line 1",            dept: "#34d399" },
    { op: "Tube Mill Run (MS / SS Tube)",      day: "Day 3–4", resp: "Tube Mill Cell",    dept: "#34d399" },
    { op: "CNC Machining (Brackets/Holes)",    day: "Day 4–6", resp: "CNC Cell",          dept: "#fbbf24" },
    { op: "Welding / Fabrication",             day: "Day 5–6", resp: "Weld Cell",         dept: "#fb923c" },
    { op: "Surface Treatment / Coating",       day: "Day 6–7", resp: "Finishing",         dept: "#c084fc" },
    { op: "Final QC + Dimensional Check",      day: "Day 7",   resp: "QC Team",           dept: "#f87171" },
    { op: "Packing + Dispatch Challan",        day: "Day 8",   resp: "Dispatch",          dept: "#52525b" },
  ];

  const DOC_TYPES: { id: DocType; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: "po",      label: "Purchase Order",   icon: <Package style={{ width: 13, height: 13 }} />,      desc: "ERP PO format" },
    { id: "bom",     label: "BOM Export",        icon: <BarChart2 style={{ width: 13, height: 13 }} />,    desc: "Bill of Materials" },
    { id: "jobcard", label: "Job Card",          icon: <ClipboardList style={{ width: 13, height: 13 }} />,desc: "Production card" },
    { id: "challan", label: "Dispatch Challan",  icon: <Truck style={{ width: 13, height: 13 }} />,        desc: "DC with GST" },
    { id: "invoice", label: "Invoice (CSV)",     icon: <FileText style={{ width: 13, height: 13 }} />,     desc: "Tax invoice CSV" },
  ];

  return (
    <div style={{ height: "100%", overflow: "auto", background: "#070710", padding: 18 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#d97706,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(217,119,6,0.3)" }}>
            <Database style={{ width: 21, height: 21, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>ERP Integration Suite</div>
            <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>Tally · ERPNext · SAP · Odoo · Job Card · Dispatch Challan · Production Schedule</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 3, textTransform: "uppercase" }}>PO / Ref Number</div>
              <input value={poNo} onChange={e => setPoNo(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 8, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.1)", color: "#fbbf24", fontSize: 12, fontWeight: 700, outline: "none", width: 160 }} />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#52525b", marginBottom: 3, textTransform: "uppercase" }}>Vendor / Party</div>
              <input value={vendor} onChange={e => setVendor(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 8, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.1)", color: "#e4e4e7", fontSize: 12, outline: "none", width: 200 }} />
            </div>
            <button onClick={generateDoc}
              style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(90deg,#d97706,#b45309)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 4px 14px rgba(217,119,6,0.3)" }}>
              <Send style={{ width: 14, height: 14 }} /> Generate
            </button>
          </div>
        </div>

        {/* Document type selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {DOC_TYPES.map(d => (
            <button key={d.id} onClick={() => setDocType(d.id)}
              style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${docType === d.id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.06)"}`, background: docType === d.id ? "rgba(217,119,6,0.12)" : "rgba(255,255,255,0.02)", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, transition: "all 0.12s" }}>
              <span style={{ color: docType === d.id ? "#fbbf24" : "#52525b" }}>{d.icon}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: docType === d.id ? "#fbbf24" : "#a1a1aa" }}>{d.label}</div>
                <div style={{ fontSize: 9, color: "#52525b" }}>{d.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ERP system selector (only for PO/BOM) */}
        {(docType === "po" || docType === "bom" || docType === "invoice") && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {ERPSYSTEMS.map(e => (
              <div key={e.id} onClick={() => setErpSys(e.id)}
                style={{ padding: "10px 14px", borderRadius: 11, border: `2px solid ${erpSys === e.id ? e.color + "60" : "rgba(255,255,255,0.05)"}`, background: erpSys === e.id ? e.color + "12" : "rgba(255,255,255,0.02)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.12s" }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: e.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff" }}>{e.logo}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: erpSys === e.id ? "#fff" : "#a1a1aa" }}>{e.name}</div>
                  <div style={{ fontSize: 9, color: "#52525b" }}>{e.desc}</div>
                </div>
                {erpSys === e.id && <CheckCircle style={{ width: 13, height: 13, color: e.color, marginLeft: 4 }} />}
              </div>
            ))}
          </div>
        )}

        {/* Summary KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
          {[
            { l: "Line Items", v: bom.length.toString(), c: "#60a5fa" },
            { l: "Net Value", v: `₹${(net/1000).toFixed(1)}K`, c: "#34d399" },
            { l: "CGST 9%", v: `₹${(gst/2/1000).toFixed(1)}K`, c: "#fbbf24" },
            { l: "SGST 9%", v: `₹${(gst/2/1000).toFixed(1)}K`, c: "#fbbf24" },
            { l: "Grand Total", v: `₹${(grand/1000).toFixed(1)}K`, c: "#f59e0b" },
          ].map((c, i) => (
            <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${c.c}18`, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#52525b", fontWeight: 700, marginBottom: 2, textTransform: "uppercase" }}>{c.l}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: c.c }}>{c.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 3, marginBottom: 12, padding: 4, background: "rgba(255,255,255,0.02)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.04)", width: "fit-content" }}>
          {[{ id: "bom", l: "📋 BOM Table" }, { id: "export", l: "📤 Document Output" }, { id: "schedule", l: "📅 Production Schedule" }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
              style={{ padding: "7px 16px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: activeTab === t.id ? "rgba(217,119,6,0.18)" : "transparent", color: activeTab === t.id ? "#fbbf24" : "#52525b" }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Tab: BOM */}
        {activeTab === "bom" && (
          <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 72px 56px 56px 46px 64px 64px 80px 80px", gap: 5, padding: "8px 12px", background: "rgba(255,255,255,0.04)", fontSize: 9, fontWeight: 800, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>Part No</div><div>Part Name</div><div>Mat.</div><div>Thk</div><div>Qty</div><div>Unit</div><div>Wt/Unit</div><div>Rate/kg</div><div>Total ₹</div><div>Process</div>
            </div>
            {bom.map((item, idx) => <BOMRow key={item.id} item={item} idx={idx} onUpdate={updateItem} />)}
            <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.04)", borderTop: "1px solid rgba(245,158,11,0.1)", display: "flex", justifyContent: "flex-end", gap: 22, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>Net: <span style={{ color: "#34d399", fontWeight: 800, fontSize: 14 }}>₹{net.toLocaleString("en-IN",{maximumFractionDigits:0})}</span></span>
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>GST 18%: <span style={{ color: "#fbbf24", fontWeight: 800 }}>₹{gst.toLocaleString("en-IN",{maximumFractionDigits:0})}</span></span>
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>Grand: <span style={{ color: "#f59e0b", fontWeight: 900, fontSize: 16 }}>₹{grand.toLocaleString("en-IN",{maximumFractionDigits:0})}</span></span>
            </div>
          </div>
        )}

        {/* Tab: Export */}
        {activeTab === "export" && (
          <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            {output ? (
              <>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText style={{ width: 13, height: 13, color: "#71717a" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#71717a" }}>{docType === "jobcard" ? "Job Card" : docType === "challan" ? "Dispatch Challan" : ERPSYSTEMS.find(e=>e.id===erpSys)?.name} — {poNo}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={copy} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.03)", color: copied ? "#34d399" : "#a1a1aa", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Copy style={{ width: 10, height: 10 }} />{copied ? "✓ Copied" : "Copy"}
                    </button>
                    <button onClick={download} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "rgba(217,119,6,0.2)", color: "#fbbf24", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Download style={{ width: 10, height: 10 }} />Download
                    </button>
                  </div>
                </div>
                <pre style={{ margin: 0, padding: 16, fontFamily: "monospace", fontSize: 11, color: "#34d399", background: "#08091a", overflow: "auto", maxHeight: 520, lineHeight: 1.75 }}>{output}</pre>
              </>
            ) : (
              <div style={{ padding: 60, textAlign: "center", color: "#3f3f46" }}>
                <Database style={{ width: 44, height: 44, margin: "0 auto 14px", opacity: 0.2 }} />
                <div style={{ fontSize: 13, fontWeight: 700 }}>Select document type and click "Generate"</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>PO → ERP formats | Job Card | Dispatch Challan</div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Schedule */}
        {activeTab === "schedule" && (
          <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                <span>📅</span> Production Schedule — {poNo}
              </div>
              <button onClick={() => { const t = genCSV(bom); const b = new Blob([t],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`Schedule_${poNo}.csv`; a.click(); }}
                style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(245,158,11,0.12)", color: "#fbbf24", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Download style={{ width: 11, height: 11 }} />Download CSV
              </button>
            </div>
            {schedule.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr 110px 180px 90px", gap: 12, padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center", background: i%2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                <div style={{ width: 26, height: 26, borderRadius: 99, background: `${row.dept}18`, border: `1px solid ${row.dept}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: row.dept }}>{i+1}</div>
                <div style={{ fontSize: 12, color: "#e4e4e7", fontWeight: 600 }}>{row.op}</div>
                <div style={{ fontSize: 11, color: "#a1a1aa" }}>{row.day}</div>
                <div style={{ fontSize: 11, color: "#71717a" }}>{row.resp}</div>
                <div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(245,158,11,0.08)", padding: "2px 8px", borderRadius: 99, border: "1px solid rgba(245,158,11,0.15)" }}>PENDING</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
