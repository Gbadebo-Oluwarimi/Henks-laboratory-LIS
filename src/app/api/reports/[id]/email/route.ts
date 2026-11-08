import { ObjectId } from "mongodb";
import { Resend } from "resend";

import type { LabOrder } from "@/lib/models";
import { getDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 5 * 1024 * 1024;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Sign in to send a report." }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return Response.json({ error: "Report not found." }, { status: 404 });

    const database = await getDatabase();
    const order = await database.collection<LabOrder>("labOrders").findOne({ _id: new ObjectId(id) });
    if (!order) return Response.json({ error: "Report not found." }, { status: 404 });

    const isFinal = order.status === "Completed"
      && order.tests.length > 0
      && order.tests.every((test) => test.status === "Completed")
      && Boolean(order.authorizedBy && order.authorizedByName && order.authorizedAt);
    if (!isFinal) return Response.json({ error: "Only an authorized final report can be emailed." }, { status: 409 });

    const recipient = order.clientSnapshot.email?.trim();
    if (!recipient) return Response.json({ error: "No email address is saved on this patient record." }, { status: 422 });
    if (!process.env.RESEND_API_KEY) {
      return Response.json({ error: "Email delivery is not configured. Ask an administrator to configure Resend." }, { status: 503 });
    }

    const formData = await request.formData();
    const attachment = formData.get("pdf");
    if (!(attachment instanceof File) || attachment.size === 0 || attachment.size > MAX_PDF_BYTES) {
      return Response.json({ error: "The report PDF is missing or too large to email." }, { status: 400 });
    }
    const pdf = Buffer.from(await attachment.arrayBuffer());
    if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return Response.json({ error: "The uploaded report is not a valid PDF." }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const accessionId = order.accessionId.replace(/[^a-zA-Z0-9_-]/g, "-");
    const patientName = escapeHtml(order.clientSnapshot.fullName);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Henks Medical Limited <info@henkslab.com.ng>",
      to: recipient,
      subject: `Authorized laboratory report ${order.accessionId}`,
      html: `<p>Dear ${patientName},</p><p>Your authorized laboratory report (${escapeHtml(order.accessionId)}) is attached as a PDF.</p><p>Regards,<br />Henks Medical Limited</p>`,
      attachments: [{ filename: `${accessionId}-report.pdf`, content: pdf }],
    });

    if (error) {
      console.error("Report email delivery failed", { orderId: id, error: error.message });
      return Response.json({ error: "Resend could not deliver the report. Please try again." }, { status: 502 });
    }

    try {
      await database.collection("auditEvents").insertOne({
        actorId: user._id,
        action: "report.emailed",
        recordType: "labOrder",
        recordId: order._id,
        recipient,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("Report was sent but could not be added to the audit log", error instanceof Error ? error.message : "Unknown error");
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Report email request failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "The report email could not be sent. Check email configuration and try again." }, { status: 500 });
  }
}
