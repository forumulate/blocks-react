import type { ReactNode } from 'react';
import { h, list } from '../h.js';
import { mediaSrc, src as srcAttr } from '../url.js';
import type { Attrs } from '../types.js';
import type { BlockRenderer } from './types.js';

/**
 * The video block — docs-schema `render-section-look.ts` `renderVideo`, with
 * `video-lesson.ts` (chapters, transcript, speed) and `lesson-words.ts`.
 *
 * Everything here is our own markup around a plain `<video>`: no player
 * script, no third-party request. A WebVTT transcript also rides along inert
 * in a `<template>` so a script can turn it into the captions track without
 * the owner hosting a second file.
 *
 * Course defaults (docs-schema's `ctx.lesson`) are a hosted-course concept with
 * no option here, so a video behaves as it does outside a lesson: only what its
 * own block asks for, and words in English (`data-lw-lang="en"`, which a
 * script may rewrite per `[data-lw]` for the page's language).
 */

// ---- closed lists (constants-parity checks them against docs-schema) ------

/** The aspect ratios a video may take (block-style.ts VIDEO_RATIOS), as CSS. */
export const VIDEO_RATIO_CSS: Record<string, string> = {
  '16:9': '16 / 9',
  '4:3': '4 / 3',
  '1:1': '1 / 1',
  '9:16': '9 / 16',
  '21:9': '21 / 9',
};
/** Bounds the schema holds a lesson video to (video-lesson.ts). */
export const VIDEO_MAX_CHAPTERS = 100;
/** The rates the speed row offers (video-lesson.ts). */
export const VIDEO_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** The words a lesson video and a knowledge check print, in the five reader languages (lesson-words.ts). */
export const LESSON_WORDS = {
  en: {
    chapters: 'Chapters',
    transcript: 'Transcript',
    searchTranscript: 'Search the transcript',
    speed: 'Playback speed',
    check: 'Check answer',
    correct: 'Correct.',
    incorrect: 'Not quite — try again.',
    pickOne: 'Choose an answer first.',
    revealSolution: 'Reveal the solution',
    knowledgeCheck: 'Knowledge check',
  },
  es: {
    chapters: 'Capítulos',
    transcript: 'Transcripción',
    searchTranscript: 'Buscar en la transcripción',
    speed: 'Velocidad de reproducción',
    check: 'Comprobar respuesta',
    correct: 'Correcto.',
    incorrect: 'No del todo; inténtalo de nuevo.',
    pickOne: 'Elige primero una respuesta.',
    revealSolution: 'Ver la solución',
    knowledgeCheck: 'Comprueba lo aprendido',
  },
  fr: {
    chapters: 'Chapitres',
    transcript: 'Transcription',
    searchTranscript: 'Rechercher dans la transcription',
    speed: 'Vitesse de lecture',
    check: 'Vérifier la réponse',
    correct: 'Exact.',
    incorrect: 'Pas tout à fait — réessayez.',
    pickOne: 'Choisissez d’abord une réponse.',
    revealSolution: 'Afficher la solution',
    knowledgeCheck: 'Vérifiez vos acquis',
  },
  de: {
    chapters: 'Kapitel',
    transcript: 'Transkript',
    searchTranscript: 'Im Transkript suchen',
    speed: 'Wiedergabegeschwindigkeit',
    check: 'Antwort prüfen',
    correct: 'Richtig.',
    incorrect: 'Nicht ganz – versuch es noch einmal.',
    pickOne: 'Wähle zuerst eine Antwort.',
    revealSolution: 'Lösung anzeigen',
    knowledgeCheck: 'Wissenscheck',
  },
  pt: {
    chapters: 'Capítulos',
    transcript: 'Transcrição',
    searchTranscript: 'Pesquisar na transcrição',
    speed: 'Velocidade de reprodução',
    check: 'Verificar resposta',
    correct: 'Correto.',
    incorrect: 'Ainda não — tente de novo.',
    pickOne: 'Escolha uma resposta primeiro.',
    revealSolution: 'Mostrar a solução',
    knowledgeCheck: 'Verifique o que aprendeu',
  },
} as const;

