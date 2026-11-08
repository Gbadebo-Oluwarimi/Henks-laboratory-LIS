"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MessageCircle, RefreshCw, Send, X } from "lucide-react";

export type TeamChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  mentions: Array<{ userId: string; name: string }>;
  createdAt: string;
};
type ChatUser = { id: string; name: string };
type ChatPage = { messages: TeamChatMessage[]; users: ChatUser[]; hasMore: boolean; nextCursor: string | null };

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MessageCard({ message }: { message: TeamChatMessage }) {
  const pieces = useMemo(() => {
    if (!message.mentions.length) return [message.body];
    const names = message.mentions.map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(@(?:${names.join("|")}))`, "gi");
    return message.body.split(pattern);
  }, [message.body, message.mentions]);

  return <article className="group flex gap-3 border-b border-slate-100/90 px-4 py-3.5 transition-colors hover:bg-slate-50/80 last:border-b-0 sm:px-5">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-[#073F9F]" aria-hidden="true">{message.senderName.trim().slice(0, 1).toUpperCase()}</span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <strong className="text-[13px] font-semibold text-slate-800">{message.senderName}</strong>
        <time className="text-[10px] font-medium text-slate-400" dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-slate-600">{pieces.map((piece, index) => {
        const isMention = message.mentions.some(({ name }) => piece.toLocaleLowerCase() === `@${name}`.toLocaleLowerCase());
        return isMention ? <span key={index} className="font-medium text-blue-700">{piece}</span> : piece;
      })}</p>
    </div>
  </article>;
}

function mergeMessages(current: TeamChatMessage[], incoming: TeamChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function ChatPopup() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<ChatPage>({ messages: [], users: [], hasMore: false, nextCursor: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [mentionPicker, setMentionPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesContainer = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/chat", { cache: "no-store" });
      const data = await response.json() as ChatPage & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load team messages.");
      setPage((current) => ({ ...data, messages: mergeMessages(current.messages, data.messages).slice(-50) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load team messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const events = new EventSource("/api/chat/events");
    events.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent<string>).data) as TeamChatMessage;
      setPage((current) => ({ ...current, messages: mergeMessages(current.messages, [message]).slice(-50) }));
    });
    return () => events.close();
  }, [open, refresh]);

  useEffect(() => {
    const container = messagesContainer.current;
    if (open && container) container.scrollTop = container.scrollHeight;
  }, [open, page.messages.length]);

  const mentions = useMemo(() => page.users.filter((user) => body.toLocaleLowerCase().includes(`@${user.name}`.toLocaleLowerCase())).map((user) => user.id), [body, page.users]);
  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, mentionUserIds: mentions }) });
      const data = await response.json() as { message?: TeamChatMessage; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error ?? "Could not send this message.");
      setPage((current) => ({ ...current, messages: mergeMessages(current.messages, [data.message!]).slice(-50) }));
      setBody("");
      setMentionPicker(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  };

  const addMention = (user: ChatUser) => {
    const prefix = body && !/\s$/.test(body) ? " " : "";
    setBody((current) => `${current}${prefix}@${user.name} `);
    setMentionPicker(false);
  };

  return <>
    {open && <section className="team-chat-panel fixed bottom-[76px] right-4 z-[60] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-18px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03]" aria-label="Team messages">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF9FE] text-[#073F9F]"><MessageCircle size={19} /></span><div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-900">Team chat</h2><span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">{page.messages.length}</span></div><p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Shared with your workspace</p></div></div>
        <div className="flex items-center gap-1">
          <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" type="button" onClick={() => void refresh()} aria-label="Refresh messages" title="Refresh messages"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
          <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" type="button" onClick={() => setOpen(false)} aria-label="Close chat"><X size={17} /></button>
        </div>
      </header>
      <div ref={messagesContainer} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 py-1">
        {loading && page.messages.length === 0 ? <div className="grid h-full place-items-center text-slate-400"><LoaderCircle className="animate-spin" size={20} /></div> : page.messages.length ? page.messages.map((message) => <MessageCard key={message.id} message={message} />) : <div className="grid h-full content-center justify-items-center px-8 text-center"><span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><MessageCircle size={21} /></span><p className="text-sm font-semibold text-slate-700">Start the conversation</p><p className="mt-1 text-xs leading-5 text-slate-500">Send a message to everyone in your workspace.</p></div>}
      </div>
      <div className="relative border-t border-slate-200 bg-white p-3.5 sm:p-4">
        {error && <p className="mb-2 text-[11px] text-red-700" role="alert">{error}</p>}
        {mentionPicker && <div className="absolute bottom-[calc(100%-4px)] left-3 right-3 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg" role="listbox" aria-label="Mention a staff member">
          {page.users.length ? page.users.map((user) => <button type="button" key={user.id} onClick={() => addMention(user)} className="block w-full rounded px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-50">@{user.name}</button>) : <p className="px-3 py-2 text-xs text-slate-500">Staff list loads when chat opens.</p>}
        </div>}
        <label className="sr-only" htmlFor="team-chat-message">Write a message</label>
        <textarea id="team-chat-message" value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Write a message…" rows={2} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[13px] leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50" />
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex gap-2"><button type="button" onClick={() => setMentionPicker((value) => !value)} className="rounded px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50" aria-expanded={mentionPicker}>@ Tag</button><Link className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100" href="/chat" onClick={() => setOpen(false)}>View all messages</Link></div>
          <button type="button" onClick={() => void send()} disabled={!body.trim() || sending} className="inline-flex items-center gap-2 rounded-lg bg-[#073F9F] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#102b61] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-45"><Send size={13} /> {sending ? "Sending…" : "Send"}</button>
        </div>
        <p className="mt-1 text-[9px] text-slate-400">Enter to send · Shift+Enter for a new line · 2,000 character limit</p>
      </div>
    </section>}
    <button type="button" onClick={() => { if (open) setOpen(false); else { setOpen(true); void refresh(); } }} className="fixed bottom-4 right-4 z-[60] inline-flex h-12 items-center gap-2 rounded-full bg-blue-700 px-4 text-sm font-semibold text-white shadow-lg hover:bg-blue-800" aria-label={open ? "Close team chat" : "Open team chat"} aria-expanded={open}>
      {open ? <X size={18} /> : <MessageCircle size={18} />}<span>{open ? "Close" : "Team chat"}</span>
    </button>
  </>;
}

export function ChatHistory({ initialPage }: { initialPage: ChatPage }) {
  const [page, setPage] = useState(() => ({ ...initialPage, messages: mergeMessages([], initialPage.messages) }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const events = new EventSource("/api/chat/events");
    events.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent<string>).data) as TeamChatMessage;
      setPage((current) => ({ ...current, messages: mergeMessages(current.messages, [message]) }));
    });
    return () => events.close();
  }, []);

  const loadOlder = async () => {
    if (!page.nextCursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/chat?before=${encodeURIComponent(page.nextCursor)}`, { cache: "no-store" });
      const data = await response.json() as ChatPage & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load older messages.");
      setPage((current) => ({ ...data, messages: mergeMessages(current.messages, data.messages), users: data.users }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load older messages.");
    } finally {
      setLoading(false);
    }
  };

  return <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF9FE] text-[#073F9F]"><MessageCircle size={19} /></span><div><h2 className="text-sm font-semibold text-slate-800">Conversation history</h2><p className="mt-1 text-xs text-slate-500">Shared with workspace staff · updates automatically</p></div><span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live</span></div>
    {page.hasMore && <div className="border-b border-slate-100 p-3 text-center"><button type="button" onClick={() => void loadOlder()} disabled={loading} className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50">{loading ? "Loading…" : "Load older messages"}</button></div>}
    {error && <p className="px-4 py-2 text-xs text-red-700" role="alert">{error}</p>}
    {page.messages.length ? page.messages.map((message) => <MessageCard key={message.id} message={message} />) : <p className="px-5 py-12 text-center text-sm text-slate-500">No team messages yet.</p>}
    {!page.hasMore && page.messages.length > 0 && <p className="border-t border-slate-100 px-4 py-3 text-center text-[10px] text-slate-400">You’re all caught up.</p>}
  </section>;
}
