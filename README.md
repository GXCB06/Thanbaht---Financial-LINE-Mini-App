# Thanbaht v2: design review deliverables

| Path | What it is |
|---|---|
| `DESIGN.md` | Design system v2: tokens (light and dark), category hues, Thai type rules, chart rules. Replaces the Stitch DESIGN.md |
| `prototype/index.html` | Clickable Mini App prototype: Home · Activity · Review (new) · Insights · Detail, plus Add (upload / voice / type) |
| `chat/index.html` | LINE chat mock: nudge, single receipt, batch drop, unknown payee, duplicate, Ask Thanbaht, daily digest, rich menu |
| `chat/flex.js` | **Reusable Flex builders.** Import them in the bot backend: `receipt()`, `batch()`, `askCategory()`, `duplicate()`, `digest()`, `answer()`, `nudge()`, `richMenu` |
| `chat/flex/*.json` | Generated message objects. Paste a file's `contents` into the LINE Flex Message Simulator |
| `chat/build.mjs` | Checks every message against the Flex rules (label lengths, baseline children, hex colours, quick-reply-only actions) and regenerates the JSON |

## Run
```bash
python -m http.server 5178
```
Then open http://localhost:5178/prototype/ and http://localhost:5178/chat/.
The pages use ES modules, so they need a local server. Opening them as `file://` won't work.

To regenerate the Flex JSON after editing `flex.js` or `samples.js`:
```bash
node chat/build.mjs
```

Replace `LIFF` in `chat/flex.js` with your real LIFF ID before sending anything.
