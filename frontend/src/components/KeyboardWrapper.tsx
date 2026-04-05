import React from 'react';
import { 
  Keyboard, 
  Platform, 
  TouchableWithoutFeedback, 
  View 
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface KeyboardWrapperProps {
  children: React.ReactNode;
  backgroundColor?: string;
  contentContainerStyle?: any;
}

/**
 * Global Wrapper to handle keyboard avoidance and dismissal.
 * Uses KeyboardAwareScrollView for optimal behavior on both iOS and Android.
 * extraScrollHeight is set high enough to clear the Gboard suggestion bar on Android.
 */
export default function KeyboardWrapper({ 
  children, 
  backgroundColor = '#fff',
  contentContainerStyle
}: KeyboardWrapperProps) {
  return (
    <View style={{ flex: 1, backgroundColor }}>
      <KeyboardAwareScrollView
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === 'ios' ? 40 : 20}
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle || { flexGrow: 1 }}
      >
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}
