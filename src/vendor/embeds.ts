/**
 * What an `embed` block may frame, and how tightly.
 *
 * Two doors, and only two:
 *
 *  1. A KNOWN PROVIDER — a URL this file recognises (a YouTube watch link, a
 *     Calendly booking page, a Spotify track) mapped to that provider's own
 *     embed address. Every origin this can produce is in
 *     `EMBED_FRAME_ORIGINS`, which the reader CSP names in `frame-src`.
 *  2. An origin the OWNER DECLARED (`theme.frameOrigins`) — "I trust this
 *     host; frame it". The URL is framed as written. The same list reaches
 *     `frame-src` on every address the space is served on, so the renderer and
 *     the policy agree by construction.
 *
 * Anything else degrades to a plain link, which is what every embed used to do
 * for a provider nobody had added here.
 *
 * Every frame is sandboxed. The flags are per provider and minimal: a gist
 * render needs no script at all, a video needs script and its own storage, a
 * booking form needs to submit. None of them gets `allow-top-navigation` — a
 * frame inside a customer's documentation never gets to navigate the page it
 * sits in. `allow-same-origin` here means the FRAME's own origin (a cross-origin
 * frame keeps its cookies so its player or login works); it never grants access
 * to the reader page around it, which is a different origin.
 *
 * Kept dependency-free and pure so it runs on the server renderer and in tests.
 */

/** A resolved frame: what to load, and what it is allowed to do. */
export interface EmbedFrame {
  /** Short provider id, also the `data-embed-provider` hook for sizing CSS. */
  provider: string;
  /** The iframe `src`. Always https. */
  src: string;
  /** Space-separated sandbox tokens. Never empty of meaning: `''` is "nothing". */
  sandbox: string;
  /** Permissions-Policy `allow` list for the frame. */
  allow: string;
  /** Accessible name for the frame. */
  title: string;
  referrerPolicy: 'strict-origin-when-cross-origin' | 'no-referrer';
}

// Sandbox sets, named for what they let a frame do.
const POPUPS = 'allow-popups allow-popups-to-escape-sandbox';
/** A player: runs its script, keeps its own storage, can open "watch on…". */
const PLAYER = `allow-scripts allow-same-origin allow-presentation ${POPUPS}`;
/** An app or a widget: as a player, and it may submit its own forms. */
const APP = `allow-scripts allow-same-origin allow-forms ${POPUPS}`;
/** A static render that needs no script at all (a gist). */
const STATIC = POPUPS;

const MEDIA_ALLOW = 'autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write';
const APP_ALLOW = 'fullscreen; clipboard-write';

/** A path segment we are willing to put back into a URL we build. */
const SEG = /^[A-Za-z0-9_-]+$/;

function frame(
  provider: string,
  src: string,
  sandbox: string,
  title: string,
  allow = APP_ALLOW,
): EmbedFrame {
  return {
    provider,
    src,
    sandbox,
    allow,
    title,
    referrerPolicy: 'strict-origin-when-cross-origin',
  };
}

