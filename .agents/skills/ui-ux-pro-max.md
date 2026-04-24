# UI/UX Pro Max — Design Intelligence (Quick Reference)

Comprehensive design guide for web and mobile applications. Apply these rules when building or reviewing any UI for MeepleBase.

> Note: This is the reference-only version. Python scripts from the original skill are not available in this environment — use the Quick Reference below directly.

## When to Apply

Use these rules whenever the task involves **UI structure, visual design decisions, interaction patterns, or UX quality**.

- New pages or screens
- Creating or refactoring components (buttons, modals, forms, cards, etc.)
- Choosing colors, typography, spacing, layout
- Reviewing UI code for accessibility or visual consistency
- Navigation structures, animations, responsive behavior

## Rule Priority Overview

| Priority | Category | Impact | Key Checks |
|----------|----------|--------|------------|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels |
| 2 | Touch & Interaction | CRITICAL | Min 44×44px, 8px+ spacing, Loading feedback |
| 3 | Performance | HIGH | WebP/AVIF, Lazy loading, CLS < 0.1 |
| 4 | Style Selection | HIGH | Match product type, Consistency, SVG icons (no emoji) |
| 5 | Layout & Responsive | HIGH | Mobile-first, No horizontal scroll |
| 6 | Typography & Color | MEDIUM | Base 16px, Line-height 1.5, Semantic tokens |
| 7 | Animation | MEDIUM | 150–300ms, transform/opacity only |
| 8 | Forms & Feedback | MEDIUM | Visible labels, Error near field, Loading states |
| 9 | Navigation Patterns | HIGH | Predictable back, Bottom nav ≤5 |
| 10 | Charts & Data | LOW | Legends, Tooltips, Accessible colors |

---

## 1. Accessibility (CRITICAL)

- Minimum 4.5:1 contrast ratio for normal text (3:1 for large text)
- Visible focus rings on all interactive elements (2–4px)
- Descriptive alt text for meaningful images
- `aria-label` for icon-only buttons
- Tab order matches visual order; full keyboard support
- Use `<label>` with `for` attribute on all form fields
- Don't convey information by color alone — add icon/text
- Respect `prefers-reduced-motion` — reduce/disable animations when requested
- Provide cancel/back in modals and multi-step flows

## 2. Touch & Interaction (CRITICAL)

- Min tap target: 44×44pt (Apple) / 48×48dp (Material)
- Minimum 8px gap between touch targets
- Use click/tap for primary actions — never rely on hover alone
- Disable button during async operations; show spinner
- Add `cursor-pointer` to clickable elements
- Use `touch-action: manipulation` to reduce 300ms delay
- Visual feedback within 100ms of tap

## 3. Performance (HIGH)

- Use `next/image` with `width`/`height` to prevent CLS
- Lazy load below-fold images (`loading="lazy"`)
- Use `next/dynamic` for heavy components (charts, map, etc.)
- Virtualize lists with 50+ items
- Use skeleton screens for >1s operations, not spinners
- Debounce/throttle scroll, resize, and input events

## 4. Style Selection (HIGH)

- Use one icon set throughout (Lucide is used in this project)
- No emoji as icons
- Consistent shadow scale: cards < sheets < modals
- One primary CTA per screen; secondary actions subordinate
- Hover/pressed/disabled states must be visually distinct

## 5. Layout & Responsive (HIGH)

- Mobile-first, breakpoints: 375 / 768 / 1024 / 1440
- Min 16px body text on mobile (prevents iOS auto-zoom)
- No horizontal scroll on mobile
- 4pt/8dp spacing system (use Tailwind's scale)
- All page wrappers: `min-h-[calc(100dvh-72px)]` (MeepleBase nav rule)
- Inputs in flex containers: always `min-w-0`
- Use `min-h-dvh` not `100vh` on mobile

## 6. Typography & Color (MEDIUM)

- Line-height 1.5–1.75 for body text
- Limit line length: 35–60 chars mobile, 60–75 chars desktop
- Bold headings (600–700), Regular body (400), Medium labels (500)
- Use semantic color tokens, not raw hex in components
- MeepleBase tokens: primary=amber/orange, accent=green, text=slate

## 7. Animation (MEDIUM)

- Duration: 150–300ms for micro-interactions; ≤400ms for complex transitions
- Use `transform` and `opacity` only — never animate `width`/`height`/`top`/`left`
- Ease-out for entering elements; ease-in for exiting
- Exit animations: ~60–70% of enter duration
- Every animation must express cause-effect — no purely decorative motion
- Stagger list/grid entrances: 30–50ms per item

## 8. Forms & Feedback (MEDIUM)

- Every input needs a visible label (not placeholder-only)
- Show errors below the related field with clear cause + fix
- Auto-focus first invalid field after submit error
- Loading state → success/error state on all async actions
- Auto-dismiss toasts in 3–5 seconds
- Confirm before destructive actions
- Validate on blur, not on keystroke

## 9. Navigation Patterns (HIGH)

- Bottom nav: max 5 items, always icon + label
- Back navigation must be predictable and preserve scroll/state
- Current location visually highlighted in nav
- No `backdrop-blur` on fixed nav (Android Chrome bug — MeepleBase rule)
- Fixed nav: `translateZ(0)` + `willChange: transform` for GPU layer
- Nav indicator always in DOM (toggle color, don't mount/unmount)

## 10. Charts & Data (LOW)

- Match chart type to data (trend → line, comparison → bar, proportion → donut)
- Always show legend; provide tooltips on interact
- Don't rely on color alone to convey data meaning
- Skeleton placeholder while chart data loads

---

## MeepleBase-Specific Design Rules

- **Fonts**: Fraunces (Display/headings) + Instrument Sans (body)
- **Primary color**: Amber/Orange `#E8821A`
- **Accent**: Green `#3DB87A`
- **Border radius**: 12–16px for cards, 8px for buttons
- **Game covers**: always prominent, use `next/image` with fixed aspect ratio
- **Empty states**: motivating, not sad — show icon + action button
- **Status badges**: owned=gray, wishlist=blue, for_sale=green, want_to_play=purple, for_trade=orange
