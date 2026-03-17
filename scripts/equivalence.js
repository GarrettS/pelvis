/**
 * PRI equivalence logic — region/direction mappings and muscle lookups.
 * @module equivalence
 */

export const REGION_LABELS = {
  IP: 'IP', IS: 'IS', IsP: 'IsP', SI: 'SI', AF: 'AF', FA: 'FA'
};

export function getAllEquivalent(regionId, directionId) {
  const ipIsER = (() => {
    switch (regionId) {
      case 'IP': case 'AF': return directionId === 'ER';
      case 'IS': case 'IsP': case 'SI': return directionId === 'IR';
      default: return true;
    }
  })();
  return {
    IP: ipIsER ? 'ER' : 'IR', IS: ipIsER ? 'IR' : 'ER',
    IsP: ipIsER ? 'IR' : 'ER', SI: ipIsER ? 'IR' : 'ER',
    AF: ipIsER ? 'ER' : 'IR'
  };
}

export function getMuscles(side, regionId, directionId) {
  const s = side === 'Left' ? 'L' : 'R';
  const map = {
    IP_IR: [s + ' Proximal Iliacus', s + ' IO/TA'],
    IP_ER: [s + ' Rectus Femoris', s + ' Sartorius'],
    IS_IR: [s + ' Glute Max (sup. fibers)'],
    IS_ER: [s + ' Gluteus Medius'],
    IsP_IR: [],
    IsP_ER: [
      s + ' Obturator Internus', s + ' Iliococcygeus',
      s + ' Puborectalis', s + ' Pubococcygeus'
    ],
    SI_IR: [s + ' Piriformis', s + ' Coccygeus', s + ' Glute Max (inf. fibers)'],
    SI_ER: [], AF_IR: [], AF_ER: [], FA_IR: [], FA_ER: []
  };
  return map[regionId + '_' + directionId] || [];
}
