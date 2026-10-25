import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { usePlayer } from "./player-provider";

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MiniPlayer() {
  const {
    current,
    playing,
    loading,
    currentTime,
    duration,
    speed,
    sleepTimer,
    error,
    togglePlay,
    skip,
    cycleSpeed,
    cycleSleepTimer,
    close,
  } = usePlayer();

  if (!current) return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <ThemedView type="backgroundElement" style={styles.bar}>
      <View style={[styles.progress, { width: `${Math.min(100, progress * 100)}%` }]} />
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {current.title.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {current.episode.name} · {formatTime(currentTime)} / {formatTime(duration)}
          {current.variant === "preview" ? " · preview" : ""}
        </ThemedText>
        {error && (
          <Pressable onPress={close}>
            <ThemedText type="small" themeColor="textSecondary">
              {error} · tap to close
            </ThemedText>
          </Pressable>
        )}
      </View>
      <View style={styles.controls}>
        <Pressable style={styles.iconBtn} onPress={() => skip(-15)} accessibilityLabel="Back 15 seconds">
          <ThemedText type="small">−15</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.iconBtn, styles.main]}
          onPress={togglePlay}
          disabled={loading}
          accessibilityLabel={playing ? "Pause" : "Play"}
        >
          <ThemedText type="small" style={styles.mainText}>
            {loading ? "…" : playing ? "❚❚" : "▶"}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => skip(30)} accessibilityLabel="Forward 30 seconds">
          <ThemedText type="small">+30</ThemedText>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={cycleSpeed} accessibilityLabel="Playback speed">
          <ThemedText type="small">{speed}×</ThemedText>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={cycleSleepTimer} accessibilityLabel="Sleep timer">
          <ThemedText type="small">{sleepTimer === 0 ? "😴" : sleepTimer === "end" ? "end" : `${sleepTimer}m`}</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  progress: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 2,
    backgroundColor: "#8a1f2d",
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.3)",
  },
  main: {
    backgroundColor: "#241a1f",
    borderColor: "#241a1f",
  },
  mainText: {
    color: "#f7f3f1",
  },
});
