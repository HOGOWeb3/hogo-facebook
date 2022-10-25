import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

export default class FbScreenHeader extends React.Component {
  render() {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={this.props.onBack}>
          <Image
            source={require('../assets/back.png')}
            style={styles.imageStyle}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={this.props.onRefresh}>
          <Image
            source={require('../assets/refresh.png')}
            style={styles.imageStyle}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={this.props.onHome}>
          <Image
            source={require('../assets/home.png')}
            style={styles.imageStyle}
          />
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  imageStyle: {
    height: 32,
    width: 32,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 32,
    width: '100%'
  },
});
