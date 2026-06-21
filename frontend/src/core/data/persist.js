import { getWindow } from '../window.js';

export async function load() {
  const w = getWindow();
  if (!w) return null;
  return w.Load();
}

export async function save(payload) {
  const w = getWindow();
  if (!w) return;
  return w.Save(payload);
}
