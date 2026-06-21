export class Register {
    constructor() {
      if (new.target === Register) {
        throw new TypeError('Register é abstrata — use extends');
      }
      if (typeof this.handlers !== 'function') {
        throw new TypeError(`${new.target.name}: handlers() é obrigatório`);
      }
      // opcional: detectar se ainda é o método da base
      if (this.handlers === Register.prototype.handlers) {
        throw new TypeError(`${new.target.name}: handlers() deve ser sobrescrito`);
      }
    }
  
    register() {
      this.handlers();
    }
  }