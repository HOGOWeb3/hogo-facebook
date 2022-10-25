import {Alert, Linking} from 'react-native';
import { strings, jsstrings } from '../locales/i18n';
import errorConnector from './error';

function strToQuotedStr(value) {
  return JSON.stringify(value + '');
}

const WRITE_MESSAGE_BLOCK_HTML = `
  <textarea id='encsendtextarea' style='flex:1;border: black solid 1px;border-radius: 6px;'></textarea>
  <button id='encsendbutton' style='font-size: 14px;'>${strings('dialog.send')}</button>
`.split('"').join('\\"').split('\n').join('\\\n');

const INIT_SCRIPT = (execId) => `(function() {
  try {
    if (!window._START_AT) {
      window._START_AT = +new Date;
    }
    if (window._IS_UNLOAD_CALLED) {
      return;
    }
    /*IOS issue workaround from https://github.com/facebook/react-native/issues/10865
    (function() {
      var originalPostMessage = window.postMessage;
      if (!window.initialPostMessage) { / *RN IOS sets this* /
        window.initialPostMessage = window.originalPostMessage || originalPostMessage;
      }
      var isInCall = false;
      var patchedPostMessage = function(message) {
        if (isInCall) {
          debugger;
        }
        isInCall = true;
        try {
        if (arguments.length === 3) {
          try {
            window.initialPostMessage(message, arguments[1], arguments[2]);
          } catch(e) {
            console.log(e);
            alert(arguments.length + ':(' + e + '');
            setTimeout(function() {
              window.ReactNativeWebView.postMessage(message, arguments[1], arguments[2]);
            }, 1500);
          }
          return;
        }

        if (arguments.length === 2) {
          try {
            window.initialPostMessage(message, arguments[1]);
          } catch(e) {
            debugger;
            console.log(e);
            setTimeout(function() {
              window.ReactNativeWebView(message, arguments[1]);
            }, 1500);
          }
          return;
        }

        originalPostMessage(message);
        }finally{
          isInCall = false;
        }
      };

      patchedPostMessage.toString = function() {
        return String(Object.hasOwnProperty).replace('hasOwnProperty', 'postMessage');
      };

      if (patchedPostMessage.toString() === window.postMessage.toString()) {
        return;
      }
debugger;
      window.postMessage = patchedPostMessage;
    })();*/

    var prevSentState = null;
    if (document.body && !window._CLICK_A_HANDLER_INSTALLED) {
      document.body.addEventListener('click', function(event) {
        var el = event.target;
        var needle = 'https://m.facebook.com';
        if (el.tagName !== 'A') {
          return;
        }
        if (!el.href || el.href.substr(0, needle.length) === needle) {
          return;
        }
        event.preventDefault();
        window.postMessage2(JSON.stringify({type: "link", url: el.href}));
      });
      window._CLICK_A_HANDLER_INSTALLED = 1;
    }

    if (!window.postMessage2) {
      window.postMessage2 = function(msg) {
        try {
          window.ReactNativeWebView.postMessage(msg);
          return;
        }catch(e) {
          if (+new Date - window._START_AT > 5000) {
            setTimeout(function(){
              console.warn('requesting reload');
              postMessage2(JSON.stringify({type: 'reload'}));
              setTimeout(function() {
                location.href = location.href;
                location.reload();
              }, 1000);
            });
            window.postMessage2 = function() {};
          }
          console.log('postMessage2 error', msg, e);
          setTimeout(function() {
            window.postMessage2(msg);
          }, 100);
        }
      };

      window.open = function(url) {
        window.postMessage2(JSON.stringify({type: "link", url: url}));
      };

      window.addEventListener('beforeunload', function(event) {
        window._IS_UNLOAD_CALLED = true;
        window.postMessage2('{"type": "unload"}');
      });
      window.addEventListener('error', function(event) {
        window.postMessage2(JSON.stringify({
          type: 'error',
          message: event.message,
          details: event.error ? event.error.toString() : null
        }));
      });
    }

    window.__GET_MESSAGE_ELELMENT = function(uuid, dsId) {
      if (uuid) {
        return document.querySelector('[data-store*="' + uuid + '"]');
      }
      if (dsId) {
        return document.querySelector('[data-store-id="' + dsId + '"]');;
      }
      var msgEls = document.querySelectorAll('[data-sigil~=message-text]');
      for(var index = 0; index < msgEls.length; index++) {
        var el = msgEls[index];
        if (!el.getAttribute('data-store-id')) {
          return el;
        }
      }
      return null;
    };

    function sendState() {
      var state = getState();
      var stringState = JSON.stringify(state);
      /*externallinks();*/
      if (stringState === prevSentState && (!state.messages || !state.messages.length)) {
        return;
      }
      window.postMessage2(stringState);
      prevSentState = stringState;
    }

    function findChilnderWithClass(element, className) {
      if (~element.className.indexOf(className)) {
        return element;
      }
      for(var child = element.firstChild; child !== null; child = child.nextSibling) {
        var found = findChilnderWithClass(child, className);
        if (found) {
          return found;
        }
      }
      return null;
    }

    function normalizeProfileUrl(url) {
      var m = url.match(/^https\\:\\/\\/m\\.facebook\\.com\\/(profile\\.php\\?id\\=(\\d+))(\\&.*)?$/);
      if (!m) {
        m = url.match(/^https\\:\\/\\/m\\.facebook\\.com\\/([^\\/\\?]+)(\\?.*)?$/);
      }
      if (!m) {
        m = url.match(/^https\\:\\/\\/m\\.facebook\\.com\\/messages\\/read\\/\\?[^\\#]+\\#\\!\\/([^?]+)\\?/);
      }
      if (!m) {
        console.warn('Url error', url);
        debugger;
        return null;
      }
      return m[1];
    }

    function parseDialog(state) {
      var msgEls = document.querySelectorAll('[data-sigil~=message-text]');
      var currentAuthor = null;
      state.messages = [];
      for(var index = 0; index < msgEls.length; index++) {
        var el = msgEls[index];
        try {
          var ds = JSON.parse(el.getAttribute("data-store"));
          if (el.parentElement.parentElement.previousSibling && el.parentElement.parentElement.previousSibling.href) {
            var profileUrl = el.parentElement.parentElement.previousSibling.href;
            currentAuthor = normalizeProfileUrl(profileUrl);
          }
          if (el.processed /*&& index > 0??? why*/) {
            continue;
          }
          if (!currentAuthor) {
            return;
          }
          state.messages.push({
            text: el.textContent.split(' ').join(''),
            dataStore: ds,
            dataStoreId: el.getAttribute('data-store-id'),
            author: currentAuthor,
            profileUrl
          });
        } catch(e) {
          console.error(e.message);
        }
      }
    }

    function patchDialog() {
      try{
        var sendencdiv = document.querySelector('#sendencdiv');
        var composerDiv = document.querySelector('#message-reply-composer');

        if (!composerDiv) {
          return false;
        }
        if (composerDiv.style.height !== 0) {
          composerDiv.style.height = 0;
          composerDiv.style.overflow = 'hidden';
        }
      }catch(e){
        console.error(e.message||(e+''));
      }
    }

    function externallinks() {
    	var anchors = document.getElementsByTagName('a');
      var needle = 'https://m.facebook.com';
    	for (var i=0; i<anchors.length; i++) {
    		var anchor = anchors[i];
        var href = anchor.getAttribute('href');
    		if (!href || href.substr(0, needle.length) === needle || anchor.target === '_blank') {
          continue;
        }
			  anchor.target = '_blank';
    	}
    }

    function getState() {
      var loginNotice = document.querySelector('[data-sigil=m_login_notice]');
      var dialogLink = document.querySelector('[data-sigil="dialog-link"]');
      var tids = document.querySelector('[name=tids]');
      var composerInput = document.querySelector('#composerInput');
      var state = {
        type: 'state',
        loginNotice: loginNotice && loginNotice.textContent,
        referrer: document.referrer,
      };
      if (document.getElementById('m_login_email')) {
        state.isLoggedIn = false;
        state.page = 'login';
      } else if (document.querySelector('[href="/login/save-device/cancel/?flow=interstitial_nux&nux_source=regular_login"]')) {
        state.isLoggedIn = true;
        state.page = 'one-touch';
      } else if (document.querySelector("[type=password]")) {
        state.isLoggedIn = false;
        state.page = 'password';
      } else if (document.querySelector('[action^="/login/device-based/validate-pin/?"]')) {
        state.isLoggedIn = false;
        state.page = 'login-select';
      } else if (!dialogLink && !composerInput) {
        state.isLoggedIn = true;
        state.page = 'logged-in';
      } else if (dialogLink && dialogLink.getBoundingClientRect().height) {
        state.isLoggedIn = true;
        state.page = 'dialogs';
      } else if (composerInput) {
        state.isLoggedIn = true;
        state.page = 'dialog';
        state.tids = tids && tids.value;
        var ajaxify = document.querySelectorAll('[data-ajaxify-href]');
        state.isAvailableOlderMessages = false;
        for (var i = 0; i < ajaxify.length; i++) {
          if (ajaxify[i].clientHeight) {
            state.isAvailableOlderMessages = true;
            break;
          }
        }
        parseDialog(state);
        patchDialog();
      } else {
        state.isLoggedIn = true;
        state.page = 'logged-in';
      }
      return state;
    }

    function startObservingState() {
      sendState();
      if (window._SUBSCRIBED_TO_STATE_CHANGES) {
        return;
      }
      var observer = new MutationObserver(sendState);
      observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true
      });
      window._SUBSCRIBED_TO_STATE_CHANGES = true;
    }
    if (document.readyState === "loading") {
      document.addEventListener('DOMContentLoaded', startObservingState);
    } else {
      startObservingState();
    }
    if ("${execId}") {
      window.postMessage2('{"execId": "${execId}"}');
    }
  } catch(e) {
    console.error(e.message || (e + ''));
  }
})()`;

