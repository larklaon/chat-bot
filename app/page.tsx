import LandingPage from "@/app/components/landing-page";
import ChatApp, { type Citation, type Conversation, type Message, type Profile } from "@/app/components/chat-app";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!isSupabaseConfigured()) return <LandingPage />;

  const supabase = await createClient();
  const { data: userResult, error: authError } = await supabase.auth.getUser();
  const user = userResult.user;

  if (authError || !user) return <LandingPage />;

  const { data: conversationRows, error } = await supabase
    .from("conversations")
    .select("id,title,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error) console.error("Could not load conversation history:", error.message);

  const rows = conversationRows ?? [];
  const { data: messageRows, error: messageError } = rows.length
    ? await supabase
        .from("messages")
        .select("id,conversation_id,role,content,citations,created_at")
        .in("conversation_id", rows.map((row) => row.id))
        .order("created_at", { ascending: true })
        .limit(1200)
    : { data: [], error: null };

  if (messageError) console.error("Could not load messages:", messageError.message);

  const messagesByConversation = new Map<string, Message[]>();
  for (const row of messageRows ?? []) {
    const messages = messagesByConversation.get(row.conversation_id) ?? [];
    messages.push({
      id: row.id,
      role: row.role as Message["role"],
      content: row.content,
      citations: Array.isArray(row.citations) ? row.citations as unknown as Citation[] : [],
      created_at: row.created_at,
    });
    messagesByConversation.set(row.conversation_id, messages);
  }

  const conversations: Conversation[] = rows.map((conversation) => ({
    ...conversation,
    messages: messagesByConversation.get(conversation.id) ?? [],
  }));

  const metadata = user.user_metadata ?? {};
  const profile: Profile = {
    id: user.id,
    name: metadata.full_name ?? metadata.name ?? user.email?.split("@")[0] ?? "사용자",
    email: user.email ?? "",
    avatarUrl: metadata.avatar_url ?? metadata.picture ?? null,
  };

  return <ChatApp profile={profile} initialConversations={conversations} />;
}
