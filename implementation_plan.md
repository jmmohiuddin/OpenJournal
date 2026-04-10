# Responsive Design & UX Enhancement Plan

## Goal
Make the entire Open Journal app work beautifully across **Mobile (≤480px)**, **Tablet (481–1023px)**, and **Desktop (≥1024px)** while maintaining the Zen-Social design language. Fix mobile breakages, enhance consistency, and align with the AI-Mediated Social Platform Design Document.

---

## Key Issues Identified

| Issue | Where | Impact |
|-------|-------|--------|
| Sidebar is always 256px wide — **overlaps/hides content on mobile** | `Layout.jsx`, `Sidebar.jsx` | 🔴 Critical |
| Main content `p-8` is too much padding on small screens | `Layout.jsx` | 🔴 Critical |
| Journal editor `p-8` inner padding squishes on 375px | `JournalEditor.jsx` | 🔴 Critical |
| BridgeViewPage split-screen unusable on mobile | `BridgeViewPage.jsx` | 🔴 Critical |
| ConnectionsPage grid stays single column but cards have too many fixed widths | `ConnectionsPage.jsx` | 🟠 High |
| ResonanceProfilePage 3-col layout collapses poorly | `ResonanceProfilePage.jsx` | 🟠 High |
| Landing page hero/grid doesn't scale down | `LandingPage.jsx` | 🟠 High |
| Auth forms: fine on mobile but could be more polished | `LoginForm.jsx` | 🟡 Medium |
| No `meta viewport` enforcement in HTML | `index.html` | 🔴 Critical |
| touch targets too small (< 44px) on toggles and some buttons | many components | 🟠 High |

---

## Design System Additions (index.css)

- Add responsive container utilities
- Add `@media (prefers-reduced-motion: reduce)` to disable heavy animations
- Add mobile-safe `backdrop-filter` with `@supports` guard
- Add CSS variable breakpoint-aware spacing
- Improve accessible focus styles for touch
- Add `scroll-x` keyframe already defined in LandingPage inline → move to global

---

## Proposed Changes

### 1. `index.html` — Viewport Meta
#### [MODIFY] index.html
Ensure proper `<meta name="viewport">` tag.

---

### 2. `index.css` — Design System Expansion
#### [MODIFY] index.css
- Add `--sp-*` spacing scales
- Add responsive helpers
- `@supports (backdrop-filter: blur())` guard for mobile
- `@media (prefers-reduced-motion: reduce)` — disable all animations
- `.container-app` utility for consistent max-width + responsive padding
- `.touch-target` minimum 44px interactive element utility
- Add `line-clamp-6` utility

---

### 3. `Layout.jsx` + `Sidebar.jsx` — Mobile Nav
#### [MODIFY] Layout.jsx
Transform layout to work with a **slide-over drawer** on mobile:
- Use `useState` for `sidebarOpen`
- On mobile: sidebar is an off-canvas drawer with backdrop overlay
- On tablet+: sidebar collapses to **icon-only rail** (56px)
- On desktop: sidebar expands to full 240px
- Pass `sidebarOpen` + `setSidebarOpen` + `isMobile` via context or props

#### [MODIFY] Sidebar.jsx
- Receive `isOpen`, `onClose` props
- Mobile: full slide-in drawer (80vw max, fixed overlay)
- Tablet: icon-only collapsed rail (hover to expand)
- Desktop: full sidebar
- All nav items show label text only on desktop/hover; icons always visible
- Touch targets min 48px height

---

### 4. `JournalEditor.jsx` — Reflective Canvas
#### [MODIFY] JournalEditor.jsx
- Remove fixed `p-8` inner padding → `p-4 sm:p-8`
- Toolbar: wrap to 2 rows on mobile, hide word count on very small screens
- `min-h-[300px]` → `min-h-[200px] sm:min-h-[300px]`
- Discovery toggle + Save button → stack vertically on mobile
- Ghost text "Press Tab" → "Tap ✓ to accept" on mobile (touch-aware)

---

### 5. `BridgeViewPage.jsx` — Mobile Bridge
#### [MODIFY] BridgeViewPage.jsx
- Desktop/tablet: keep existing side-by-side split
- Mobile: **Vertical stack** — context panel collapses into a "slide-up" sheet triggered by a floating indicator button
- Add `useState(showContext)` — on mobile the left panel starts hidden, revealed by tapping a bottom pill button
- Frosted modal overlay for context panel on mobile

---

### 6. `ConnectionsPage.jsx` — Resonance Feed
#### [MODIFY] ConnectionsPage.jsx
- Cards already single-column — ensure padding/spacing is touch-friendly
- Action buttons in each card → min 44px touch targets
- Stats bar → horizontal scroll on mobile

---

### 7. `ResonanceProfilePage.jsx` — Connection Detail
#### [MODIFY] ResonanceProfilePage.jsx
- `grid md:grid-cols-3` → tabs and action rail stack on mobile
- Action rail moves ABOVE the tab content on mobile (so CTA is thumb-reachable)
- Tab bar buttons → `text-xs` label, icon first, min-h touch target

---

### 8. `LandingPage.jsx` — Landing
#### [MODIFY] LandingPage.jsx
- Hero text: `text-7xl` → scale down to `text-4xl` on mobile
- Pricing grid: already `md:grid-cols-3` but padding needs mobile fix
- Ticker: already auto-scroll, fine
- Nav: hamburger menu on mobile

---

### 9. Auth Pages — Polish
#### [MODIFY] `LoginForm.jsx` + `RegisterForm.jsx`
- Already mostly fine; enhance with frosted glass card style matching design system
- Ensure input fields are `text-base` to prevent iOS zoom

---

## Verification Plan

### Automated
```bash
# Check build passes with no errors
cd open-journal && npm run build --prefix client
```

### Manual browser testing
- Chrome DevTools: iPhone SE (375px), iPhone 14 Pro (393px), iPad (768px), MacBook (1440px)
- Verify: sidebar opens/closes, editor scrolls correctly, bridge view stack works on mobile

---

## Open Questions

> [!IMPORTANT]
> **Sidebar behaviour on tablet**: Should the tablet sidebar show icon-only (always visible) or should it use the same slide-over drawer as mobile? The icon-rail approach is recommended for discoverability.

> [!NOTE]
> The PDF design doc mentions "Shake to Lock" and "Face ID to Unlock" — these are native mobile API features not available in a web PWA without significant platform integration. We'll add a note but skip implementation for now. All other responsive/UX items are in scope.
