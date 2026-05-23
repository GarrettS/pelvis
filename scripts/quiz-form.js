import {newEl} from './el-create.js';

const optionButton = (opt, isCorrect) => newEl('button', {
  type: 'submit',
  className: 'answer-btn',
  textContent: opt,
  attrs: isCorrect ? {'data-correct': ''} : {}
});

const optionCheckboxRow = (opt, isCorrect) => newEl('label', {
  className: 'option-row',
  children: [
    newEl('input', {
      type: 'checkbox',
      value: opt,
      attrs: isCorrect ? {'data-correct': ''} : {}
    }),
    newEl('span', {textContent: opt})
  ]
});

export const answerFieldsetEl = (options, correct) => newEl('fieldset', {
  className: 'answer-opts',
  children: options.map(opt => optionButton(opt, opt === correct))
});

export const checkboxFieldsetEl = (options, correctSet, extraProps = {}) =>
  newEl('fieldset', {
    className: 'answer-opts',
    ...extraProps,
    children: options.map(opt => optionCheckboxRow(opt, correctSet.has(opt)))
  });
