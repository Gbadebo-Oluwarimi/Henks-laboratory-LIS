import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getDatabase } from "@/lib/mongodb";
import type { ChatMessageRecord, UserRecord } from "@/lib/models";
import { ChatHistory, type TeamChatMessage } from "@/app/(workspace)/chat/chat-ui";

export default async function ChatPage() {
  const database = await getDatabase();
  const rows = await database.collection<ChatMessageRecord>("chatMessages")
    .find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(51)
    .toArray();
  const hasMore = rows.length > 50;
  const messages: TeamChatMessage[] = rows.slice(0, 50).map((message) => ({
    id: message._id.toHexString(),
    senderId: message.senderId.toHexString(),
    senderName: message.senderName,
    body: message.body,
    mentions: message.mentions.map((mention) => ({ userId: mention.userId.toHexString(), name: mention.name })),
    createdAt: message.createdAt.toISOString(),
  }));
  const oldest = rows[49];
  const users = await database.collection<UserRecord>("users").find({ active: true }, { projection: { name: 1 } }).sort({ name: 1 }).toArray();

  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">Workspace / Team chat</p><h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">Team messages</h1><p className="mt-1 text-sm text-slate-500">A shared message board for doctors and staff across the platform.</p></div>
      <Link className="button button-secondary self-start" href="/dashboard"><ArrowLeft size={15} /> Back to workspace</Link>
    </header>
    <ChatHistory initialPage={{ messages, users: users.map((user) => ({ id: user._id.toHexString(), name: user.name })), hasMore, nextCursor: hasMore && oldest ? `${oldest.createdAt.toISOString()}|${oldest._id.toHexString()}` : null }} />
    <p className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-400"><MessageCircle size={13} /> New messages appear automatically while chat is open.</p>
  </div>;
}
