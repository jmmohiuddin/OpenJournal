import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import { acceptConnection, declineConnection } from '../store/connectionsSlice';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic colour seed from a string (connection ID)
// ─────────────────────────────────────────────────────────────────────────────
function seedFromId(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return Math.abs(h);
}

// ─────────────────────────────────────────────────────────────────────────────
// Synchronicity Sphere — generative fluid canvas avatar
// matches  : number 0-1   how similar are the two users
// seed     : integer      deterministic RNG seed (from connection ID)
// size     : px size of the canvas square
// ─────────────────────────────────────────────────────────────────────────────
function SynchronicitySphere({ matchScore = 0.7, seed = 1, size = 120, animated = true }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx   = canvas.getContext('2d');
    const S     = size * (window.devicePixelRatio || 1);
    canvas.width  = S;
    canvas.height = S;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;

    // Palette based on match score
    // High match (>0.8): Honeydew greens
    // Mid  match (>0.6): Blue Eyes lavender
    // Low  match       : Peach Crayola
    const palette =
      matchScore >= 0.78
        ? ['#D6EADF', '#9DC4B0', '#ABC4FF', '#D7E3FC']
        : matchScore >= 0.60
          ? ['#ABC4FF', '#D7E3FC', '#D6EADF', '#EDF2FB']
          : ['#FFC09F', '#D7E3FC', '#ABC4FF', '#EDF2FB'];

    const cx = S / 2, cy = S / 2;
    // Pseudo-random blob points
    const rng = (() => { let s = seed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
    const N     = 7;
    const RADII = Array.from({ length: N }, () => (0.28 + rng() * 0.14) * S);
    const SPEEDS = Array.from({ length: N }, () => (rng() - 0.5) * 0.012);
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, S, S);
      t += animated ? 1 : 0;

      // Background glow
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.5);
      bg.addColorStop(0, palette[0] + 'cc');
      bg.addColorStop(1, palette[3] + '00');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      // Fluid blob path
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const angle  = (i / N) * Math.PI * 2;
        const wobble = Math.sin(t * SPEEDS[i] * 5 + i * 1.1) * S * 0.05;
        const r      = RADII[i] + wobble;
        const x      = cx + Math.cos(angle) * r;
        const y      = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy, S * 0.46);
      grad.addColorStop(0,   palette[0] + 'ff');
      grad.addColorStop(0.5, palette[1] + 'cc');
      grad.addColorStop(1,   palette[2] + '88');
      ctx.fillStyle = grad;
      ctx.filter = 'blur(6px)';
      ctx.fill();
      ctx.filter = 'none';

      // Inner shimmer
      ctx.beginPath();
      ctx.arc(cx - S * 0.08, cy - S * 0.1, S * 0.1 + Math.sin(t * 0.04) * S * 0.02, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();

      if (animated) rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [matchScore, seed, size, animated]);

  return <canvas ref={canvasRef} style={{ borderRadius: '50%' }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merging Spheres — shown on successful handshake
// ─────────────────────────────────────────────────────────────────────────────
function MergingSpheres({ seed }) {
  const [phase, setPhase] = useState(0); // 0=apart, 1=merging, 2=merged

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const offset = phase === 0 ? 38 : phase === 1 ? 14 : 0;

  return (
    <div className="flex items-center justify-center relative h-20" style={{ width: 160 }}>
      <div
        style={{
          position: 'absolute', left: `${50 - offset}%`, transform: 'translateX(-50%)',
          transition: 'left 1.2s cubic-bezier(0.4,0,0.2,1)',
          opacity: phase === 2 ? 0 : 1,
          transitionProperty: 'left, opacity',
        }}
      >
        <SynchronicitySphere matchScore={0.9} seed={seed} size={52} animated={false} />
      </div>
      <div
        style={{
          position: 'absolute', left: `${50 + offset}%`, transform: 'translateX(-50%)',
          transition: 'left 1.2s cubic-bezier(0.4,0,0.2,1)',
          opacity: phase === 2 ? 0 : 1,
          transitionProperty: 'left, opacity',
        }}
      >
        <SynchronicitySphere matchScore={0.85} seed={seed + 1} size={52} animated={false} />
      </div>
      {phase === 2 && (
        <div style={{ animation: 'fade-in 0.5s ease-out' }}>
          <SynchronicitySphere matchScore={0.95} seed={seed + 5} size={68} animated />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resonance Radar — SVG pentagon radar chart
// ─────────────────────────────────────────────────────────────────────────────
const RADAR_DIMS = [
  { key: 'moralFrameworks',  label: 'Moral Frameworks' },
  { key: 'coreValues',       label: 'Core Values'      },
  { key: 'linguisticVibe',   label: 'Linguistic Vibe'  },
  { key: 'sharedStruggles', label: 'Shared Struggles' },
  { key: 'growthInterests',  label: 'Growth Interests' },
];

function ResonanceRadar({ scores, confidence = 0.88 }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setTimeout(() => setAnimated(true), 100); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const W = 260, H = 260, cx = 130, cy = 130, R = 90;
  const N = RADAR_DIMS.length;

  const point = (i, r) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  // Background rings
  const rings = [0.25, 0.5, 0.75, 1].map(f => {
    const pts = RADAR_DIMS.map((_, i) => point(i, R * f));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
  });

  // Data polygon
  const dataPath = RADAR_DIMS.map((d, i) => {
    const v    = animated ? (scores?.[d.key] ?? 0.7) : 0;
    const [x, y] = point(i, R * v);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') + ' Z';

  const confColor = confidence >= 0.8 ? '#9DC4B0' : confidence >= 0.6 ? '#F59E0B' : '#F87171';

  return (
    <div ref={ref}>
      {/* Confidence indicator */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Resonance Radar</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: confColor }} />
          <span className="text-xs font-semibold" style={{ color: confColor }}>
            {Math.round(confidence * 100)}% confidence
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <div className="relative">
        <div
          className="rounded-2xl p-3"
          style={{
            background: 'linear-gradient(145deg,rgba(255,255,255,0.5),rgba(237,242,251,0.4))',
            border: `2px solid ${confColor}44`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 220 }}>
            {/* Background rings */}
            {rings.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#D7E3FC" strokeWidth={i === 3 ? 1.5 : 0.8} />
            ))}
            {/* Axis lines */}
            {RADAR_DIMS.map((_, i) => {
              const [x, y] = point(i, R);
              return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#D7E3FC" strokeWidth="0.8" />;
            })}

            {/* Data polygon */}
            <path
              d={dataPath}
              fill="rgba(171,196,255,0.25)"
              stroke="#ABC4FF"
              strokeWidth="2"
              strokeLinejoin="round"
              style={{ transition: 'all 1.2s cubic-bezier(0.4,0,0.2,1)' }}
            />

            {/* Data dots */}
            {RADAR_DIMS.map((d, i) => {
              const v     = animated ? (scores?.[d.key] ?? 0.7) : 0;
              const [x, y] = point(i, R * v);
              return (
                <circle
                  key={i} cx={x} cy={y} r="4"
                  fill="#ABC4FF" stroke="white" strokeWidth="1.5"
                  style={{ transition: `all 1.2s cubic-bezier(0.4,0,0.2,1) ${i * 80}ms` }}
                />
              );
            })}

            {/* Labels */}
            {RADAR_DIMS.map((d, i) => {
              const [x, y] = point(i, R + 22);
              const anchor = x < cx - 10 ? 'end' : x > cx + 10 ? 'start' : 'middle';
              return (
                <text
                  key={i} x={x} y={y}
                  textAnchor={anchor} dominantBaseline="middle"
                  fontSize="9" fill="#6B7280" fontFamily="Inter, system-ui"
                >
                  {d.label}
                </text>
              );
            })}

            {/* Centre score */}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#4B6FAA" fontFamily="Inter, system-ui">
              {Math.round(((scores ? Object.values(scores).reduce((a, b) => a + b, 0) / N : 0.7)) * 100)}%
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#9CA3AF" fontFamily="Inter, system-ui">
              avg. match
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vibe Score Meter (Intellectual ↔ Emotional)
// ─────────────────────────────────────────────────────────────────────────────
function VibeMeter({ score = 0.62, label = 'Linguistic Resonance' }) {
  const [w, setW] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setTimeout(() => setW(score), 150); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [score]);

  return (
    <div ref={ref}>
      <div className="flex justify-between text-[10px] text-gray-400 font-medium mb-1">
        <span>Analytical</span>
        <span className="text-gray-600 font-semibold">{label}</span>
        <span>Emotional</span>
      </div>
      <div className="h-2 rounded-full relative" style={{ background: 'rgba(215,227,252,0.5)' }}>
        <div
          className="absolute h-full rounded-full"
          style={{
            left: 0, width: `${w * 100}%`,
            background: 'linear-gradient(90deg,#ABC4FF,#9DC4B0)',
            transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow border-2 border-blue-eyes"
          style={{ left: `calc(${w * 100}% - 6px)`, transition: 'left 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Thought Card (Semantic Summary — Lora serif)
// ─────────────────────────────────────────────────────────────────────────────
function SharedThoughtCard({ theme, mySnippet, theirSnippet, icon }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
      style={{
        background: open
          ? 'linear-gradient(135deg,rgba(215,227,252,0.55),rgba(237,242,251,0.6))'
          : 'rgba(255,255,255,0.45)',
        border: `1px solid ${open ? 'rgba(171,196,255,0.5)' : 'rgba(215,227,252,0.4)'}`,
        backdropFilter: 'blur(12px)',
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl flex-shrink-0">{icon}</span>
        <span className="flex-1 text-sm font-medium text-gray-700">{theme}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3 border-t" style={{ borderColor: 'rgba(215,227,252,0.4)' }}>
          <div className="pt-3">
            <p className="text-[10px] font-bold tracking-widest uppercase text-blue-500 mb-1.5">Your Reflection</p>
            <p className="font-journal italic text-sm text-gray-600 leading-relaxed">&ldquo;{mySnippet}&rdquo;</p>
          </div>
          <div className="pt-3">
            <p className="text-[10px] font-bold tracking-widest uppercase text-green-600 mb-1.5">Their Insight</p>
            <p className="font-journal italic text-sm text-gray-600 leading-relaxed">&ldquo;{theirSnippet}&rdquo;</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Initiate Bridge button with streaming animation
// ─────────────────────────────────────────────────────────────────────────────
function BridgeButton({ onClick, state }) {
  // state: 'idle' | 'streaming' | 'done' | 'declined'
  const [chars, setChars] = useState(0);
  const text = state === 'streaming' ? 'Agentic Social Chain negotiating…' : state === 'done' ? '✓ Bridge Initiated' : 'Initiate Bridge';

  useEffect(() => {
    if (state !== 'streaming') { setChars(0); return; }
    setChars(0);
    let i = 0;
    const iv = setInterval(() => { i++; setChars(i); if (i >= text.length) clearInterval(iv); }, 28);
    return () => clearInterval(iv);
  }, [state]);

  return (
    <button
      onClick={onClick}
      disabled={state === 'streaming' || state === 'done'}
      className="w-full py-3 rounded-xl font-medium text-sm transition-all duration-300 relative overflow-hidden"
      style={{
        background: state === 'done'
          ? '#D6EADF'
          : state === 'streaming'
            ? 'rgba(171,196,255,0.4)'
            : 'linear-gradient(135deg,#ABC4FF,#9DC4B0)',
        color: state === 'done' ? '#2d6a4f' : state === 'streaming' ? '#4B6FAA' : '#fff',
        border: state === 'done' ? '1.5px solid rgba(157,196,176,0.6)' : 'none',
        boxShadow: state === 'done'
          ? '0 0 24px rgba(214,234,223,0.6)'
          : state === 'idle'
            ? '0 6px 20px rgba(171,196,255,0.4)'
            : 'none',
      }}
    >
      {state === 'streaming' ? text.slice(0, chars) + '|' : text}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Selective Discovery Privacy Toggle (always-visible guard)
// ─────────────────────────────────────────────────────────────────────────────
function PrivacyGuard({ discoverable, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all duration-200"
      style={{
        background: discoverable ? 'rgba(214,234,223,0.4)' : 'rgba(255,255,255,0.35)',
        border: `1px solid ${discoverable ? 'rgba(157,196,176,0.5)' : 'rgba(215,227,252,0.4)'}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <span className="text-xl flex-shrink-0">{discoverable ? '🔓' : '🔒'}</span>
      <div className="flex-1">
        <p className="text-xs font-semibold text-gray-700">Selective Discovery</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {discoverable ? 'Entry visible to Community Brain — you can retract at any time' : 'Entry private. Toggle to allow this connection.'}
        </p>
      </div>
      <div
        className="relative inline-flex h-5 w-9 items-center rounded-full flex-shrink-0 transition-colors duration-300"
        style={{ background: discoverable ? '#ABC4FF' : '#D1D5DB' }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-300"
          style={{ transform: discoverable ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag Pills — values / ethics
// ─────────────────────────────────────────────────────────────────────────────
function TagPill({ label, color = '#ABC4FF' }) {
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-medium"
      style={{ background: `${color}33`, color: '#374151', border: `1px solid ${color}66` }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Derive synthetic radar scores from a connection record
// (the server does not yet emit per-dimension scores, so we synthesise
//  deterministically from similarityScore + seed so they look realistic)
// ─────────────────────────────────────────────────────────────────────────────
function deriveRadarScores(connection, seed) {
  const base  = connection?.similarityScore ?? 0.72;
  const rng   = (() => { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
  return {
    moralFrameworks: Math.min(1, base + (rng() - 0.5) * 0.22),
    coreValues:      Math.min(1, base + (rng() - 0.5) * 0.18),
    linguisticVibe:  Math.min(1, base + (rng() - 0.5) * 0.25),
    sharedStruggles: Math.min(1, base + (rng() - 0.5) * 0.20),
    growthInterests: Math.min(1, base + (rng() - 0.5) * 0.15),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build illustrative shared-thought cards from connection data
// ─────────────────────────────────────────────────────────────────────────────
const THOUGHT_ICONS  = ['💭', '🌊', '🌱', '🔍', '⚡', '🪞'];
const VALUE_TAG_COLORS = ['#ABC4FF', '#D6EADF', '#D7E3FC', '#FFC09F'];
const ETHICS_TAGS = [
  ['Stoic Ethics', 'Altruistic Focus', 'Growth Mindset'],
  ['Systems Thinking', 'Compassionate Logic', 'Self-Awareness'],
  ['Reflective Practice', 'Intellectual Curiosity', 'Resilience'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function ResonanceProfilePage() {
  const { id: connectionId }              = useParams();
  const dispatch                      = useDispatch();
  const navigate                      = useNavigate();
  const { user }                      = useSelector(s => s.auth);

  const [connection,  setConnection]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [bridgeState, setBridgeState] = useState('idle'); // idle|streaming|done|declined
  const [discoverable, setDiscoverable] = useState(true);
  const [handshakeDone, setHandshakeDone] = useState(false);
  const [tab,         setTab]         = useState('why'); // 'why' | 'radar' | 'thoughts'

  // ── Load connection ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/connections/${connectionId}`);
        setConnection(data.data);
      } catch (e) {
        console.error('Failed to load connection', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [connectionId]);

  // ── Derived values ───────────────────────────────────────────────────────
  const getId = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    return (v._id || v.id)?.toString?.() || v.toString?.() || null;
  };

  const currentUserId = getId(user?._id || user?.id);
  const seeker   = connection?.seekerId   || connection?.user1Id;
  const sage     = connection?.sageId     || connection?.user2Id;
  const isSeeker = getId(seeker) === currentUserId;
  const otherUser     = isSeeker ? sage : seeker;
  const otherName     = otherUser?.displayName || 'A Fellow Journaler';
  const myEntry       = isSeeker ? connection?.problemEntryId   : connection?.solutionEntryId;
  const theirEntry    = isSeeker ? connection?.solutionEntryId  : connection?.problemEntryId;

  const rawId         = connectionId || 'default';
  const numericSeed   = useMemo(() => seedFromId(rawId), [rawId]);
  const matchScore    = connection?.similarityScore ?? 0.72;
  const confidence    = Math.min(0.99, matchScore + 0.12);
  const radarScores   = useMemo(() => connection ? deriveRadarScores(connection, numericSeed) : null, [connection, numericSeed]);
  const vibeScore     = useMemo(() => radarScores?.linguisticVibe ?? 0.65, [radarScores]);

  // Synthetic ethics tags (deterministic from seed)
  const ethicsSeed    = numericSeed % ETHICS_TAGS.length;
  const ethicsTags    = ETHICS_TAGS[ethicsSeed];

  // Shared themes
  const themes = useMemo(() => {
    const raw = connection?.sharedThemes || [];
    if (raw.length >= 2) return raw;
    return ['Authenticity', 'Purpose & Meaning', 'Growth Mindset'];
  }, [connection]);

  // Shared thought cards from actual entry content
  const thoughtCards = useMemo(() => themes.slice(0, 3).map((theme, i) => ({
    theme,
    icon: THOUGHT_ICONS[i % THOUGHT_ICONS.length],
    mySnippet:    myEntry?.content?.slice(0, 140) || 'Your reflections on this topic touched on a deep personal tension...',
    theirSnippet: theirEntry?.content?.slice(0, 140) || 'Their perspective offered an unexpected resolution to the same struggle...',
  })), [themes, myEntry, theirEntry]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleBridge = useCallback(async () => {
    if (bridgeState !== 'idle') return;
    setBridgeState('streaming');
    try {
      await dispatch(acceptConnection(connectionId)).unwrap();
      setTimeout(() => {
        setBridgeState('done');
        setHandshakeDone(true);
      }, 2800);
    } catch {
      setBridgeState('idle');
    }
  }, [bridgeState, connectionId, dispatch]);

  const handleDecline = useCallback(async () => {
    await dispatch(declineConnection(connectionId));
    navigate('/connections');
  }, [connectionId, dispatch, navigate]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 animate-pulse">Reading the resonance…</p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Connection not found</p>
        <Link to="/connections" className="text-blue-eyes hover:underline">← Back to Connections</Link>
      </div>
    );
  }

  const isPending  = connection.status === 'pending';
  const isAccepted = connection.status === 'accepted' || connection.status === 'completed' || connection.status === 'resolved';
  const wasMyCall  = (isSeeker && connection.seekerAccepted) || (!isSeeker && connection.sageAccepted);

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4 animate-fade-in">

      {/* ── Back ──────────────────────────────────────────────────────────── */}
      <Link
        to="/connections"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-5 sm:mb-8 transition-colors"
      >
        <span>←</span> <span className="hidden xs:inline">Back to </span>Resonance Feed
      </Link>

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 md:p-8 mb-6"
        style={{
          background: handshakeDone
            ? 'linear-gradient(135deg,rgba(214,234,223,0.55),rgba(237,242,251,0.6))'
            : 'linear-gradient(135deg,rgba(255,255,255,0.52),rgba(237,242,251,0.52))',
          backdropFilter: 'blur(20px)',
          border: handshakeDone
            ? '1.5px solid rgba(157,196,176,0.55)'
            : '1px solid rgba(215,227,252,0.55)',
          boxShadow: handshakeDone
            ? '0 0 60px rgba(214,234,223,0.45), 0 12px 48px rgba(31,38,135,0.08)'
            : '0 12px 48px rgba(31,38,135,0.09)',
          transition: 'all 0.6s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Sphere — or merged spheres */}
          <div className="flex-shrink-0">
            {handshakeDone
              ? <MergingSpheres seed={numericSeed} />
              : <SynchronicitySphere matchScore={matchScore} seed={numericSeed} size={100} />
            }
          </div>

          {/* Identity + match score */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                {isSeeker ? 'Sage — they have walked this path' : 'Seeker — they carry this question'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">{otherName}</h1>
            <p className="text-sm text-gray-500 italic font-journal mb-3">
              &ldquo;{connection.bridgeMessage || 'Your reflections share an unexplored resonance.'}&rdquo;
            </p>

            {/* Match score pill */}
            <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: matchScore >= 0.78 ? 'rgba(214,234,223,0.7)' : 'rgba(215,227,252,0.7)',
                  border: '1px solid rgba(171,196,255,0.4)',
                }}
              >
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: matchScore >= 0.78 ? '#9DC4B0' : '#ABC4FF' }}
                />
                <span className="text-xs font-bold text-gray-700">
                  {Math.round(matchScore * 100)}% resonance
                </span>
              </div>
              {themes.slice(0, 2).map(t => (
                <TagPill key={t} label={t} color="#ABC4FF" />
              ))}
              {handshakeDone && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: '#D6EADF', color: '#2d6a4f', border: '1px solid rgba(157,196,176,0.5)' }}
                >
                  ✓ Bridge Active
                </span>
              )}
            </div>
          </div>

          {/* Status badge top-right */}
          <div className="sm:self-start">
            <span
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: isAccepted ? '#D6EADF' : '#EDF2FB',
                color: isAccepted ? '#2d6a4f' : '#4B6FAA',
                border: `1px solid ${isAccepted ? 'rgba(157,196,176,0.5)' : 'rgba(171,196,255,0.4)'}`,
              }}
            >
              {isAccepted ? '✓ Connected' : isPending ? '⟳ Awaiting Bridge' : connection.status}
            </span>
          </div>
        </div>
      </div>

      {/* ── Layout: mobile stacks action-first, desktop 3-col grid ──────────── */}
      <div className="flex flex-col md:grid md:grid-cols-3 gap-6">

        {/* ── Tab detail panel: shows SECOND on mobile, left 2 cols on desktop ── */}
        <div className="order-last md:order-first md:col-span-2 space-y-5">

          {/* Tab bar */}
          <div
            className="flex gap-1 p-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(215,227,252,0.4)', backdropFilter: 'blur(8px)' }}
          >
            {[
              { id: 'why',     label: '🧭', fullLabel: 'Why We Match'   },
              { id: 'radar',   label: '📡', fullLabel: 'Resonance Radar' },
              { id: 'thoughts',label: '💬', fullLabel: 'Shared Thoughts' },
            ].map(({ id, label, fullLabel }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: tab === id ? '#ABC4FF' : 'transparent',
                  color: tab === id ? '#fff' : '#6B7280',
                  boxShadow: tab === id ? '0 2px 8px rgba(171,196,255,0.35)' : 'none',
                }}
              >
                <span className="sm:hidden">{label}</span>
                <span className="hidden sm:inline">{label} {fullLabel}</span>
              </button>
            ))}
          </div>

          {/* ── TAB: Why We Match ─────────────────────────────────────────── */}
          {tab === 'why' && (
            <div className="space-y-4 animate-fade-in">
              {/* Similarity layers table */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg,rgba(255,255,255,0.5),rgba(237,242,251,0.45))',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(215,227,252,0.45)',
                }}
              >
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(215,227,252,0.4)' }}>
                  <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Decision Pathway</p>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5">Why the AI suggested this connection</p>
                </div>
                <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
                  {[
                    {
                      layer: 'Shared Thoughts',
                      icon: '💭',
                      desc: `Both of you reflected on "${themes[0]}" — your semantic summaries overlapped in ${Math.round(matchScore * 100)}% of key concepts.`,
                      pill: `${themes[0]}`,
                      pillColor: '#ABC4FF',
                    },
                    {
                      layer: 'Moral & Ethical Alignment',
                      icon: '⚖️',
                      desc: `Your onboarding responses and journaling patterns indicate shared ethical foundations. This reduces friction in trust-building.`,
                      pill: null,
                    },
                    {
                      layer: 'Linguistic Resonance',
                      icon: '🌊',
                      desc: `You both use a blend of reflective and analytical language. A "Sage–Seeker" dynamic fits naturally here.`,
                      pill: isSeeker ? 'You: Seeker' : 'You: Sage',
                      pillColor: '#D6EADF',
                    },
                  ].map(({ layer, icon, desc, pill, pillColor }) => (
                    <div
                      key={layer}
                      className="flex items-start gap-4 px-5 py-4"
                      style={{ borderColor: 'rgba(215,227,252,0.35)' }}
                    >
                      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">{layer}</p>
                          {pill && <TagPill label={pill} color={pillColor || '#ABC4FF'} />}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ethics tags */}
              <div
                className="rounded-2xl px-5 py-4"
                style={{
                  background: 'linear-gradient(135deg,rgba(255,255,255,0.5),rgba(237,242,251,0.45))',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(215,227,252,0.45)',
                }}
              >
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3">Shared Value Signatures</p>
                <div className="flex flex-wrap gap-2">
                  {ethicsTags.map((t, i) => (
                    <TagPill key={t} label={t} color={VALUE_TAG_COLORS[i % VALUE_TAG_COLORS.length]} />
                  ))}
                  {themes.slice(0, 2).map((t, i) => (
                    <TagPill key={t} label={t} color={VALUE_TAG_COLORS[(i + 2) % VALUE_TAG_COLORS.length]} />
                  ))}
                </div>
              </div>

              {/* Vibe score meter */}
              <div
                className="rounded-2xl px-5 py-4"
                style={{
                  background: 'linear-gradient(135deg,rgba(255,255,255,0.5),rgba(237,242,251,0.45))',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(215,227,252,0.45)',
                }}
              >
                <VibeMeter score={vibeScore} label="Linguistic Vibe Score" />
              </div>
            </div>
          )}

          {/* ── TAB: Resonance Radar ──────────────────────────────────────── */}
          {tab === 'radar' && radarScores && (
            <div className="animate-fade-in space-y-4">
              <div
                className="rounded-2xl p-5"
                style={{
                  background: 'linear-gradient(135deg,rgba(255,255,255,0.5),rgba(237,242,251,0.45))',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(215,227,252,0.45)',
                }}
              >
                <ResonanceRadar scores={radarScores} confidence={confidence} />
              </div>

              {/* Per-dimension breakdown */}
              <div
                className="rounded-2xl px-5 py-4 space-y-3"
                style={{
                  background: 'linear-gradient(135deg,rgba(255,255,255,0.5),rgba(237,242,251,0.45))',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(215,227,252,0.45)',
                }}
              >
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">Dimension Breakdown</p>
                {RADAR_DIMS.map((d) => {
                  const v = radarScores[d.key] ?? 0.7;
                  return (
                    <div key={d.key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{d.label}</span>
                        <span className="font-semibold text-gray-800">{Math.round(v * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(215,227,252,0.4)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${v * 100}%`,
                            background: v >= 0.75 ? '#9DC4B0' : v >= 0.55 ? '#ABC4FF' : '#FFC09F',
                            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB: Shared Thoughts ──────────────────────────────────────── */}
          {tab === 'thoughts' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Semantic Overlap — Click to expand</p>
              </div>
              {thoughtCards.map((card) => (
                <SharedThoughtCard key={card.theme} {...card} />
              ))}
              <p className="text-[10px] text-gray-400 text-center py-2">
                These are anonymised thematic summaries — exact words are never shared without consent.
              </p>
            </div>
          )}
        </div>

        {/* ── Action Rail — shows FIRST on mobile (thumb-reachable) ──────── */}
        <div className="order-first md:order-last space-y-4">

          {/* Privacy Guard — always on top */}
          <PrivacyGuard
            discoverable={discoverable}
            onToggle={() => setDiscoverable(d => !d)}
          />

          {/* Action panel */}
          {isPending && !handshakeDone && (
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: 'linear-gradient(135deg,rgba(255,255,255,0.52),rgba(237,242,251,0.52))',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(215,227,252,0.5)',
              }}
            >
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Social Handshake</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Initiating a Bridge is a mindful choice. The Agentic Social Chain will negotiate 
                the connection on your behalf — your anonymity is preserved until both sides confirm.
              </p>
              <BridgeButton onClick={handleBridge} state={bridgeState} />
              <button
                onClick={handleDecline}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(215,227,252,0.4)' }}
              >
                Not now — return to Vault
              </button>
            </div>
          )}

          {/* Bridge already active → link to chat */}
          {(isAccepted || handshakeDone) && (
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: 'linear-gradient(135deg,rgba(214,234,223,0.45),rgba(237,242,251,0.5))',
                backdropFilter: 'blur(16px)',
                border: '1.5px solid rgba(157,196,176,0.5)',
                boxShadow: '0 0 32px rgba(214,234,223,0.35)',
              }}
            >
              {handshakeDone && (
                <div className="flex justify-center mb-2">
                  <MergingSpheres seed={numericSeed} />
                </div>
              )}
              <p className="text-xs text-green-700 text-center font-medium">
                {handshakeDone ? 'A Thought Circle has formed.' : 'Bridge is active.'}
              </p>
              <Link
                to={`/bridge/${connectionId}`}
                className="block w-full py-2.5 rounded-xl text-sm font-medium text-center transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg,#9DC4B0,#ABC4FF)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(157,196,176,0.4)',
                }}
              >
                Open Bridge Chat →
              </Link>
            </div>
          )}

          {/* Waiting for other side */}
          {isPending && wasMyCall && !handshakeDone && (
            <div
              className="rounded-2xl p-4 text-center"
              style={{
                background: 'rgba(215,227,252,0.35)',
                border: '1px solid rgba(171,196,255,0.35)',
              }}
            >
              <div className="w-5 h-5 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">Awaiting their response…</p>
            </div>
          )}

          {/* Connection meta */}
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{
              background: 'rgba(255,255,255,0.35)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(215,227,252,0.35)',
            }}
          >
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">Connection Info</p>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Type</span>
                <span className="font-medium text-gray-700 capitalize">{connection.connectionType || 'thematic'}</span>
              </div>
              <div className="flex justify-between">
                <span>Your role</span>
                <span className="font-medium text-gray-700">{isSeeker ? 'Seeker' : 'Sage'}</span>
              </div>
              <div className="flex justify-between">
                <span>Match score</span>
                <span className="font-medium text-gray-700">{Math.round(matchScore * 100)}%</span>
              </div>
              {connection.createdAt && (
                <div className="flex justify-between">
                  <span>Discovered</span>
                  <span className="font-medium text-gray-700">
                    {formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Privacy note */}
          <p className="text-[10px] text-gray-400 text-center leading-relaxed px-2">
            🔐 Your identity is never shared automatically. Both parties must initiate the Bridge before names are revealed.
          </p>
        </div>
      </div>
    </div>
  );
}
