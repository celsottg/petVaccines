import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { clampScale, clampTranslation } from './zoom';

interface ZoomableImageProps {
  uri: string;
  label: string;
}

/**
 * Full-size image with pinch zoom and one-finger pan once zoomed in, built on
 * react-native-gesture-handler and reanimated (the same on Android and iOS).
 * Zoom is centered on the image; panning is limited to the zoomed edges.
 */
export function ZoomableImage({ uri, label }: ZoomableImageProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  function onLayout(event: LayoutChangeEvent) {
    const { width: w, height: h } = event.nativeEvent.layout;
    setSize({ width: w, height: h });
    width.value = w;
    height.value = h;
  }

  const pinch = usePinchGesture({
    onUpdate: (event) => {
      'worklet';
      const next = clampScale(savedScale.value * event.scale);
      scale.value = next;
      // Zooming out can leave the image past its new edges.
      x.value = clampTranslation(x.value, width.value, next);
      y.value = clampTranslation(y.value, height.value, next);
    },
    onDeactivate: () => {
      'worklet';
      savedScale.value = scale.value;
      savedX.value = x.value;
      savedY.value = y.value;
    },
  });

  const pan = usePanGesture({
    onUpdate: (event) => {
      'worklet';
      x.value = clampTranslation(savedX.value + event.translationX, width.value, scale.value);
      y.value = clampTranslation(savedY.value + event.translationY, height.value, scale.value);
    },
    onDeactivate: () => {
      'worklet';
      savedX.value = x.value;
      savedY.value = y.value;
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width: size.width, height: size.height }, animatedStyle]}>
          <Image accessibilityLabel={label} source={{ uri }} contentFit="contain" style={styles.fill} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
});
