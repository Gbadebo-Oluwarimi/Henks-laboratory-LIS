import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";
import type { ChatMessageRecord, UserRecord } from "@/lib/models";

const PAGE_SIZE = 50;

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

function decodeCursor(value: string | null): { createdAt: Date; id: ObjectId } | null | false {
  if (!value) return null;
  const separator = value.indexOf("|");
  if (separator < 1) return false;
  const createdAt = new Date(value.slice(0, separator));
  const id = value.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || !ObjectId.isValid(id)) return false;
  return { createdAt, id: new ObjectId(id) };
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Sign in to view team messages." }, { status: 401 });

  const url = new URL(request.url);
  const cursor = decodeCursor(url.searchParams.get("before"));
  if (cursor === false) return Response.json({ error: "The message cursor is invalid." }, { status: 400 });

  const database = await getDatabase();
  const filter = cursor ? {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  } : {};
  const rows = await database.collection<ChatMessageRecord>("chatMessages")
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(PAGE_SIZE + 1)
    .toArray();
  const hasMore = rows.length > PAGE_SIZE;
  const messages = rows.slice(0, PAGE_SIZE);
  const oldest = messages.at(-1);
  const users = await database.collection<UserRecord>("users")
    .find({ active: true }, { projection: { name: 1 } })
    .sort({ name: 1 })
    .toArray();

  return Response.json({
    messages: messages.map(serializeMessage),
    users: users.map((user) => ({ id: user._id.toHexString(), name: user.name })),
    hasMore,
    nextCursor: hasMore && oldest ? `${oldest.createdAt.toISOString()}|${oldest._id.toHexString()}` : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Sign in to send team messages." }, { status: 401 });

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return Response.json({ error: "The request origin is not allowed." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Enter a message before sending." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") return Response.json({ error: "Enter a message before sending." }, { status: 400 });
  const body = typeof (payload as { body?: unknown }).body === "string" ? (payload as { body: string }).body.trim() : "";
  const mentionIds = (payload as { mentionUserIds?: unknown }).mentionUserIds;
  if (!body || body.length > 2000) return Response.json({ error: "Messages must contain 1 to 2,000 characters." }, { status: 400 });
  if (!Array.isArray(mentionIds) || mentionIds.length > 10 || mentionIds.some((id) => typeof id !== "string" || !ObjectId.isValid(id))) {
    return Response.json({ error: "The mention list is invalid." }, { status: 400 });
  }

  const database = await getDatabase();
  const uniqueIds = [...new Set(mentionIds as string[])].map((id) => new ObjectId(id));
  const mentionedUsers = uniqueIds.length
    ? await database.collection<UserRecord>("users").find({ _id: { $in: uniqueIds }, active: true }, { projection: { name: 1 } }).toArray()
    : [];
  if (mentionedUsers.length !== uniqueIds.length || mentionedUsers.some((user) => !body.toLocaleLowerCase().includes(`@${user.name}`.toLocaleLowerCase()))) {
    return Response.json({ error: "Choose active staff from the mention suggestions." }, { status: 400 });
  }

  const message: ChatMessageRecord = {
    _id: new ObjectId(),
    senderId: currentUser._id,
    senderName: currentUser.name,
    body,
    mentions: mentionedUsers.map((user) => ({ userId: user._id, name: user.name })),
    createdAt: new Date(),
  };
  await database.collection<ChatMessageRecord>("chatMessages").insertOne(message);
  return Response.json({ message: serializeMessage(message) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
