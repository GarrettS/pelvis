/**
 * Abbreviation expansion — wraps known abbreviations in <abbr> tags.
 * @module abbreviations
 */

let abbrMap = null;
let abbrRe = null;

/**
 * Lazily load abbreviations.json and compile a single regex.
 *
 * The regex sorts keys longest-first so that longer abbreviations match
 * before shorter prefixes (e.g. "IO/TA" before "IO"), then joins them
 * with alternation. The global flag ensures every occurrence is replaced.
 */
async function loadAbbreviations() {
  if (abbrMap) return;
  try {
    const resp = await fetch('data/abbreviations.json');
    if (!resp.ok) return;
    const data = await resp.json();
    abbrMap = new Map(data);
    const abbrKeys = [...abbrMap.keys()].sort((a, b) => b.length - a.length);
    abbrRe = new RegExp(
      abbrKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
      'g'
    );
  } catch (fetchErr) {
    // Abbreviation expansion unavailable — callers degrade to plain text.
  }
}

export async function expandAbbr(text) {
  await loadAbbreviations();
  if (!abbrMap) return text;
  return text.replace(abbrRe, match => {
    const expansion = abbrMap.get(match);
    return expansion ? '<abbr title="' + expansion + '">' + match + '</abbr>' : match;
  });
}
