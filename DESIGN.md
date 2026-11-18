# Vistazo: visual system

A work tool ("operate" mode): calm, readable, with a clear hierarchy. The brand lives in the details (the orange dot in
the logo, the orange of the main action). Tokens in `src/app/globals.css`; base components in `src/components/ui.tsx`.

## Color

Light and dark, following the system. Color only carries meaning:

| Token | Use | Contrast (light / dark) |
|---|---|---|
| `accent` / `on-accent` | Main action (one per screen), pins, focus | 5.2 / 8.5 |
| `warn` / `warnbg` | Your turn to fix: with comments, changes requested, warnings | 6.4 / 10.1 |
| `ok` / `okbg` | Approved, "works" | 6.5 / 10.2 |
| `bad` / `badbg` | Fails, revoke, errors | 5.3 / 8.5 |
| `muted` | Secondary text | ≥ 5.4 on any background |
| `field` | Border of fields and buttons | 3.3 (≥ 3:1 for controls) |
| `info` / `infobg` | Open review not yet reviewed (list icon) | |
| `accent-soft` | Soft selection (active screen, active filter) | |
| `ink`, `paper`, `card`, `sunken`, `line`, `neutral` | Neutrals (cool greys) | |
| `--k-<color>` | Test kit data types: orange, green, violet, blue, ink, ochre, grey, red | |

## Review states

The `StateLabel` badge, always the same: Pending review (neutral), With comments / Changes requested (amber), Approved
(green), Closed (grey).

## Structure (inspired by GitHub, not a copy)

- Page header in a white band with title, state, meta and **underlined tabs** (`.tabs`, with `.count`).
- Boxes with a header (`.box`, `.box-head`) for the description and checks; a timeline with icons in circles.
- A sidebar of small sections (`.side-title`) separated by a line.
- Avatars with initials and a stable color per name; the agent is "AI" in ink; guests get a dashed border.
- On mobile, everything goes in one column; the next step moves to the top.

## Buttons

- `btn-primary` (orange): the main action. One per screen.
- `btn-strong` (ink): strong actions inside a tool (comment).
- `btn`: secondary. `btn-quiet`: tertiary. `btn-danger`: remove, revoke.
- Minimum height 36px (32px for `btn-sm`); pins with a 40px touch area.

## Type and spacing

Geist and Geist Mono (only for code, branches and test data). Scale: 12 / 13 / 14 / 15 / 16 / 20 / 28. Two weights:
regular and semibold. Spacing in multiples of 4.

## Shape

Controls 8px, surfaces 12px, badges and pins fully round. Shadows only on floating layers (dialogs, menus, pins).

## Rules

- No long dashes in UI text, no emoji as icons (Phosphor), no uppercase labels above titles.
- Dialogs use the native `<dialog>` (`Sheet`): Esc, trapped focus, inert background.
- Motion only as feedback (dialog entrance), respecting `prefers-reduced-motion`.
