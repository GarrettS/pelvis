# Style Guide — PRI Pelvis

Project-specific design decisions. Code standards are in `~/.web-xp/code-guidelines.md`; this file defines the visual and tonal identity of this project.

---

## Theme Palette

Light mode (`:root` default):
```css
--bg: #ffffff; --surface: #f5f5f0; --surface2: #eaeae5; --border: #d0d0c8;
--text: #1a1a1a; --text-dim: #6b6b6b;
--accent: #1a7a5a; --accent-dim: #b0d8c8; --accent-bg: #e8f5ef;
--warn: #b87a20; --warn-bg: #fdf3e0;
--error: #c03030; --error-bg: #fde8e8;
--inlet: #2a6a9a; --outlet: #9a5a2a;
--green: #2a7a4a; --red: #a03030;
```

Dark mode (`@media (prefers-color-scheme: dark)` on `:root`):
```css
--bg: #1a1c1b; --surface: #242826; --surface2: #2e3230; --border: #3a403e;
--text: #d4dbd6; --text-dim: #7a8a82;
--accent: #3aaa80; --accent-dim: #2a6a50; --accent-bg: #1a2e24;
--warn: #d49540; --warn-bg: #2a2218;
--error: #d05050; --error-bg: #2a1818;
--inlet: #5ea8d4; --outlet: #d4815e;
--green: #5a9a5a; --red: #b05555;
```

## Typography

Font stacks:
- Sans: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- Serif: `Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif`
- Mono: `ui-monospace, 'Cascadia Code', 'SF Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, monospace`

Font scale:
```css
--text-xs: clamp(0.75rem, 0.7rem + 0.2vw, 0.875rem);
--text-sm: clamp(0.875rem, 0.82rem + 0.25vw, 1.0625rem);
--text-base: clamp(1rem, 0.92rem + 0.35vw, 1.1875rem);
--text-lg: clamp(1.0625rem, 0.95rem + 0.45vw, 1.3125rem);
--text-xl: clamp(1.125rem, 1rem + 0.5vw, 1.4375rem);
--text-2xl: clamp(1.5rem, 1.2rem + 1vw, 2.25rem);
```

## Responsive Breakpoints

- Tables stack as cards below 600px.
- Tab bar scrolls horizontally on mobile — no wrapping.
- Images: `max-width: 100%; height: auto`. Hotspot overlays use percentage-based positioning.

## Tone

Clinical and direct. "Correct." — not "Great job!" No exclamation points in feedback. Professional continuing-education tone.
