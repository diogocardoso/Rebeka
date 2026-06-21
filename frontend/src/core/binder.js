import { getState } from './store.js';

export class Binder {
    constructor(root) {
      if (!root) throw new TypeError('root é obrigatório');
    //   if (typeof getState !== 'function') {
    //     throw new TypeError('getState deve ser uma função');
    //   }
      this.root = root;
      this.getState = getState;
      this._bound = false;
    }
    bind() {
      if (this._bound) return;
      this._bound = true;
      this.click();
      this.mouseleave();
      this.dblclick();
    }
    click() {}
    mouseleave() {}
    dblclick() {}
  }