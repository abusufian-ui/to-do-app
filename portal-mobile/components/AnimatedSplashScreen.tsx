import React, { useEffect, useState } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
    Easing,
    FadeOut,
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
    Stop
} from "react-native-svg";

// Make SVG elements animatable
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const { width, height } = Dimensions.get("window");

export default function AnimatedSplashScreen({
  onAnimationComplete,
}: {
  onAnimationComplete: () => void;
}) {
  const [isDone, setIsDone] = useState(false);

  // 2000 is roughly the total length of the SVG path
  const pathLength = 2000;
  const strokeOffset = useSharedValue(pathLength);
  const diamondOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Draw the line smoothly over 1.5 seconds
    strokeOffset.value = withTiming(0, {
      duration: 1500,
      easing: Easing.inOut(Easing.cubic),
    });

    // 2. Fade in the diamond with a slight delay
    diamondOpacity.value = withDelay(
      1000,
      withTiming(1, { duration: 800 }, () => {
        // 3. Tell the parent we are done after a brief pause to admire the logo
        setTimeout(() => {
          runOnJS(setIsDone)(true);
          setTimeout(() => runOnJS(onAnimationComplete)(), 300); // Allow fade out
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

  if (isDone) return null;

  return (
    <Animated.View exiting={FadeOut.duration(400)} style={styles.container}>
      <Svg viewBox="0 0 1024 1024" width={width * 0.5} height={width * 0.5}>
        <Defs>
          <RadialGradient id="spotlight" cx="50%" cy="50%" r="70%">
            <Stop offset="0%" stopColor="#262626" />
            <Stop offset="100%" stopColor="#000000" />
          </RadialGradient>
        </Defs>

        {/* The Floating Diamond */}
        <AnimatedPolygon
          points="512,100 592,180 512,260 432,180"
          fill="#FFFFFF"
          animatedProps={animatedDiamondProps}
        />

        {/* The Pulse Line drawing itself */}
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
    zIndex: 9999, // Ensure it stays on top of everything
  },
});
