import React from 'react';
import {Modal, View, Text, TouchableOpacity, StyleSheet, Linking} from 'react-native';

import updateController from '../controllers/update';
import { strings } from '../locales/i18n';

export default class UpdateModal extends React.Component {
  constructor() {
    super();
    updateController.getUpdateInfo().then((updateInfo) => {
      this.setState({updateInfo});
    });
  }
  state = { updateInfo: null, isDownloading: false }

  _renderButton = (text, onPress) => (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.button}>
        <Text>{text}</Text>
      </View>
    </TouchableOpacity>
  );

  onRequestClose = () => {
    this.setState({updateInfo: null, isDownloading: false});
  }

  onRequestUpdate = () => {
    Linking.openURL(this.state.updateInfo.updateUrl);
    this.setState({isDownloading: true});
  }

  renderContent() {
    const {updateInfo, isDownloading} = this.state;
    if (isDownloading) {
      return (
        <View>
          <Text>{strings('update.downloading_text')}</Text>
          {this._renderButton(strings('update.cancel_btn'), this.onRequestClose)}
        </View>
      );
    }

    return (
      <View>
        <Text>{strings('update.text', updateInfo)}</Text>
        {this._renderButton(strings('update.cancel_btn'), this.onRequestClose)}
        {this._renderButton(strings('update.update_btn'), this.onRequestUpdate)}
      </View>
    );
  }

  render() {
    const {updateInfo} = this.state;
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={!!updateInfo && updateInfo.isUpdateAvailable}
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
