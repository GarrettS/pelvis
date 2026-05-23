import {expandAbbr} from './abbr-expand.js';
import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {newEl} from './el-create.js';
import {testProfileEl} from './test-profile.js';
import {answerFieldsetEl, checkboxFieldsetEl} from './quiz-form.js';

let caseStudyData = {};

const containerEl = document.getElementById('diagnose-case-studies-content');
const caseStudyWrap = document.getElementById('case-study-wrap');

caseStudyWrap.addEventListener('click', handleClick);
caseStudyWrap.addEventListener('submit', handleSubmit);

function handleClick(e) {
  const action = e.target.closest('.case-restart, .case-next');
  if (!action) return;

  const caseEl = action.closest('.case-study');
  if (action.matches('.case-restart')) CaseStudy.discard(caseEl.id);
  else CaseStudy.getInstance(caseEl.id).advanceVisit();

  renderCaseVisit(CaseStudy.getInstance(caseEl.id), caseEl);
}

function handleSubmit(e) {
  e.preventDefault();
  const caseEl = e.target.closest('.case-study');
  if (!caseEl) return;

  const grade = e.submitter.matches('.answer-btn') ? gradeVisitAnswer : gradeTreatment;
  grade(e.target, e.submitter, CaseStudy.getInstance(caseEl.id));
}

export function renderCaseVisit(caseStudy, caseEl) {
  if (caseStudy.isComplete()) {
    caseEl.replaceChildren(caseCompleteEl());
    return;
  }

  const visit = caseStudy.currentVisit();
  caseEl.replaceChildren(
    newEl('div', {
      className: 'visit-badge',
      textContent: 'Visit ' + caseStudy.visitNumber()
    }),
    testProfileEl(visit.testResults),
    visitFormEl(visit)
  );
}

const visitFormEl = visit => newEl('form', {
  children: [
    newEl('p', {
      className: 'question-stem',
      innerHTML: expandAbbr(visit.question)
    }),
    answerFieldsetEl(visit.options, visit.correct)
  ]
});

const treatmentFormEl = visit => newEl('div', {
  className: 'treatment-subquestion',
  children: [newEl('form', {
    children: [
      newEl('p', {
        className: 'question-stem',
        innerHTML: expandAbbr(visit.treatmentQuestion)
      }),
      checkboxFieldsetEl(
        visit.treatmentOptions || [],
        new Set(visit.correctTreatment || [])
      ),
      newEl('button', {
        type: 'submit',
        className: 'primary submit-gap',
        textContent: 'Check'
      })
    ]
  })]
});

const caseCompleteEl = () => newEl('div', {
  className: 'callout',
  children: [
    newEl('strong', {textContent: 'Case complete.'}),
    newEl('div', {
      className: 'btn-row',
      children: [newEl('button', {
        type: 'button',
        className: 'case-restart',
        textContent: 'Restart Case'
      })]
    })
  ]
});

const feedbackBox = (isCorrect, explanation) => newEl('div', {
  className: 'feedback-box' + (isCorrect ? '' : ' error'),
  innerHTML: '<strong>' + (isCorrect ? 'Correct.' : 'Incorrect.')
    + '</strong> ' + expandAbbr(explanation)
});

const nextButtonRow = caseStudy => newEl('div', {
  className: 'btn-row',
  children: [newEl('button', {
    type: 'button',
    className: 'primary case-next',
    textContent: caseStudy.hasMoreVisits()
      ? 'Next Visit (Visit ' + (caseStudy.visitNumber() + 1) + ') →'
      : 'Case Complete'
  })]
});

const caseCardEl = id => {
  const caseEl = newEl('div', {className: 'case-study', id});
  const card = newEl('div', {
    className: 'card',
    children: [
      newEl('h3', {
        className: 'case-title',
        textContent: caseStudyData[id].title
      }),
      caseEl
    ]
  });
  renderCaseVisit(CaseStudy.getInstance(id), caseEl);
  return card;
};

function renderAll(container) {
  CaseStudy.discardAll();
  container.replaceChildren(...Object.keys(caseStudyData).map(caseCardEl));
}

function gradeVisitAnswer(form, submitter, caseStudy) {
  const visit = caseStudy.currentVisit();
  const isCorrect = submitter.hasAttribute('data-correct');
  submitter.dataset.picked = '';
  const fieldset = form.querySelector('fieldset');
  fieldset.dataset.answered = fieldset.disabled = true;

  const next = visit.treatmentQuestion && isCorrect
    ? treatmentFormEl(visit)
    : nextButtonRow(caseStudy);
  form.parentElement.append(feedbackBox(isCorrect, visit.explanation), next);
}

function gradeTreatment(form, submitter, caseStudy) {
  const fieldset = form.querySelector('fieldset');
  const visit = caseStudy.currentVisit();
  const isCorrect = !fieldset.querySelector(
    'input[data-correct]:not(:checked), input:checked:not([data-correct])'
  );
  fieldset.dataset.answered = fieldset.disabled = true;
  submitter.hidden = true;

  form.parentElement.append(
    feedbackBox(isCorrect, visit.treatmentExplanation || ''),
    nextButtonRow(caseStudy)
  );
}

class CaseStudy {
  static #instances = Object.create(null);
  static #KEY = Symbol();

  static getInstance(id) {
    return CaseStudy.#instances[id] ??=
      new CaseStudy(id, caseStudyData[id], CaseStudy.#KEY);
  }

  static discard(id) {
    delete CaseStudy.#instances[id];
  }

  static discardAll() {
    CaseStudy.#instances = Object.create(null);
  }

  #visits;
  #visitIdx = 0;

  constructor(id, definition, key) {
    if (key !== CaseStudy.#KEY) throw new Error(
      'CaseStudy: use CaseStudy.getInstance()'
    );
    this.#visits = Object.freeze([...definition.visits]);
  }

  currentVisit() { return this.#visits[this.#visitIdx]; }
  isComplete() { return this.#visitIdx >= this.#visits.length; }
  hasMoreVisits() { return this.#visitIdx + 1 < this.#visits.length; }
  visitNumber() { return this.#visitIdx + 1; }

  advanceVisit() {
    this.#visitIdx++;
  }
}

await attemptLoad({
  loader: () => loadJson('./data/diagnose-case-studies.json'),
  container: containerEl,
  render: (data) => {
    caseStudyData = data;
    renderAll(caseStudyWrap);
  }
});
