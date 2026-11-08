import type { ChangeStream } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import type { ChatMessageRecord } from "@/lib/models";

export const runtime = "nodejs";

function serializeMessage(message: ChatMessageRecord) {
  return {
    id: message._id.toHexString(),
    senderId: message.senderId.toHexString(),
    senderName: message.senderName,
    body: message.body,
    mentions: message.mentions.map((mention) => ({ userId: mention.userId.toHexString(), name: mention.name })),
    createdAt: message.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Sign in to view team messages." }, { status: 401 });

  const database = await getDatabase();
  const encoder = new TextEncoder();
  let changeStream: ChangeStream<ChatMessageRecord> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let ended = false;
  let abortListener: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (ended) return;
        ended = true;
        if (heartbeat) clearInterval(heartbeat);
        request.signal.removeEventListener("abort", close);
        void changeStream?.close();
        try {
          controller.close();
        } catch {
          // The client may have already closed the response stream.
        }
      };

      abortListener = close;
      request.signal.addEventListener("abort", abortListener, { once: true });
      controller.enqueue(encoder.encode(": connected\n\n"));
      heartbeat = setInterval(() => {
        if (!ended) controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 25_000);

      changeStream = database.collection<ChatMessageRecord>("chatMessages")
        .watch([{ $match: { operationType: "insert" } }]);
      changeStream.on("change", (change) => {
        if (ended || change.operationType !== "insert") return;
        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(serializeMessage(change.fullDocument))}\n\n`));
      });
      changeStream.on("error", (error) => {
        if (ended) return;
        ended = true;
        if (heartbeat) clearInterval(heartbeat);
        request.signal.removeEventListener("abort", close);
        controller.error(error);
        void changeStream?.close();
      });
    },
    cancel() {
      ended = true;
      if (heartbeat) clearInterval(heartbeat);
      if (abortListener) request.signal.removeEventListener("abort", abortListener);
      void changeStream?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