export default class FbNet {
  constructor() {
    this._execCounter = 1;

    this._execInProgress = Object.create(null);
    this._execText = Object.create(null);
    this._stateListeners = [];

    this._webViewPromise = new Promise((resolve, reject) => {
      this._webViewPromiseResolve = resolve;
      this._webViewPromiseReject = reject;
    });
    fb = this;
    this.injectedJavaScript = INIT_SCRIPT('');
  }

  setWebView(webView) {
    if (!webView) {
      throw new Error('webView requred');
    }
    if (this._isWebViewSet) {
      this._webViewPromise = new Promise((resolve, reject) => {
        this._webViewPromiseResolve = resolve;
        this._webViewPromiseReject = reject;
      });
    }
    this._isWebViewSet = true;
    this._webViewPromiseResolve(webView);
    this._init();
  }

  sendInitScript() {
    this._init();
  }

  _init() {
    const execId = this._execCounter++;
    let interval = null;
    this._execInProgress[execId] = {
      resolve: () => {
        clearInterval(interval);
      },
      reject: (why) => {
        clearInterval(interval);
        console.warn('Init rejected', why);
      }
    };
    console.log(`_init(${execId})`);
    this._webViewPromise.then(webView => {
      interval = setInterval(() => {
        console.log(`init(${execId})`);
        webView.injectJavaScript(INIT_SCRIPT(execId));
      }, 500);
    });
  }

