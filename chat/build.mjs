// Writes every sample message to chat/flex/*.json after a structural check
// against the Messaging API's Flex rules.
// Usage: node chat/build.mjs
// Each file is a full message object (what the bot sends). To preview one in
// LINE's Flex Message Simulator, paste only its "contents" value.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES } from './samples.js';
import { richMenu } from './flex.js';

const HEX = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
const SIZES = ['nano', 'micro', 'deca', 'hecto', 'kilo', 'mega', 'giga'];
const COMPONENTS = ['box', 'text', 'button', 'separator', 'image', 'icon', 'span', 'video', 'filler'];
const ACTIONS = ['postback', 'message', 'uri', 'datetimepicker', 'camera', 'cameraRoll', 'location', 'richmenuswitch', 'clipboard'];

function check(name, msg) {
  const errs = [];
  const err = (p, m) => errs.push(`${name} ${p}: ${m}`);
  const action = (a, p, inQuickReply) => {
    if (!ACTIONS.includes(a.type)) err(p, `bad action type ${a.type}`);
    if (['camera', 'cameraRoll', 'location'].includes(a.type) && !inQuickReply) err(p, `${a.type} only works in quick replies`);
    if (a.label && [...a.label].length > 20) err(p, `label > 20 chars: ${a.label}`);
    if (a.type === 'uri' && !/^https:\/\//.test(a.uri)) err(p, 'uri must be https');
    if (a.type === 'postback' && (!a.data || a.data.length > 300)) err(p, 'postback data missing or > 300');
  };
  const comp = (c, p, parentLayout) => {
    if (!COMPONENTS.includes(c.type)) return err(p, `unknown component ${c.type}`);
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (c[k] && !HEX.test(c[k])) err(p, `${k} not hex: ${c[k]}`);
    if (parentLayout === 'baseline' && !['text', 'icon', 'filler', 'span'].includes(c.type)) err(p, `${c.type} not allowed in baseline box`);
    if (c.type === 'text' && !c.text && !c.contents) err(p, 'text is empty');
    if (c.type === 'button') { if (!c.action) err(p, 'button without action'); else action(c.action, p + '.action'); }
    if (c.action && c.type !== 'button') action(c.action, p + '.action');
    if (c.type === 'box') {
      if (!['vertical', 'horizontal', 'baseline'].includes(c.layout)) err(p, `bad layout ${c.layout}`);
      if (!Array.isArray(c.contents)) err(p, 'box.contents must be an array');
      else c.contents.forEach((x, i) => comp(x, `${p}[${i}]`, c.layout));
    }
  };
  const bubble = (b, p) => {
    if (b.type !== 'bubble') return err(p, 'not a bubble');
    if (b.size && !SIZES.includes(b.size)) err(p, `bad size ${b.size}`);
    for (const part of ['header', 'hero', 'body', 'footer']) if (b[part]) comp(b[part], `${p}.${part}`);
  };
  if (msg.type === 'flex') {
    if (!msg.altText || [...msg.altText].length > 400) err('altText', 'missing or > 400 chars');
    const c = msg.contents;
    if (c.type === 'carousel') {
      if (c.contents.length > 12) err('carousel', '> 12 bubbles');
      c.contents.forEach((b, i) => bubble(b, `bubble[${i}]`));
    } else bubble(c, 'bubble');
    if (JSON.stringify(c).length > 30000) err('contents', '> 30 KB');
  }
  if (msg.quickReply) {
    if (msg.quickReply.items.length > 13) err('quickReply', '> 13 items');
    msg.quickReply.items.forEach((it, i) => action(it.action, `quickReply[${i}]`, true));
  }
  return errs;
}

const errors = Object.entries(MESSAGES).flatMap(([n, m]) => check(n, m));
richMenu.areas.forEach((a, i) => {
  if (a.bounds.x + a.bounds.width > richMenu.size.width || a.bounds.y + a.bounds.height > richMenu.size.height) errors.push(`richmenu area ${i} out of bounds`);
});
if ([...richMenu.chatBarText].length > 14) errors.push('richmenu chatBarText > 14 chars');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const out = join(dirname(fileURLToPath(import.meta.url)), 'flex');
mkdirSync(out, { recursive: true });
for (const [name, msg] of Object.entries(MESSAGES)) writeFileSync(join(out, `${name}.json`), JSON.stringify(msg, null, 2) + '\n');
writeFileSync(join(out, 'richmenu.json'), JSON.stringify(richMenu, null, 2) + '\n');
console.log(`OK · checked and wrote ${Object.keys(MESSAGES).length + 1} files to chat/flex/`);
