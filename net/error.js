class ErrorConnector {
  constructor() {
    this._contexts = Object.create(null);
    this._sentCount = 0;
    this._sendMessages = Object.create(null);
  }

  setContext(name, obj) {
    if (typeof name !== 'string') {
      throw new Error('name must be string');
    }
    if (__DEV__) {
      try {
        JSON.stringify(obj);
      } catch(e) {
        debugger;
        console.error('Cannot serialize error context', obj);
        return;
      }
    }
    this._contexts[name] = obj;
  }

  removeContext(name) {
    if (typeof name !== 'string') {
      throw new Error('name must be string');
    }
    delete this._contexts[name];
  }

  onError(message, data) {
    if (this._sendMessages[message]) {
      return;
    }
    if (this._sentCount >= 5) {
      return;
    }
    if (typeof message !== 'string') {
      console.error('Error message is not string', message);
      message = '';
    }
    try  {
      JSON.stringify(data);
    } catch(e) {
      data = null;
      console.error(e);
    }

    let queryString;
    try {
      queryString = JSON.stringify({message, data, context: this._contexts});
    }catch(e) {
      try {
        queryString = JSON.stringify({message, data});
        console.error(e);
      } catch(e) {
        queryString = message;
        console.error(e);
      }
    }

    try {
      fetch('https://secserv.me/fk_error?' + encodeURIComponent(queryString),{
        method: 'POST'
      });
      this._sendMessages[message] = 1;
      this._sentCount++;
    } catch(e) {
      console.error(e);
    }
  }

  wrap(Class) {
    const props = Object.getOwnPropertyNames(Class.prototype);
    for (let name of props) {
      let value = Class.prototype[name];
      if (typeof value !== 'function') {
        continue;
      }
      Class.prototype[name] = function() {
        let res = null;
        try {
          res = value.apply(this, arguments);
        } catch(e) {
          errorConnector.onError(`calling ${name}: ${e.message}`, arguments);
          throw e;
        }
        if (res && res.then && res.catch) {
          return res.catch(e => {
            errorConnector.onError(`calling async ${name}: ${e.message}`, arguments);
            throw e;
          });
        }
        return res;
      };
    }
  }
}

export default new ErrorConnector();
