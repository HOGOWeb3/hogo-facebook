import nacl from 'tweetnacl';
import FbNet from '../net/fb';
import sessionBufferedRepo from '../repo/session.buffered';
import profileRepo from '../repo/profile';
import Base64 from '../base64';
import errorConnector from '../net/error';

const INVITE_TEXT = `Let\`s use this tool to encrypt our communication through Facebook.
Please install Fondom application and log in into your facebook account. Давайте шифровать наши сообщения.
Для этого установите приложение Fondom и залогиньтесь в аккаунт фейсбука. https://secserv.me/fondom.html
`.split('\n').join(' ');

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function base64ToUint8Array(base64) {
  var binary_string =  Base64.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array( len );
  for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  var base64    = '';
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  var byteLength    = bytes.byteLength;
  var byteRemainder = byteLength % 3;
  var mainLength    = byteLength - byteRemainder;

  var a, b, c, d;
  var chunk;

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12; // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6; // 4032     = (2^6 - 1) << 6
    d = chunk & 63;               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength];

    a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4;// 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '==';
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

    a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4; // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2; // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '=';
  }

  return base64;
}

class FbController {
  constructor() {
    this._net = new FbNet();
    this.onMessage = this._net.onMessage;
    this._currentState = null;
    this._net.listenStateChanges(this.onStateChanged);
    this._net.onJoin(this.onJoin);
    this._net.onSend(this.onSend);
    this._net.onStoploading(this.onStoploading);
    this.injectedJavaScript = this._net.injectedJavaScript;
    this._pub_priv_cache = Object.create(null);
  }
  onJoin = () => {
    this.joinOrCreateSecretChat(INVITE_TEXT);
  }
  onSend = (text) => {
    if (!text) {
      this._net.enableNewMessage();
      return;
    }
    this.sendTextMessage(text);
  }
  onStoploading = (tids) => {
    this._stoppedLoading = tids;
    this._net.hideLoadingFullDialogWarning();
  }
  setWebView(webView) {
    this._net.setWebView(webView);
  }
  listenStateChanges(cb) {
    this._net.listenStateChanges(cb);
  }
  sendInitScript() {
    this._net.sendInitScript();
  }
  onStateChanged = (newState) => {
    if (newState.page !== 'dialog' || !newState.tids) {
      return;
    }
    this._currentState = newState;
    const {tids} = newState;
    if (!newState.isAvailableOlderMessages) {
      this._net.hideLoadingFullDialogWarning();
      this.processMessages();
      return
    }

    if (newState.messages.length === 0) {
      this._net.loadDialogMore(this._currentState.tids);
      return;
    }

    this.getCurrentSession().then( session => {
      const {dataStore} = newState.messages[0];
      //dataStore is null for just sent messages
      if ((!dataStore || !session.lastMessageTs || dataStore.timestamp > session.lastMessageTs) && this._stoppedLoading !== tids) {
        this._net.showLoadingFullDialogWarning(tids);
        this._net.loadDialogMore(tids);
        return;
      }
      this._net.hideLoadingFullDialogWarning();
      this.processMessages();
    });
  }

  async getDhKeyPair() {
    const profile = await profileRepo.getProfile();
    if (!profile.dhKeyPair) {
      const {publicKey, secretKey} = nacl.box.keyPair();
      profile.dhKeyPair = {
        publicKey: uint8ArrayToBase64(publicKey),
        secretKey: uint8ArrayToBase64(secretKey)
      };
      await profileRepo.updateProfile();
    }
    return profile.dhKeyPair;
  }

  async getCurrentSession() {
    const {tids} = this._currentState;
    let session = await sessionBufferedRepo.getSessionData(tids);
    if (!session) {
      session = {
        keysPerPid: {},
        selfUserId: null,
        lastMessageTs: 0,
        keysTsPerPid: {}
      };
      await sessionBufferedRepo.createNewSession(tids, session);
    }
    if (!session.keysTsPerPid) {
      session.keysTsPerPid = {};
    }
    return session;
  }
  async processMessages() {
    const {tids, messages} = this._currentState;
    const session = await this.getCurrentSession();
    const dhKeyPair = await this.getDhKeyPair();
    const secretKey64 = dhKeyPair.secretKey;
    let isSessionUpdated = this.extractPublicKeys(session, messages, dhKeyPair.publicKey);
    if (session.selfUserId) { //is joined
      if (this.decryptMessages(
          session,
          messages,
          secretKey64
        )) {
          isSessionUpdated = true;
        }
    }
    if (isSessionUpdated) {
      await sessionBufferedRepo.updateSessionData(tids);
    }
    if ( this._currentState.tids !== tids) {
      alert('tids changed');
      return;
    }
    this.reactToProcessedMessages(session);
  }

