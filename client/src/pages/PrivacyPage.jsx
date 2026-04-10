import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Streaming text hook – reveals characters one-by-one when in viewport
// ─────────────────────────────────────────────────────────────────────────────
function useStreamText(text, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [started, text, speed]);

  return { displayed, ref };
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Badge
// ─────────────────────────────────────────────────────────────────────────────
function ConfidenceBadge({ value, label }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setAnimated(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1 min-w-[72px]">
      {/* Arc ring */}
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#D7E3FC" strokeWidth="5" />
          <circle
            cx="28" cy="28" r="22" fill="none"
            stroke="#ABC4FF" strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={animated ? `${2 * Math.PI * 22 * (1 - value / 100)}` : `${2 * Math.PI * 22}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-700 rotate-90">
          {animated ? `${value}%` : '0%'}
        </span>
      </div>
      <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy section card with hover lavender shift + streaming body text
// ─────────────────────────────────────────────────────────────────────────────
function PolicySection({ icon, title, concept, truth, result, badges = [], children }) {
  const [hovered, setHovered] = useState(false);
  const { displayed: bodyText, ref: bodyRef } = useStreamText(truth, 12);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? 'linear-gradient(135deg, rgba(215,227,252,0.55) 0%, rgba(237,242,251,0.7) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(237,242,251,0.45) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: hovered ? '1px solid rgba(171,196,255,0.5)' : '1px solid rgba(255,255,255,0.35)',
        boxShadow: hovered
          ? '0 12px 48px rgba(31,38,135,0.11), inset 0 1px 0 rgba(255,255,255,0.6)'
          : '0 8px 32px rgba(31,38,135,0.07), inset 0 1px 0 rgba(255,255,255,0.5)',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
      }}
      className="rounded-2xl p-6 md:p-8"
    >
      {/* Header row */}
      <div className="flex items-start gap-4 mb-5">
        <div
          style={{
            background: 'linear-gradient(135deg,#ABC4FF22,#D7E3FC66)',
            border: '1px solid rgba(171,196,255,0.4)',
          }}
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
        >
          {icon}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-800 mb-0.5">{title}</h2>
          <p className="text-sm text-blue-600 font-medium italic">"{concept}"</p>
        </div>
        {/* Confidence badges */}
        {badges.length > 0 && (
          <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
            {badges.map(b => (
              <ConfidenceBadge key={b.label} value={b.value} label={b.label} />
            ))}
          </div>
        )}
      </div>

      {/* The Truth */}
      <div className="mb-4">
        <span className="text-[10px] font-bold tracking-widest text-blue-eyes uppercase">The Truth</span>
        <p ref={bodyRef} className="mt-2 text-gray-700 leading-relaxed font-system min-h-[1.5em]">
          {bodyText}
          <span className="animate-pulse text-blue-eyes">|</span>
        </p>
      </div>

      {/* The Result */}
      <div
        style={{ background: 'rgba(214,234,223,0.35)', borderLeft: '3px solid #D6EADF' }}
        className="rounded-r-lg px-4 py-3"
      >
        <span className="text-[10px] font-bold tracking-widest text-green-700 uppercase">The Result</span>
        <p className="mt-1 text-gray-600 text-sm leading-relaxed">{result}</p>
      </div>

      {/* Mobile badges */}
      {badges.length > 0 && (
        <div className="sm:hidden flex items-center gap-4 mt-5 justify-end">
          {badges.map(b => (
            <ConfidenceBadge key={b.label} value={b.value} label={b.label} />
          ))}
        </div>
      )}

      {/* Optional child content */}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vault Toggle Preview (interactive but purely visual)
// ─────────────────────────────────────────────────────────────────────────────
function VaultTogglePreview() {
  const [on, setOn] = useState(false);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,0.55),rgba(237,242,251,0.55))',
        border: '1px solid rgba(255,255,255,0.4)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(31,38,135,0.07)',
      }}
      className="rounded-xl p-5 flex items-center gap-5"
    >
      {/* Lock icon that changes */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 transition-all duration-500"
        style={{
          background: on ? '#D6EADF' : '#EDF2FB',
          border: on ? '1.5px solid #9DC4B0' : '1.5px solid #D7E3FC',
        }}
      >
        {on ? '🔓' : '🔒'}
      </div>

      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">Selective Discovery</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {on
            ? 'This entry enters the Community Brain — your name stays hidden.'
            : 'This entry is private. Only you can see it.'}
        </p>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setOn(p => !p)}
        aria-label={on ? 'Disable discovery' : 'Enable discovery'}
        className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 flex-shrink-0"
        style={{ background: on ? '#ABC4FF' : '#D1D5DB' }}
      >
        <span
          className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-300"
          style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pulsing "Secure" Trust Indicator Banner
// ─────────────────────────────────────────────────────────────────────────────
function TrustBanner() {
  return (
    <div
      style={{
        background: 'linear-gradient(100deg,#D6EADF 0%,#EDF2FB 60%,#D7E3FC 100%)',
        border: '1px solid rgba(171,196,255,0.35)',
        boxShadow: '0 0 32px 8px rgba(214,234,223,0.55), 0 0 0 1px rgba(171,196,255,0.15)',
      }}
      className="rounded-2xl px-6 py-5 flex items-center gap-4 mb-10"
    >
      {/* Animated glow dot */}
      <div className="relative flex-shrink-0">
        <div className="w-4 h-4 rounded-full bg-green-400" />
        <div
          className="absolute inset-0 w-4 h-4 rounded-full bg-green-300 animate-ping"
          style={{ animationDuration: '2.5s' }}
        />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-green-800 text-sm">Open Journal — Secure State</p>
        <p className="text-green-700 text-xs mt-0.5">
          Your vault is locked. No one — including us — can read your private entries.
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-2">
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/60 text-green-700 border border-green-200">
          E2E Encrypted
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/60 text-blue-700 border border-blue-200">
          Zero Knowledge
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating orb background decoration
// ─────────────────────────────────────────────────────────────────────────────
function OrbDecors() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden>
      <div
        style={{
          width: 520, height: 520, top: -120, right: -120,
          background: 'radial-gradient(circle,rgba(215,227,252,0.55) 0%,transparent 70%)',
          filter: 'blur(40px)',
          position: 'absolute',
        }}
      />
      <div
        style={{
          width: 420, height: 420, bottom: 80, left: -80,
          background: 'radial-gradient(circle,rgba(214,234,223,0.45) 0%,transparent 70%)',
          filter: 'blur(40px)',
          position: 'absolute',
        }}
      />
      <div
        style={{
          width: 300, height: 300, top: '45%', left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle,rgba(171,196,255,0.18) 0%,transparent 70%)',
          filter: 'blur(30px)',
          position: 'absolute',
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section navigation dots
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'vault',     label: 'The Vault' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'ai',        label: 'Our AI' },
  { id: 'vanish',    label: 'Vanish' },
  { id: 'data',      label: 'Data' },
  { id: 'contact',   label: 'Contact' },
];

function SideNav({ active }) {
  return (
    <nav className="hidden xl:flex fixed left-6 top-1/2 -translate-y-1/2 flex-col gap-3 z-20">
      {NAV_ITEMS.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          title={item.label}
          className="group flex items-center gap-2"
        >
          <div
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              background: active === item.id ? '#ABC4FF' : '#D7E3FC',
              transform: active === item.id ? 'scale(1.5)' : 'scale(1)',
              boxShadow: active === item.id ? '0 0 6px rgba(171,196,255,0.8)' : 'none',
            }}
          />
          <span
            className="text-xs font-medium text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: active === item.id ? '#6C8ECC' : '#9CA3AF' }}
          >
            {item.label}
          </span>
        </a>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('vault');

  // Track active section on scroll
  useEffect(() => {
    const sectionEls = NAV_ITEMS.map(n => ({
      id: n.id,
      el: document.getElementById(n.id)
    })).filter(n => n.el);

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    sectionEls.forEach(({ el }) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <OrbDecors />
      <SideNav active={activeSection} />

      {/* Page wrapper */}
      <div className="relative max-w-3xl mx-auto px-4 py-10 pb-24">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-10 text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-semibold tracking-widest uppercase"
            style={{
              background: 'rgba(214,234,223,0.6)',
              border: '1px solid rgba(157,196,176,0.5)',
              color: '#2d6a4f',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            Privacy Policy
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 leading-tight mb-4">
            Privacy as a{' '}
            <span style={{ background: 'linear-gradient(90deg,#6C8ECC,#9DC4B0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Product
            </span>
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto text-lg leading-relaxed">
            We believe trust is the foundation of every meaningful connection. Your thoughts are not
            data points to be sold — they are the sacred movements of your inner life.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Effective: January 1, 2026 &nbsp;·&nbsp; Last updated: April 2026
          </p>
        </header>

        {/* ── Trust Banner ───────────────────────────────────────────────── */}
        <TrustBanner />

        {/* ── Quick-nav pills ────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-10 justify-center">
          {NAV_ITEMS.map(n => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-200"
              style={{
                background: activeSection === n.id ? 'rgba(171,196,255,0.4)' : 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(215,227,252,0.8)',
                color: activeSection === n.id ? '#4B6FAA' : '#6B7280',
              }}
            >
              {n.label}
            </a>
          ))}
        </div>

        {/* ── Sections ───────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* 1. Vault */}
          <section id="vault">
            <PolicySection
              icon="🔐"
              title="The Key is in Your Hands"
              concept="Your journal is locked in a digital vault"
              truth="When you create a password, you create a unique cryptographic key that only you hold. This key never leaves your device in readable form. We store only a cryptographic hash — mathematically impossible to reverse into your password."
              result="We — the creators of this app — cannot read your journal entries. If you lose your password, we cannot recover your data because we never held the key to begin with. Your privacy is guaranteed by mathematics, not promises."
              badges={[
                { value: 100, label: 'Zero Access' },
                { value: 96, label: 'Encryption' },
              ]}
            />
          </section>

          {/* 2. Discovery */}
          <section id="discovery">
            <PolicySection
              icon="🌐"
              title="Choosing to be Seen"
              concept="You decide when vulnerability becomes a bridge"
              truth="Every entry is private by default. Your thoughts only enter the Community Brain if you explicitly toggle the Selective Discovery switch on a specific entry. You are both the observer and the controller of what is shared."
              result="Nothing is ever shared without your explicit action on that specific entry. Enabling discovery at the account level does not share anything — you must opt-in per entry, each time."
              badges={[
                { value: 100, label: 'Opt-In Only' },
                { value: 92, label: 'Per-Entry' },
              ]}
            >
              {/* Interactive toggle preview */}
              <div className="mt-2">
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3">
                  Live Preview — how it looks in your journal
                </p>
                <VaultTogglePreview />
              </div>
            </PolicySection>
          </section>

          {/* 3. AI */}
          <section id="ai">
            <PolicySection
              icon="🧠"
              title={`How Our AI "Sees" Without Watching`}
              concept="We match the vibe, not the identity"
              truth={`When you share an entry, our system creates a "Semantic Summary" — a short, anonymised distillation of the essence of your thought. The AI reads the emotional contour and thematic resonance of your words, never your name, location, or identifiers.`}
              result={`The system matches your problem entry with someone else's solution using vector mathematics. Two people can find each other across thousands of entries without either ever knowing the other's identity, email, or personal details.`}
              badges={[
                { value: 92, label: 'Anon Match' },
                { value: 88, label: 'Confidence' },
              ]}
            >
              {/* How the pipeline works */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { step: '01', label: 'Your entry', sub: 'Stays encrypted on our server', icon: '📝' },
                  { step: '02', label: 'Semantic vibe', sub: 'Anonymous vector summary', icon: '🌊' },
                  { step: '03', label: 'Bridge formed', sub: 'Names never exchanged', icon: '🤝' },
                ].map(({ step, label, sub, icon }) => (
                  <div
                    key={step}
                    className="rounded-xl p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(215,227,252,0.6)' }}
                  >
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className="text-[10px] font-bold text-blue-eyes mb-0.5">Step {step}</p>
                    <p className="text-xs font-semibold text-gray-700">{label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            </PolicySection>
          </section>

          {/* 4. Vanish */}
          <section id="vanish">
            <PolicySection
              icon="🌫️"
              title="Your Right to Vanish"
              concept="The ending of a pattern is truly the ending"
              truth="You have the Right to be Forgotten at any time. Deleting your account is an irreversible, instant action. There is no 30-day grace period during which your data lingers. The deletion is total and immediate."
              result="If you delete your account, we trigger a total purge. Your entries, your semantic summaries, your match history, and your connection threads are erased from our servers and cached storage simultaneously. No backup copy is retained."
              badges={[
                { value: 100, label: 'Full Purge' },
                { value: 98, label: 'Instant' },
              ]}
            />
          </section>

          {/* 5. Data we collect */}
          <section id="data">
            <div
              style={{
                background: 'linear-gradient(135deg,rgba(255,255,255,0.45),rgba(237,242,251,0.45))',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.35)',
                boxShadow: '0 8px 32px rgba(31,38,135,0.07)',
              }}
              className="rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-start gap-4 mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#ABC4FF22,#D7E3FC66)', border: '1px solid rgba(171,196,255,0.4)' }}
                >
                  📋
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">What Data We Collect</h2>
                  <p className="text-sm text-gray-500 mt-1">Minimum viable data, maximum meaningful use.</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    category: 'Account Data',
                    color: '#ABC4FF',
                    items: ['Email address (login only)', 'Display name (you choose)', 'Hashed password (bcrypt)'],
                    note: 'Never sold. Never shared.'
                  },
                  {
                    category: 'Journal Entries',
                    color: '#D6EADF',
                    items: ['Entry content (encrypted at rest)', 'AI-derived intent label', 'Thematic clusters (anonymised)'],
                    note: 'We cannot read these.'
                  },
                  {
                    category: 'Usage Signals',
                    color: '#FFC09F',
                    items: ['Session timestamps', 'Feature interaction (aggregate)', 'Error logs (anonymised)'],
                    note: 'Used only for reliability.'
                  },
                  {
                    category: 'We Never Collect',
                    color: '#D7E3FC',
                    items: ['Your location', 'Your contacts or social graph', 'Advertising identifiers'],
                    note: '✓ Confirmed zero collection.'
                  },
                ].map(({ category, color, items, note }) => (
                  <div
                    key={category}
                    className="rounded-xl p-4"
                    style={{ background: `${color}22`, border: `1px solid ${color}66` }}
                  >
                    <p className="font-semibold text-gray-800 text-sm mb-2">{category}</p>
                    <ul className="space-y-1 mb-3">
                      {items.map(i => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="mt-0.5 flex-shrink-0" style={{ color }}>▪</span>
                          {i}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. Third parties */}
          <section>
            <div
              style={{
                background: 'linear-gradient(135deg,rgba(255,255,255,0.45),rgba(237,242,251,0.45))',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.35)',
                boxShadow: '0 8px 32px rgba(31,38,135,0.07)',
              }}
              className="rounded-2xl p-6 md:p-8"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>🔗</span> Third-Party Services
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed mb-5">
                We use a minimal set of infrastructure providers, chosen for their privacy track record.
                None receive your journal content.
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { name: 'MongoDB Atlas', role: 'Database hosting (encrypted at rest)', flag: '🇺🇸' },
                  { name: 'Vercel', role: 'API and frontend hosting', flag: '🌐' },
                  { name: 'Hugging Face / OpenAI', role: 'AI inference (anonymised prompts only)', flag: '🤖' },
                  { name: 'Firebase Auth (optional)', role: 'Google sign-in only — no data beyond auth token', flag: '🔑' },
                ].map(({ name, role, flag }) => (
                  <div
                    key={name}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(215,227,252,0.5)' }}
                  >
                    <span className="text-xl">{flag}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{name}</p>
                      <p className="text-xs text-gray-500">{role}</p>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#D6EADF', color: '#2d6a4f' }}
                    >
                      Privacy-Safe
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 7. Contact */}
          <section id="contact">
            <div
              style={{
                background: 'linear-gradient(135deg,rgba(214,234,223,0.35),rgba(215,227,252,0.35))',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(171,196,255,0.3)',
                boxShadow: '0 0 40px rgba(214,234,223,0.3)',
              }}
              className="rounded-2xl p-6 md:p-8 text-center"
            >
              <div className="text-4xl mb-3">🤝</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Questions? Reach Out.</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-5">
                Privacy is a conversation, not a document. If you have any question about how your
                data is handled, we will reply within 48 hours.
              </p>
              <a
                href="mailto:privacy@openjournal.me"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg,#ABC4FF,#9DC4B0)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(171,196,255,0.4)',
                }}
              >
                <span>✉️</span>
                privacy@openjournal.me
              </a>
              <p className="text-xs text-gray-400 mt-4">
                Open Journal · GDPR &amp; CCPA compliant · Effective January 2026
              </p>
            </div>
          </section>

        </div>
        {/* ── End sections ───────────────────────────────────────────────── */}
      </div>
    </>
  );
}
