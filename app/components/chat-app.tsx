"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";

export type Citation = {
  title: string;
  sourcePath: string;
  chunkIndex?: number;
  similarity?: number;
  referenceNumbers?: number[];
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
};

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type ChatAppProps = {
  profile: Profile;
  initialConversations: Conversation[];
};

type ChatResponse = {
  error?: string;
  conversation?: Omit<Conversation, "messages">;
  userMessage?: Message;
  assistantMessage?: Message;
};

const suggestions = [
  { icon: "✦", title: "이 문서의 핵심을 요약해 줘", detail: "긴 내용도 한눈에 정리" },
  { icon: "⌕", title: "자료에서 중요한 내용을 찾아줘", detail: "필요한 정보를 빠르게" },
  { icon: "↗", title: "두 가지 내용을 비교해 줘", detail: "공통점과 차이점을 정리" },
  { icon: "∴", title: "어려운 내용을 쉽게 설명해 줘", detail: "문서의 맥락까지 이해하도록" },
];

function Icon({ name, size = 19 }: { name: string; size?: number }) {
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
    case "chat": return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /></svg>;
    case "send": return <svg {...common}><path d="m21 3-7.2 18-3.7-7.1L3 10.2 21 3Z" /><path d="M10.1 13.9 15 9" /></svg>;
    case "menu": return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "close": return <svg {...common}><path d="m18 6-12 12M6 6l12 12" /></svg>;
    case "book": return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10h8" /></svg>;
    case "arrow": return <svg {...common}><path d="M7 17 17 7M7 7h10v10" /></svg>;
    case "copy": return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>;
    default: return <svg {...common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /></svg>;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function newDraft(): Conversation {
  const now = new Date().toISOString();
  return {
    id: `draft-${crypto.randomUUID()}`,
    title: "새 대화",
    created_at: now,
    updated_at: now,
    messages: [],
  };
}

export default function ChatApp({ profile, initialConversations }: ChatAppProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialConversations[0]?.id ?? "draft-initial");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? {
    id: activeId,
    title: "새 대화",
    created_at: "",
    updated_at: "",
    messages: [],
  };

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...conversations]
      .filter((conversation) => !query || conversation.title.toLocaleLowerCase().includes(query))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [conversations, search]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeId, conversations, isSending]);

  useEffect(() => {
    function handleShortcuts(event: globalThis.KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        startNewConversation();
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search-box input")?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  });

  function startNewConversation() {
    const draft = newDraft();
    setConversations((current) => [draft, ...current]);
    setActiveId(draft.id);
    setInput("");
    setIsSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function commitConversation(
    draftId: string,
    data: ChatResponse,
    localPendingId: string,
    localError?: string,
  ) {
    if (!data.conversation || !data.userMessage) return;

    setConversations((current) => {
      const previous = current.find((conversation) => conversation.id === draftId);
      const messages = (previous?.messages ?? []).filter((message) => message.id !== localPendingId);
      const savedMessages = [...messages, data.userMessage!];
      if (data.assistantMessage) savedMessages.push(data.assistantMessage);
      else if (localError) {
        savedMessages.push({
          id: `local-error-${crypto.randomUUID()}`,
          role: "assistant",
          content: localError,
          citations: [],
          created_at: new Date().toISOString(),
        });
      }

      const saved: Conversation = { ...data.conversation!, messages: savedMessages };
      return [saved, ...current.filter((conversation) => conversation.id !== draftId && conversation.id !== saved.id)];
    });
    setActiveId(data.conversation.id);
  }

  async function sendMessage(value = input) {
    const text = value.trim();
    if (!text || isSending) return;

    const currentId = activeConversation.id;
    const conversationId = currentId.startsWith("draft-") ? null : currentId;
    const pendingId = `pending-${crypto.randomUUID()}`;
    const pendingMessage: Message = {
      id: pendingId,
      role: "user",
      content: text,
      citations: [],
      created_at: new Date().toISOString(),
    };

    setConversations((current) => {
      const exists = current.some((conversation) => conversation.id === currentId);
      const draft = exists ? current : [{ ...activeConversation, id: currentId } as Conversation, ...current];
      return draft.map((conversation) => conversation.id === currentId
        ? {
            ...conversation,
            title: conversation.messages.length === 0 ? text.slice(0, 64) : conversation.title,
            updated_at: pendingMessage.created_at,
            messages: [...conversation.messages, pendingMessage],
          }
        : conversation,
      );
    });
    setInput("");
    setIsSending(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await response.json() as ChatResponse;

      if (data.conversation && data.userMessage) {
        const errorMessage = !response.ok
          ? data.error ?? "답변을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요."
          : undefined;
        commitConversation(currentId, data, pendingId, errorMessage);
        if (!response.ok) setInput(text);
      } else {
        throw new Error(data.error || "응답을 가져오지 못했어요.");
      }
    } catch (error) {
      setConversations((current) => current.map((conversation) => conversation.id === currentId
        ? {
            ...conversation,
            messages: [...conversation.messages, {
              id: `local-error-${crypto.randomUUID()}`,
              role: "assistant",
              content: error instanceof Error ? error.message : "문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
              citations: [],
              created_at: new Date().toISOString(),
            }],
          }
        : conversation,
      ));
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

  async function copyConversation() {
    const transcript = activeConversation.messages
      .map((message) => `${message.role === "user" ? profile.name : "모아"}: ${message.content}`)
      .join("\n\n");
    if (!transcript) return;

    try {
      await navigator.clipboard.writeText(transcript);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1600);
    } catch {
      window.alert("이 브라우저에서는 대화를 복사할 수 없어요.");
    }
  }

  return (
    <main className="app-shell">
      {isSidebarOpen && <button className="sidebar-backdrop" aria-label="사이드바 닫기" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`sidebar ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Link className="brand" href="/" aria-label="모아 홈">
            <span className="brand-mark"><span>✦</span></span>
            <span>moa<span className="brand-period">.</span></span>
          </Link>
          <button className="icon-button sidebar-close" aria-label="메뉴 닫기" onClick={() => setIsSidebarOpen(false)}><Icon name="close" /></button>
        </div>

        <button className="new-chat-button" onClick={startNewConversation}>
          <span className="new-chat-icon"><Icon name="plus" size={18} /></span>
          <span>새 대화</span><kbd>⌘ K</kbd>
        </button>

        <label className="search-box">
          <Icon name="search" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="대화 검색" aria-label="대화 검색" />
          <span className="search-shortcut">⌘ F</span>
        </label>

        <div className="conversation-list-wrap">
          <div className="section-label">내 대화 <span>{filteredConversations.filter((item) => !item.id.startsWith("draft-")).length}</span></div>
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
                    <span className="conversation-date">
                      {conversation.id.startsWith("draft-") ? "새 대화" : `생성 ${formatDate(conversation.created_at)}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : <p className="empty-search">검색 결과가 없어요.</p>}
        </div>

        <div className="sidebar-bottom">
          <div className="plan-card">
            <span className="plan-icon"><Icon name="spark" size={16} /></span>
            <div><strong>내 문서로 답하는 모아</strong><span>근거 문서까지 한 번에</span></div>
          </div>
          <div className="profile-row">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar avatar-profile" src={profile.avatarUrl} alt={`${profile.name} 프로필`} referrerPolicy="no-referrer" />
            ) : <div className="avatar avatar-user">{profile.name.slice(0, 1)}</div>}
            <div className="profile-copy"><strong>{profile.name}</strong><span>{profile.email}</span></div>
            <form action="/auth/sign-out" method="post"><button className="signout-button" type="submit">로그아웃</button></form>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="메뉴 열기" onClick={() => setIsSidebarOpen(true)}><Icon name="menu" /></button>
            <div className="model-picker"><span className="model-dot" /><span>모아 AI</span><span className="model-version">문서 RAG</span></div>
          </div>
          <div className="topbar-actions">
            {activeConversation.messages.length > 0 && (
              <button className="share-button" onClick={() => void copyConversation()}>
                <span>{isCopied ? "복사됨" : "대화 복사"}</span><Icon name="copy" size={14} />
              </button>
            )}
          </div>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          {activeConversation.messages.length > 0 ? (
            <div className="message-thread">
              {activeConversation.messages.map((message) => (
                <article className={`message-row message-${message.role}`} key={message.id}>
                  {message.role === "assistant" && <div className="avatar avatar-moa"><Icon name="spark" size={16} /></div>}
                  <div className="message-body">
                    {message.role === "assistant" && <div className="message-name">모아 <span>{formatDate(message.created_at)}</span></div>}
                    {message.role === "user" && <div className="message-name message-name-user">{profile.name} <span>{formatDate(message.created_at)}</span></div>}
                    <div className="message-content">{message.content}</div>
                    {message.role === "assistant" && message.citations?.length > 0 && (
                      <div className="citation-box">
                        <div className="citation-heading"><Icon name="book" size={14} /> 참고한 문서</div>
                        <div className="citation-list">
                          {message.citations.map((citation, index) => (
                            <span className="citation-chip" key={`${citation.sourcePath}-${index}`}>
                              {(citation.referenceNumbers ?? [index + 1]).map((reference) => (
                                <span className="citation-number" key={reference}>{reference}</span>
                              ))}
                              <span>{citation.title}</span>
                              <small>{citation.sourcePath}</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && <div className="avatar avatar-user">{profile.name.slice(0, 1)}</div>}
                </article>
              ))}
              {isSending && <div className="message-row message-assistant"><div className="avatar avatar-moa"><Icon name="spark" size={16} /></div><div className="message-body"><div className="message-name">모아 <span>문서를 살펴보는 중</span></div><div className="typing-indicator"><i /><i /><i /></div></div></div>}
            </div>
          ) : (
            <div className="welcome-wrap">
              <div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" />
              <div className="welcome-icon"><Icon name="spark" size={27} /></div>
              <div className="welcome-eyebrow"><span /> 당신의 지식 파트너</div>
              <h1>반가워요, <span>무엇이 궁금하세요?</span></h1>
              <p className="welcome-description">모아가 내 문서를 찾아보고<br />근거와 함께 답변해 드릴게요.</p>
              <div className="suggestion-grid">
                {suggestions.map((item) => (
                  <button className="suggestion-card" key={item.title} onClick={() => void sendMessage(item.title)}>
                    <span className="suggestion-emoji">{item.icon}</span>
                    <span className="suggestion-text"><strong>{item.title}</strong><small>{item.detail}</small></span>
                    <span className="suggestion-arrow"><Icon name="arrow" size={15} /></span>
                  </button>
                ))}
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
              placeholder="모아에게 문서와 관련해 물어보세요"
              aria-label="메시지 입력"
            />
            <div className="composer-bottom">
              <div className="composer-hint"><span className="hint-spark"><Icon name="book" size={14} /></span><span>답변에는 참고 문서가 표시돼요</span></div>
              <div className="composer-right"><span className="enter-hint">Enter ↵</span><button className="send-button" type="submit" disabled={!input.trim() || isSending} aria-label="메시지 보내기"><Icon name="send" size={18} /></button></div>
            </div>
          </form>
          <p className="disclaimer">문서에서 근거를 찾지 못하면 모아가 알려드릴게요.</p>
        </div>
      </section>
    </main>
  );
}