  extractPublicKeys(session, messages, publicKey64) {
    let isSessionUpdated = false;
    messages.forEach((message) => {
      let b64Key = null;
      const {author, dataStore, text} = message;
      const textTruncated = text.split('---')[0].split('_')[0];
      try {
        b64Key = base64ToUint8Array(textTruncated);
      }catch(e) {
        return;
      }
      if (b64Key.length !== 32) {
        return;
      }
      if (textTruncated === publicKey64) {
        if (!session.selfUserId) {
          //Not joined yet
          session.selfUserId = author;
          session.sentPKTimestamp = dataStore ? dataStore.timestamp : +new Date;
          delete session.keysPerPid[author];
          isSessionUpdated = true;
        }
        return;
      }
      if (session.keysPerPid[author] !== textTruncated &&
        (!session.keysTsPerPid[author] || !dataStore || session.keysTsPerPid[author] < dataStore.timestamp)) {
        if (author === session.selfUserId || author === 'profile.php') {
          // console.log('Self key mismatch', author);
        } else {
          session.keysPerPid[author] = textTruncated;
          session.keysTsPerPid[author] = dataStore ? dataStore.timestamp : +new Date;
          isSessionUpdated = true;
        }
      }
    });
    return isSessionUpdated;
  }

  decryptMessages(session, messages, secretKey64) {
    let isSessionUpdated = false;
    //Do not decrypt more than 5 messages at ones
    for (let i = 0; i < messages.length && i < 5; i++) {
      let message = messages[messages.length - i - 1];
      const {dataStore} = message;
      const startAt = +new Date;
      try {
        if (this.decryptMessage(session, secretKey64, message)) {
          isSessionUpdated = true;
        }
      }catch(e) {
        console.error(e);
      }
      const ts = +new Date-startAt;
      if (ts > 50) {
        console.warn('decryptMessage took', ts, message);
      }
      if (dataStore && dataStore.timestamp > session.lastMessageTs) {
        session.lastMessageTs = dataStore.timestamp;
        isSessionUpdated = true;
      }
    }
    return isSessionUpdated;
  }

  reactToProcessedMessages(session) {
    if (session.selfUserId) {
      //If is joined
      for (let pid in session.keysPerPid) {
        this._net.setNewMessageInterface();
        this._net.setLoneliness(false);
        return;
      }
      this._net.setLoneliness(true);
      return;
    }
    this._net.setLoneliness(false);
    for (let pid in session.keysPerPid) {
      //Autojoin if there's at least one participant
      this.joinOrCreateSecretChat();
      return;
    }
    this._net.setJoinButton();
  }

  decryptMessage(session, secretKey64, message) {
    const {author, dataStore, text} = message;
    let partsUint8 = null;
    let partBase64 = null;
    let isSessionUpdated = false;
    try {
      partBase64 = text.split('---')[0].split('_');
      partsUint8 = partBase64.map(base64ToUint8Array);
    }catch(e) {
      this._net.ignoreMessage(message);
      return;
    }
    if (partsUint8.length === 1 && partsUint8[0].length == 32) {
      this._net.warn('calling replaceWithJoinedMessage');
      this._net.replaceWithJoinedMessage(message);
      return;
    }
    if (partsUint8.length === 1) {
      this._net.ignoreMessage(message);
      return;
    }
    if (dataStore && session.sentPKTimestamp > dataStore.timestamp) {
      if (author === session.selfUserId || author === 'profile.php') {
        this._net.replaceWithUndecryptedOutgoing(message);
      } else {
        this._net.replaceWithPrevIncomingSession(message);
      }
      return;
    }
    let plainText;
    if (author === session.selfUserId || author === 'profile.php') {
      plainText = this.decryptOutgoingMessage(session, partsUint8, secretKey64);
    } else {
      plainText = this.decryptIncomingMessage(partsUint8, secretKey64);
      if (!plainText) {
        this._net.replaceWithResendPK(message);
      }
      //TODO: check timestamp if already set
      if (!session.keysPerPid[author]) {
        isSessionUpdated = true;
        session.keysPerPid[author] = partBase64[0];
      }
    }
    if (plainText) {
      this._net.replaceWithDecryptedMessage(message, plainText);
    }
    return isSessionUpdated;
  }

