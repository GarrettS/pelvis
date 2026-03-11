import { getAllEquivalent } from './equivalence.js';

const REGION_LABELS = { ip:'IP', is:'IS', isp:'IsP', si:'SI', af:'AF' };
const REGIONS_LIST = ['IP','IS','IsP','SI','AF'];
const SIDES = ['L','R'];
const DIRS = ['ER','IR'];

let questions = [];
let qIdx = 0;
let score = { correct: 0, total: 0 };
let isAnswered = false;

function generateQuestions() {
  const qs = [];
  SIDES.forEach(function(side) {
    REGIONS_LIST.forEach(function(region) {
      DIRS.forEach(function(dir) {
        const regionLower = region.toLowerCase().replace('isp','isp');
        const dirLower = dir.toLowerCase();
        const equiv = getAllEquivalent(regionLower, dirLower);
        const allEquiv = Object.entries(equiv)
          .filter(function([rid]) { return rid !== regionLower; })
          .map(function([rid, d]) { return side + ' ' + (REGION_LABELS[rid] || rid.toUpperCase()) + ' ' + d; });

        const distractors = [];
        const otherSide = side === 'L' ? 'R' : 'L';
        distractors.push(otherSide + ' ' + region + ' ' + dir);
        const wrongDir = dir === 'ER' ? 'IR' : 'ER';
        distractors.push(side + ' ' + region + ' ' + wrongDir);
        const outletRegion = ['IP','IS'].includes(region) ? 'IsP' : 'IP';
        const wrongEquivDir = ['IP','IS','AF'].includes(outletRegion) ? dir : wrongDir;
        distractors.push(side + ' ' + outletRegion + ' ' + wrongEquivDir);
        distractors.push(otherSide + ' ' + (REGIONS_LIST.find(function(r) { return r !== region; }) || 'SI') + ' ' + dir);

        const correctPick = allEquiv.slice(0, 3);
        const distPick = distractors.filter(function(d) { return !correctPick.includes(d); }).slice(0, 2);
        const allOpts = correctPick.slice(0, 2).concat(distPick).sort(function() { return Math.random() - 0.5; });

        qs.push({
          given: side + ' ' + region + ' ' + dir,
          correctAnswers: new Set(correctPick.slice(0, 2)),
          options: allOpts,
          equiv: equiv
        });
      });
    });
  });
  return qs.sort(function() { return Math.random() - 0.5; });
}

export function initEquivalence() {
  questions = generateQuestions();
  qIdx = 0;
  score = { correct: 0, total: 0 };
  isAnswered = false;
  renderQuestion();
}

function renderQuestion() {
  const wrap = document.getElementById('equiv-quiz-wrap');
  const scoreEl = document.getElementById('equiv-score');
  scoreEl.textContent = 'Score: ' + score.correct + ' / ' + score.total;

  if (qIdx >= questions.length) {
    wrap.innerHTML = '<div class="callout"><strong>Session complete.</strong> Score: ' + score.correct + ' / ' + score.total + '.<div class="btn-row"><button class="btn primary" id="equiv-restart">New Session</button></div></div>';
    document.getElementById('equiv-restart').addEventListener('click', function() { initEquivalence(); });
    return;
  }

  const q = questions[qIdx];
  const selected = new Set();
  isAnswered = false;

  let html = '<div class="card">';
  html += '<div class="card-label">Question ' + (qIdx + 1) + ' of ' + questions.length + '</div>';
  html += '<div class="equiv-given">' + q.given + '</div>';
  html += '<p class="equiv-instruction">Select ALL equivalent positions (may be zero or more):</p>';
  html += '<div class="equiv-opts" id="equiv-options">';
  q.options.forEach(function(opt) {
    html += '<div class="equiv-opt" data-opt="' + opt + '" role="checkbox" aria-checked="false" tabindex="0">' + opt + '</div>';
  });
  html += '</div>';
  html += '<div class="btn-row"><button class="btn primary" id="equiv-submit">Submit</button></div>';
  html += '<div id="equiv-feedback" class="hidden"></div>';
  html += '</div>';
  wrap.innerHTML = html;

  wrap.querySelector('#equiv-options').addEventListener('click', function(e) {
    const opt = e.target.closest('.equiv-opt');
    if (!opt || isAnswered) return;
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
  });

  wrap.querySelector('#equiv-options').addEventListener('keydown', function(e) {
    const opt = e.target.closest('.equiv-opt');
    if (!opt) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click(); }
  });

  document.getElementById('equiv-submit').addEventListener('click', function() {
    if (isAnswered) return;
    handleEquivSubmit({wrap, question: q, selected, scoreEl});
  });
}

function handleEquivSubmit({wrap, question, selected, scoreEl}) {
  isAnswered = true;
  score.total++;
  const isCorrect = selected.size === question.correctAnswers.size &&
    [...selected].every(function(s) { return question.correctAnswers.has(s); });
  if (isCorrect) score.correct++;
  scoreEl.textContent = 'Score: ' + score.correct + ' / ' + score.total;

  wrap.querySelectorAll('.equiv-opt').forEach(function(optEl) {
    const val = optEl.dataset.opt;
    const isCorr = question.correctAnswers.has(val);
    const isSel = selected.has(val);
    if (isCorr && isSel) optEl.classList.add('correct-reveal');
    else if (isCorr && !isSel) optEl.classList.add('missed');
    else if (!isCorr && isSel) optEl.classList.add('wrong-reveal');
    optEl.classList.remove('selected');
  });

  const chainHTML = buildEquivChainHTML(question);
  const feedback = document.getElementById('equiv-feedback');
  feedback.className = 'feedback-box' + (isCorrect ? '' : ' error');
  feedback.innerHTML = '<strong>' + (isCorrect ? 'Correct.' : 'Incorrect.') + '</strong>' + chainHTML;
  feedback.classList.remove('hidden');

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn primary';
  nextBtn.classList.add('feedback-next');
  nextBtn.textContent = qIdx + 1 < questions.length ? 'Next Question \u2192' : 'Finish Session';
  nextBtn.addEventListener('click', function() { qIdx++; renderQuestion(); });
  feedback.appendChild(nextBtn);
}

function buildEquivChainHTML(q) {
  const [qs, qr, qd] = q.given.split(' ');
  const equiv = getAllEquivalent(qr.toLowerCase(), qd.toLowerCase());
  const labels = { ip:'IP', is:'IS', isp:'IsP', si:'SI', af:'AF', fa:'FA' };
  let html = '<div class="equiv-chain">'
    + '<div class="equiv-chain-label">FULL EQUIVALENCE CHAIN:</div>';
  let first = true;
  Object.entries(equiv).forEach(function([rid, d]) {
    const label = labels[rid] || rid.toUpperCase();
    const outletClass = ['isp','si'].includes(rid) ? ' outlet' : '';
    html += '<div class="equiv-line' + (rid === qr.toLowerCase() ? ' main' : '') + outletClass + '">' + (first ? '' : '= ') + qs + ' ' + label + ' ' + d + '</div>';
    first = false;
  });
  html += '</div>';
  return html;
}
