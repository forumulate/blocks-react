/**
 * What a card's cover IS — a talk, an interview, an essay, a video, a picture —
 * read from the card's kicker, so a cover that has not loaded (or never will)
 * can stand in with a fitting glyph rather than one grey picture frame for
 * everything (careers design wave: "Talks and interviews" rendered as three
 * identical blank boxes).
 *
 * The kicker is the only place an author already says it ("Talk", "Interview",
 * "Essay"); a new card attribute would mean every existing page says nothing.
 * Words are matched per token, accents folded, in the five reader locales, so
 * "Vortrag · 32 min" is a talk too. Anything unrecognised is null: the
 * renderer then writes no attribute and the reader draws its plain picture.
 *
 * No imports: blocks-react vendors this file verbatim (test/vendor-sync).
 */
export type CoverMediaKind = 'talk' | 'interview' | 'essay' | 'video' | 'image';

const WORDS: Record<string, CoverMediaKind> = {};
const add = (kind: CoverMediaKind, words: string) => {
  for (const w of words.split(' ')) WORDS[w] = kind;
};
add('talk', 'talk talks keynote presentation podcast vortrag vortrage conference conferencia charla palestra ponencia');
add('interview', 'interview interviews qa entretien entrevista gesprach conversation conversa conversacion');
add('essay', 'essay essays article articles post blog story essai ensayo ensaio artigo articulo artikel beitrag read');
add('video', 'video videos film webinar recording clip');
add('image', 'photo photos gallery foto fotos galerie galeria image images bild');

/** The kind a kicker names, or null when it names none of them. */
export function coverMediaKind(kicker: string | null | undefined): CoverMediaKind | null {
  if (!kicker) return null;
  const folded = kicker
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  for (const token of folded.split(/[^a-z&]+/)) {
    const kind = WORDS[token.replace('&', '')];
    if (kind) return kind;
  }
  return null;
}