export type LessonWordKey = keyof (typeof LESSON_WORDS)['en'];

/** A word in `locale` (`fr`, `pt-BR` …), English when the language is not one of the five. */
export function lessonWord(key: LessonWordKey, locale?: string | null): string {
  const lang = (locale ?? 'en').slice(0, 2).toLowerCase() as keyof typeof LESSON_WORDS;
  return (LESSON_WORDS[lang] ?? LESSON_WORDS.en)[key];
}

// ---- transcript and timestamps (video-lesson.ts) ---------------------------

interface TranscriptCue {
  at: number | null;
  text: string;
}

/** `75` → `1:15`, `3725` → `1:02:05` — how every timestamp on the page is spelt. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function parseTimestamp(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(t);
  if (!m) return null;
  const [, hh, min, sec, ms] = m;
  return Number(hh ?? 0) * 3600 + Number(min) * 60 + Number(sec) + (ms ? Number(`0.${ms}`) : 0);
}

function isWebVtt(text: unknown): boolean {
  return typeof text === 'string' && /^\uFEFF?WEBVTT\b/.test(text.trimStart());
}

const VTT_TIMING = /^((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s+-->\s+/;
/** Tags a cue may carry (`<v Ada>`, `<i>`, `<00:01.000>`) — dropped from the words shown. */
const VTT_TAG = /<[^>]*>/g;

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

/**
 * A transcript as cues. WebVTT keeps each cue's start (a line can seek the
 * player); plain text is one cue per paragraph, untimed — unless a line opens
 * with a timestamp (`0:42 Now we…`, the pasted-YouTube habit).
 */
