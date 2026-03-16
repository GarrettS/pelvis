const ABBRS = [
  ['B Patho PEC', 'Bilateral Pathological Posterior Exterior Chain'],
  ['Patho PEC', 'Pathological Posterior Exterior Chain'],
  ['L AIC', 'Left Anterior Interior Chain'],
  ['B PEC', 'Bilateral Posterior Exterior Chain'],
  ['IsP ER', 'Ischio-Pubo External Rotation'],
  ['IsP IR', 'Ischio-Pubo Internal Rotation'],
  ['IP ER', 'Ilio-Pubo External Rotation'],
  ['IP IR', 'Ilio-Pubo Internal Rotation'],
  ['IS ER', 'Ilio-Sacral External Rotation'],
  ['IS IR', 'Ilio-Sacral Internal Rotation'],
  ['SI IR', 'Sacro-Ilio Internal Rotation'],
  ['SI ER', 'Sacro-Ilio External Rotation'],
  ['AF ER', 'Acetabulo-Femoral External Rotation'],
  ['AF IR', 'Acetabulo-Femoral Internal Rotation'],
  ['FA IR', 'Femoro-Acetabular Internal Rotation'],
  ['FA ER', 'Femoro-Acetabular External Rotation'],
  ['HALT', 'Hruska Abduction Lift Test'],
  ['PADT', 'Pelvic Ascension Drop Test'],
  ['PART', 'Passive Abduction Raise Test'],
  ['ADT', 'Adduction Drop Test'],
  ['SRT', 'Standing Reach Test'],
  ['ZOA', 'Zone of Apposition'],
  ['AIC', 'Anterior Interior Chain'],
  ['PEC', 'Posterior Exterior Chain'],
  ['ROM', 'Range of Motion'],
  ['TAs', 'Transversus Abdominis'],
  ['IO', 'Internal Oblique'],
  ['IC', 'Ischiocondylar'],
  ['COG', 'Center of Gravity'],
];

const ABBR_TITLES = {};
for (const [abbr, title] of ABBRS) {
  ABBR_TITLES[abbr] = title;
}

const longestFirst = ABBRS.map(([a]) => a)
  .sort((a, b) => b.length - a.length);
const abbrPattern = longestFirst
  .map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const ABBR_RE = new RegExp('\\b(' + abbrPattern + ')\\b', 'g');

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function expandAbbr(text) {
  return escapeHtml(text).replace(
    ABBR_RE, (match) =>
      '<abbr title="' + ABBR_TITLES[match] + '">'
        + match + '</abbr>'
  );
}

export { expandAbbr };
