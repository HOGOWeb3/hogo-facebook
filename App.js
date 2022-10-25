import React from 'react';
import nacl from 'tweetnacl';
import { generateSecureRandom } from 'react-native-securerandom';
import { View, Text } from 'react-native';
import SplashScreen from 'react-native-splash-screen'

import MainStackNavigator from './navigation/MainStackNavigator';
import UpdateModal from './modals/Update';
import IntroModal from './modals/Intro';

async function init() {
  let randomState = await generateSecureRandom(64);
  let isReseeding = false;

  async function reseed() {
    if (isReseeding) {
      return;
    }
    try {
      const dataForNewState = await generateSecureRandom(128);
      dataForNewState.set(randomState, 64);
      randomState = nacl.hash(dataForNewState);
    } finally {
      isReseeding = false;
    }
  }

  function getBlock(i) {
    const dataForBlock = new ArrayBuffer(128);
    const dataAsBytes = new Uint8Array(dataForBlock);
    const dataFromIndex = new Float64Array(dataForBlock, 64, 1);
    dataAsBytes.set(randomState, 0);
    dataFromIndex[0] = i;
    return nacl.hash(dataAsBytes);
  }

  nacl.setPRNG((x, n) => {
    for(let i = 0; i < n; i += 64) {
      let newData = getBlock(i);
      if (n - i < newData.length) {
        newData = newData.subarray(0, n - i);
      }
      x.set(newData, i);
    }
    randomState = getBlock(n);
    reseed();
  } );
}

export default class App extends React.Component {
  constructor() {
    super();
    this.state = {isInit: false};
    init().then(() => {
      this.setState({isInit: true});
      SplashScreen.hide();
    });
  }

  render() {
    if (!this.state.isInit) {
      return (
        <View><Text>
          Initializing crypto library
        </Text></View>
      );
    }
    return (
      <React.Fragment>
        <UpdateModal />
        <IntroModal />
        <MainStackNavigator />
      </React.Fragment>
    );
  }
}
