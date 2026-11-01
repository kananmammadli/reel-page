import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { MiniPlayer } from '@/components/player/mini-player';
import { PlayerProvider } from '@/components/player/player-provider';
import { BottomTabInset } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { configurePurchases } from '@/lib/purchases';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // appUserID must equal the Supabase user id (see lib/purchases.ts) so
  // RevenueCat webhook events carry it -- configure as soon as we know who's
  // signed in, app-wide, rather than per-screen.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) configurePurchases(data.user.id);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) configurePurchases(session.user.id);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

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