  async _queryState() {
    return await this.sendInitScript();
  }

  onMessage = (event) => {
    const {data} = event.nativeEvent;
    console.log('onMessage', data);
    if (!data || typeof data !== 'string' || data.startsWith('setImmediate')) {
      return;
    }
    let dataParsed = null;
    try {
      dataParsed = JSON.parse(data);
    } catch(e) {
      console.warn( 'Invalid post message: ' + data + e.message, e );
      return;
    }
    if (!this._gotState && dataParsed.type !== 'state') {
      this._queryState();
    }
    switch (dataParsed.type) {
      case 'state':
        this._gotState = true;
        this._stateListeners.forEach( cb => {
          try {
            cb(dataParsed);
          } catch(e){}
        });
        break;
      case 'error':
        debugger;
        errorConnector.onError(dataParsed.message, dataParsed.details);
        console.error(dataParsed);
        break;
      case 'unload':
        //Abort all pending calls
        for(let execId in this._execInProgress) {
          this._execInProgress[execId].reject('unload');
          delete this._execInProgress[execId];
        }
        this._init();
        break;
      case 'reload':
        this._webViewPromise.then(webView => {
          webView.reload();
        } );
        break;
      case 'join':
        if (this._onJoin) {
          this._onJoin();
        } else {
          console.error('join without handler');
        }
        break;
      case 'send':
        if (this._onSend) {
          this._onSend(dataParsed.text);
        } else {
          console.error('send without handler');
        }
        break;
      case 'stoploading':
        if (this._onStoploading) {
          this._onStoploading(dataParsed.tids);
        }
        break;
      case 'link':
        console.log('open url', dataParsed.url);
        Linking.openURL(dataParsed.url);
        break;
      default:
        if (!('execId' in dataParsed)) {
          console.warn(data);
          break;
        }
        if (!this._execInProgress[dataParsed.execId]) {
          break;
        }
        if (dataParsed.error) {
          errorConnector.onError(dataParsed.error);
          console.warn('exec error', dataParsed);
          this._execInProgress[dataParsed.execId].reject(dataParsed.res);
        } else {
          this._execInProgress[dataParsed.execId].resolve(dataParsed.res);
        }

        delete this._execInProgress[dataParsed.execId];
        break;
    }
  }

