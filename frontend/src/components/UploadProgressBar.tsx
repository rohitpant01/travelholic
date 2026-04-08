import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useAppTheme } from '../utils/theme';

export default function UploadProgressBar() {
  const theme = useAppTheme();
  const { tasks } = useSelector((state: RootState) => state.uploads);
  const activeTasks = Object.values(tasks).filter(t => t.status === 'uploading');
  
  const animatedProgress = useRef(new Animated.Value(0)).current;

  // Track the most recent active task
  const currentTask = activeTasks[0];

  useEffect(() => {
    if (currentTask) {
      Animated.timing(animatedProgress, {
        toValue: currentTask.progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      animatedProgress.setValue(0);
    }
  }, [currentTask?.progress]);

  if (!currentTask) return null;

  const widthInterpolated = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.background, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <Animated.View style={[styles.fill, { width: widthInterpolated, backgroundColor: theme.teal }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  background: {
    height: 4,
    width: '100%',
  },
  fill: {
    height: '100%',
  },
});
