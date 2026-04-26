import {expandAbbr} from './abbr-expand.js';
import {getCaseStudies} from './study-data-cache.js';

let caseStudies = {};

const CaseStudyFactory = (() => {
  const instances = {};
  const KEY = Symbol();

  class CaseStudy {
    #id;
    #visits;
    #visitIdx = 0;
    #isAnswered = false;
    #selectedTreatments = new Set();
    #correctTreatmentSet;

    constructor(id, definition, key) {
      if (key !== KEY) throw new Error(
        'CaseStudy: use CaseStudyFactory.getInstance()'
      );
      this.#id = id;
      this.#visits = Object.freeze([...definition.visits]);
      this.#cacheCorrectTreatmentSet();
    }

    get id() { return this.#id; }
    currentVisit() { return this.#visits[this.#visitIdx]; }
    isComplete() { return this.#visitIdx >= this.#visits.length; }
    hasMoreVisits() { return this.#visitIdx + 1 < this.#visits.length; }
    isAnswered() { return this.#isAnswered; }
    visitNumber() { return this.#visitIdx + 1; }

    advanceVisit() {
      this.#visitIdx++;
      this.#isAnswered = false;
      this.#selectedTreatments.clear();
      this.#cacheCorrectTreatmentSet();
    }

    markAnswered() {
      this.#isAnswered = true;
    }

    toggleTreatment(option) {
      if (this.#selectedTreatments.has(option)) {
        this.#selectedTreatments.delete(option);
        return false;
      }
      this.#selectedTreatments.add(option);
      return true;
    }

    isAnswerCorrect(text) {
      return text === this.currentVisit().correct;
    }

    isCorrectTreatment(option) {
      return this.#correctTreatmentSet.has(option);
    }

    isSelectedTreatment(option) {
      return this.#selectedTreatments.has(option);
    }

    isTreatmentCorrect() {
      return this.#selectedTreatments.size === this.#correctTreatmentSet.size
        && this.#selectedTreatments.isSubsetOf(this.#correctTreatmentSet);
    }

    #cacheCorrectTreatmentSet() {
      this.#correctTreatmentSet = new Set(
        this.currentVisit()?.correctTreatment || []
      );
    }
  }

  return {
    getInstance(elOrId, definition) {
      const id = elOrId.id || elOrId;
      if (!instances[id]) {
        // Fallback for the discard-and-recreate restart path: the
        // delegated click handler has the element but not the
        // definition, so look it up from the cached slice.
        definition ??= caseStudies[id];
        if (!definition) throw new Error(
          'CaseStudyFactory: no definition for "' + id + '"'
        );
        instances[id] = new CaseStudy(id, definition, KEY);
      }
      return instances[id];
    },
    discard(id) {
      delete instances[id];
    },
    discardAll() {
      for (const k in instances) delete instances[k];
    }
  };
})();

export async function setupCaseStudies() {
  caseStudies = await getCaseStudies();

  const wrap = document.getElementById('case-study-wrap');
  wrap.innerHTML = '';
  CaseStudyFactory.discardAll();

  Object.entries(caseStudies).forEach(([id, definition]) => {
    const caseStudy = CaseStudyFactory.getInstance(id, definition);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3 class="case-title">${definition.title}</h3>`;
    const caseEl = document.createElement('div');
    caseEl.className = 'case-study';
    caseEl.id = id;
    card.appendChild(caseEl);
    wrap.appendChild(card);
    renderCaseVisit(caseStudy, caseEl);
  });

  wrap.addEventListener('click', (e) => {
    const answerBtn = e.target.closest('.answer-btn');
    if (answerBtn) {
      handleAnswerClick(answerBtn);
      return;
    }
    const caseEl = e.target.closest('.case-study');
    if (!caseEl) return;

    if (e.target.closest('.case-restart')) {
      CaseStudyFactory.discard(caseEl.id);
      renderCaseVisit(CaseStudyFactory.getInstance(caseEl), caseEl);
    } else if (e.target.closest('.case-next')) {
      const caseStudy = CaseStudyFactory.getInstance(caseEl);
      caseStudy.advanceVisit();
      renderCaseVisit(caseStudy, caseEl);
    } else if (e.target.closest('.case-submit')) {
      showTreatmentResult(CaseStudyFactory.getInstance(caseEl), caseEl);
    }
  });
}

function handleAnswerClick(btn) {
  const caseEl = btn.closest('.case-study');
  if (!caseEl) return;

  const caseStudy = CaseStudyFactory.getInstance(caseEl);
  if (caseStudy.isAnswered()) {
    handleTreatmentToggle(caseStudy, btn);
    return;
  }
  if (btn.disabled) return;

  caseStudy.markAnswered();
  const visit = caseStudy.currentVisit();

  const optWrap = btn.closest('.answer-opts');
  for (const b of optWrap.children) {
    if (b.textContent === visit.correct) {
      b.classList.add('correct');
    } else if (b === btn) {
      b.classList.add('incorrect');
    }
    b.disabled = true;
  }

  const isCorrect = caseStudy.isAnswerCorrect(btn.textContent);
  const fb = document.createElement('div');
  fb.className = 'feedback-box' + (isCorrect ? '' : ' error');
  fb.innerHTML = '<strong>'
    + (isCorrect ? 'Correct.' : 'Incorrect.')
    + '</strong> ' + expandAbbr(visit.explanation);
  caseEl.appendChild(fb);

  if (visit.treatmentQuestion && isCorrect) {
    renderTreatmentQuestion(caseStudy, caseEl);
  } else {
    appendNextButton(caseStudy, caseEl);
  }
}

function handleTreatmentToggle(caseStudy, btn) {
  if (!btn.closest('.treatment-opts')) return;
  if (btn.disabled) return;

  const isNowSelected = caseStudy.toggleTreatment(btn.textContent);
  btn.classList.toggle('selectedOpt', isNowSelected);
}

export function renderCaseVisit(caseStudy, caseEl) {
  if (caseStudy.isComplete()) {
    caseEl.innerHTML =
      `<div class="callout">
        <strong>Case complete.</strong>
        <div class="btn-row">
          <button class="btn case-restart">Restart Case</button>
        </div></div>`;
    return;
  }

  const visit = caseStudy.currentVisit();
  const testHTML = visit.testResults
    ? '<div class="test-profile">'
      + Object.entries(visit.testResults).map(
        ([k, v]) => {
          const isPos = String(v).startsWith('+');
          const isNeg = String(v).startsWith('−')
            || String(v).startsWith('-');
          const cls = isPos ? 'positive'
            : isNeg ? 'negative' : '';
          return '<div class="test-item">'
            + '<div class="test-item-name">'
            + expandAbbr(k) + '</div>'
            + '<div class="test-item-val '
            + cls + '">' + expandAbbr(String(v)) + '</div></div>';
        }
      ).join('') + '</div>'
    : '';

  const btnTemplate = document.createElement('button');
  btnTemplate.className = 'answer-btn';
  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts';
  (visit.options || []).forEach((opt) => {
    const btn = btnTemplate.cloneNode(false);
    btn.textContent = opt;
    optWrap.appendChild(btn);
  });

  caseEl.innerHTML =
    `<div class="visit-badge">Visit ${caseStudy.visitNumber()}</div>`
    + testHTML
    + '<p class="question-stem">' + expandAbbr(visit.question) + '</p>';
  caseEl.appendChild(optWrap);
}

function renderTreatmentQuestion(caseStudy, caseEl) {
  const visit = caseStudy.currentVisit();

  const treatmentDiv = document.createElement('div');
  treatmentDiv.className = 'treatment-subquestion';
  treatmentDiv.innerHTML =
    '<p class="question-stem">' + expandAbbr(visit.treatmentQuestion) + '</p>';

  const optWrap = document.createElement('div');
  optWrap.className = 'answer-opts treatment-opts';
  const btnTemplate = document.createElement('button');
  btnTemplate.className = 'answer-btn';
  (visit.treatmentOptions || []).forEach((opt) => {
    const btn = btnTemplate.cloneNode(false);
    btn.textContent = opt;
    optWrap.appendChild(btn);
  });
  treatmentDiv.appendChild(optWrap);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn primary submit-gap case-submit';
  submitBtn.textContent = 'Check';
  treatmentDiv.appendChild(submitBtn);

  caseEl.appendChild(treatmentDiv);
}

function showTreatmentResult(caseStudy, caseEl) {
  const submitBtn = caseEl.querySelector('.case-submit');
  if (!submitBtn || submitBtn.disabled) return;
  submitBtn.disabled = true;

  const visit = caseStudy.currentVisit();
  const isCorrect = caseStudy.isTreatmentCorrect();

  const optWrap = caseEl.querySelector('.treatment-opts');
  for (const b of optWrap.children) {
    if (caseStudy.isCorrectTreatment(b.textContent)) {
      b.classList.add('correct');
    } else if (caseStudy.isSelectedTreatment(b.textContent)) {
      b.classList.add('incorrect');
    }
    b.disabled = true;
  }

  const fb = document.createElement('div');
  fb.className = 'feedback-box' + (isCorrect ? '' : ' error');
  fb.innerHTML = '<strong>'
    + (isCorrect ? 'Correct.' : 'Incorrect.')
    + '</strong> '
    + expandAbbr(visit.treatmentExplanation || '');
  const treatmentDiv = caseEl.querySelector('.treatment-subquestion');
  treatmentDiv.appendChild(fb);
  appendNextButton(caseStudy, treatmentDiv);
}

function appendNextButton(caseStudy, parent) {
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const btn = document.createElement('button');
  btn.className = 'btn primary case-next';
  btn.textContent = caseStudy.hasMoreVisits()
    ? 'Next Visit (Visit ' + (caseStudy.visitNumber() + 1) + ') →'
    : 'Case Complete';
  btnRow.appendChild(btn);
  parent.appendChild(btnRow);
}
