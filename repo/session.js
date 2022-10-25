import { AsyncStorage } from "react-native";

const STORAGE_PREFIX = 'sess_';

function getStorageKey(sessionId) {
  return `${STORAGE_PREFIX}${sessionId}`;
}

class SessionRepository {
  async setSessionData(sessionId, sData) {
    if (typeof sessionId !== 'string') {
      throw new Error(`sessionId string required`);
    }
    if (!sData) {
      throw new Error('sData requred');
    }
    const storageKey = getStorageKey(sessionId);
    const stringified = JSON.stringify(sData);
    return await AsyncStorage.setItem(storageKey, stringified);
  }
  async getSessionData(sessionId) {
    if (typeof sessionId !== 'string') {
      throw new Error(`sessionId string required`);
    }
    const storageKey = getStorageKey(sessionId);
    const json = await AsyncStorage.getItem(storageKey);
    const sData = json && JSON.parse(json);

    return sData;
  }
  async deleteSession(sessionId) {
    if (typeof sessionId !== 'string') {
      throw new Error(`sessionId string required`);
    }
    const storageKey = getStorageKey(sessionId);
    await AsyncStorage.removeItem(storageKey);
  }
  async isAnySession() {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(key => key.startsWith(STORAGE_PREFIX)).length > 0;
  }
}

export default new SessionRepository();
