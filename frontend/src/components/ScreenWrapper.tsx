import React from 'react';
import { 
  View, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../utils/theme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: any;
  /**
   * If true, adds padding top based on safe area insets.
   * Default is true.
   */
  withTopInset?: boolean;
  /**
   * If true, adds padding bottom based on safe area insets.
   * Default is true.
   */
  withBottomInset?: boolean;
  /**
   * Background color for the wrapper. Defaults to theme background.
   */
  backgroundColor?: string;
}

/**
 * Global Screen Wrapper to handle Safe Areas and Keyboard Avoiding Behavior.
 * Use this as the root component for all screens to ensure responsiveness.
 */
export default function ScreenWrapper({ 
  children, 
  style, 
  withTopInset = true, 
  withBottomInset = true,
  backgroundColor
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: backgroundColor || theme.background,
        paddingTop: withTopInset ? insets.top : 0,
        paddingBottom: withBottomInset ? insets.bottom : 0,
      },
      style
    ]}>
      <StatusBar 
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} 
        translucent 
        backgroundColor="transparent" 
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
});
