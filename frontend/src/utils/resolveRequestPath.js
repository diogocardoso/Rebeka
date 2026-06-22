export function resolvePathInTree(tree, requests, path) {
  const segments = String(path || '')
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!segments.length) {
    throw new Error('caminho da request vazio');
  }

  const requestName = segments[segments.length - 1];
  const folderNames = segments.slice(0, -1);

  let parentId = null;
  for (const folderName of folderNames) {
    const folder = tree.find(
      (n) => n.type === 'folder'
        && (n.parentId || null) === parentId
        && n.name.toLowerCase() === folderName.toLowerCase(),
    );
    if (!folder) {
      throw new Error(`pasta não encontrada: ${folderName}`);
    }
    parentId = folder.id;
  }

  const node = tree.find(
    (n) => n.type === 'request'
      && (n.parentId || null) === parentId
      && n.name.toLowerCase() === requestName.toLowerCase(),
  );
  if (!node) {
    throw new Error(`request não encontrada: ${requestName}`);
  }

  const request = requests[node.id];
  if (!request) {
    throw new Error(`request não carregada: ${requestName}`);
  }

  return { node, request };
}

export function findWorkspaceRef(ref, workspaces = []) {
  const value = String(ref || '').trim();
  if (!value) return null;

  const byId = workspaces.find((w) => w.id === value);
  if (byId) return byId;

  const matches = workspaces.filter((w) => w.name.toLowerCase() === value.toLowerCase());
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`workspace ambíguo: ${value}`);
  }
  return null;
}
