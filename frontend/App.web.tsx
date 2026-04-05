import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import store from './src/store';
import WebLandingScreen from './src/web_version/WebLandingScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  // This file is ONLY used by the web bundler.
  // It completely bypasses all native-only mobile code.
  
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
           <WebLandingScreen />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
