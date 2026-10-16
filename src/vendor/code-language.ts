/*
 * Dependency-free on purpose: the reader's hydrator imports it through the
 * platform's code-language module for the language chip, and
 * the server uses it for a code group's default tab labels — one table.
 */

/**
 * The short name a reader sees for a language: the code group's default tab
 * label, and the language chip (D-116). Anything not in the table is shown
 * upper-cased, capped at 12 characters.
 */
const LANGUAGE_LABELS: Record<string, string> = {
  ts: 'TS',
  typescript: 'TS',
  tsx: 'TSX',
  js: 'JS',
  javascript: 'JS',
  jsx: 'JSX',
  sh: 'Shell',
  bash: 'Shell',
  shell: 'Shell',
  zsh: 'Shell',
  console: 'Shell',
  ps1: 'PowerShell',
  powershell: 'PowerShell',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  diff: 'Diff',
  ansi: 'Output',
};

/*
 * The fences that name NO language: a chip reading "TEXT" over a plain block
 * (or over a prompt-looking fence) tells a reader nothing, and it was the one
 * chip every defaults replica showed (R3-050). They label as nothing, which
 * the hydrator already takes as "no chip" and a code group as "Tab N".
 */
const PLAIN = new Set(['text', 'plaintext', 'txt', 'plain', 'none']);

export function codeLanguageLabel(lang: string | null | undefined): string {
  if (!lang || PLAIN.has(lang.trim().toLowerCase())) return '';
  const known = LANGUAGE_LABELS[lang.toLowerCase()];
  return known ?? lang.toUpperCase().slice(0, 12);
}
