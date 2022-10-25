import React from 'react';
import {
  TouchableOpacity, TouchableWithoutFeedback, TextInput, Text, Button,
  Platform, StatusBar, StyleSheet, View, KeyboardAvoidingView, Linking, BackHandler,
  // WebView
} from 'react-native';
import WebView from 'react-native-webview';
import { SafeAreaView } from 'react-navigation';

import fbController from '../controllers/fb';
import FbScreenHeader from './FbScreenHeader';
import { strings } from '../locales/i18n';

const webViewSource = {uri: 'https://m.facebook.com'};

export default class FbScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentState: null,
    }
    fbController.listenStateChanges((currentState) => {
      this.setState({currentState});
    });
    this._didFocusSubscription = props.navigation.addListener('didFocus', payload =>
      BackHandler.addEventListener('hardwareBackPress', this.onBackButtonPressAndroid)
    );
  }

  wvRef = React.createRef()

  componentDidMount() {
    this._willBlurSubscription = this.props.navigation.addListener('willBlur', payload =>
      BackHandler.removeEventListener('hardwareBackPress', this.onBackButtonPressAndroid)
    );
  }

  componentWillUnmount() {
    this._didFocusSubscription && this._didFocusSubscription.remove();
    this._willBlurSubscription && this._willBlurSubscription.remove();
  }

  onBackButtonPressAndroid = () => {
    if (!this.wvRef.current) {
      return;
    }
    this.wvRef.current.onBack();
    return true;
  }

  onBack = () => {
    this.wvRef.current.onBack();
  }

  onRefresh = () => {
    this.wvRef.current.onRefresh();
  }

  onHome = () => {
    this.wvRef.current.onHome();
  }

  render() {
    const {currentState} = this.state;
    if (Platform.OS === 'ios') {
      return (
        <KeyboardAvoidingView style={styles.container} behavior="padding" enabled>
          <SafeAreaView style={styles.containerInner}>
            <FbScreenHeader onBack={this.onBack} onRefresh={this.onRefresh} onHome={this.onHome}/>
            <View style={styles.fullScreenWebView}>
              <WebViewFb ref={this.wvRef}/>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      );
    }
    return (
      <SafeAreaView style={styles.container}>
        <FbScreenHeader onBack={this.onBack} onRefresh={this.onRefresh} onHome={this.onHome}/>
        <View style={styles.fullScreenWebView}>
          <WebViewFb ref={this.wvRef}/>
        </View>
      </SafeAreaView>
    );
  }
}

class WebViewFb extends React.Component {
  wvRef_current = null

  state = {wvKey: 0, isLoaded: false}

  componentDidMount() {
    console.log( "App mounted" );
  }

  onError = (error) => {
    console.warn('Webview load error', error);
    this.setState({wvKey: this.state.wvKey + 1});
  }

  onBack = () => {
    this.wvRef_current.goBack();
  }

  onRefresh = () => {
    this.wvRef_current.reload();
  }

  onHome = () => {
    this.wvRef_current.injectJavaScript('window.location.href = "https://m.facebook.com";');
  }

  onReload = () => {
    this.setState({wvKey: this.state.wvKey + 1});
  }

  onLoad = () => {
    if (this.state.isLoaded) {
      // this.setState({isLoaded: false, wvKey: this.state.wvKey + 1});
      // console.log( "WebView reloading" );
      fbController.sendInitScript();
      return;
    }
    console.log( "WebView loaded" );
    fbController.setWebView(this.wvRef_current);
    this.setState({isLoaded: true});
  }

  componentWillUnmount() {
    if (this._timeout) {
      clearTimeout(this._timeout);
      delete this._timeout;
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return nextState.wvKey !== this.state.wvKey;
  }

  renderError = () => {
    return (
      <View>
        <Text>Error loading facebook.com</Text>
          <Button
            onPress={this.onReload}
            title="Try load again"
            color="#841584"
            accessibilityLabel="Reload"
          />
        </View>
    );
  }

  renderLoading = () => {
    return (
      <View style={styles.loading}>
        <Text>{strings('loading')}</Text>
      </View>
    );
  }

  setRef = (e) => {
    this.wvRef_current = e;
  }

  onNavigationStateChange = (event) => {
    const needle = 'https://m.facebook.com';

    if (event.url.substr(0, needle.length) === needle) {
      return;
    }
    this.wvRef_current.stopLoading();
    Linking.openURL(event.url);
  }

  render() {
    return (
      <WebView
        source={webViewSource}
        ref={this.setRef}
        onError={this.onError}
        onLoad={this.onLoad}
        renderError={this.renderError}
        renderLoading={this.renderLoading}
        userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36"
        key={this.state.wvKey}
        onMessage={fbController.onMessage}
        injectedJavaScript={fbController.injectedJavaScript}
        startInLoadingState={true}
      />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerInner: {
    flex: 1,
  },
  fullScreenWebView: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: '#fff'
  }
});