  onJoin(func) {
    if (typeof func !== 'function') {
      throw new Error('Function required');
    }
    if (this._onJoin) {
      throw new Error('onJoin already set');
    }
    this._onJoin = func;
  }

  onSend(func) {
    if (typeof func !== 'function') {
      throw new Error('Function required');
    }
    if (this._onSend) {
      throw new Error('onSend already set');
    }
    this._onSend = func;
  }

  onStoploading(func) {
    if (typeof func !== 'function') {
      throw new Error('Function required');
    }
    if (this._onStoploading) {
      throw new Error('onStoploading already set');
    }
    this._onStoploading = func;
  }

  _updateExecErrorContext() {
    errorConnector.setContext('execInProgress', this._execText);
  }

  exec(functionString, description) {
    return this._webViewPromise.then( webView =>
      new Promise( (resolve, reject) => {
        var id = this._execCounter++;
        this._execText[id] = functionString;
        this._updateExecErrorContext();
        this._execInProgress[id] = {
          resolve: param => {
            delete this._execText[id];
            this._updateExecErrorContext();
            resolve(param);
          },
          reject: param => {
            delete this._execText[id];
            this._updateExecErrorContext();
            reject(param);
          }
        };
        functionString = functionString+'';
        webView.injectJavaScript(this.execScript(functionString, id, description || 'no description'));
      })
    );
  }

  execScript(functionString, id, description) {
    return `
      try{
      (function(){
        if (window.postMessage.length !== 1) {
          console.error('!!!window.postMessage.length !== 1');
        }
        var res=${functionString};
        if (res && res.then){
          res.then(function(res2){
            window.postMessage2(JSON.stringify({
              execId:${id},
              res:res2
            }));
          }, function(e){
            window.postMessage2(JSON.stringify({
              execId:${id},
              error:e.message||(e+'')
            }));
          });
          return;
        }
        window.postMessage2(JSON.stringify({
          execId:${id},
          res:res
        }));
      })();
    }catch(e){
      window.postMessage2(JSON.stringify({
        execId:${id},
        error:e.message||(e+'')
      }));
    }
    `;
  }

  async sendTextMessage(tids, text) {
    return await this.exec(`(function() {
      var tids = document.querySelector('[name=tids]');
      var textarea = document.querySelector('#composerInput');
      var button = document.querySelector('[name=send]');

      if (!tids || tids.value !== '${tids/*TODO: escape*/}' || !textarea || !button) {
        console.error('tids mismatch');
        return false;
      }
      textarea.value = '${text}';
      if ("createEvent" in document) {
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent("change", false, true);
        textarea.dispatchEvent(evt);
      } else {
        textarea.fireEvent("onchange");
      }
      var prevmsgCount = document.querySelectorAll('[data-sigil~=message-text]').length;
      setTimeout(button.click.bind(button), 10);
      setTimeout(function() {
        var newmsgCount = document.querySelectorAll('[data-sigil~=message-text]').length;
        if (prevmsgCount === newmsgCount) {
          postMessage2(JSON.stringify({type: 'reload'}));
        }
      }, 2000);
    })()`, `sendTextMessage(${tids}, ${text})`);
  }

  async loadDialogMore(tids) {
    return await this.exec(`(function() {
      var tids = document.querySelector('[name=tids]');
      if (!tids || tids.value !== '${tids/*TODO: escape*/}') {
        return false;
      }

      var ajaxify = document.querySelectorAll('[data-ajaxify-href]');
      for (var i = 0; i < ajaxify.length; i++) {
        if (ajaxify[i].clientHeight) {
          ajaxify[i].click();
          break;
        }
      }
    })()`, `loadDialogMore(${tids})`);
  }

