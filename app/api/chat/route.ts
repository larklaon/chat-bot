import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `당신은 '모아'라는 이름의 친절하고 유능한 한국어 AI 어시스턴트입니다.
사용자의 언어와 말투에 맞춰 답하고, 정확하고 실용적으로 설명하세요. 복잡한 내용은 읽기 쉬운 항목으로 정리하고, 모르는 내용은 아는 척하지 마세요.`;

function demoReply(prompt: string) {
  const text = prompt.toLowerCase();

  if (/안녕|반가|hello|hi\b/.test(text)) {
    return "안녕하세요! 저는 모아예요. 😊\n궁금한 점을 물어보거나, 글쓰기·아이디어 정리·계획 세우기처럼 필요한 일을 편하게 맡겨 주세요.";
  }
  if (/계획|일정|루틴|목표/.test(text)) {
    return `좋아요, 함께 계획을 세워 볼게요.\n\n먼저 목표를 작게 나누면 시작하기 쉬워요:\n1. 가장 중요한 결과를 한 문장으로 정하기\n2. 오늘 할 수 있는 20분짜리 첫 단계 정하기\n3. 일정에 여유 시간을 남겨 두기\n\n원하는 기간이나 목표를 알려 주시면 더 구체적으로 정리해 드릴게요.`;
  }
  if (/글|이메일|메일|소개|작성|문장/.test(text)) {
    return `물론이죠. 좋은 글은 읽는 사람이 누구인지와 전달할 핵심이 분명할수록 더 잘 쓰여요.\n\n요청하신 내용을 바탕으로 초안을 만들 수 있어요. 대상, 원하는 분위기(예: 정중하게·친근하게), 꼭 포함할 내용을 알려 주시면 바로 작성해 드릴게요.`;
  }
  if (/아이디어|브레인스토밍|아이템/.test(text)) {
    return `아이디어를 함께 넓혀 봐요! 💡\n\n좋은 출발점은 다음 세 가지예요:\n• 누구의 어떤 불편을 해결할까요?\n• 지금 방식보다 무엇이 더 간단해질까요?\n• 아주 작게 시험해 볼 수 있는 방법은 무엇일까요?\n\n주제나 상황을 알려 주시면 구체적인 아이디어를 여러 개 제안할게요.`;
  }

  return `좋은 질문이에요!\n\n지금은 데모 모드로 실행 중이라 질문을 이해하는 범위에서 답변을 드리고 있어요. 더 깊이 있는 답변이 필요하다면 배포 환경 변수에 OPENAI_API_KEY를 설정해 AI 응답을 활성화해 주세요.\n\n질문을 조금 더 구체적으로 알려 주시면 가능한 범위에서 더 잘 도와드릴게요.`;
}

export async function POST(request: Request) {
  let messages: ChatMessage[];

  try {
    const body = (await request.json()) as { messages?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
    }

    messages = body.messages
      .slice(-24)
      .filter(
        (item): item is ChatMessage =>
          typeof item === "object" &&
          item !== null &&
          "role" in item &&
          (item.role === "user" || item.role === "assistant") &&
          "content" in item &&
          typeof item.content === "string" &&
          item.content.length > 0 &&
          item.content.length <= 4000,
      );

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "유효한 사용자 메시지가 필요해요." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "요청을 읽을 수 없어요." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: demoReply(messages[messages.length - 1].content) });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API request failed:", response.status);
      return NextResponse.json(
        { error: "AI 응답을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json({ error: "비어 있는 응답을 받았어요. 다시 시도해 주세요." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
