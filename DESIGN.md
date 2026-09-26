---
name: Thanbaht (ธัญบาท) — Design System v2
version: 2.0
supersedes: DESIGN.md v1 (Google Stitch export)
---

# Thanbaht Design System v2

v2 keeps v1's personality (calm, warm minimal, LINE-native) and fixes the
inconsistencies found in the Stitch screens: two mixed design languages,
three different "income greens", iOS system colours, contrast failures, and Thai
typography broken by negative tracking.

**Product north star:** *Drop your slips, walk away. Thanbaht handles it, and asks only when it's unsure.*
Each surface answers one question:

| Surface | Question it answers |
|---|---|
| LINE chat (Flex replies, rich menu, digest) | "Did it get logged?" and "What do you need from me?" |
| Overview | "Am I OK right now, and what needs me?" |
| Review | "What did the bot not understand?" |
| Transactions | "What exactly happened?" |
| Insights | "Why, and what should I change?" |

---

## 1. Platform rules (LINE Mini App)

- **Never draw our own ⋯ / ✕ header.** LINE renders the native Mini App header. Our page starts with the large page title.
- **Never draw a fake status bar or Dynamic Island.**
- Respect `env(safe-area-inset-bottom)` under the tab bar.
- Mobile first, fluid width, and a max content width of 480px on tablet or desktop.
- Language comes from `liff.getLanguage()`: Thai (`th`) or English. Every label needs both.
- Follow LINE's light and dark appearance (`prefers-color-scheme`) and allow a manual override.

## 2. Colour tokens

Every colour is a CSS custom property. Components never use raw hex values.

### Core
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F5F6F4` | `#0F110F` | Canvas |
| `--surface` | `#FFFFFF` | `#181B18` | Cards, sheets |
| `--surface-2` | `#F0F2EF` | `#202420` | Inset fields, chips, tracks |
| `--surface-3` | `#E7EAE6` | `#2A2F2A` | Neutral chart bars, pressed states |
| `--border` | `#E3E7E2` | `#2A2F2A` | Hairlines |
| `--ink` | `#171917` | `#F1F3F0` | Primary text and amounts |
| `--ink-2` | `#565B56` | `#C4C9C3` | Secondary text |
| `--muted` | `#6F746F` | `#9BA29A` | Meta text. **Lightest colour allowed for text** (≥4.5:1) |

> v1's `#BBCBB8` "outline-variant" text (for example "2 deposits" and axis labels) is **banned for text**. It measures about 1.7:1.

### Brand & semantic
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | `#06C755` | `#1FD36A` | LINE green: active tab, selected chart mark, icons, focus ring |
| `--brand-strong` | `#00863C` | `#1FD36A` | **Filled primary buttons** (white text, 4.7:1). In dark mode the text is `#04210F` |
| `--brand-soft` | `#E6F9EE` | `#11301E` | Success chips, "Verified" pill |
| `--income` | `#15803D` | `#4ADE80` | Income amounts. **The only income green** |
| `--expense` | `#B94444` | `#F08A8A` | Expense totals in summaries only |
| `--good` / `--bad` | = income / expense | | Deltas, coloured by *meaning*, never by arrow direction |
| `--warn` / `--warn-soft` | `#9A5B00` / `#FFF3DC` | `#F5B84A` / `#33270F` | "Needs review" |
| `--ai` / `--ai-soft` | `#4A63E0` / `#EEF1FF` | `#9FB0FF` / `#1E2442` | Mascot / AI voice (tips, "See why", review prompts) |

**Amount colour rule**
- In lists, **expense amounts use `--ink`** (calm, not alarming) and income uses `--income` with a `+` prefix.
- **Transfers** between your own accounts use `--muted`, have no sign, and are labelled "not counted".
- `--expense` coral is only for aggregate totals such as "Spent" in summaries.
- Use a real minus sign (U+2212 `−`), never a hyphen.

**Deltas:** "Spending down 12%" is *good*, so it's green with an icon and a word ("less"). Colour is never the only signal.

### Category hues (identity, not status)
Each category keeps the same hue in the list icon, the category bar and every chart. These are the validated data-viz categorical slots. Never cycle them or generate new ones; a 7th category folds into "Other".

| Category | Light | Dark | Icon |
|---|---|---|---|
| Food & Dining | `#EB6834` | `#D95926` | utensils |
| Groceries | `#EDA100` | `#C98500` | cart |
| Transport | `#2A78D6` | `#3987E5` | car |
| Shopping | `#E87BA4` | `#D55181` | bag |
| Bills & Utilities | `#4A3AA7` | `#9085E9` | zap |
| Entertainment | `#1BAF7A` | `#199E70` | film |
| Income / Transfer / Unknown | `--income` / `--muted` / `--warn` | | banknote / arrows / help |

