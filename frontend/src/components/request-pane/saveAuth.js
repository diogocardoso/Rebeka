import { edit } from '../../core/components/pane/request.js';
import { getVariableInputValue } from '../variable-input/index.js';

export function saveAuth(id, rootEl, options = {}) {
  const authType = rootEl.querySelector('[data-field="authType"]')?.value || 'none';
  const authData = {
    token: getVariableInputValue(rootEl.querySelector('[data-auth-host="token"]')) || '',
    username: getVariableInputValue(rootEl.querySelector('[data-auth-host="username"]')) || '',
    password: getVariableInputValue(rootEl.querySelector('[data-auth-host="password"]')) || '',
  };
  edit(id, { authType, authData: JSON.stringify(authData) }, options);
}
