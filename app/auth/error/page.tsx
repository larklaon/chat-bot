import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="auth-error-page">
      <div className="auth-error-card">
        <div className="brand-mark auth-error-mark">✦</div>
        <p className="landing-eyebrow">로그인 설정 확인</p>
        <h1>Google 로그인에 연결하지 못했어요.</h1>
        <p>
          Supabase 대시보드에서 Google Provider를 켜고 Client ID, Client Secret,
          허용된 redirect URL을 확인한 뒤 다시 시도해 주세요.
        </p>
        <Link className="secondary-link" href="/">모아 홈으로 돌아가기</Link>
      </div>
    </main>
  );
}
