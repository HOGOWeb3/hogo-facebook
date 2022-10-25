import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator } from 'react-navigation-stack';
import { createAppContainer } from 'react-navigation';

import FbScreen from "../screens/FbScreen";

const RootStack = createStackNavigator({
  Fb: FbScreen,
},{
  initialRouteName: 'Fb',
  headerMode: 'none',
});

const App = createAppContainer(RootStack);

export default App;
