import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  fetchConnections,
  acceptConnection,
  declineConnection,
  upsertConnection,
  enrichConnection
} from '../store/connectionsSlice';
import {
  onResonance,
  onConnectionEnriched,
  onConnectionAccepted
} from '../services/socket';
import { formatDistanceToNow } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic seed from a string
// ─────────────────────────────────────────────────────────────────────────────
function seedFromId(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return Math.abs(h);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini Synchronicity Sphere (static snapshot, canvas-based)
// ─────────────────────────────────────────────────────────────────────────────
function MiniSphere({ matchScore = 0.7, seed = 1, size = 56 }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const S   = size * dpr;
    canvas.width  = S;
    canvas.height = S;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    const palette =
      matchScore >= 0.78
        ? ['#D6EADF', '#9DC4B0', '#ABC4FF', '#D7E3FC']
        : matchScore >= 0.60
          ? ['#ABC4FF', '#D7E3FC', '#D6EADF', '#EDF2FB']
          : ['#FFC09F', '#D7E3FC', '#ABC4FF', '#EDF2FB'];

    const cx = S / 2, cy = S / 2;
    const rng = (() => { let s = seed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
    const N     = 7;
    const RADII = Array.from({ length: N }, () => (0.27 + rng() * 0.12) * S);
    const SPEEDS = Array.from({ length: N }, () => (rng() - 0.5) * 0.015);
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, S, S);
      t += 1;

      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.5);
      bg.addColorStop(0, palette[0] + 'cc');
      bg.addColorStop(1, palette[3] + '00');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const angle  = (i / N) * Math.PI * 2;
        const wobble = Math.sin(t * SPEEDS[i] * 5 + i * 1.1) * S * 0.04;
        const r      = RADII[i] + wobble;
        const x      = cx + Math.cos(angle) * r;
        const y      = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy, S * 0.46);
      grad.addColorStop(0,   palette[0] + 'ff');
      grad.addColorStop(0.55, palette[1] + 'cc');
      grad.addColorStop(1,   palette[2] + '88');
      ctx.fillStyle = grad;
      ctx.filter = 'blur(4px)';
      ctx.fill();
      ctx.filter = 'none';

      ctx.beginPath();
      ctx.arc(cx - S * 0.08, cy - S * 0.1, S * 0.09 + Math.sin(t * 0.05) * S * 0.02, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [matchScore, seed, size]);

  return <canvas ref={canvasRef} style={{ borderRadius: '50%', flexShrink: 0 }} />;
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
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resonance Card (pending) — links to the full Resonance Profile page
// ─────────────────────────────────────────────────────────────────────────────
function ResonanceCard({ connection, userId, onAccept, onDecline, delay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const currentUserId = typeof userId === 'string' ? userId : userId?._id?.toString?.();
  const seeker    = connection.seekerId || connection.user1Id;
  const sage      = connection.sageId   || connection.user2Id;
  const seekerId  = seeker?._id || seeker;
  const isSeeker  = (seekerId?.toString?.() || seekerId) === currentUserId;
  const otherUser = isSeeker ? sage : seeker;
  const otherName = otherUser?.displayName || 'A Fellow Journaler';

  const seed       = seedFromId(connection._id || '');
  const matchScore = connection.similarityScore ?? 0.7;
  const themes     = (connection.sharedThemes || []).slice(0, 3);

  const matchColor =
    matchScore >= 0.78 ? '#9DC4B0' :
    matchScore >= 0.60 ? '#ABC4FF' : '#FFC09F';

  const handleAccept = async (e) => {
    e.preventDefault();
    setAccepting(true);
    await onAccept();
    setAccepting(false);
  };

  return (
    <Reveal delay={delay}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative rounded-2xl transition-all duration-300"
        style={{
          background: hovered
            ? 'linear-gradient(135deg,rgba(215,227,252,0.55),rgba(237,242,251,0.65))'
            : 'linear-gradient(135deg,rgba(255,255,255,0.48),rgba(237,242,251,0.45))',
          backdropFilter: 'blur(16px)',
          border: hovered
            ? '1px solid rgba(171,196,255,0.55)'
            : '1px solid rgba(255,255,255,0.45)',
          boxShadow: hovered
            ? `0 14px 50px rgba(31,38,135,0.12), 0 0 0 1px rgba(171,196,255,0.15)`
            : '0 6px 28px rgba(31,38,135,0.07)',
          transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        }}
      >
        {/* Match quality indicator — left border */}
        <div
          className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full"
          style={{ background: matchColor, opacity: 0.7 }}
        />

        <div className="p-5 pl-6">
          {/* Top row: sphere + name + match badge */}
          <div className="flex items-center gap-4 mb-4">
            <MiniSphere matchScore={matchScore} seed={seed} size={52} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-800 text-sm">{otherName}</p>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${matchColor}33`, color: '#374151', border: `1px solid ${matchColor}66` }}
                >
                  {isSeeker ? 'Sage' : 'Seeker'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isSeeker ? 'Has walked this path' : 'Seeking your perspective'}
              </p>
            </div>

            {/* Score ring */}
            <div className="relative w-11 h-11 flex-shrink-0">
              <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90">
                <circle cx="22" cy="22" r="16" fill="none" stroke="rgba(215,227,252,0.6)" strokeWidth="3.5" />
                <circle
                  cx="22" cy="22" r="16" fill="none"
                  stroke={matchColor} strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 16}`}
                  strokeDashoffset={`${2 * Math.PI * 16 * (1 - matchScore)}`}
                  style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-[11px] font-bold rotate-90"
                style={{ color: matchColor }}
              >
                {Math.round(matchScore * 100)}%
              </span>
            </div>
          </div>

          {/* Bridge message */}
          <p className="font-journal italic text-xs text-gray-600 leading-relaxed mb-3 pl-1">
            &ldquo;{connection.bridgeMessage || 'Your reflections share an unexplored resonance.'}&rdquo;
          </p>

          {/* Theme pills */}
          {themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {themes.map(t => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: 'rgba(171,196,255,0.2)', color: '#4B6FAA', border: '1px solid rgba(171,196,255,0.35)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Action row */}
          <div className="flex gap-2 items-center">
            <Link
              to={`/connections/${connection._id}/resonance`}
              className="flex-1 py-2 rounded-xl text-xs font-medium text-center transition-all duration-200"
              style={{
                background: 'rgba(171,196,255,0.18)',
                color: '#4B6FAA',
                border: '1px solid rgba(171,196,255,0.35)',
              }}
            >
              View Resonance Profile →
            </Link>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg,#ABC4FF,#9DC4B0)',
                color: '#fff',
                boxShadow: '0 3px 10px rgba(171,196,255,0.35)',
                opacity: accepting ? 0.7 : 1,
              }}
            >
              {accepting ? '…' : '✓ Accept'}
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onDecline(); }}
              className="px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(215,227,252,0.4)' }}
            >
              Pass
            </button>
          </div>
        </div>

        {/* Connection age chip */}
        {connection.createdAt && (
          <div
            className="absolute top-4 right-4 text-[9px] text-gray-400 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(215,227,252,0.4)' }}
          >
            {formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })}
          </div>
        )}
      </div>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active Connection Card
// ─────────────────────────────────────────────────────────────────────────────
function ActiveCard({ connection, userId, delay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const currentUserId = typeof userId === 'string' ? userId : userId?._id?.toString?.();
  const seeker    = connection.seekerId || connection.user1Id;
  const sage      = connection.sageId   || connection.user2Id;
  const seekerId  = seeker?._id || seeker;
  const isSeeker  = (seekerId?.toString?.() || seekerId) === currentUserId;
  const otherUser = isSeeker ? sage : seeker;
  const otherName = otherUser?.displayName || 'Someone';
  const seed      = seedFromId(connection._id || '');
  const matchScore = connection.similarityScore ?? 0.8;

  return (
    <Reveal delay={delay}>
      <Link to={`/connections/${connection._id}/resonance`}>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-300"
          style={{
            background: hovered
              ? 'linear-gradient(135deg,rgba(214,234,223,0.5),rgba(237,242,251,0.55))'
              : 'linear-gradient(135deg,rgba(255,255,255,0.45),rgba(237,242,251,0.42))',
            backdropFilter: 'blur(14px)',
            border: hovered
              ? '1px solid rgba(157,196,176,0.5)'
              : '1px solid rgba(215,227,252,0.45)',
            boxShadow: hovered ? '0 10px 36px rgba(31,38,135,0.1)' : '0 4px 20px rgba(31,38,135,0.06)',
            transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          }}
        >
          <MiniSphere matchScore={matchScore} seed={seed} size={44} />

          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 text-sm">{otherName}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {connection.createdAt
                ? `Connected ${formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })}`
                : 'Recently connected'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="px-2 py-1 text-xs rounded-full font-medium"
              style={{
                background: connection.status === 'resolved' ? '#D6EADF' : 'rgba(215,227,252,0.6)',
                color:      connection.status === 'resolved' ? '#2d6a4f' : '#4B6FAA',
              }}
            >
              {connection.status === 'resolved' ? '✓ Resolved' : 'Active'}
            </span>
            <Link
              to={`/bridge/${connection._id}`}
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1 rounded-xl text-xs font-medium transition-all duration-200"
              style={{ background: '#ABC4FF', color: '#fff', boxShadow: '0 2px 8px rgba(171,196,255,0.3)' }}
            >
              Chat →
            </Link>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ConnectionsPage() {
  const dispatch = useDispatch();
  const { connections, pending, active, loading, error } = useSelector(s => s.connections);
  const { user }   = useSelector(s => s.auth);
  const [refreshing, setRefreshing] = useState(false);

  // -- Socket subscriptions -------------------------------------------------
  useEffect(() => {
    const unsubResonance = onResonance((payload) => {
      if (!payload?.connectionId) return;
      dispatch(upsertConnection({
        _id:             payload.connectionId,
        connectionType:  payload.connectionType,
        bridgeMessage:   payload.bridgeMessage,
        similarityScore: payload.similarity,
        status:          'pending',
        seekerAccepted:  false,
        sageAccepted:    false,
        _myRole:         payload.role,
        _theirEntry:     payload.theirEntry,
        _summary:        payload.summary,
        sharedThemes:    payload.sharedThemes || []
      }));
    });
    const unsubEnriched = onConnectionEnriched((payload) => {
      if (!payload?.connectionId) return;
      dispatch(enrichConnection({ connectionId: payload.connectionId, bridgeMessage: payload.bridgeMessage, summary: payload.summary }));
    });
    const unsubAccepted = onConnectionAccepted(() => dispatch(fetchConnections()));
    return () => { unsubResonance(); unsubEnriched(); unsubAccepted(); };
  }, [dispatch]);

  useEffect(() => { dispatch(fetchConnections()); }, [dispatch]);

  // -- Handlers -------------------------------------------------------------
  const handleAccept  = useCallback((id) => dispatch(acceptConnection(id)),  [dispatch]);
  const handleDecline = useCallback((id) => dispatch(declineConnection(id)), [dispatch]);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchConnections());
    setRefreshing(false);
  }, [dispatch]);

  // -- Dedup helpers --------------------------------------------------------
  const getUserId = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (v._id) return v._id.toString();
    if (v.id)  return v.id.toString();
    return v.toString?.() || null;
  };
  const resolveParticipants = (c) => ({ seeker: c.seekerId || c.user1Id, sage: c.sageId || c.user2Id });
  const dedupeByOtherUser = (list) => {
    const myId      = getUserId(user?._id || user?.id || user);
    const byOtherUser = new Map();
    list.forEach((c) => {
      const { seeker, sage } = resolveParticipants(c);
      const otherId = getUserId(seeker) === myId ? getUserId(sage) : getUserId(seeker);
      if (!otherId) return;
      const existing = byOtherUser.get(otherId);
      if (!existing || new Date(c.createdAt || 0) > new Date(existing.createdAt || 0)) {
        byOtherUser.set(otherId, c);
      }
    });
    return Array.from(byOtherUser.values());
  };

  const uniquePending = useMemo(() => dedupeByOtherUser(pending), [pending, user?._id, user?.id]);
  const uniqueActive  = useMemo(() => dedupeByOtherUser(active),  [active,  user?._id, user?.id]);
  const hasAny        = connections.some(c => c.status !== 'declined');

  return (
    <div className="max-w-3xl mx-auto py-8 px-2">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-0.5">Resonance Feed</h1>
          <p className="text-gray-500 text-sm">
            People whose wisdom echoes your own — explore depth, not just similarity.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl transition-all duration-200 disabled:opacity-40"
          style={{
            background: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(215,227,252,0.6)',
            backdropFilter: 'blur(8px)',
            color: '#4B6FAA',
          }}
        >
          <span className={refreshing || loading ? 'animate-spin inline-block' : 'inline-block'}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stats bar */}
      {hasAny && !loading && (
        <div
          className="flex gap-4 mb-8 p-3 rounded-2xl flex-wrap"
          style={{
            background: 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(215,227,252,0.4)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {[
            { label: 'Pending Resonances', value: uniquePending.length, color: '#ABC4FF' },
            { label: 'Active Bridges',     value: uniqueActive.length,  color: '#9DC4B0' },
            { label: 'Total Connections',  value: connections.filter(c => c.status !== 'declined').length, color: '#D7E3FC' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2 flex-shrink-0">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs text-gray-500">{label}:</span>
              <span className="text-xs font-bold text-gray-800">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && !refreshing && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-9 h-9 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400 animate-pulse">Tuning into the resonance…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl mb-6 text-sm text-gray-700"
          style={{ background: 'rgba(255,192,159,0.3)', border: '1px solid rgba(255,192,159,0.5)' }}>
          {error}
        </div>
      )}

      {/* ── Pending Resonances ─────────────────────────────────────────────── */}
      {uniquePending.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-blue-eyes animate-pulse" />
            <h2 className="text-base font-semibold text-gray-700">
              Pending Resonances
            </h2>
            <span
              className="px-2 py-0.5 text-xs font-bold rounded-full"
              style={{ background: '#ABC4FF', color: '#fff' }}
            >
              {uniquePending.length}
            </span>
            <span className="text-xs text-gray-400 ml-1">— explore each before deciding</span>
          </div>

          <div className="grid sm:grid-cols-1 gap-4">
            {uniquePending.map((connection, i) => (
              <ResonanceCard
                key={connection._id}
                connection={connection}
                userId={user?._id}
                onAccept={() => handleAccept(connection._id)}
                onDecline={() => handleDecline(connection._id)}
                delay={i * 80}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Active Bridges ─────────────────────────────────────────────────── */}
      {uniqueActive.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <h2 className="text-base font-semibold text-gray-700">Active Bridges</h2>
            <span
              className="px-2 py-0.5 text-xs font-bold rounded-full"
              style={{ background: '#D6EADF', color: '#2d6a4f' }}
            >
              {uniqueActive.length}
            </span>
          </div>
          <div className="space-y-3">
            {uniqueActive.map((connection, i) => (
              <ActiveCard
                key={connection._id}
                connection={connection}
                userId={user?._id}
                delay={i * 60}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!loading && !hasAny && (
        <div
          className="text-center py-16 rounded-3xl"
          style={{
            background: 'linear-gradient(135deg,rgba(255,255,255,0.45),rgba(237,242,251,0.45))',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(215,227,252,0.45)',
          }}
        >
          <div className="flex justify-center mb-5">
            <div style={{ opacity: 0.5 }}>
              <MiniSphere matchScore={0.75} seed={42} size={72} />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">The vault is quiet</h3>
          <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6 leading-relaxed">
            Write journal entries with Selective Discovery enabled to let the Community Brain
            find your resonant match.
          </p>
          <Link
            to="/journal"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'linear-gradient(135deg,#ABC4FF,#9DC4B0)',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(171,196,255,0.35)',
            }}
          >
            ✦ Write an Entry
          </Link>
        </div>
      )}
    </div>
  );
}
