/**
 * PRI equivalence logic — region/direction mappings, muscle lookups,
 * and joint schematic SVGs.
 * @module equivalence
 */

export function getAllEquivalent(regionId, directionId) {
  const ipIsER = (() => {
    switch (regionId) {
      case 'ip': case 'af': case 'fa': return directionId === 'er';
      case 'is': case 'isp': case 'si': return directionId === 'ir';
      default: return true;
    }
  })();
  return {
    ip: ipIsER ? 'ER' : 'IR', is: ipIsER ? 'IR' : 'ER',
    isp: ipIsER ? 'IR' : 'ER', si: ipIsER ? 'IR' : 'ER',
    af: ipIsER ? 'ER' : 'IR', fa: ipIsER ? 'ER' : 'IR'
  };
}

export function getMuscles(side, regionId, directionId) {
  const s = side === 'Left' ? 'L' : 'R';
  const map = {
    ip_ir: [s + ' Proximal Iliacus', s + ' IO/TA'],
    ip_er: [s + ' Rectus Femoris', s + ' Sartorius'],
    is_ir: [s + ' Glute Max (sup. fibers)'],
    is_er: [s + ' Gluteus Medius'],
    isp_ir: [],
    isp_er: [
      s + ' Obturator Internus', s + ' Iliococcygeus',
      s + ' Puborectalis', s + ' Pubococcygeus'
    ],
    si_ir: [s + ' Piriformis', s + ' Coccygeus', s + ' Glute Max (inf. fibers)'],
    si_er: [], af_ir: [], af_er: [], fa_ir: [], fa_er: []
  };
  return map[regionId + '_' + directionId] || [];
}

export const SI_SVG = '<svg class="joint-schematic" viewBox="0 0 240 190">' +
  '<polygon points="120,38 152,44 156,132 120,148 84,132 88,44" fill="var(--surface2)" stroke="var(--accent)" stroke-width="1.5"/>' +
  '<text x="120" y="100" text-anchor="middle" fill="var(--accent)" font-family="monospace" font-size="11" font-weight="700">SACRUM</text>' +
  '<path d="M88,44 Q58,18 28,32 L18,122 Q34,138 64,132 L84,132 Z" fill="var(--surface2)" stroke="var(--inlet)" stroke-width="1.5"/>' +
  '<text x="44" y="88" text-anchor="middle" fill="var(--inlet)" font-family="monospace" font-size="10">L ILIUM</text>' +
  '<path d="M152,44 Q182,18 212,32 L222,122 Q206,138 176,132 L156,132 Z" fill="var(--surface2)" stroke="var(--inlet)" stroke-width="1.5"/>' +
  '<text x="196" y="88" text-anchor="middle" fill="var(--inlet)" font-family="monospace" font-size="10">R ILIUM</text>' +
  '<line x1="88" y1="44" x2="84" y2="132" stroke="var(--warn)" stroke-width="3" stroke-linecap="round"/>' +
  '<line x1="152" y1="44" x2="156" y2="132" stroke="var(--warn)" stroke-width="3" stroke-linecap="round"/>' +
  '<text x="120" y="162" text-anchor="middle" fill="var(--text-dim)" font-family="monospace" font-size="10">SI joint surfaces shown in amber</text>' +
  '<text x="120" y="176" text-anchor="middle" fill="var(--text-dim)" font-family="monospace" font-size="9">Schematic \u2014 not anatomically proportional</text>' +
  '</svg>';

export const HIP_SVG = '<svg class="joint-schematic" viewBox="0 0 200 210">' +
  '<path d="M20,18 Q100,8 180,18 L176,82 Q155,105 100,110 Q45,105 24,82 Z" fill="var(--surface2)" stroke="var(--inlet)" stroke-width="1.5"/>' +
  '<text x="100" y="60" text-anchor="middle" fill="var(--inlet)" font-family="monospace" font-size="10">PELVIS</text>' +
  '<path d="M64,98 Q100,138 136,98" fill="var(--surface)" stroke="var(--warn)" stroke-width="2.5"/>' +
  '<text x="100" y="125" text-anchor="middle" fill="var(--warn)" font-family="monospace" font-size="10">acetabulum</text>' +
  '<circle cx="100" cy="118" r="21" fill="var(--surface2)" stroke="var(--accent)" stroke-width="1.8"/>' +
  '<text x="100" y="122" text-anchor="middle" fill="var(--accent)" font-family="monospace" font-size="10">fem. head</text>' +
  '<rect x="88" y="139" width="24" height="50" rx="6" fill="var(--surface2)" stroke="var(--accent)" stroke-width="1.5"/>' +
  '<text x="100" y="174" text-anchor="middle" fill="var(--accent)" font-family="monospace" font-size="10">FEMUR</text>' +
  '</svg>';
