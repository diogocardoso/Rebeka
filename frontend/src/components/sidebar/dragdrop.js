let dragNodeId = null;
let suppressClick = false;

export function shouldSuppressTreeClick() {
  const value = suppressClick;
  suppressClick = false;
  return value;
}

const DROP_CLASSES = ['drop-before', 'drop-after', 'drop-inside'];

function clearDropIndicators(container) {
  container.querySelectorAll('.tree-node').forEach((el) => {
    DROP_CLASSES.forEach((cls) => el.classList.remove(cls));
  });
  container.classList.remove('drop-root');
}

function showDropIndicator(nodeEl, zone) {
  clearDropIndicators(nodeEl.closest('.sidebar-tree'));
  if (zone === 'root-end') {
    nodeEl.closest('.sidebar-tree')?.classList.add('drop-root');
    return;
  }
  const cls = zone === 'inside' ? 'drop-inside' : `drop-${zone}`;
  nodeEl.classList.add(cls);
}

function getDropZone(nodeEl, clientY) {
  const rect = nodeEl.getBoundingClientRect();
  const y = clientY - rect.top;
  const h = rect.height;
  const type = nodeEl.dataset.type;

  if (type === 'folder') {
    if (y < h * 0.25) return 'before';
    if (y > h * 0.75) return 'after';
    return 'inside';
  }
  return y < h * 0.5 ? 'before' : 'after';
}

function isInteractiveDragTarget(target) {
  return target.closest('[data-toggle], [data-menu-toggle], .tree-menu-actions, .tree-menu');
}

export function bindTreeDragDrop(container, { onMove }) {
  if (!container) return;

  container.querySelectorAll('.tree-node').forEach((nodeEl) => {
    nodeEl.setAttribute('draggable', 'true');

    nodeEl.addEventListener('dragstart', (e) => {
      if (isInteractiveDragTarget(e.target)) {
        e.preventDefault();
        return;
      }
      dragNodeId = nodeEl.dataset.id;
      nodeEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragNodeId);
    });

    nodeEl.addEventListener('dragend', () => {
      dragNodeId = null;
      suppressClick = true;
      clearDropIndicators(container);
      container.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
    });
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = e.target.closest('.tree-node');
    if (!target || target.dataset.id === dragNodeId) {
      clearDropIndicators(container);
      if (!target) container.classList.add('drop-root');
      return;
    }

    showDropIndicator(target, getDropZone(target, e.clientY));
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) clearDropIndicators(container);
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('text/plain') || dragNodeId;
    if (!dragId) return;

    const target = e.target.closest('.tree-node');
    clearDropIndicators(container);

    if (!target) {
      onMove(dragId, null, 'root-end');
      return;
    }

    if (target.dataset.id === dragId) return;
    onMove(dragId, target.dataset.id, getDropZone(target, e.clientY));
  });
}
