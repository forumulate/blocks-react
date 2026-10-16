import type { ReactNode } from 'react';
import { h, type HtmlAttrs } from '../h.js';

/**
 * Terminal output as elements — docs-schema `ansi.ts`, for a code block whose
 * language is `ansi`.
 *
 * Coloured at render time, so a reader with JavaScript off sees the colours
 * and the highlighter never meets it (`ansi` is no grammar; the raw `ESC[32m`
 * noise showed). Only SGR colour/weight/style sequences mean anything; every
 * other escape — cursor moves, OSC titles and links — is dropped. A colour
 * reaches a `style` only when it was built from validated integers.
 */

/** The SGR state carried from one line to the next on the split path. */
export interface AnsiState {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const ESCAPES =
  // eslint-disable-next-line no-control-regex -- ESC is the whole point
  /\u001b\[([0-9;]*)([A-Za-z])|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g;

const hex2 = (n: number) => n.toString(16).padStart(2, '0');
const rgb = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** xterm's 256-colour cube and grey ramp, for `38;5;n` past the first 16. */
function xterm256(n: number): string {
  if (n < 16) return `c${n}`;
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return rgb(v, v, v);
  }
  const i = n - 16;
  const step = (k: number) => (k === 0 ? 0 : 55 + k * 40);
  return rgb(step(Math.floor(i / 36)), step(Math.floor(i / 6) % 6), step(i % 6));
}

const byte = (v: number | undefined): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 255;

function applySgr(codes: number[], s: AnsiState): void {
  if (codes.length === 0) codes = [0];
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i]!;
    if (c === 0) {
      for (const k of Object.keys(s)) delete (s as Record<string, unknown>)[k];
    } else if (c === 1) s.bold = true;
    else if (c === 2) s.dim = true;
    else if (c === 3) s.italic = true;
    else if (c === 4) s.underline = true;
    else if (c === 22) s.bold = s.dim = false;
    else if (c === 23) s.italic = false;
    else if (c === 24) s.underline = false;
    else if (c === 39) delete s.fg;
    else if (c === 49) delete s.bg;
    else if (c >= 30 && c <= 37) s.fg = `c${c - 30}`;
    else if (c >= 90 && c <= 97) s.fg = `c${c - 90 + 8}`;
    else if (c >= 40 && c <= 47) s.bg = `c${c - 40}`;
    else if (c >= 100 && c <= 107) s.bg = `c${c - 100 + 8}`;
    else if (c === 38 || c === 48) {
      const mode = codes[i + 1];
      let colour: string | undefined;
      if (mode === 5 && byte(codes[i + 2])) {
        colour = xterm256(codes[i + 2]!);
        i += 2;
      } else if (mode === 2 && byte(codes[i + 2]) && byte(codes[i + 3]) && byte(codes[i + 4])) {
        colour = rgb(codes[i + 2]!, codes[i + 3]!, codes[i + 4]!);
        i += 4;
      } else {
        i = codes.length; // malformed: ignore the rest of the sequence
      }
      if (colour) {
        if (c === 38) s.fg = colour;
        else s.bg = colour;
      }
    }
  }
}

/** The span attributes for a state, or null when it says nothing. */
function openAttrs(s: AnsiState): HtmlAttrs | null {
  const cls: string[] = [];
  const style: string[] = [];
  if (s.fg) {
    if (s.fg.startsWith('c')) cls.push(`cf-ansi-fg-${s.fg.slice(1)}`);
    else style.push(`color:${s.fg}`);
  }
  if (s.bg) {
    if (s.bg.startsWith('c')) cls.push(`cf-ansi-bg-${s.bg.slice(1)}`);
    else style.push(`background-color:${s.bg}`);
  }
  if (s.bold) cls.push('cf-ansi-b');
  if (s.dim) cls.push('cf-ansi-dim');
  if (s.italic) cls.push('cf-ansi-i');
  if (s.underline) cls.push('cf-ansi-u');
  if (!cls.length && !style.length) return null;
  return { class: cls.length ? cls.join(' ') : null, style: style.length ? style.join(';') : null };
}

/**
 * One run of terminal text as nodes. `state` is read and updated in place, so
 * the split path can colour line by line and still carry a colour opened on
 * one line into the next. A run between two SGR sequences is one span (an
 * empty one too — the hosted string opens and closes it all the same).
 */
export function ansiNodes(text: string, state: AnsiState = {}): ReactNode[] {
  const out: ReactNode[] = [];
  let open = openAttrs(state);
  let buf = '';
  const flush = () => {
    if (open) out.push(h('span', open, buf));
    else if (buf) out.push(buf);
    buf = '';
  };
  let last = 0;
  ESCAPES.lastIndex = 0;
  for (let m = ESCAPES.exec(text); m; m = ESCAPES.exec(text)) {
    buf += text.slice(last, m.index);
    last = m.index + m[0].length;
    if (m[2] !== 'm' || m[1] === undefined) continue; // not SGR: dropped
    const codes = m[1]
      .split(';')
      .filter((p) => p !== '')
      .map((p) => Number(p))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 255);
    flush();
    applySgr(m[1] === '' ? [0] : codes, state);
    open = openAttrs(state);
  }
  buf += text.slice(last);
  flush();
  return out;
}
