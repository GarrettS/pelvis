import {getDecisionTree} from './study-data-cache.js';
import {expandAbbr} from './abbr-expand.js';

export async function setupDecisionTree() {
  const tree = await getDecisionTree();

  const wrap = document.getElementById('tree-wrap');
  wrap.innerHTML = '';
  renderTreeNode(tree, wrap);

  wrap.addEventListener('click', (e) => {
    const toggle = e.target.closest('.tree-answer-toggle');
    if (!toggle) return;

    toggleTreeBranch(toggle);
  });
}

function toggleTreeBranch(toggle) {
  const children = toggle.nextElementSibling;
  const isOpen = children.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
  toggle.textContent = (isOpen ? '▼ ' : '▶ ')
    + toggle.dataset.answer;
}

function renderTreeNode(node, parent) {
  if (!node) return;

  if (node.terminal) {
    const el = document.createElement('div');
    el.className = 'tree-terminal';
    el.innerHTML = expandAbbr(annotateOutOfScope(node.content || ''));
    parent.appendChild(el);
    return;
  }
  const qEl = document.createElement('div');
  qEl.className = 'tree-question';
  qEl.innerHTML = expandAbbr(node.question);
  parent.appendChild(qEl);

  if (!node.branches) return;

  node.branches.forEach((branch) => {
    const branchWrap = document.createElement('div');
    branchWrap.className = 'tree-branch';
    const toggle = document.createElement('button');
    toggle.className = 'tree-answer-toggle';
    toggle.dataset.answer = branch.answer;
    toggle.textContent = '▶ ' + branch.answer;
    const children = document.createElement('div');
    children.className = 'tree-children';
    branchWrap.appendChild(toggle);
    renderTreeNode(branch.next, children);
    branchWrap.appendChild(children);
    parent.appendChild(branchWrap);
  });
}

function annotateOutOfScope(content) {
  return content.replace(
    /Myokinematic Restoration(?: & Postural Respiration)?/g,
    '$& (out of scope for this course)'
  );
}
