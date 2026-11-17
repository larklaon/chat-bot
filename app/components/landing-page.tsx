import Link from "next/link";

function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.89c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.37 38.08 46.98 31.92 46.98 24.55Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.96 23.96 0 0 0 0 21.56l7.98-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <Link className="brand" href="/" aria-label="모아 홈">
          <span className="brand-mark"><span>✦</span></span>
          <span>moa<span className="brand-period">.</span></span>
        </Link>
        <span className="landing-nav-label">YOUR KNOWLEDGE, IN A CONVERSATION</span>
      </header>

      <section className="landing-hero">
        <div className="landing-visual" aria-hidden="true">
          <div className="visual-ring ring-large" />
          <div className="visual-ring ring-small" />
          <div className="visual-glow" />
          <div className="visual-spark spark-a">✦</div>
          <div className="visual-spark spark-b">✳</div>
          <div className="visual-center"><span>m</span><i>✦</i></div>
          <span className="orbit-dot dot-a" />
          <span className="orbit-dot dot-b" />
        </div>

        <div className="landing-copy">
          <div className="landing-eyebrow"><span /> 문서 기반 AI 어시스턴트</div>
          <h1>알고 싶은 답,<br /><span>모아 둔 지식</span>에서 찾다.</h1>
          <p className="landing-description">
            모아 AI는 내 문서를 이해하고, 질문에 꼭 맞는 답을 찾아주는
            지식 대화 파트너예요. 근거가 된 문서까지 함께 보여드려요.
          </p>

          <div className="landing-benefits">
            <div><span className="benefit-check">✓</span><span><strong>내 문서로 답변</strong><small>업로드된 자료를 바탕으로 정확하게</small></span></div>
            <div><span className="benefit-check">✓</span><span><strong>근거를 투명하게</strong><small>참고한 문서 출처를 답변 아래에</small></span></div>
            <div><span className="benefit-check">✓</span><span><strong>대화는 안전하게</strong><small>내 대화는 내 계정에만 저장</small></span></div>
          </div>

          <Link className="google-signin-button" href="/auth/sign-in">
            <GoogleMark />
            <span>Google로 시작하기</span>
            <span className="button-arrow">↗</span>
          </Link>
          <p className="landing-footnote">로그인하면 개인 대화 기록이 Supabase에 안전하게 저장됩니다.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <span>모아 AI <i>·</i> 문서와 대화하는 새로운 방법</span>
        <span>THINK CLEAR. FIND TOGETHER.</span>
      </footer>
    </main>
  );
}
