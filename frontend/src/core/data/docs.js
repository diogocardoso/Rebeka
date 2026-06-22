import { getWindow } from '../window.js';

const fallbackDocs = import.meta.glob('../../../../docs/*.md', { query: '?raw', import: 'default', eager: true });

const orderByID = {
  inicio: 0,
  workspaces: 1,
  'ambientes-variaveis': 2,
  requisicoes: 3,
  'testes-scripts': 4,
  workflows: 5,
  backup: 6,
};

function extractTitle(content, fallback) {
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (t.startsWith('# ')) return t.slice(2);
  }
  return fallback;
}

function listFallback() {
  return Object.entries(fallbackDocs)
    .map(([path, content]) => {
      const file = path.split('/').pop();
      const id = file.replace(/\.md$/, '');
      return { id, title: extractTitle(content, id), order: orderByID[id] ?? 99 };
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function getFallback(id) {
  const key = Object.keys(fallbackDocs).find((p) => p.endsWith(`/${id}.md`));
  return key ? fallbackDocs[key] : null;
}

export async function list() {
  const w = getWindow();
  if (w?.ListDocs) return w.ListDocs();
  return listFallback();
}

export async function get(id) {
  const w = getWindow();
  if (w?.GetDocContent) return w.GetDocContent(id);
  const content = getFallback(id);
  if (!content) throw new Error(`Doc não encontrado: ${id}`);
  return content;
}