/** The known providers, in the order they are tried. */
function providerFrame(url: URL, rawUrl: string): EmbedFrame | null {
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname;
  const parts = path.split('/').filter(Boolean);
  const seg = (i: number): string | null => (parts[i] && SEG.test(parts[i]!) ? parts[i]! : null);

  // YouTube
  if (host === 'youtu.be') {
    const id = seg(0);
    return id
      ? frame(
          'youtube',
          `https://www.youtube.com/embed/${id}`,
          PLAYER,
          'YouTube video',
          MEDIA_ALLOW,
        )
      : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    let id: string | null = null;
    if (path === '/watch') id = url.searchParams.get('v');
    else if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live')
      id = parts[1] ?? null;
    return id && SEG.test(id)
      ? frame(
          'youtube',
          `https://www.youtube.com/embed/${id}`,
          PLAYER,
          'YouTube video',
          MEDIA_ALLOW,
        )
      : null;
  }

  // Vimeo
  if (host === 'vimeo.com') {
    const id = parts[0];
    return id && /^\d+$/.test(id)
      ? frame('vimeo', `https://player.vimeo.com/video/${id}`, PLAYER, 'Vimeo video', MEDIA_ALLOW)
      : null;
  }

  // Loom
  if (host === 'loom.com' && parts[0] === 'share' && seg(1)) {
    return frame('loom', `https://www.loom.com/embed/${seg(1)}`, PLAYER, 'Loom video', MEDIA_ALLOW);
  }

  // Figma (design + prototype)
  if (host === 'figma.com' && ['file', 'proto', 'design', 'board'].includes(parts[0] ?? '')) {
    return frame(
      'figma',
      `https://www.figma.com/embed?embed_host=forumulate&url=${encodeURIComponent(rawUrl)}`,
      APP,
      'Figma design',
    );
  }

  // CodePen
  if (host === 'codepen.io' && parts[1] === 'pen' && seg(0) && seg(2)) {
    return frame(
      'codepen',
      `https://codepen.io/${seg(0)}/embed/${seg(2)}?default-tab=result`,
      APP,
      'CodePen',
    );
  }

  // CodeSandbox
  if (host === 'codesandbox.io' && parts[0] === 's' && seg(1)) {
    return frame('codesandbox', `https://codesandbox.io/embed/${seg(1)}`, APP, 'CodeSandbox');
  }

  // StackBlitz — /edit/<id> and /github/<owner>/<repo>[/…]
  if (
    host === 'stackblitz.com' &&
    (parts[0] === 'edit' || parts[0] === 'github') &&
    parts.length >= 2
  ) {
    if (!parts.slice(1).every((p) => SEG.test(p) || /^[A-Za-z0-9._-]+$/.test(p))) return null;
    return frame(
      'stackblitz',
      `https://stackblitz.com/${parts.join('/')}?embed=1`,
      APP,
      'StackBlitz project',
    );
  }

  // Replit — /@user/repl
  if (host === 'replit.com' && /^@[A-Za-z0-9_-]+$/.test(parts[0] ?? '') && seg(1)) {
    return frame('replit', `https://replit.com/${parts[0]}/${seg(1)}?embed=true`, APP, 'Replit');
  }

  // Google Docs / Slides / Sheets → preview/embed
  if (host === 'docs.google.com') {
    if (path.includes('/presentation/'))
      return frame(
        'google-docs',
        rawUrl.replace(/\/(edit|pub|view)(\?.*)?(#.*)?$/, '/embed'),
        APP,
        'Google Slides',
      );
    if (path.includes('/document/') || path.includes('/spreadsheets/'))
      return frame(
        'google-docs',
        rawUrl.replace(/\/(edit|pub|view)(\?.*)?(#.*)?$/, '/preview'),
        APP,
        'Google document',
      );
    return null;
  }

  // Google Maps — the embed URL as-is, or a place/search link as an output=embed map.
  if (
    (host === 'google.com' || host === 'maps.google.com') &&
    (parts[0] === 'maps' || host === 'maps.google.com')
  ) {
    if (parts[0] === 'maps' && parts[1] === 'embed' && url.searchParams.get('pb')) {
      return frame(
        'google-maps',
        `https://www.google.com/maps/embed?pb=${encodeURIComponent(url.searchParams.get('pb')!)}`,
        PLAYER,
        'Google Map',
      );
    }
    const q =
      url.searchParams.get('q') ??
      (parts[1] === 'place' || parts[1] === 'search'
        ? decodeURIComponent((parts[2] ?? '').replace(/\+/g, ' '))
        : '');
    return q
      ? frame(
          'google-maps',
          `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`,
          PLAYER,
          'Google Map',
        )
      : null;
  }

  // Calendly — a booking page, inline
  if (host === 'calendly.com' && seg(0)) {
    const tail = seg(1) ? `/${seg(1)}` : '';
    return frame(
      'calendly',
      `https://calendly.com/${seg(0)}${tail}?embed_type=Inline&hide_gdpr_banner=1`,
      APP,
      'Calendly scheduling',
    );
  }

  // Cal.com — cal.com/<user>/<event>, the same booking page Cal's own embed
  // script frames (`/embed`), without the script: a contact page's
  // post-submit booking (CT-3) and an `embed` block both reach it here.
  if (host === 'cal.com' && seg(0)) {
    const tail = seg(1) ? `/${seg(1)}` : '';
    return frame(
      'calcom',
      `https://cal.com/${seg(0)}${tail}/embed?embedType=inline`,
      APP,
      'Cal.com scheduling',
    );
  }

  // Typeform — form.typeform.com/to/<id>, or an account subdomain's /to/<id>
  if ((host === 'typeform.com' || host.endsWith('.typeform.com')) && parts[0] === 'to' && seg(1)) {
    return frame('typeform', `https://form.typeform.com/to/${seg(1)}`, APP, 'Typeform');
  }

  // Tally — /r/<id> (share link) or /embed/<id>
  if (host === 'tally.so' && (parts[0] === 'r' || parts[0] === 'embed') && seg(1)) {
    return frame(
      'tally',
      `https://tally.so/embed/${seg(1)}?alignLeft=1&transparentBackground=1`,
      APP,
      'Tally form',
    );
  }

  // Spotify — track/album/playlist/episode/show/artist, with or without /intl-xx/
  if (host === 'open.spotify.com') {
    const p = parts[0]?.startsWith('intl-') ? parts.slice(1) : parts;
    const at = p[0] === 'embed' ? 1 : 0;
    const kind = p[at];
    const id = p[at + 1];
    if (
      kind &&
      ['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(kind) &&
      id &&
      SEG.test(id)
    )
      return frame(
        'spotify',
        `https://open.spotify.com/embed/${kind}/${id}`,
        PLAYER,
        'Spotify player',
        MEDIA_ALLOW,
      );
    return null;
  }

  // SoundCloud — any track or set page, through the visual player
  if ((host === 'soundcloud.com' || host === 'm.soundcloud.com') && parts.length >= 2) {
    const canonical = `https://soundcloud.com/${parts.map(encodeURIComponent).join('/')}`;
    return frame(
      'soundcloud',
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonical)}&visual=true`,
      PLAYER,
      'SoundCloud player',
      MEDIA_ALLOW,
    );
  }

  // Airtable — a shared view or form (shr…), with or without the base id
  if (host === 'airtable.com') {
    const rest = parts[0] === 'embed' ? parts.slice(1) : parts;
    if (rest.length && rest.every((p) => SEG.test(p)) && rest.some((p) => p.startsWith('shr')))
      return frame('airtable', `https://airtable.com/embed/${rest.join('/')}`, APP, 'Airtable');
    return null;
  }

  // Miro — a board, through the live embed
  if (
    host === 'miro.com' &&
    parts[0] === 'app' &&
    (parts[1] === 'board' || parts[1] === 'live-embed')
  ) {
    const id = parts[2];
    return id && /^[A-Za-z0-9_=-]+$/.test(id)
      ? frame('miro', `https://miro.com/app/live-embed/${id}/`, APP, 'Miro board')
      : null;
  }

  // Excalidraw — a shared scene lives in the fragment, which the frame keeps
  if (host === 'excalidraw.com' && /^#(json|room)=[A-Za-z0-9_,=-]+$/.test(url.hash)) {
    return frame('excalidraw', `https://excalidraw.com/${url.hash}`, APP, 'Excalidraw drawing');
  }

  // X / Twitter — a post, through the platform's own iframe document (no widgets.js)
  if (
    (host === 'twitter.com' || host === 'x.com' || host === 'mobile.twitter.com') &&
    parts[1] === 'status'
  ) {
    const id = parts[2];
    return id && /^\d+$/.test(id)
      ? frame(
          'twitter',
          `https://platform.twitter.com/embed/Tweet.html?id=${id}&dnt=true`,
          PLAYER,
          'Post on X',
        )
      : null;
  }

  // Instagram — a post or reel, through its /embed document
  if (
    host === 'instagram.com' &&
    (parts[0] === 'p' || parts[0] === 'reel' || parts[0] === 'tv') &&
    seg(1)
  ) {
    return frame(
      'instagram',
      `https://www.instagram.com/${parts[0]}/${seg(1)}/embed`,
      PLAYER,
      'Instagram post',
    );
  }

  /*
   * GitHub Gist. GitHub's own embed is a `<script>` that `document.write`s the
   * gist into the page — owner-chosen script on the reader's origin, which the
   * reader policy refuses and should. The `.pibb` render is the same gist as a
   * plain HTML document GitHub explicitly lets anyone frame, so it goes in a
   * frame with NO script permission at all.
   */
  if (host === 'gist.github.com') {
    const user = seg(0);
    const id = parts[1];
    return user && id && /^[0-9a-f]{5,64}$/i.test(id)
      ? frame('gist', `https://gist.github.com/${user}/${id}.pibb`, STATIC, 'GitHub Gist')
      : null;
  }

  return null;
}

/** An exact https origin, or null — the same rule the theme schema applies. */
function exactOrigin(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    if (
      !/^[a-z0-9.-]+$/i.test(u.hostname) ||
      u.hostname.startsWith('.') ||
      !u.hostname.includes('.')
    )
      return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Resolve an embed URL to a frame, or null (the caller renders a link).
 *
 * `frameOrigins` is the owner's declared allowlist (`theme.frameOrigins`). It
 * is matched EXACTLY — origin to origin — and anything that is not an exact
 * https origin in it is ignored rather than widened, so a stored `https://*`
 * cannot turn every URL into a frame. A known provider wins over the
 * allowlist: its own embed address and its own flags are better than the raw
 * page.
 */
export function embedFrame(
  rawUrl: string,
  frameOrigins: readonly string[] = [],
): EmbedFrame | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const known = providerFrame(url, rawUrl);
  if (known) return known;
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const allowed = new Set(frameOrigins.map(exactOrigin).filter((o): o is string => Boolean(o)));
  if (!allowed.has(url.origin)) return null;
  return {
    provider: 'custom',
    src: url.href,
    // The owner trusted the HOST; we still do not let it navigate the page or
    // open a modal over it. Script, its own storage, its own forms and popups
    // are what a Typeform-shaped widget needs to work at all.
    sandbox: APP,
    allow: APP_ALLOW,
    title: `Embedded content from ${url.hostname}`,
    // A host the owner named, not one we vetted: it learns the reader's origin
    // and nothing about the page they are reading.
    referrerPolicy: 'no-referrer',
  };
}

/**
 * Map a known provider URL to an embeddable iframe src. Returns null for
 * anything we don't recognise, so the caller falls back to a plain link.
 * Kept for callers that only need the address; `embedFrame` has the flags.
 */
export function embedIframeSrc(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  return providerFrame(url, rawUrl)?.src ?? null;
}

/**
 * Every origin a known provider can produce.
 *
 * Exported so the reader's CSP can name them instead of allowing `frame-src
 * https:` — "any site may be framed inside your documentation" is a wide
 * promise to make on a customer's own domain, and the set is knowable because
 * this file is the only thing that makes an embed src. A
 * provider added above has to be added here, which is the point: the policy and
 * the renderer cannot drift without a test noticing. Owner-declared origins are
 * added per response from `theme.frameOrigins`, not here.
 */
export const EMBED_FRAME_ORIGINS: readonly string[] = [
  'https://www.youtube.com',
  'https://player.vimeo.com',
  'https://www.loom.com',
  'https://codesandbox.io',
  'https://codepen.io',
  'https://www.figma.com',
  'https://docs.google.com',
  'https://www.google.com',
  'https://stackblitz.com',
  'https://replit.com',
  'https://calendly.com',
  'https://cal.com',
  'https://form.typeform.com',
  'https://tally.so',
  'https://open.spotify.com',
  'https://w.soundcloud.com',
  'https://airtable.com',
  'https://miro.com',
  'https://excalidraw.com',
  'https://platform.twitter.com',
  'https://www.instagram.com',
  'https://gist.github.com',
];
