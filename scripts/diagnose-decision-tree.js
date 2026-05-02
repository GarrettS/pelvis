import {getDecisionTree} from './study-data-cache.js';
import {expandAbbr} from './abbr-expand.js';

const branchSummaryTemplate = (() => {
  const branchSummary = document.createElement('summary');
  branchSummary.className = 'tree-answer-toggle';
  return branchSummary;
})();

const branchTemplate = (() => {
  const branchDetails = document.createElement('details');
  branchDetails.className = 'tree-branch';
  branchDetails.appendChild(branchSummaryTemplate.cloneNode(false));
  return branchDetails;
})();

export async function setupDecisionTree() {
  const tree = await getDecisionTree();

  const wrap = document.getElementById('tree-wrap');
  wrap.innerHTML = '';
  renderNode(tree, wrap);
}

function renderNode(node, parent) {
  if (!node) return;

  if (node.terminal) {
    const terminalEl = document.createElement('div');
    terminalEl.className = 'tree-terminal';
    terminalEl.innerHTML = expandAbbr(
      annotateOutOfScope(node.content || '')
    );
    parent.appendChild(terminalEl);
    return;
  }
  const questionEl = document.createElement('div');
  questionEl.className = 'tree-question';
  questionEl.innerHTML = expandAbbr(node.question);
  parent.appendChild(questionEl);

  if (!node.branches) return;

  node.branches.forEach((branch) => renderBranch(branch, parent));
}

function makeBranchTemplate(answer) {
  const branchDetailsEl = branchTemplate.cloneNode(true);
  const branchSummaryEl = branchDetailsEl.firstElementChild;
  branchSummaryEl.textContent = answer;
  return branchDetailsEl;
}

function renderBranch(branch, parent) {
  const branchDetailsEl = makeBranchTemplate(branch.answer);
  renderNode(branch.next, branchDetailsEl);
  parent.appendChild(branchDetailsEl);
}

function annotateOutOfScope(content) {
  return content.replace(
    /Myokinematic Restoration(?: & Postural Respiration)?/g,
    '$& (out of scope for this course)'
  );
}
