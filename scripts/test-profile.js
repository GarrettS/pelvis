import {expandAbbr} from './abbr-expand.js';
import {newEl} from './el-create.js';

const polarityClass = value =>
  value.startsWith('+') ? 'positive'
  : /^[-−]/.test(value) ? 'negative'
  : '';

const testItemEl = ([name, val]) => newEl('div', {
  className: 'test-item',
  children: [
    newEl('div', {className: 'test-item-name', innerHTML: expandAbbr(name)}),
    newEl('div', {
      className: 'test-item-val ' + polarityClass(val),
      innerHTML: expandAbbr(val)
    })
  ]
});

export const testProfileEl = profile => newEl('div', {
  className: 'test-profile',
  children: Object.entries(profile).map(testItemEl)
});
