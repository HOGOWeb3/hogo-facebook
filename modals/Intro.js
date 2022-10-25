import React from 'react';
import {Modal, View, Text, TouchableOpacity, StyleSheet, Linking, Image} from 'react-native';

import sessionRepo from '../repo/session';
import { strings } from '../locales/i18n';

export default class Intro extends React.Component {
  constructor() {
    super();
    this.state = {isModalViaible: false};
    sessionRepo.isAnySession().then((isAnySession) => {
      this.setState({isModalViaible: !isAnySession});
    });
  }

  _renderButton = (text, onPress) => (
    <TouchableOpacity onPress={onPress}>
      <Image
        style={ { width: 988/5, height: 160/5 } }
        source={ require( "../assets/facebook.button.png" ) }
      />
    </TouchableOpacity>
  );

  onRequestClose = () => {
    this.setState({isModalViaible: false});
  }

  renderContent = () => (
    <View style={{margin: 20}}>
      <View style={{margin: 20, alignItems: "center"}}>
        <Text style={{fontSize: 24}}>The Fondom Project</Text>
      </View>
      <View style={{margin: 20}}>
        <Text>{strings('intro.text')}</Text>
      </View>
      <View style={{margin: 20, alignItems: "center"}}>
        {this._renderButton(strings('intro.ok_btn'), this.onRequestClose)}
      </View>
    </View>
  )

  render() {
    const {updateInfo} = this.state;
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={this.state.isModalViaible}
        onRequestClose={this.onRequestClose}>
        <View style={{marginTop: 22}}>
          {this.renderContent()}
        </View>
      </Modal>
    );
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: 'lightblue',
    padding: 12,
    margin: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  bottomModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
});
