import React, { useEffect } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Defs,
  Path,
  Polygon,
  RadialGradient,
  Stop,
} from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const { width, height } = Dimensions.get("window");

export default function AnimatedSplashScreen({
  onAnimationComplete,
}: {
  onAnimationComplete: () => void;
}) {
  const pathLength = 2000;
  const strokeOffset = useSharedValue(pathLength);
  const diamondOpacity = useSharedValue(0);

  // THE FIX: Manage the fade out manually to avoid Fabric layout crash
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    strokeOffset.value = withTiming(0, {
      duration: 1500,
      easing: Easing.inOut(Easing.cubic),
    });

    diamondOpacity.value = withDelay(
      1000,
      withTiming(1, { duration: 800 }, () => {
        setTimeout(() => {
          // Manually fade out the container before completing
          containerOpacity.value = withTiming(0, { duration: 400 }, () => {
            runOnJS(onAnimationComplete)();
          });
        }, 800);
      }),
    );
  }, []);

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: strokeOffset.value,
  }));

  const animatedDiamondProps = useAnimatedProps(() => ({
    opacity: diamondOpacity.value,
  }));

  // Notice we completely removed the `if (isDone) return <View />`
  // Notice we completely removed `exiting={FadeOut}`
  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Svg viewBox="0 0 1024 1024" width={width * 0.5} height={width * 0.5}>
        <Defs>
          <RadialGradient id="spotlight" cx="50%" cy="50%" r="70%">
            <Stop offset="0%" stopColor="#262626" />
            <Stop offset="100%" stopColor="#000000" />
          </RadialGradient>
        </Defs>

        <AnimatedPolygon
          points="512,100 592,180 512,260 432,180"
          fill="#FFFFFF"
          animatedProps={animatedDiamondProps}
        />

        <AnimatedPath
          d="M 150,500 L 331,800 L 512,320 L 693,800 L 874,500"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="64"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          animatedProps={animatedPathProps}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
});