function parseTranscript(text: string | null | undefined): TranscriptCue[] {
  if (!text || !text.trim()) return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (isWebVtt(text)) {
    const cues: TranscriptCue[] = [];
    for (let i = 0; i < lines.length; i++) {
      const m = VTT_TIMING.exec(lines[i]!.trim());
      if (!m) continue;
      const words: string[] = [];
      while (i + 1 < lines.length && lines[i + 1]!.trim() !== '') words.push(lines[++i]!.trim());
      const said = words.join(' ').replace(VTT_TAG, '').replace(/\s+/g, ' ').trim();
      if (said) cues.push({ at: parseTimestamp(m[1]!), text: decodeEntities(said) });
    }
    return cues;
  }
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n(?=\[?\d{1,2}:\d{2})/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((block) => {
      const m = /^\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s+(.*)$/.exec(block);
      const at = m ? parseTimestamp(m[1]!) : null;
      return at !== null && m ? { at, text: m[2]! } : { at: null, text: block };
    });
}

/** What a video does as a lesson: with no course defaults, only what the block asks. */
function videoBehaviour(a: Attrs) {
  return {
    speed: a.speed ?? false,
    resume: a.resume ?? false,
    transcriptOpen: (a.transcriptOpen ?? false) === true,
    // Only a course lesson has something to complete.
    completeAt: 0,
  };
}

/** The figure's own data attributes for a lesson video; none for a plain one. */
function videoLessonAttrs(a: Attrs) {
  const b = videoBehaviour(a);
  const any = b.speed || b.resume || b.completeAt > 0 || (a.chapters?.length ?? 0) > 0 || !!a.transcript;
  if (!any) return {};
  return { 'data-video-lesson': '', 'data-resume': b.resume ? '' : null, 'data-lw-lang': 'en' };
}

/**
 * What a lesson video adds inside its figure, after the `<video>`: the speed
 * row, the chapter list and the transcript. Every control is a real
 * `<button>` (`data-seek`, `data-rate`); the transcript is a native
 * `<details>` whose words are in the server HTML for search and screen readers.
 */
function videoLessonParts(a: Attrs): ReactNode[] {
  const b = videoBehaviour(a);
  const w = (k: LessonWordKey) => lessonWord(k);
  const parts: ReactNode[] = [];
  if (b.speed)
    parts.push(
      h(
        'div',
        { class: 'doc-video-speed', role: 'group', 'aria-label': w('speed'), 'data-lw': 'speed', 'data-lw-attr': 'aria-label' },
        list(
          VIDEO_RATES.map((rate) =>
            h('button', { type: 'button', 'data-rate': rate, 'aria-pressed': rate === 1 ? 'true' : 'false' }, `${rate}×`),
          ),
        ),
      ),
    );
  const chapters = ((a.chapters ?? []) as Attrs[]).filter((c) => c.title.trim()).slice(0, VIDEO_MAX_CHAPTERS);
  if (chapters.length)
    parts.push(
      h(
        'nav',
        { class: 'doc-video-chapters', 'aria-label': w('chapters'), 'data-lw': 'chapters', 'data-lw-attr': 'aria-label' },
        h(
          'ol',
          null,
          list(
            chapters.map((c) =>
              h(
                'li',
                null,
                h(
                  'button',
                  { type: 'button', 'data-seek': String(Math.floor(c.at)) },
                  h('span', { class: 'doc-video-t' }, formatTimestamp(c.at)),
                  h('span', null, String(c.title)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  const cues = parseTranscript(a.transcript);
  if (cues.length)
    parts.push(
      h(
        'details',
        { class: 'doc-video-transcript', open: b.transcriptOpen },
        h('summary', { 'data-lw': 'transcript' }, w('transcript')),
        h('input', {
          type: 'search',
          class: 'doc-video-find',
          placeholder: w('searchTranscript'),
          'aria-label': w('searchTranscript'),
          'data-lw': 'searchTranscript',
          'data-lw-attr': 'placeholder aria-label',
        }),
        h(
          'div',
          { class: 'doc-video-cues' },
          list(
            cues.map((c) =>
              c.at === null
                ? h('p', null, c.text)
                : h(
                    'p',
                    { 'data-at': String(c.at) },
                    h('button', { type: 'button', class: 'doc-video-t', 'data-seek': String(c.at) }, formatTimestamp(c.at)),
                    ` ${c.text}`,
                  ),
            ),
          ),
        ),
      ),
    );
  // The captions: the WebVTT itself, inert in a <template> (never parsed as
  // markup, never executed), which a script turns into the <track>.
  if (isWebVtt(a.transcript)) parts.push(h('template', { class: 'doc-video-vtt' }, a.transcript as string));
  return parts;
}

/**
 * A video, as a figure. `controls` is on unless the author turned it off AND
 * it autoplays — a video with neither cannot be started. `autoplay` implies
 * `muted` (no browser autoplays sound) and is marked `data-autoplay`, so a
 * script can pause it for somebody who asked for reduced motion. A src the
 * schema would refuse renders as nothing rather than a broken player.
 */
const video: BlockRenderer = (node, r) => {
  const a = node.attrs as Attrs;
  const proxy = r.s.opts.imageProxy;
  const source = mediaSrc(a.src, proxy);
  if (!source) return null;
  const autoplay = a.autoplay === true;
  const controls = a.controls !== false || !autoplay;
  const muted = autoplay || a.muted === true;
  const poster = a.poster ? srcAttr(a.poster, proxy) : '';
  const ratio = a.aspectRatio && VIDEO_RATIO_CSS[a.aspectRatio] ? VIDEO_RATIO_CSS[a.aspectRatio]! : '16 / 9';
  const caption: string | undefined = a.caption?.trim();
  return h(
    'figure',
    { class: 'doc-video', style: `--doc-video-ratio:${ratio}`, ...videoLessonAttrs(a) },
    h('video', {
      src: source,
      poster: poster || null,
      controls,
      autoplay,
      'data-autoplay': autoplay ? '' : null,
      muted,
      loop: a.loop === true,
      playsinline: true,
      preload: autoplay ? 'auto' : 'metadata',
    }),
    // Chapters, transcript, speed: nothing for a video that has none of them.
    list(videoLessonParts(a)),
    caption ? h('figcaption', null, caption) : null,
  );
};

export const VIDEO: Record<string, BlockRenderer> = { video };