  async setJoinButton() {
    return await this.exec(`(function() {
      var composerDiv = document.querySelector('#message-reply-composer');
      var joinDiv = document.querySelector('#joindiv');
      var newMessageDiv = document.querySelector('#newmessagediv');
      var joinButton;
      if (newMessageDiv) {
        newMessageDiv.remove();
      }
      if (joinDiv || !composerDiv) {
        return;
      }
      joinButton = document.createElement('button');
      joinButton.appendChild(document.createTextNode('${jsstrings('dialog.join')}'));
      joinButton.style.flex = '1';
      joinButton.onclick = function() {
        joinButton.disabled = true;
        window.postMessage2('{"type": "join"}');
      };
      joinDiv = document.createElement('div');
      joinDiv.id = 'joindiv';
      joinDiv.style.display = 'flex';
      joinDiv.appendChild(joinButton);
      composerDiv.parentElement.appendChild(joinDiv);
    })()`, 'setJoinButton');
  }

  async setNewMessageInterface() {
    return await this.exec(`(function() {
      var composerDiv = document.querySelector('#message-reply-composer');
      var newMessageDiv = document.querySelector('#newmessagediv');
      var joinDiv = document.querySelector('#joindiv');
      var joinButton;
      if (joinDiv) {
        joinDiv.remove();
      }
      if (newMessageDiv || !composerDiv) {
        return;
      }
      newMessageDiv = document.createElement('div');
      newMessageDiv.id = 'newmessagediv';
      newMessageDiv.style.display = 'flex';
      newMessageDiv.innerHTML = "${WRITE_MESSAGE_BLOCK_HTML}";
      composerDiv.parentElement.appendChild(newMessageDiv);

      var encsendbutton = document.querySelector('#encsendbutton');
      var encsendtextarea = document.querySelector('#encsendtextarea');
      encsendbutton.onclick = function() {
        var text = encsendtextarea.value.trim();
        if (!text) {
          encsendtextarea.value = '';
          return;
        }
        window.postMessage2(JSON.stringify({
          type: "send",
          text: text
        }));
        encsendbutton.disabled = true;
        encsendtextarea.disabled = true;
      };
      encsendtextarea.addEventListener('focus', function(event) {
        setTimeout(function() { encsendtextarea.scrollIntoView(true); }, 500);
        setTimeout(function() { encsendtextarea.scrollIntoView(true); }, 1000);
      });
      encsendtextarea.addEventListener('keypress', function(event) {
        if (event.keyCode === 13) {
          event.preventDefault();
          encsendbutton.click();
        }
      });
    })()`, 'setNewMessageInterface');
  }

  async setLoneliness(isLonely) {
    if (!isLonely) {
      return await this.exec(`(function() {
        var lonelinessDiv = document.querySelector('#lonelinessdiv');
        if (lonelinessDiv) {
          lonelinessDiv.remove();
        }
      })()`, 'setLoneliness(false)');
    }
    return await this.exec(`(function() {
      var composerDiv = document.querySelector('#message-reply-composer');
      var joinDiv = document.querySelector('#joindiv');
      var newMessageDiv = document.querySelector('#newmessagediv');
      var lonelinessDiv = document.querySelector('#lonelinessdiv');
      var joinButton;
      if (newMessageDiv) {
        newMessageDiv.remove();
      }
      if (joinDiv) {
        joinDiv.remove();
      }
      if (lonelinessDiv || !composerDiv) {
        return;
      }
      lonelinessDiv = document.createElement('div');
      lonelinessDiv.id = 'lonelinessdiv';
      lonelinessDiv.style.display = 'flex';
      lonelinessDiv.appendChild(document.createTextNode('${jsstrings('dialog.loneliness')}'));
      composerDiv.parentElement.appendChild(lonelinessDiv);
    })()`, 'setLoneliness(true)');
  }

  async clearNewMessage() {
    return await this.exec(`(function() {
      var encsendtextarea = document.querySelector('#encsendtextarea');
      if (encsendtextarea) {
        encsendtextarea.value = '';
      }
    })()`, 'clearNewMessage');
  }

