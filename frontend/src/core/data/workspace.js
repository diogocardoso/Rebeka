import { getWindow } from '../window.js';

export async function create(name) {
  return getWindow().CreateWorkspace(name);
}

export async function edit(id, name) {
  return getWindow().UpdateWorkspace(id, name);
}

export async function remove(id) {
  return getWindow().DeleteWorkspace(id);
}
