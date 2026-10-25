import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { MiniPlayer } from '@/components/player/mini-player';
import { PlayerProvider } from '@/components/player/player-provider';
import { BottomTabInset } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PlayerProvider>
        <AnimatedSplashOverlay />
        <View style={styles.flex}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="titles/[id]" options={{ title: '' }} />
          </Stack>
          <View style={styles.miniPlayerDock} pointerEvents="box-none">
            <MiniPlayer />
          </View>
        </View>
      </PlayerProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  miniPlayerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BottomTabInset,
  },
});