  async enableNewMessage() {
    return await this.exec(`(function() {
      var encsendbutton = document.querySelector('#encsendbutton');
      var encsendtextarea = document.querySelector('#encsendtextarea');
      if (encsendbutton) {
        encsendbutton.disabled = false;
      }
      if (encsendtextarea) {
        encsendtextarea.disabled = false;
      }
    })()`, 'enableNewMessage');
  }

  async replaceWithDecryptedMessage(encryptedMessage, text) {
    if (!encryptedMessage) {
      throw new Error('encryptedMessage required');
    }
    if (!text) {
      throw new Error('text required');
    }
    const {dataStoreId, dataStore} = encryptedMessage;
    const uuid = dataStore ? dataStore.uuid : null;
    return await this.exec(`(function() {
      var messageEl = window.__GET_MESSAGE_ELELMENT("${uuid || ""}", "${dataStoreId || ""}");
      if (!messageEl) {
        console.warn('replaceWithDecryptedMessage not found');
        return;
      }
      if (messageEl.processed) {
        return;
      }
      messageEl.processed = 'replaceWithDecryptedMessage';
      messageEl.style.background = '#afa';
      messageEl.style.color = '#000';
      messageEl.textContent = decodeURIComponent("${encodeURIComponent(text)}");
    })()`, 'replaceWithDecryptedMessage ');
  }

  async ignoreMessage(encryptedMessage) {
    if (!encryptedMessage) {
      throw new Error('encryptedMessage required');
    }
    const {dataStoreId, dataStore} = encryptedMessage;
    const uuid = dataStore ? dataStore.uuid : null;
    return await this.exec(`(function() {
      var messageEl = window.__GET_MESSAGE_ELELMENT("${uuid || ""}", "${dataStoreId || ""}");
        if (!messageEl) {
          console.warn('ignoreMessage not found');
          return;
        }
        if (messageEl.processed) {
          return;
        }
        messageEl.processed = 'ignoreMessage';
      })()`, 'ignoreMessage');
  }

  async replaceWithJoinedMessage(encryptedMessage) {
    if (!encryptedMessage) {
      throw new Error('encryptedMessage required');
    }
    const {dataStoreId, dataStore} = encryptedMessage;
    const uuid = dataStore ? dataStore.uuid : null;
    return await this.exec(`(function() {
      var messageEl = window.__GET_MESSAGE_ELELMENT("${uuid || ""}", "${dataStoreId || ""}");
        if (!messageEl) {
          console.warn('replaceWithJoinedMessage not found');
          return;
        }
        if (messageEl.processed) {
          return;
        }
        messageEl.processed = 'replaceWithJoinedMessage';
        messageEl.style.background = '#eee';
        messageEl.textContent = '${jsstrings('dialog.joined_msg')}';
      })()`, `replaceWithJoinedMessage(${encryptedMessage})`);
  }

  async replaceWithUndecryptedOutgoing(encryptedMessage) {
    if (!encryptedMessage) {
      throw new Error('encryptedMessage required');
    }
    const {dataStoreId, dataStore} = encryptedMessage;
    const uuid = dataStore ? dataStore.uuid : null;
    return await this.exec(`(function() {
      var messageEl = window.__GET_MESSAGE_ELELMENT("${uuid || ""}", "${dataStoreId || ""}");
        if (!messageEl) {
          console.warn('replaceWithResendPK not found');
          return;
        }
        if (messageEl.processed) {
          return;
        }
        messageEl.processed = 'replaceWithUndecryptedOutgoing';
        messageEl.style.background = '#eee';
        messageEl.innerHTML = '${jsstrings('dialog.undecrypted_outgoing')}';
      })()`, `replaceWithUndecryptedOutgoing(${encryptedMessage})`);
  }

  async replaceWithResendPK(encryptedMessage) {
    if (!encryptedMessage) {
      throw new Error('encryptedMessage required');
    }
    const {dataStoreId, dataStore} = encryptedMessage;
    const uuid = dataStore ? dataStore.uuid : null;
    return await this.exec(`(function() {
      var messageEl = window.__GET_MESSAGE_ELELMENT("${uuid || ""}", "${dataStoreId || ""}");
        if (!messageEl) {
          console.warn('replaceWithResendPK not found');
          return;
        }
        if (messageEl.processed) {
          return;
        }
        messageEl.processed = 'replaceWithResendPK';
        messageEl.style.background = '#eee';
        messageEl.innerHTML = '${jsstrings(
          'dialog.resendpk',
          {button:`<button id=resendpk_button>${jsstrings('dialog.resendpk_btn')}</button>`}
        )}';
        var button = document.querySelector('#resendpk_button');
        if (button) {
          button.onclick = function() {
            window.postMessage2('{"type": "join"}');
          };
        } else {
          console.warn('replaceWithResendPK button not found in html');
        }
      })()`, `replaceWithResendPK(${encryptedMessage})`);
  }

