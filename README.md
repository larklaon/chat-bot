# 모아 — 문서 기반 RAG 챗봇

Next.js 16, Supabase Auth/Database, Upstage Embeddings, OpenAI 답변 생성을 사용하는 한국어 문서 챗봇입니다. Google OAuth로 로그인하고, 내 문서에서 찾은 근거와 함께 답변을 제공합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 환경 변수

`.env.example`을 참고해 `.env.local`을 설정하세요. 로컬 개발용 Supabase URL과 publishable key는 이 프로젝트 연결 정보로 채워져 있습니다. OpenAI와 Upstage 키는 실제 값을 넣어야 합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
UPSTAGE_API_KEY=...
UPSTAGE_EMBEDDING_MODEL=solar-embedding-2-query
UPSTAGE_PASSAGE_MODEL=solar-embedding-2-passage
SUPABASE_SECRET_KEY=...
```

`OPENAI_API_KEY`, `UPSTAGE_API_KEY`, `SUPABASE_SECRET_KEY`는 서버/로컬 스크립트 전용입니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요. `SUPABASE_SECRET_KEY`는 문서 색인용으로만 필요하며 브라우저에 전달하지 마세요.

## Supabase 설정

1. `supabase/migrations/20261117055958_moa_rag_chat.sql` 및 `supabase/migrations/20261117060030_index_message_owner.sql`이 Supabase 프로젝트에 적용되어 있습니다. 첫 번째 마이그레이션은 `conversations`, `messages`, `documents` 테이블, pgvector 인덱스, `match_documents` RPC, 사용자별 RLS를 만듭니다.
2. Supabase 대시보드의 **Authentication → Providers → Google**에서 Google Provider를 활성화하고 Google OAuth Client ID/Secret을 입력합니다.
3. Google Cloud OAuth 웹 클라이언트의 승인된 리디렉션 URI에 다음을 추가합니다:

   ```text
   https://cdpxezucbhuydmzuvcmr.supabase.co/auth/v1/callback
   ```

4. Supabase **Authentication → URL Configuration → Redirect URLs**에 개발 URL `http://localhost:3000/auth/callback`과 배포 URL `https://<your-domain>/auth/callback`을 추가합니다.

프로젝트의 현재 OpenCode Supabase MCP 설정이 읽기 전용이면 원격 마이그레이션은 실행되지 않습니다. 이 경우 SQL Editor에서 위 파일을 직접 적용하거나, 쓰기 권한이 있는 설정으로 전환한 뒤 적용해야 합니다.

## 문서 색인

지원 형식: `.md`, `.mdx`, `.txt`, `.csv`, `.json`, `.html`, `.htm`.

1. 문서를 프로젝트의 `dataset/` 폴더에 넣습니다.
2. `.env.local`에 `UPSTAGE_API_KEY`와 `SUPABASE_SECRET_KEY`를 설정합니다.
3. 다음 명령으로 문서를 청크로 나누고, Upstage `solar-embedding-2-passage` 임베딩과 원문 청크를 Supabase `documents` 테이블에 저장합니다.

   ```bash
   npm run ingest:dataset
   ```

문서는 약 1,800자 단위로 겹치게 청크화됩니다. 사용자의 질문은 `solar-embedding-2-query`로 임베딩한 뒤 Supabase의 cosine similarity 검색으로 관련 문서를 찾습니다. 답변 아래에 참조 문서명이 표시됩니다.

현재 저장소에는 `dataset/` 문서가 포함되어 있지 않습니다. 문서를 추가하고 색인 명령을 실행해야 문서 기반 검색 결과를 확인할 수 있습니다.

## 대화 저장 및 권한

대화방, 사용자 질문, AI 답변, 생성 시각, 인용 문서는 Supabase에 저장됩니다. RLS 정책은 로그인한 사용자가 본인의 대화만 읽고 쓰도록 제한하며, 문서 테이블은 로그인 사용자에게 읽기만 허용합니다.

## Vercel 배포

Vercel 프로젝트의 **Settings → Environment Variables**에는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `UPSTAGE_API_KEY`, `UPSTAGE_EMBEDDING_MODEL`을 추가하세요. `SUPABASE_SECRET_KEY`는 웹 앱에 필요하지 않으며 문서를 색인하는 신뢰할 수 있는 로컬/CI 환경에만 설정합니다. Google OAuth 설정에는 배포 도메인의 `/auth/callback`을 허용하고, Google Cloud에는 Supabase Auth callback URI를 등록해야 합니다. 환경 변수 변경 후 재배포하세요.
