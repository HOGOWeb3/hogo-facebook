import {Platform} from 'react-native';

import packageJson from '../package.json';

class UpdateController {
  constructor() {

  }

  async getUpdateInfo() {
    try {
      // if (Platform.OS !== 'android') {
      const response = await fetch('https://secserv.me/fk_version.json');
      return {
        isSupported: true,
        selfVersionStr: packageJson.version,
        currentVersionStr: packageJson.version,
        isUpdateAvailable: false
      };
      // }
      const selfVersionStr = packageJson.version;
      const selfVersionParts = selfVersionStr.split('.').map(part => part|0);
      const responseJson = await response.json();
      const currentVersionStr = responseJson.currentVersion;
      const currentVersionParts = currentVersionStr.split('.').map(part => part|0);
      const minSupportedVersionStr = responseJson.minSupportedVersion;
      const minSupportedVersionParts = minSupportedVersionStr.split('.').map(part => part|0);
      let isSupported = true;
      for(let i = 0; i < selfVersionParts.length && i < minSupportedVersionParts.length; i++) {
        if (selfVersionParts[i] < minSupportedVersionParts[i]) {
          isSupported = false;
          break;
        }
        if (selfVersionParts[i] > minSupportedVersionParts[i]) {
          break;
        }
      }
      const updateUrl = responseJson.androidApkUrl; //TODO: more flexible
      const isUpdateAvailable = selfVersionStr !== currentVersionStr && !!updateUrl;
      return {
        isSupported, selfVersionStr, currentVersionStr, isUpdateAvailable, updateUrl
      };
    }catch(error) {
      return {
        error, isSupported: true, isUpdateAvailable: false
      };
    }
  }
}

export default new UpdateController();