  async replaceWithPrevIncomingSession(encryptedMessage) {
    if (!encryptedMessage) {
      throw new Error('encryptedMessage required');
    }
    const {dataStoreId, dataStore} = encryptedMessage;
    const uuid = dataStore ? dataStore.uuid : null;
    return await this.exec(`(function() {
      var messageEl = window.__GET_MESSAGE_ELELMENT("${uuid || ""}", "${dataStoreId || ""}");
        if (!messageEl) {
          console.warn('replaceWithPrevOutgoingSession not found');
          return;
        }
        if (messageEl.processed) {
          return;
        }
        messageEl.processed = 'replaceWithPrevIncomingSession';
        messageEl.style.background = '#eee';
        messageEl.textContent = '${jsstrings('dialog.undecrypted_incoming')}';
      })()`, `replaceWithPrevIncomingSession(${encryptedMessage})`);
  }

  async replaceWithPrevOutgoingSession(encryptedMessage) {
    if (!encryptedMessage) {
      throw new Error('encryptedMessage required');
    }
    const {dataStoreId, dataStore} = encryptedMessage;
    const uuid = dataStore ? dataStore.uuid : null;
    return await this.exec(`(function() {
      var messageEl = window.__GET_MESSAGE_ELELMENT("${uuid || ""}", "${dataStoreId || ""}");
        if (!messageEl) {
          console.warn('replaceWithPrevOutgoingSession not found');
          return;
        }
        if (messageEl.processed) {
          return;
        }
        messageEl.processed = 'replaceWithPrevOutgoingSession';
        messageEl.style.background = '#eee';
        messageEl.textContent = '${jsstrings('dialog.prevsession')}';
      })()`, `replaceWithPrevOutgoingSession(${encryptedMessage})`);
  }

  async showLoadingFullDialogWarning(tids) {
    return await this.exec(`(function() {
      var tids = document.querySelector('[name=tids]');
      if (!tids || tids.value !== '${tids/*TODO: escape*/}' ) {
        return;
      }
      var warn = document.querySelector('#loadingFullDialogWarning');
      if (warn) {
        return;
      }
      var root = document.querySelector('#root');
      warn = document.createElement('div');
      warn.id = 'loadingFullDialogWarning';
      warn.style.position = 'fixed';
      warn.style.left = 0;
      warn.style.top = '50px';
      warn.style.background = 'white';
      warn.style.border = 'solid 1px';
      warn.style.borderRadius = '10px';
      warn.style.padding = '20px';
      warn.appendChild(document.createTextNode('${jsstrings('dialog.loadingwarn')}'));
      var button = document.createElement('button');
      button.appendChild(document.createTextNode('${jsstrings('dialog.loadingwarn_btn')}'));
      button.onclick = function() {
        window.postMessage2('{"type": "stoploading", "tids": "' + tids.value + '"}');
      };
      warn.appendChild(document.createElement('br'));
      warn.appendChild(button);
      root.appendChild(warn);
    })()`, `showLoadingFullDialogWarning(${tids})`);
  }

  async hideLoadingFullDialogWarning() {
    return await this.exec(`(function() {
      var warn = document.querySelector('#loadingFullDialogWarning');
      if (warn) {
        warn.remove();
        document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
      }
    })()`, 'hideLoadingFullDialogWarning');
  }

  async warn(...args) {
    const argsStr = args.map(arg => {
      try {
        return JSON.stringify(arg);
      }catch(e) {
        return e.message;
      }
    }).map(str => 'JSON.parse(\'' + str.split('\'').join('\\\'') + '\')').join();
    return await this.exec(`(function() {
      console.warn(${argsStr});
    })()`, 'warn');
  }

  listenStateChanges(callback) {
    this._stateListeners.push(callback);
  }
}

errorConnector.wrap(FbNet);
