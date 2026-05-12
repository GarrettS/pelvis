// Data layer for equivalence quiz answers. Only getCorrectAnswer is
// exported; cache and helpers are module-private. 
//
// We fetch correctAnswers when the student submits an answer (first one).
// The first Submit triggers the fetch; the rest of the session reads
// from the cached bundle. Why all this... for a study quiz?

// Caching design rationale:
// Showcases state machine: prd/architecture/equivalence-quiz.md
// - so we CAN gate each answer on a per-response basis, as done on first user-submission.
// But because we control the data, we cache it in this module after 
// the first user-submission response.

// A REAL formal testing backend would gate each answer behind its submission:
//  client posts the answer, server returns its verdict +  explanation, so
// the key never reaches the client ahead of submission.
  
// Per-question verdict (vs end-of-test) is our UX study-tool design choice.


import { loadJson } from './load.js';

let bundlePromise;

const fetchBundle = async () => loadJson('./data/equivalence-explanations.json');

function entryFor(bundle, question) {
  const entry = bundle?.regions?.[question.region]?.[question.dir];
  if (!Array.isArray(entry?.equivalents)) return null;
  return entry;
}

function findLink(bundle, fromId, toId) {
  if (!Array.isArray(bundle?.links)) return null;
  return bundle.links.find((lk) =>
    (lk.from === fromId && lk.to === toId)
    || (lk.from === toId && lk.to === fromId)
  ) || null;
}

function buildAnswerLinks(bundle, question, correctAnswers) {
  return [...correctAnswers].map((answer) => {
    const [, ansRegion, ansDir] = answer.split(' ');
    const title = 'Why ' + question.region + ' ' + question.dir
      + ' = ' + ansRegion + ' ' + ansDir;
    const link = findLink(bundle, question.region, ansRegion);
    if (!link) return { title, missing: true };
    return {
      title,
      priReasoning: link.priReasoning,
      biomechanics: link.biomechanics,
      couplingType: link.couplingType
    };
  });
}

function buildCorrectAnswer(bundle, question) {
  const entry = entryFor(bundle, question);
  if (!entry) return { ok: false, reason: 'missing-entry' };

  const fullCorrect = new Set(
    entry.equivalents.map((token) => question.side + ' ' + token)
  );
  const correctAnswers = new Set(
    question.options.filter((opt) => fullCorrect.has(opt))
  );

  const regionMeta = bundle.regions[question.region];
  return {
    ok: true,
    side: question.side,
    region: question.region,
    dir: question.dir,
    correctAnswers,
    totalEquivalents: entry.equivalents.length,
    regionInfo: {
      name: regionMeta.name,
      anatomicalName: regionMeta.anatomicalName,
      manualRef: regionMeta.manualRef
    },
    dirInfo: {
      pri: entry.pri,
      biomechanics: entry.biomechanics
    },
    answerLinks: buildAnswerLinks(bundle, question, correctAnswers),
    couplingDisclaimer: bundle.couplingDisclaimer
  };
}

export async function getCorrectAnswer(question) {
  if (!bundlePromise) bundlePromise = fetchBundle();
  const result = await bundlePromise;
  if (!result.ok) {
    bundlePromise = null;
    return { ok: false, reason: 'fetch-failed' };
  }
  return buildCorrectAnswer(result.data, question);
}
