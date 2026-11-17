# 모아 — AI 챗봇

한국어 대화 UI와 Next.js API를 갖춘 챗봇입니다. Vercel에 바로 배포할 수 있으며, API 키가 없어도 데모 모드로 동작합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 실제 AI 응답 설정

`.env.example`을 참고해 프로젝트 루트에 `.env.local`을 만들고 키를 설정하세요.

```env
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4o-mini
```

키는 서버의 `/api/chat`에서만 사용되며 브라우저에 노출되지 않습니다. 설정하지 않으면 대화 시나리오 기반 데모 응답을 반환합니다.

## Vercel 배포

저장소를 Vercel에 연결하고 배포하면 됩니다. 실제 AI 응답을 사용하려면 Vercel 프로젝트의 **Settings → Environment Variables**에서 `OPENAI_API_KEY` (필요하면 `OPENAI_MODEL`)를 추가한 뒤 재배포하세요.

대화 내용은 현재 브라우저의 `localStorage`에 저장됩니다.