Icon tiles use the hue at 14% over the surface (`color-mix`) with the icon drawn at full hue.
**Text never takes the category colour.**

### Bank badges
These are small identity badges (16px, radius 5) with the bank's short label: K · SCB · KTB · TM · ฿.
They are never the only way to identify a bank: the account name appears on the Detail screen.

## 3. Typography

```css
font-family: "LINE Seed Sans TH", "Inter", "Noto Sans Thai", system-ui, sans-serif;
```
- Production font: **LINE Seed Sans TH** (LINE's free brand font with Latin and Thai, self-hosted). Prototype fallback: Inter + Noto Sans Thai.
- **No SF Pro stacks.** Most Thai LINE users are on Android, where SF Pro falls back to Roboto.
- **Thai text uses letter-spacing 0 and line-height ≥ 1.5**, because stacked vowels and tone marks clip. Negative tracking is allowed **only on numerals** (`.num`).
- **All amounts use `font-variant-numeric: tabular-nums`.**
- **Time is always 24h:** `12:42` in English, `12:42 น.` in Thai. Never write "18:30 PM".
- Dates in the app use the CE year (`23 Sep 2026`). Slip previews keep the bank's BE format (`23/09/69`), since that is what the source document says.

| Style | Size / line-height | Weight | Use |
|---|---|---|---|
| display | 34 / 40 | 700 | Hero number (1 per screen) |
| title | 26 / 32 | 700 | Page title |
| headline | 17 / 24 | 600 | Card titles |
| body | 15 / 22 | 400 | Rows |
| meta | 13 / 18 | 400 | Row subtitles, timestamps |
| label | 12 / 16 | 600, +0.02em (Latin only) | Eyebrows, chips |

## 4. Layout, shape, elevation

- Spacing base 4px: 4 · 8 · 12 · 16 · 24 · 32. Screen gutter 16px. Cards are 24px apart.
- Radii: card 18, button 14, input 12, icon tile 12, chip is a full pill.
- Elevation: cards use a hairline border plus `0 1px 3px rgba(23,25,23,.04), 0 4px 12px rgba(23,25,23,.03)`. Sheets sit over a backdrop of `rgba(23,25,23,.4)`.
- Minimum tap target 44×44.

## 5. Components

- **Row:** 40px category icon tile · name (15/600) · meta line with `Category · 12:42` plus a bank badge and a source icon (slip / voice / text) · amount on the right. Review rows carry a warn pill.
- **Provenance pill** (Detail), with honest wording:
  - `✓ Verified · QR ref matched` only after the slip's QR/transRef has been checked
  - `Read from slip` for OCR only
  - `From voice note` with the transcript quoted
  - `Typed in chat` with the text quoted
- **Bottom sheet** for every edit (category picker, split bill, add). No full-page edit forms.
- **Undo toast** after any destructive or automatic action. Never use a confirm dialog when undo is possible.
- **Mascot (periwinkle wallet)** appears only when the AI speaks: the review banner, insight tips and empty states. It's never decoration.
- **Privacy toggle (eye icon):** blurs every amount (`.money`) for use in public.

## 6. Charts

These follow the data-viz method: form first, colour last, one axis, thin marks, and a hover tooltip on every chart.

- **Daily spend is discrete, so use bars**, not smoothed splines, which invent values and dip below zero.
- **Cumulative lines use straight or monotone segments.** Income is a **step** line (deposits are lumpy).
- **The y-max comes from the data**, rounded up to a nice tick. A label is never allowed to exceed the axis.
- **Weekday patterns use averages per weekday** (months have 4 or 5 of each day), excluding unlogged days.
- Value labels sit in an **overlay**. They never take height from the bar they describe.
- Unlogged past days are drawn as a dotted `?` stub, and future days as a dashed outline. Missing data is never shown as zero spend.
- The highlight colour is `--brand`, other bars are `--surface-3`, and the comparison line is `--muted` dashed.

## 7. Content & voice

- Speak like a calm friend. Thai first, with English on toggle. Example: "ขอเช็ก 2 รายการนะ" / "2 things need a quick look."
- Never say "Sync active". Show freshness instead: "Last slip 19:40".
- Only use a number if it's computed from the same source as everywhere else. **Each metric is computed in one place.**
- Keep the brand name consistent: **Thanbaht (ธัญบาท)**.