  decryptOutgoingMessage(session, partsUint8, secretKey64) {
    const nonce = partsUint8[1];
    const encryptedMessage = partsUint8[2];
    for(let i = 2; i < partsUint8.length; i++) {
      for(let pid in session.keysPerPid) {
        const sharedKey = this.getSharedKey(session.keysPerPid[pid], secretKey64);
        const encKey = nacl.box.open.after(partsUint8[i], nonce, sharedKey);
        if (!encKey) {
          continue;
        }
        const plain = nacl.secretbox.open(encryptedMessage, nonce, encKey);
        if (!plain) {
          continue;
        }
        const plainText = new TextDecoder("utf-8").decode(plain);
        if (plainText) {
          return plainText;
        }
      }
    }
  }

  decryptIncomingMessage(partsUint8, secretKey64) {
    const publicKey = partsUint8[0];
    const nonce = partsUint8[1];
    const encryptedMessage = partsUint8[2];
    for(let i = 3; i < partsUint8.length; i++) {
      const sharedKey = this.getSharedKey(publicKey, secretKey64);
      const encKey = nacl.box.open.after(partsUint8[i], nonce, sharedKey);
      if (!encKey) {
        continue;
      }
      const plain = nacl.secretbox.open(encryptedMessage, nonce, encKey);
      if (!plain) {
        continue;
      }
      const plainText = new TextDecoder("utf-8").decode(plain);
      if (plainText) {
        return plainText;
      }
    }
  }

  getSharedKey(pub64, secretKey64) {
    if (pub64.constructor === Uint8Array) {
      pub64 = uint8ArrayToBase64(pub64);
    }
    if (secretKey64.constructor === Uint8Array) {
      secretKey64 = uint8ArrayToBase64(secretKey64);
    }
    const id = pub64 + '_' + secretKey64;
    if (!this._pub_priv_cache[id]) {
      this._pub_priv_cache[id] = nacl.box.before(base64ToUint8Array(pub64), base64ToUint8Array(secretKey64));
    }
    return this._pub_priv_cache[id];
  }

  async joinOrCreateSecretChat(additionalText){
    const {tids} = this._currentState;
    const session = await this.getCurrentSession();
    const dhKeyPair = await this.getDhKeyPair();
    const messageText = dhKeyPair.publicKey;
    if (this.joinInProgress === tids) {
      return;
    }
    this.joinInProgress = tids;
    if (additionalText) {
      return await this._net.sendTextMessage(tids, messageText + '---' + additionalText);
    }
    return await this._net.sendTextMessage(tids, messageText);
  }

  async sendTextMessage(text) {
    const {tids} = this._currentState;
    const {keysPerPid} = await this.getCurrentSession();
    const dhKeyPair = await this.getDhKeyPair();
    const nonce = nacl.randomBytes(24);
    const encKey = nacl.randomBytes(32);
    const secretKey = base64ToUint8Array(dhKeyPair.secretKey);
    const ui8Text = new TextEncoder("utf-8").encode(text);
    const messageParts = [];
    messageParts.push(base64ToUint8Array(dhKeyPair.publicKey));
    messageParts.push(nonce);
    messageParts.push(nacl.secretbox(ui8Text, nonce, encKey));
    for (let pid in keysPerPid) {
      if (!keysPerPid.hasOwnProperty(pid)) {
        continue;
      }
      const publicKey = base64ToUint8Array(keysPerPid[pid]);
      const encryptedKey = nacl.box(encKey, nonce, publicKey, secretKey);
      messageParts.push(encryptedKey);
    }
    if (messageParts.length === 2) {
      throw new Error('No recipients');
    }
    const messageText = messageParts.map(uint8ArrayToBase64).join('_');
    try {
      await this._net.sendTextMessage(tids, messageText);
      await this._net.clearNewMessage();
    }catch(e) {
    }finally {
      await this._net.enableNewMessage();
    }
  }
}

export default new FbController();

errorConnector.wrap(FbController);
