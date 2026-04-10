import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

// ─────────────────────────────────────────────────────────────────────────────
// Sentient Cursor — the breathing "ready to listen" orb in the hero
// ─────────────────────────────────────────────────────────────────────────────
function SentientCursor() {
  const canvasRef = useRef(null);
  const mouse     = useRef({ x: 0, y: 0 });
  const orbs      = useRef([]);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Seed floating orbs
    orbs.current = Array.from({ length: 6 }, (_, i) => ({
      x:  canvas.width  * 0.5 + (Math.random() - 0.5) * 300,
      y:  canvas.height * 0.5 + (Math.random() - 0.5) * 200,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.25,
      r:  80 + Math.random() * 120,
      phase: i * (Math.PI * 2 / 6),
    }));

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('mousemove', onMove);

    let t = 0;
    const draw = () => {
      t += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const orb of orbs.current) {
        // Gentle drift
        orb.x += orb.vx + Math.sin(t + orb.phase) * 0.3;
        orb.y += orb.vy + Math.cos(t + orb.phase * 0.7) * 0.2;

        // Soft mouse attraction
        const dx = mouse.current.x - orb.x;
        const dy = mouse.current.y - orb.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 350) {
          orb.x += dx * 0.002;
          orb.y += dy * 0.002;
        }

        // Wrap edges
        if (orb.x < -orb.r)            orb.x = canvas.width  + orb.r;
        if (orb.x > canvas.width + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r)            orb.y = canvas.height + orb.r;
        if (orb.y > canvas.height + orb.r) orb.y = -orb.r;

        // Pulse alpha
        const alpha = 0.06 + Math.sin(t * 1.2 + orb.phase) * 0.04;
        const grad  = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0,   `rgba(171,196,255,${alpha * 2})`);
        grad.addColorStop(0.5, `rgba(215,227,252,${alpha})`);
        grad.addColorStop(1,   'rgba(237,242,251,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central "ready" pulse
      const cx    = canvas.width  * 0.5;
      const cy    = canvas.height * 0.5;
      const pulse = 18 + Math.sin(t * 1.8) * 4;
      const cg    = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse * 4);
      cg.addColorStop(0,   'rgba(171,196,255,0.22)');
      cg.addColorStop(0.4, 'rgba(215,227,252,0.12)');
      cg.addColorStop(1,   'rgba(237,242,251,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, pulse * 4, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'auto' }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zero-Knowledge Shield — hover for character-by-character reasoning story
// ─────────────────────────────────────────────────────────────────────────────
const ZK_STORY = `Your journal entry is encrypted in your browser before it ever reaches our servers. We use AES-256-GCM — the same standard used by governments and financial institutions. The encryption key is derived from your password using PBKDF2 with 310,000 iterations. We never see the key. We never see the content. Zero-Knowledge means exactly that: our knowledge is zero.`;

function ZeroKnowledgeShield() {
  const [hovered,   setHovered]   = useState(false);
  const [displayed, setDisplayed] = useState('');
  const intervalRef = useRef(null);

  const startStream = useCallback(() => {
    setHovered(true);
    setDisplayed('');
    let i = 0;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayed(ZK_STORY.slice(0, i));
      if (i >= ZK_STORY.length) clearInterval(intervalRef.current);
    }, 14);
  }, []);

  const stopStream = useCallback(() => {
    setHovered(false);
    setDisplayed('');
    clearInterval(intervalRef.current);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div
      onMouseEnter={startStream}
      onMouseLeave={stopStream}
      className="relative cursor-pointer select-none"
    >
      {/* Shield icon */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300"
        style={{
          background: hovered ? 'rgba(214,234,223,0.6)' : 'rgba(255,255,255,0.35)',
          border: `1px solid ${hovered ? 'rgba(157,196,176,0.6)' : 'rgba(215,227,252,0.5)'}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <span className="text-lg">{hovered ? '🔓' : '🛡️'}</span>
        <span className="text-xs font-semibold text-gray-600">Zero-Knowledge Active</span>
        {!hovered && (
          <span className="text-[10px] text-blue-400 ml-1">hover to learn</span>
        )}
      </div>

      {/* Reasoning story tooltip */}
      {hovered && (
        <div
          className="absolute bottom-full left-0 mb-3 w-80 rounded-2xl p-5 z-50"
          style={{
            background: 'linear-gradient(135deg,rgba(255,255,255,0.92),rgba(237,242,251,0.95))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(214,234,223,0.7)',
            boxShadow: '0 16px 48px rgba(31,38,135,0.15)',
          }}
        >
          <p className="text-[10px] font-bold tracking-widest text-green-700 uppercase mb-2">
            🔐 Reasoning Story
          </p>
          <p className="text-xs text-gray-700 leading-relaxed font-system">
            {displayed}
            <span className="animate-pulse text-blue-400">|</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral / Invite Module
// ─────────────────────────────────────────────────────────────────────────────
function InvitePortal({ user }) {
  const [copied, setCopied] = useState(false);
  const code = user?.referralCode || `OJ-${(user?.displayName || 'SEEKER').toUpperCase().slice(0, 6).replace(/\s/g, '')}-${Math.floor(1000 + (user?._id?.charCodeAt(0) || 0) % 9000)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://openjournal.me/join?ref=${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="rounded-2xl p-6 md:p-8"
      style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,0.5),rgba(237,242,251,0.5))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(215,227,252,0.6)',
        boxShadow: '0 12px 48px rgba(31,38,135,0.09)',
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#D6EADF,#D7E3FC)', border: '1px solid rgba(171,196,255,0.3)' }}
        >
          🌐
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Invitation Portal</h3>
          <p className="text-xs text-gray-500">Who shares your vibe?</p>
        </div>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed mb-5">
        Invite a fellow <span className="font-semibold text-blue-600">Seeker</span>,{' '}
        <span className="font-semibold text-purple-600">Sage</span>, or{' '}
        <span className="font-semibold text-green-600">Reflector</span> to grow our
        collective wisdom. Each person you invite raises your{' '}
        <span className="font-medium text-gray-800">Social Vibe Score</span> — making your
        own matches more accurate and meaningful.
      </p>

      {/* Vibe score preview */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: 'rgba(214,234,223,0.4)', border: '1px solid rgba(157,196,176,0.35)' }}>
        <div className="relative w-10 h-10 flex-shrink-0">
          <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#D6EADF" strokeWidth="4" />
            <circle cx="20" cy="20" r="16" fill="none" stroke="#9DC4B0" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 16}`}
              strokeDashoffset={`${2 * Math.PI * 16 * 0.32}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-green-700 rotate-90">68%</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-green-800">Social Vibe Score</p>
          <p className="text-[10px] text-green-700">+12% per accepted invitation</p>
        </div>
        <div className="ml-auto">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#D6EADF', color: '#2d6a4f' }}>3 invited</span>
        </div>
      </div>

      {/* Copy link */}
      <div className="flex gap-2">
        <div
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-mono text-gray-700 truncate"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(215,227,252,0.6)' }}
        >
          openjournal.me/join?ref={code}
        </div>
        <button
          onClick={handleCopy}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            background: copied ? '#D6EADF' : '#ABC4FF',
            color: copied ? '#2d6a4f' : '#fff',
            border: `1px solid ${copied ? 'rgba(157,196,176,0.5)' : 'rgba(171,196,255,0.5)'}`,
            boxShadow: copied ? 'none' : '0 4px 12px rgba(171,196,255,0.35)',
          }}
        >
          {copied ? '✓ Copied' : 'Copy Link'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Card
// ─────────────────────────────────────────────────────────────────────────────
function PricingCard({ plan, price, tagline, features, cta, ctaAction, highlight, badge }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col rounded-2xl p-6 transition-all duration-500"
      style={{
        background: highlight
          ? 'linear-gradient(145deg,rgba(171,196,255,0.25),rgba(215,227,252,0.35))'
          : 'linear-gradient(145deg,rgba(255,255,255,0.42),rgba(237,242,251,0.42))',
        backdropFilter: 'blur(18px)',
        border: highlight
          ? '2px solid rgba(171,196,255,0.55)'
          : hovered
            ? '1px solid rgba(171,196,255,0.4)'
            : '1px solid rgba(255,255,255,0.4)',
        boxShadow: highlight
          ? '0 0 40px rgba(171,196,255,0.22), 0 12px 48px rgba(31,38,135,0.1)'
          : hovered
            ? '0 16px 56px rgba(31,38,135,0.12)'
            : '0 8px 32px rgba(31,38,135,0.07)',
        transform: hovered ? 'translateY(-5px)' : 'translateY(0)',
      }}
    >
      {/* Badge */}
      {badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold"
          style={{
            background: 'linear-gradient(90deg,#ABC4FF,#9DC4B0)',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(171,196,255,0.4)',
          }}
        >
          {badge}
        </div>
      )}

      {/* Plan name */}
      <div className="mb-4">
        <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-1">{tagline}</p>
        <h3 className="text-xl font-bold text-gray-800">{plan}</h3>
      </div>

      {/* Price */}
      <div className="mb-6">
        {typeof price === 'string' ? (
          <p className="text-3xl font-bold text-gray-800">{price}</p>
        ) : (
          <div className="flex items-end gap-1">
            <span className="text-3xl font-bold text-gray-800">${price}</span>
            <span className="text-sm text-gray-500 mb-1">/mo</span>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 flex-1 mb-6">
        {features.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5 text-sm text-gray-600">
            <span className="mt-0.5 flex-shrink-0 text-base">{f.icon}</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={ctaAction}
        className="w-full py-2.5 rounded-xl font-medium text-sm transition-all duration-200"
        style={{
          background: highlight
            ? 'linear-gradient(135deg,#ABC4FF,#9DC4B0)'
            : hovered
              ? 'rgba(171,196,255,0.3)'
              : 'rgba(255,255,255,0.5)',
          color:  highlight ? '#fff' : '#374151',
          border: highlight ? 'none' : '1px solid rgba(215,227,252,0.7)',
          boxShadow: highlight ? '0 4px 16px rgba(171,196,255,0.4)' : 'none',
        }}
      >
        {cta}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Pill row (used in Benefits section)
// ─────────────────────────────────────────────────────────────────────────────
function FeaturePill({ icon, text }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-600"
      style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(215,227,252,0.5)', backdropFilter: 'blur(8px)' }}
    >
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll-reveal wrapper
// ─────────────────────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.65s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section label
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-[11px] font-bold tracking-widest uppercase"
      style={{ background: 'rgba(214,234,223,0.55)', border: '1px solid rgba(157,196,176,0.4)', color: '#2d6a4f' }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating orb decorations (persistent)
// ─────────────────────────────────────────────────────────────────────────────
function PageOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden>
      {[
        { w: 600, h: 600, top: -150, right: -150, color: 'rgba(215,227,252,0.45)' },
        { w: 500, h: 500, bottom: 100, left: -100, color: 'rgba(214,234,223,0.4)' },
        { w: 350, h: 350, top: '40%', left: '35%', color: 'rgba(171,196,255,0.15)' },
        { w: 250, h: 250, top: '70%', right: '10%', color: 'rgba(255,192,159,0.12)' },
      ].map((o, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width:  o.w, height: o.h,
            top:    o.top,    right:  o.right,
            bottom: o.bottom, left:   o.left,
            background: `radial-gradient(circle,${o.color} 0%,transparent 70%)`,
            filter: 'blur(50px)',
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Landing Page
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate                        = useNavigate();
  const { isAuthenticated, user }       = useSelector(state => state.auth);
  const [scrolled,           setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToApp    = () => navigate(isAuthenticated ? '/journal' : '/register');
  const goToLogin  = () => navigate('/login');

  const PLANS = [
    {
      plan:     'The Seeker',
      tagline:  'Personal Clarity',
      price:    'Free Forever',
      badge:    null,
      highlight: false,
      features: [
        { icon: '🔐', text: 'AES-256 Privacy Vault — your entries, encrypted' },
        { icon: '📝', text: 'Unlimited private journal entries' },
        { icon: '✨', text: '3 AI-mediated connections per month' },
        { icon: '📊', text: 'Basic clarity insights' },
        { icon: '🌱', text: 'Community Brain read access' },
      ],
      cta:       isAuthenticated ? 'You are here' : 'Start Free',
      ctaAction: goToApp,
    },
    {
      plan:     'The Sage',
      tagline:  'Active Connection',
      price:    12,
      badge:    '✦ Most Meaningful',
      highlight: true,
      features: [
        { icon: '🔐', text: 'Everything in The Seeker' },
        { icon: '🤖', text: 'Unlimited AI Mediator & Bridge View sessions' },
        { icon: '🌐', text: 'Selective Discovery — be found & find others' },
        { icon: '📈', text: 'Advanced resonance analytics' },
        { icon: '🔮', text: 'Wisdom Circles (up to 5)' },
        { icon: '⚡', text: 'Priority AI matching queue' },
      ],
      cta:       'Begin as Sage',
      ctaAction: goToApp,
    },
    {
      plan:     'The Symphony',
      tagline:  'Collective Impact',
      price:    'Team / Custom',
      badge:    null,
      highlight: false,
      features: [
        { icon: '♾️', text: 'Everything in The Sage, unlimited' },
        { icon: '🤝', text: 'Agentic Social Chains — team-level connections' },
        { icon: '🏢', text: 'Organization-wide Community Brain' },
        { icon: '📋', text: 'Admin dashboard & usage analytics' },
        { icon: '🛡️', text: 'SOC2 compliance & custom data retention' },
        { icon: '🎯', text: 'Dedicated AI Fine-tuning for your community' },
      ],
      cta:       'Talk to Us',
      ctaAction: () => window.location.href = 'mailto:hello@openjournal.me',
    },
  ];

  return (
    <div
      className="min-h-screen font-system antialiased"
      style={{ background: '#EDF2FB' }}
    >
      <PageOrbs />

      {/* ── Sticky Nav ──────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(237,242,251,0.88)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(215,227,252,0.5)' : 'none',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg,#ABC4FF,#D6EADF)', boxShadow: '0 2px 8px rgba(171,196,255,0.35)' }}
            >
              ✦
            </div>
            <span className="font-semibold text-gray-800 tracking-tight">Open Journal</span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-500">
            <a href="#how" className="hover:text-gray-800 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-gray-800 transition-colors">Pricing</a>
            <a href="#community" className="hover:text-gray-800 transition-colors">Community</a>
            <Link to="/privacy" className="hover:text-gray-800 transition-colors">Privacy</Link>
          </div>

          {/* Auth CTA (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/journal')}
                className="px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                style={{ background: '#ABC4FF', color: '#fff', boxShadow: '0 4px 12px rgba(171,196,255,0.4)' }}
              >
                Enter Journal →
              </button>
            ) : (
              <>
                <button
                  onClick={goToLogin}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-white/40 transition-all"
                >
                  Sign in
                </button>
                <button
                  onClick={goToApp}
                  className="px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{ background: '#ABC4FF', color: '#fff', boxShadow: '0 4px 12px rgba(171,196,255,0.4)' }}
                >
                  Begin Free
                </button>
              </>
            )}
          </div>

            {/* Mobile Nav Hamburger */}
            <button
              className="md:hidden touch-target text-gray-600 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
          
          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-lavender-web shadow-lg flex flex-col px-6 py-4 gap-4 animate-slide-down">
              <a href="#how" onClick={() => setMobileMenuOpen(false)} className="text-gray-600 font-medium py-2 border-b border-alice-blue">How It Works</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-gray-600 font-medium py-2 border-b border-alice-blue">Pricing</a>
              <a href="#community" onClick={() => setMobileMenuOpen(false)} className="text-gray-600 font-medium py-2 border-b border-alice-blue">Community</a>
              <Link to="/privacy" onClick={() => setMobileMenuOpen(false)} className="text-gray-600 font-medium py-2">Privacy</Link>
              
              {!isAuthenticated && (
                <div className="flex flex-col gap-2 pt-2">
                  <button onClick={() => { setMobileMenuOpen(false); goToLogin(); }} className="py-2.5 rounded-xl font-medium border border-lavender-web text-gray-700">Sign in</button>
                  <button onClick={() => { setMobileMenuOpen(false); goToApp(); }} className="py-2.5 rounded-xl font-medium bg-blue-eyes text-white">Begin Free</button>
                </div>
              )}
            </div>
          )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-16"
      >
        {/* Animated canvas background */}
        <SentientCursor />

        {/* Content */}
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase mb-8"
            style={{ background: 'rgba(214,234,223,0.7)', border: '1px solid rgba(157,196,176,0.5)', color: '#2d6a4f' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            System ready — Vault secured
          </div>

          {/* Headline — Lora serif */}
          <h1
            className="font-journal text-fluid-hero text-gray-800 leading-tight mb-6"
            style={{ letterSpacing: '-0.02em' }}
          >
            End the isolation
            <br />
            <span
              style={{
                background: 'linear-gradient(120deg,#6C8ECC 0%,#ABC4FF 40%,#9DC4B0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              of your wisdom.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="font-journal italic text-xl md:text-2xl text-gray-500 mb-4 leading-relaxed max-w-xl mx-auto">
            Turn your private reflections into a bridge for others.
          </p>
          <p className="text-gray-500 text-base mb-10 max-w-md mx-auto leading-relaxed font-system">
            Open Journal is a zero-knowledge journaling platform where your entries
            are private by default — and only you decide when they become a connection.
          </p>

          {/* CTA group */}
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center mb-12">
            <button
              onClick={goToApp}
              className="px-8 py-3.5 rounded-xl font-medium text-base transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg,#ABC4FF,#9DC4B0)',
                color: '#fff',
                boxShadow: '0 6px 24px rgba(171,196,255,0.45)',
              }}
            >
              {isAuthenticated ? '→ Enter the Vault' : '✦ Begin Your Journey'}
            </button>
            <a
              href="#how"
              className="px-8 py-3.5 rounded-xl font-medium text-base text-gray-600 transition-all duration-200 hover:text-gray-800"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(215,227,252,0.7)', backdropFilter: 'blur(8px)' }}
            >
              How it works ↓
            </a>
          </div>

          {/* ZK Shield */}
          <div className="flex justify-center">
            <ZeroKnowledgeShield />
          </div>
        </div>

        {/* Scroll cue */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce"
          style={{ opacity: 0.5 }}
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-blue-300" />
          <span className="text-[10px] tracking-widest text-gray-400 uppercase">Scroll</span>
        </div>
      </section>

      {/* ── Resonance Bar ────────────────────────────────────────────────── */}
      <div
        className="py-4 overflow-hidden"
        style={{ background: 'rgba(171,196,255,0.12)', borderTop: '1px solid rgba(215,227,252,0.4)', borderBottom: '1px solid rgba(215,227,252,0.4)' }}
      >
        <div className="flex gap-12 whitespace-nowrap" style={{ animation: 'scroll-x 28s linear infinite' }}>
          {[
            '🔐 AES-256 Encrypted', '✨ AI-Mediated Connections', '🌐 Zero-Knowledge Architecture',
            '📝 Private by Default', '🤝 Seeker ↔ Sage Matching', '🔮 Wisdom Circles',
            '⚡ Real-Time Bridges', '🌱 Community Vibe Score', '🛡️ GDPR & CCPA Compliant',
            '🔐 AES-256 Encrypted', '✨ AI-Mediated Connections', '🌐 Zero-Knowledge Architecture',
          ].map((t, i) => (
            <span key={i} className="text-sm text-gray-500 font-medium">{t}</span>
          ))}
        </div>
      </div>
      <style>{`@keyframes scroll-x { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>

      {/* Main content wrapper */}
      <div className="max-w-6xl mx-auto px-6">

        {/* ── How It Works ──────────────────────────────────────────────── */}
        <section id="how" className="py-24">
          <Reveal>
            <div className="text-center mb-16">
              <SectionLabel>✦ How It Works</SectionLabel>
              <h2 className="font-journal text-4xl text-gray-800 mb-4">
                Quiet Discovery. Meaningful Connection.
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
                Three steps. No noise. No algorithm optimising for engagement — just resonance.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                n: '01', icon: '📝', color: '#ABC4FF',
                title: 'Write in the Vault',
                body:  'Your entries are encrypted before upload using AES-256-GCM. Write freely — the vault is yours alone.',
              },
              {
                n: '02', icon: '🌊', color: '#D6EADF',
                title: 'Choose Selective Discovery',
                body:  'On any entry, a single toggle graduates your thought into the Community Brain — anonymised, theme-only.',
              },
              {
                n: '03', icon: '✨', color: '#D7E3FC',
                title: 'The Bridge Forms',
                body:  'Our AI Mediator finds a semantic match. A "Seeker" meets a "Sage". Your names are never shared.',
              },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 120}>
                <div
                  className="rounded-2xl p-7 h-full transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(145deg,rgba(255,255,255,0.5),rgba(237,242,251,0.45))',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.45)',
                    boxShadow: '0 8px 32px rgba(31,38,135,0.07)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `${step.color}44`, border: `1px solid ${step.color}77` }}
                    >
                      {step.icon}
                    </div>
                    <span
                      className="text-4xl font-bold"
                      style={{ color: `${step.color}99` }}
                    >
                      {step.n}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Community / Logged-in Dashboard ───────────────────────────── */}
        <section id="community" className="py-12">
          <Reveal>
            <div className="text-center mb-12">
              <SectionLabel>🌐 Community Brain</SectionLabel>
              <h2 className="font-journal text-4xl text-gray-800 mb-4">
                You are not alone in the vault.
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
                Every member who shares a discoverable entry adds wisdom to the collective.
                The more trust is grown, the more precise the matches become.
              </p>
            </div>
          </Reveal>

          <div className={`grid ${isAuthenticated ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6`}>
            {/* Resonance Pulse */}
            <Reveal delay={0}>
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'linear-gradient(135deg,rgba(214,234,223,0.5),rgba(237,242,251,0.5))',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(157,196,176,0.4)',
                  boxShadow: '0 0 32px rgba(214,234,223,0.35)',
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-300 animate-ping" style={{ animationDuration: '2s' }} />
                  </div>
                  <p className="font-semibold text-green-800 text-sm">Resonance Pulse</p>
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#D6EADF', color: '#2d6a4f' }}>Live</span>
                </div>
                <p className="text-xs text-green-700 mb-5">System Secure — Zero-Knowledge Active</p>
                <div className="space-y-3">
                  {[
                    { label: 'Community Members',    value: '2,847',  bar: 0.71 },
                    { label: 'Active Bridges Today', value: '143',    bar: 0.38 },
                    { label: 'Avg. Match Confidence',value: '89%',   bar: 0.89 },
                  ].map(({ label, value, bar }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-semibold text-gray-800">{value}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(157,196,176,0.25)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${bar * 100}%`, background: 'linear-gradient(90deg,#9DC4B0,#ABC4FF)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Invite Portal — always shown, richer when logged in */}
            <Reveal delay={100}>
              {isAuthenticated
                ? <InvitePortal user={user} />
                : (
                  <div
                    className="rounded-2xl p-6"
                    style={{
                      background: 'linear-gradient(135deg,rgba(255,255,255,0.5),rgba(237,242,251,0.5))',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(215,227,252,0.5)',
                    }}
                  >
                    <div className="text-4xl mb-4">🌐</div>
                    <h3 className="font-semibold text-gray-800 mb-2">Invitation Portal</h3>
                    <p className="text-sm text-gray-500 leading-relaxed mb-5">
                      Each trusted person you invite raises your{' '}
                      <span className="font-medium text-gray-700">Social Vibe Score</span> — improving
                      match accuracy for you and everyone in the collective.
                    </p>
                    <button
                      onClick={goToApp}
                      className="w-full py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: '#D7E3FC', color: '#4B6FAA', border: '1px solid rgba(171,196,255,0.4)' }}
                    >
                      Join to Access Invite Portal →
                    </button>
                  </div>
                )
              }
            </Reveal>

            {/* Vibe types (non-auth only) */}
            {!isAuthenticated && (
              <Reveal delay={200}>
                <div
                  className="rounded-2xl p-6"
                  style={{
                    background: 'linear-gradient(135deg,rgba(255,255,255,0.5),rgba(237,242,251,0.5))',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(215,227,252,0.5)',
                  }}
                >
                  <h3 className="font-semibold text-gray-800 mb-4">Find Your Role</h3>
                  <div className="space-y-3">
                    {[
                      { role: 'The Seeker', desc: 'You carry a problem looking for a perspective.', color: '#ABC4FF', icon: '🔍' },
                      { role: 'The Sage',   desc: 'You have walked the path others are entering.', color: '#D6EADF', icon: '🌿' },
                      { role: 'The Reflector', desc: 'You process life through deep, quiet thought.', color: '#D7E3FC', icon: '🪞' },
                    ].map(({ role, desc, color, icon }) => (
                      <div key={role} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: `${color}33`, border: `1px solid ${color}66` }}>
                        <span className="text-lg flex-shrink-0">{icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{role}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </section>

        {/* ── Feature Pills ────────────────────────────────────────────── */}
        <Reveal>
          <div className="py-8 flex flex-wrap gap-3 justify-center">
            {[
              { icon: '🔐', text: 'AES-256 end-to-end encryption' },
              { icon: '🤖', text: 'AI Mediator on every Bridge' },
              { icon: '👁️', text: 'Zero-Knowledge by design' },
              { icon: '🗑️', text: 'Right to be Forgotten — instant purge' },
              { icon: '📵', text: 'No ads. No data sales. Ever.' },
              { icon: '🌐', text: 'Works offline in the vault' },
            ].map(p => <FeaturePill key={p.text} {...p} />)}
          </div>
        </Reveal>

        {/* ── Pricing ─────────────────────────────────────────────────── */}
        <section id="pricing" className="py-24">
          <Reveal>
            <div className="text-center mb-16">
              <SectionLabel>✦ Value-Aligned Access</SectionLabel>
              <h2 className="font-journal text-4xl text-gray-800 mb-4">
                Pricing that feels fair.
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
                No dark patterns. No lock-in. You pay only when you get real value
                — and you always know exactly what you are paying for.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.plan} delay={i * 130}>
                <PricingCard {...plan} />
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p className="text-center text-xs text-gray-400 mt-8">
              All plans include the Privacy Vault. No credit card required for The Seeker.
              Cancel The Sage at any time — we keep nothing.
            </p>
          </Reveal>
        </section>

        {/* ── Trust strip ─────────────────────────────────────────────── */}
        <Reveal>
          <div
            className="rounded-2xl p-8 mb-24 text-center"
            style={{
              background: 'linear-gradient(135deg,rgba(214,234,223,0.4),rgba(215,227,252,0.4))',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(171,196,255,0.3)',
              boxShadow: '0 0 60px rgba(214,234,223,0.25)',
            }}
          >
            <h2 className="font-journal text-3xl text-gray-800 mb-3">
              Privacy is not a feature here. It is the product.
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto mb-6 leading-relaxed">
              Every architectural decision — from how we hash your password to how our AI reads
              only your themes, never your words — was made in your favour.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { label: 'GDPR Compliant',    icon: '🇪🇺' },
                { label: 'CCPA Compliant',    icon: '🇺🇸' },
                { label: 'Zero-Knowledge',    icon: '🛡️' },
                { label: 'Open Architecture', icon: '📖' },
              ].map(({ label, icon }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-700"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(215,227,252,0.6)' }}
                >
                  {icon} {label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── Zen Footer ──────────────────────────────────────────────────── */}
      <footer
        className="border-t"
        style={{ borderColor: 'rgba(215,227,252,0.4)', background: 'rgba(237,242,251,0.6)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Guide's pulse — opens onboarding / re-evaluation AI interview */}
          <button
            onClick={() => navigate(isAuthenticated ? '/onboarding' : '/register')}
            title="Open the AI Guide to re-evaluate your values"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-800 transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(215,227,252,0.5)', backdropFilter: 'blur(8px)' }}
          >
            <span className="text-lg animate-pulse-soft">✦</span>
            <span>The Guide&apos;s Pulse</span>
          </button>

          {/* Center: minimal brand */}
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Open Journal &nbsp;·&nbsp; Reflect. Connect. Grow.
            <br />
            <span className="opacity-70">© {new Date().getFullYear()} — Built with quiet intention.</span>
          </p>

          {/* Privacy link */}
          <Link
            to="/privacy"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-800 transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(215,227,252,0.5)', backdropFilter: 'blur(8px)' }}
          >
            <span>🔐</span>
            <span>Privacy as a Product</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
