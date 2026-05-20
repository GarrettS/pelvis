import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {newEl} from './el-create.js';

const containerEl = document.getElementById('diagnose-decision-tree-content');
const treeWrap = document.getElementById('tree-wrap');

function renderTree(node, parent) {
  if (!node) return;

  if (node.terminal) {
    parent.appendChild(newEl('div', {
      className: 'tree-terminal',
      innerHTML: expandAbbr(annotateOutOfScope(node.content || ''))
    }));
    return;
  }
  parent.appendChild(newEl('div', {
    className: 'tree-question',
    innerHTML: expandAbbr(node.question)
  }));

  node.branches?.forEach(branch => renderBranch(branch, parent));
}

function renderBranch(branch, parent) {
  const branchDetailsEl = makeBranchTemplate(branch.answer);
  renderTree(branch.next, branchDetailsEl);
  parent.appendChild(branchDetailsEl);
}

function makeBranchTemplate(answer) {
  const branchDetailsEl = branchTemplate.cloneNode(true);
  branchDetailsEl.firstChild.textContent = answer;
  return branchDetailsEl;
}

const annotateOutOfScope = content => content.replace(
    /Myokinematic Restoration(?: & Postural Respiration)?/g,
    '$& (out of scope for this course)');

const branchTemplate = newEl('details', {
  className: 'tree-branch',
  children: [newEl('summary', {className: 'tree-answer-toggle'})]
});

await attemptLoad({
  loader: () => loadJson('./data/diagnose-decision-tree.json'),
  container: containerEl,
  render: data => {
    treeWrap.innerHTML = '';
    renderTree(data, treeWrap);
  }
});
