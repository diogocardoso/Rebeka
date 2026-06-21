const registry = new Map();

function resolveGlobalName(name) {
  return name.endsWith('_') ? name.slice(0, -1) : name;
}

/**
 * Registra uma função em globalThis para uso em onclick do HTML.
 * Nomes terminados em "_" expõem sem o sufixo (ex: "teste_" → teste()).
 */
export function fn(name, callback) {
  if (typeof name !== 'string' || !name) {
    throw new TypeError('APP.fn: name deve ser uma string não vazia');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('APP.fn: callback deve ser uma função');
  }

  const globalName = resolveGlobalName(name);
  const wrapped = (...args) => callback(...args);

  registry.set(globalName, wrapped);
  globalThis[globalName] = wrapped;

  return wrapped;
}

export function unregister(name) {
  const globalName = resolveGlobalName(name);
  registry.delete(globalName);
  delete globalThis[globalName];
}

export function listFns() {
  return [...registry.keys()];
}
