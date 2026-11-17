"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const STORAGE_KEY = "moa-chat-conversations-v1";
const STORAGE_EVENT = "moa:conversations-updated";
const EMPTY_CONVERSATIONS: Conversation[] = [];

let cachedStorageValue: string | null | undefined;
let cachedConversations: Conversation[] = EMPTY_CONVERSATIONS;

function getTimestamp() {
  return Date.now();
}

function getConversationsSnapshot() {
  if (typeof window === "undefined") return EMPTY_CONVERSATIONS;

  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY_CONVERSATIONS;
  }

  if (raw === cachedStorageValue) return cachedConversations;
  cachedStorageValue = raw;

  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedConversations = Array.isArray(parsed)
      ? parsed.filter(
          (item): item is Conversation =>
            typeof item?.id === "string" &&
            typeof item?.title === "string" &&
            Array.isArray(item?.messages) &&
            typeof item?.updatedAt === "number",
        )
      : EMPTY_CONVERSATIONS;
  } catch {
    cachedConversations = EMPTY_CONVERSATIONS;
  }

  return cachedConversations;
}

function subscribeToConversations(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function saveConversations(conversations: Conversation[]) {
  const raw = JSON.stringify(conversations);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
  cachedStorageValue = raw;
  cachedConversations = conversations;
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeToHydration(callback: () => void) {
  queueMicrotask(callback);
  return () => {};
}

function getHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

const suggestions = [
  { icon: "✍️", title: "글쓰기 도와줘", detail: "메일부터 소개글까지" },
  { icon: "💡", title: "아이디어를 떠올려 줘", detail: "새로운 관점이 필요할 때" },
  { icon: "🗓️", title: "하루 계획 세우기", detail: "오늘을 알차게 보내도록" },
  { icon: "🧠", title: "어려운 개념 설명해 줘", detail: "쉽고 간단하게 풀어서" },
];

function makeConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "새 대화",
    messages: [],
    updatedAt: Date.now(),
  };
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
    case "chat": return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></svg>;
    case "spark": return <svg {...common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" /></svg>;
    case "send": return <svg {...common}><path d="m21 3-7.2 18-3.7-7.1L3 10.2 21 3Z" /><path d="M10.1 13.9 15 9" /></svg>;
    case "menu": return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "close": return <svg {...common}><path d="m18 6-12 12M6 6l12 12" /></svg>;
    case "trash": return <svg {...common}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" /></svg>;
    case "arrow": return <svg {...common}><path d="M7 17 17 7M7 7h10v10" /></svg>;
    case "copy": return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "오늘";
  if (date.toDateString() === yesterday.toDateString()) return "어제";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function Home() {
  const conversations = useSyncExternalStore(
    subscribeToConversations,
    getConversationsSnapshot,
    () => EMPTY_CONVERSATIONS,
  );
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isHydrated && conversations.length === 0) {
      saveConversations([makeConversation()]);
    }
  }, [conversations, isHydrated]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversations, isSending, activeId]);

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        const next = makeConversation();
        saveConversations([next, ...getConversationsSnapshot()]);
        setActiveId(next.id);
        setInput("");
        setIsSidebarOpen(false);
        textareaRef.current?.focus();
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search-box input")?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const filteredConversations = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return [...conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((item) => !normalized || item.title.toLowerCase().includes(normalized));
  }, [conversations, search]);

  function startNewConversation() {
    const next = makeConversation();
    saveConversations([next, ...getConversationsSnapshot()]);
    setActiveId(next.id);
    setInput("");
    setIsSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function updateConversation(id: string, update: (conversation: Conversation) => Conversation) {
    saveConversations(
      getConversationsSnapshot().map((conversation) =>
        conversation.id === id ? update(conversation) : conversation,
      ),
    );
  }

  async function sendMessage(value = input) {
    const text = value.trim();
    if (!text || isSending || !activeConversation) return;

    const conversationId = activeConversation.id;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: getTimestamp(),
    };
    const nextMessages = [...activeConversation.messages, userMessage];

    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: conversation.messages.length === 0 ? text.slice(0, 32) : conversation.title,
      messages: nextMessages,
      updatedAt: getTimestamp(),
    }));
    setInput("");
    setIsSending(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !data.reply) throw new Error(data.error || "응답을 가져오지 못했어요.");

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        createdAt: getTimestamp(),
      };
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: getTimestamp(),
      }));
    } catch (error) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: error instanceof Error ? error.message : "문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
        createdAt: getTimestamp(),
      };
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: getTimestamp(),
      }));
    } finally {
      setIsSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function clearConversation() {
    if (!activeConversation || !activeConversation.messages.length) return;
    const next = makeConversation();
    saveConversations([next, ...getConversationsSnapshot().filter((item) => item.id !== activeConversation.id)]);
    setActiveId(next.id);
  }

  async function copyConversation() {
    if (!activeConversation?.messages.length) return;
    const transcript = activeConversation.messages
      .map((message) => `${message.role === "user" ? "나" : "모아"}: ${message.content}`)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(transcript);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      window.alert("이 브라우저에서는 대화를 복사할 수 없어요.");
    }
  }

  return (
    <main className="app-shell">
      {isSidebarOpen && <button className="sidebar-backdrop" aria-label="사이드바 닫기" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`sidebar ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <a className="brand" href="#" aria-label="모아 홈">
            <span className="brand-mark"><Icon name="spark" size={20} /></span>
            <span>moa<span className="brand-period">.</span></span>
          </a>
          <button className="icon-button sidebar-close" aria-label="메뉴 닫기" onClick={() => setIsSidebarOpen(false)}><Icon name="close" /></button>
        </div>

        <button className="new-chat-button" onClick={startNewConversation}>
          <span className="new-chat-icon"><Icon name="plus" size={18} /></span>
          <span>새 대화</span>
          <kbd>⌘ K</kbd>
        </button>

        <label className="search-box">
          <Icon name="search" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="대화 검색" aria-label="대화 검색" />
          <span className="search-shortcut">⌘ F</span>
        </label>

        <div className="conversation-list-wrap">
          <div className="section-label">내 대화 <span>{filteredConversations.length}</span></div>
          {filteredConversations.length ? (
            <div className="conversation-list">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={`conversation-item ${activeId === conversation.id ? "conversation-active" : ""}`}
                  onClick={() => { setActiveId(conversation.id); setIsSidebarOpen(false); }}
                >
                  <Icon name="chat" size={17} />
                  <span className="conversation-copy">
                    <span className="conversation-title">{conversation.title}</span>
                    <span className="conversation-date">{formatDate(conversation.updatedAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-search">검색 결과가 없어요.</p>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="plan-card">
            <span className="plan-icon"><Icon name="spark" size={16} /></span>
            <div><strong>모아와 더 깊은 대화</strong><span>나만의 AI를 만나 보세요</span></div>
            <Icon name="arrow" size={15} />
          </div>
          <div className="profile-row">
            <div className="avatar avatar-user">나</div>
            <div className="profile-copy"><strong>내 작업 공간</strong><span>무료 플랜</span></div>
            <button className="more-button" aria-label="계정 메뉴">···</button>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="메뉴 열기" onClick={() => setIsSidebarOpen(true)}><Icon name="menu" /></button>
            <div className="model-picker"><span className="model-dot" /> <span>모아 AI</span><span className="model-version">기본</span><span className="chevron">⌄</span></div>
          </div>
          <div className="topbar-actions">
            {activeConversation?.messages.length ? <>
              <button className="top-action" onClick={clearConversation}><Icon name="trash" size={16} /><span>대화 지우기</span></button>
              <button className="share-button" onClick={() => void copyConversation()}><span>{isCopied ? "복사됨" : "대화 복사"}</span><Icon name="copy" size={14} /></button>
            </> : null}
          </div>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          {activeConversation?.messages.length ? (
            <div className="message-thread">
              {activeConversation.messages.map((message) => (
                <article className={`message-row message-${message.role}`} key={message.id}>
                  {message.role === "assistant" ? <div className="avatar avatar-moa"><Icon name="spark" size={16} /></div> : null}
                  <div className="message-body">
                    {message.role === "assistant" ? <div className="message-name">모아 <span>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span></div> : null}
                    <div className="message-content">{message.content}</div>
                  </div>
                  {message.role === "user" ? <div className="avatar avatar-user">나</div> : null}
                </article>
              ))}
              {isSending && <div className="message-row message-assistant"><div className="avatar avatar-moa"><Icon name="spark" size={16} /></div><div className="message-body"><div className="message-name">모아 <span>생각 중</span></div><div className="typing-indicator"><i /><i /><i /></div></div></div>}
            </div>
          ) : (
            <div className="welcome-wrap">
              <div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" />
              <div className="welcome-icon"><Icon name="spark" size={27} /></div>
              <div className="welcome-eyebrow"><span /> 당신의 AI 어시스턴트</div>
              <h1>반가워요, <span>무엇을 도와드릴까요?</span></h1>
              <p className="welcome-description">아이디어를 나누고, 궁금한 것을 물어보세요.<br />모아가 함께 생각해 드릴게요.</p>
              <div className="suggestion-grid">
                {suggestions.map((item) => <button className="suggestion-card" key={item.title} onClick={() => void sendMessage(item.title)}><span className="suggestion-emoji">{item.icon}</span><span className="suggestion-text"><strong>{item.title}</strong><small>{item.detail}</small></span><span className="suggestion-arrow"><Icon name="arrow" size={15} /></span></button>)}
              </div>
            </div>
          )}
        </div>

        <div className="composer-area">
          <form className="composer" onSubmit={onSubmit}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
              }}
              onKeyDown={onKeyDown}
              placeholder="모아에게 무엇이든 물어보세요"
              aria-label="메시지 입력"
              disabled={!isHydrated}
            />
            <div className="composer-bottom">
              <div className="composer-hint"><span className="hint-spark"><Icon name="spark" size={14} /></span><span>모아는 언제나 배우고 있어요</span></div>
              <div className="composer-right"><span className="enter-hint">Enter ↵</span><button className="send-button" type="submit" disabled={!input.trim() || isSending} aria-label="메시지 보내기"><Icon name="send" size={18} /></button></div>
            </div>
          </form>
          <p className="disclaimer">모아는 실수를 할 수 있어요. 중요한 정보는 꼭 다시 확인해 주세요.</p>
        </div>
      </section>
    </main>
  );
}
