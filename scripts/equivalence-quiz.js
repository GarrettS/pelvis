import { getAllEquivalent, REGION_LABELS } from './equivalence.js';

const REGIONS = Object.keys(REGION_LABELS).filter((r) => r !== 'FA');
const SIDES = ['L', 'R'];
const DIRS = ['ER', 'IR'];

let questions = [];
let qIdx = 0;
let score = { correct: 0, total: 0 };
let isAnswered = false;
let selected = new Set();

const dom = Object.create(null);

function generateQuestions() {
  const qs = [];
  SIDES.forEach((side) => {
    REGIONS.forEach((region) => {
      DIRS.forEach((dir) => {
        const equiv = getAllEquivalent(region, dir);
        const allEquiv = Object.entries(equiv)
          .filter(([rid]) => rid !== region)
          .map(([rid, d]) => side + ' ' + rid + ' ' + d);

        const otherSide = side === 'L' ? 'R' : 'L';
        const wrongDir = dir === 'ER' ? 'IR' : 'ER';
        const outletRegion = ['IP', 'IS'].includes(region) ? 'IsP' : 'IP';
        const wrongEquivDir = ['IP', 'IS', 'AF'].includes(outletRegion) ? dir : wrongDir;
        const distractors = [
          otherSide + ' ' + region + ' ' + dir,
          side + ' ' + region + ' ' + wrongDir,
          side + ' ' + outletRegion + ' ' + wrongEquivDir,
          otherSide + ' ' + (REGIONS.find((r) => r !== region) || 'SI') + ' ' + dir
        ];

        const correctPick = allEquiv.slice(0, 3);
        const distPick = distractors.filter((d) => !correctPick.includes(d)).slice(0, 2);
        const allOpts = correctPick.slice(0, 2).concat(distPick).sort(() => Math.random() - 0.5);

        qs.push({
          given: side + ' ' + region + ' ' + dir,
          correctAnswers: new Set(correctPick.slice(0, 2)),
          options: allOpts,
          equiv: equiv
        });
      });
    });
  });
  return qs.sort(() => Math.random() - 0.5);
}

function resetSession() {
  questions = generateQuestions();
  qIdx = 0;
  score = { correct: 0, total: 0 };
  isAnswered = false;
  renderQuestion();
}

const CLICK_DISPATCH = {
  'equiv-submit': handleSubmit,
  'equiv-restart': resetSession
};

export function initEquivalence() {
  dom.wrap = document.getElementById('equiv-quiz-wrap');
  dom.scoreEl = document.getElementById('equiv-score');

  dom.wrap.addEventListener('click', (e) => {
    const opt = e.target.closest('.equiv-opt');
    if (opt) {
      handleOptionToggle(opt);
      return;
    }
    if (e.target.closest('.feedback-next')) {
      qIdx++;
      renderQuestion();
      return;
    }
    const target = e.target.closest('[id]');
    if (target && CLICK_DISPATCH[target.id]) {
      CLICK_DISPATCH[target.id]();
    }
  });

  dom.wrap.addEventListener('keydown', (e) => {
    const opt = e.target.closest('.equiv-opt');
    if (!opt) return;

    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click(); }
  });

  resetSession();
}

function handleOptionToggle(opt) {
  if (isAnswered) return;

  const val = opt.dataset.opt;
  if (selected.has(val)) {
    selected.delete(val);
    opt.classList.remove('selected');
    opt.setAttribute('aria-checked', 'false');
  } else {
    selected.add(val);
    opt.classList.add('selected');
    opt.setAttribute('aria-checked', 'true');
  }
}

function renderQuestion() {
  dom.scoreEl.textContent = 'Score: ' + score.correct + ' / ' + score.total;

  if (qIdx >= questions.length) {
    dom.wrap.innerHTML = '<div class="callout"><strong>Session complete.</strong> Score: '
      + score.correct + ' / ' + score.total
      + '.<div class="btn-row"><button class="btn primary" id="equiv-restart">New Session</button></div></div>';
    return;
  }

  const q = questions[qIdx];
  selected = new Set();
  isAnswered = false;

  const optItems = q.options.map((opt) =>
    '<div class="equiv-opt" data-opt="' + opt + '" role="checkbox" aria-checked="false" tabindex="0">' + opt + '</div>'
  );
  dom.wrap.innerHTML = '<div class="card">'
    + '<div class="card-label">Question ' + (qIdx + 1) + ' of ' + questions.length + '</div>'
    + '<div class="equiv-given">' + q.given + '</div>'
    + '<p class="equiv-instruction">Select ALL equivalent positions (may be zero or more):</p>'
    + '<div class="equiv-opts" id="equiv-options">' + optItems.join('') + '</div>'
    + '<div class="btn-row"><button class="btn primary" id="equiv-submit">Submit</button></div>'
    + '<div id="equiv-feedback" class="hidden"></div>'
    + '</div>';
}

function handleSubmit() {
  if (isAnswered) return;

  isAnswered = true;
  score.total++;
  const q = questions[qIdx];
  const isCorrect = selected.size === q.correctAnswers.size &&
    [...selected].every((s) => q.correctAnswers.has(s));
  if (isCorrect) score.correct++;
  dom.scoreEl.textContent = 'Score: ' + score.correct + ' / ' + score.total;

  const optEls = dom.wrap.querySelectorAll('.equiv-opt');
  for (const optEl of optEls) {
    const val = optEl.dataset.opt;
    const isCorr = q.correctAnswers.has(val);
    const isSel = selected.has(val);
    if (isCorr && isSel) optEl.classList.add('correct-reveal');
    else if (isCorr && !isSel) optEl.classList.add('missed');
    else if (!isCorr && isSel) optEl.classList.add('wrong-reveal');
    optEl.classList.remove('selected');
  }

  const chainHTML = buildEquivChainHTML(q);
  const feedback = document.getElementById('equiv-feedback');
  feedback.className = 'feedback-box' + (isCorrect ? '' : ' error');
  feedback.innerHTML = '<strong>' + (isCorrect ? 'Correct.' : 'Incorrect.') + '</strong>'
    + chainHTML
    + '<button class="btn primary feedback-next">'
    + (qIdx + 1 < questions.length ? 'Next Question \u2192' : 'Finish Session')
    + '</button>';
}

function buildEquivChainHTML(q) {
  const [qs, qr] = q.given.split(' ');
  const lines = Object.entries(q.equiv).map(([rid, d], i) => {
    const outletClass = ['IsP', 'SI'].includes(rid) ? ' outlet' : '';
    return '<div class="equiv-line' + (rid === qr ? ' main' : '') + outletClass + '">'
      + (i ? '= ' : '') + qs + ' ' + rid + ' ' + d + '</div>';
  });
  return '<div class="equiv-chain">'
    + '<div class="equiv-chain-label">FULL EQUIVALENCE CHAIN:</div>'
    + lines.join('')
    + '</div>';
}
