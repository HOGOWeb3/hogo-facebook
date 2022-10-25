import sessionRepo from './session.js';

class SessionBufferedRepo {
  constructor() {
    this._loadingSessions = Object.create(null);
    this._storingSessions = Object.create(null);
  }
  async getSessionData(sessionId) {
    if (typeof sessionId !== 'string') {
      throw new Error('sessionId string requred');
    }
    if (!this._loadingSessions[sessionId]) {
      this._loadingSessions[sessionId] = (
        sessionRepo.getSessionData(sessionId)
      );
    }
    const session = await this._loadingSessions[sessionId];
    return session;
  }
  async createNewSession(sessionId, session) {
    if (typeof sessionId !== 'string') {
      throw new Error('sessionId string required');
    }
    if (!session) {
      throw new Error('session required');
    }
    if (this._loadingSessions[sessionId]) {
      const oldSession = await this._loadingSessions[sessionId];
      if (oldSession) {
        throw new Error('Session with this id is already loaded');
      }
    }
    this._loadingSessions[sessionId] = Promise.resolve(session);
    this._storingSessions[sessionId] = this.updateSessionData(sessionId);
    return await this._storingSessions[sessionId];
  }
  async updateSessionData(sessionId) {
    if (typeof sessionId !== 'string') {
      throw new Error('sessionId string requred');
    }
    if (!this._loadingSessions[sessionId]) {
      throw new Error('Session not created or loaded');
    }
    const prevUpdate = this._storingSessions[sessionId];
    const session = await this._loadingSessions[sessionId];
    if (!session) {
      throw new Error('Session not created');
    }
    if (prevUpdate) {
      this._storingSessions[sessionId] = (
        prevUpdate.then(() =>
          sessionRepo.setSessionData(sessionId, session)
        )
      );
    } else {
      this._storingSessions[sessionId] = sessionRepo.setSessionData(sessionId, session);
    }
    await this._storingSessions[sessionId];
  }
}

export default new SessionBufferedRepo();
