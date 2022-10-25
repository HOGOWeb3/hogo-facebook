import { AsyncStorage } from "react-native";

const STORAGE_KRY = 'profile';

class ProfileRepo {
  constructor() {
    this.profilePromise = (
      AsyncStorage.getItem(STORAGE_KRY)
        .then((profile) => {
          if (!profile) {
            profile = {};
          } else {
            profile = JSON.parse(profile);
          }
          return profile;
        })
    );
  }

  async getProfile() {
    return await this.profilePromise;
  }

  async updateProfile() {
    const profile = await this.profilePromise;
    const stringified = JSON.stringify(profile);
    return await AsyncStorage.setItem(STORAGE_KRY, stringified);
  }
}

export default new ProfileRepo();
