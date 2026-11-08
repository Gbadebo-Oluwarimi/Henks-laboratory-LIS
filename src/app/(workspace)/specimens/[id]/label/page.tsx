import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PrintLabelButton } from "@/app/(workspace)/specimens/[id]/label/print-label-button";
import { getDatabase } from "@/lib/mongodb";
import type { SpecimenRecord } from "@/lib/models";
import { ObjectId } from "mongodb";

const code39: Record<string, string> = {
  "*": "nwnwnnwnn", "-": "nwnnnnwnw",
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
  "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn",
  P: "nnwnwnnwn", S: "nnwnnnwwn",
};

function Code39Barcode({ value }: { value: string }) {
  const symbols = `*${value}*`;
  let x = 0;
  const bars: Array<{ x: number; width: number }> = [];
  for (const symbol of symbols) {
    const pattern = code39[symbol];
    if (!pattern) continue;
    for (let index = 0; index < pattern.length; index += 1) {
      const width = pattern[index] === "w" ? 3 : 1;
      if (index % 2 === 0) bars.push({ x, width });
      x += width + 1;
    }
    x += 2;
  }
  return <svg className="barcode" viewBox={`0 0 ${x} 40`} role="img" aria-label={`Code 39 barcode for ${value}`}><title>{value}</title>{bars.map((bar, index) => <rect key={index} x={bar.x} y="0" width={bar.width} height="34" fill="#111827" />)}</svg>;
}

export default async function SpecimenLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  const specimen = await (await getDatabase()).collection<SpecimenRecord>("specimens").findOne({ _id: new ObjectId(id) });
  if (!specimen) notFound();
  return <main className="mx-auto max-w-xl space-y-4 p-6 print:m-0 print:p-0">
    <div className="flex items-center justify-between print:hidden"><Link href="/specimens" className="inline-flex items-center gap-1 text-xs font-medium text-slate-600"><ArrowLeft size={14} />Back to specimens</Link><PrintLabelButton /></div>
    <article className="specimen-label"><header><strong>HENKS MEDICAL LIMITED</strong><span>SPECIMEN IDENTIFICATION</span></header><div className="patient-name">{specimen.patientName}</div><div className="patient-meta"><span>{specimen.patientNumber}</span><span>{specimen.accessionId}</span></div><div className="specimen-type">{specimen.specimenType}</div><Code39Barcode value={specimen.specimenId} /><div className="barcode-caption">{specimen.specimenId}</div><footer>Linked tests: {specimen.testCodes.join(", ")}</footer></article>
    <style>{`@page{size:76mm 38mm;margin:2mm}.specimen-label{box-sizing:border-box;width:72mm;min-height:34mm;border:1px solid #64748b;padding:2mm 3mm;color:#111827;font-family:Arial,sans-serif;overflow:hidden}.specimen-label header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd5e1;padding-bottom:1mm;font-size:8pt}.specimen-label header span{font-size:6pt;letter-spacing:.08em}.patient-name{font-size:10pt;font-weight:700;margin-top:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.patient-meta{display:flex;justify-content:space-between;font-size:7pt;margin-top:.5mm}.specimen-type{font-size:8pt;font-weight:700;margin-top:1mm}.barcode{display:block;width:100%;height:8mm;margin-top:1mm}.barcode-caption{text-align:center;font-family:monospace;font-size:7pt;letter-spacing:.08em}.specimen-label footer{margin-top:1mm;border-top:1px solid #cbd5e1;padding-top:.5mm;font-size:6pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media screen{.specimen-label{box-shadow:0 1px 3px #0002}}`}</style>
  </main>;
}
