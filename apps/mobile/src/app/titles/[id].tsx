import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getEpisodes,
  getPlaybackPositionsForTitle,
  getTitle,
  hasAccess,
  type Episode,
  type Title,
} from "@reel-and-page/shared";

import { PosterCard } from "@/components/catalog/poster-card";
import { TranscriptView } from "@/components/player/transcript-view";
import { usePlayer } from "@/components/player/player-provider";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { isPurchasesConfigured, purchaseProduct } from "@/lib/purchases";

function minutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

export default function TitleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { current, play, currentTime, didJustFinish, sleepTimer } = usePlayer();

  const [title, setTitle] = useState<Title | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [savedPositions, setSavedPositions] = useState<Record<string, number>>({});
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const [t, eps] = await Promise.all([getTitle(supabase, id), getEpisodes(supabase, id)]);
      if (cancelled) return;
      setTitle(t);
      setEpisodes(eps);
      setLoading(false);

      const { data: userData } = await supabase.auth.getUser();
      if (!cancelled && userData.user) {
        setSavedPositions(await getPlaybackPositionsForTitle(supabase, eps.map((e) => e.id)));
        setOwned(await hasAccess(supabase, userData.user.id, { titleId: id }));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Auto-advance to the next unlocked episode (SPEC.md §3.3). Previews don't
  // advance -- ending a preview should prompt a purchase, not skip ahead.
  // The "end of episode" sleep timer also suppresses this for one ending.
  useEffect(() => {
    if (!title || !didJustFinish || !current || current.title.id !== title.id) return;
    if (current.variant !== "full" || sleepTimer === "end") return;
    const index = episodes.findIndex((e) => e.id === current.episode.id);
    const next = episodes[index + 1];
    if (!next) return;
    const nextAccess = title.is_free || owned ? "full" : next.id === episodes[0]?.id ? "preview" : "locked";
    if (nextAccess === "locked") return;
    playEpisode(next, nextAccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- episodes/title/playEpisode are stable for this render's inputs
  }, [didJustFinish]);

  if (loading || !title) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">{loading ? "Loading…" : "Not found"}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const firstEpisode = episodes[0];
  const totalSeconds = episodes.reduce((sum, e) => sum + e.duration_s, 0);
  const playingEpisode = current?.title.id === title.id ? current.episode : null;

  const hasFullAccess = title.is_free || owned;

  function episodeAccess(episode: Episode): "full" | "preview" | "locked" {
    if (hasFullAccess) return "full";
    if (episode.id === firstEpisode?.id) return "preview";
    return "locked";
  }

  function playEpisode(episode: Episode, access: "full" | "preview" | "locked") {
    const variant = access === "preview" ? "preview" : "full";
    const resumeAt = variant === "full" ? savedPositions[episode.id] : undefined;
    play(title!, episode, variant, resumeAt);
  }

  async function buy() {
    setBuyError(null);
    setBuying(true);
    try {
      if (!isPurchasesConfigured()) throw new Error("Purchases aren't set up yet");
      await purchaseProduct("title", title!.id);
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <PosterCard
              id={title.id}
              title={title.title}
              year={title.year}
              type={title.type}
              posterUrl={title.poster_url}
              style={styles.heroPoster}
            />
            <ThemedText type="subtitle" style={styles.centered}>
              {title.title}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {title.type === "film" ? "Directed by" : "By"} {title.creator} · {title.year}
            </ThemedText>
            <ThemedText style={styles.centered}>{title.description}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {episodes.length} {episodes.length > 1 ? "episodes" : "episode"} · {minutes(totalSeconds)}
            </ThemedText>
          </View>

          {firstEpisode && (
            <Pressable style={styles.playButton} onPress={() => playEpisode(firstEpisode, episodeAccess(firstEpisode))}>
              <ThemedText style={styles.playButtonText}>
                {!hasFullAccess ? "Play 5-min preview" : savedPositions[firstEpisode.id] ? "Resume" : "Play"}
              </ThemedText>
            </Pressable>
          )}

          <View style={styles.parts}>
            {episodes.map((episode, i) => {
              const access = episodeAccess(episode);
              const isPlaying = playingEpisode?.id === episode.id;
              const canResume = access === "full" && !!savedPositions[episode.id];
              return (
                <Pressable
                  key={episode.id}
                  disabled={access === "locked"}
                  onPress={() => playEpisode(episode, access)}
                  style={[
                    styles.part,
                    { borderColor: isPlaying ? "#8a1f2d" : theme.backgroundSelected },
                    access === "locked" && styles.partLocked,
                  ]}
                >
                  <ThemedText type="small" themeColor="textSecondary">
                    {String(i + 1).padStart(2, "0")}
                  </ThemedText>
                  <ThemedText style={styles.partName}>
                    {isPlaying ? "▶ " : ""}
                    {episode.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {access === "locked"
                      ? "Locked"
                      : access === "preview"
                        ? "Preview"
                        : canResume
                          ? "Resume"
                          : minutes(episode.duration_s)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {!hasFullAccess && (
            <ThemedView type="backgroundElement" style={styles.buybox}>
              <ThemedText>Own this commentary for good</ThemedText>
              <Pressable style={[styles.playButton, styles.ghostButton]} onPress={buy} disabled={buying}>
                <ThemedText>{buying ? "Buying…" : "Buy to unlock"}</ThemedText>
              </Pressable>
              {buyError && (
                <ThemedText type="small" style={styles.error}>
                  {buyError}
                </ThemedText>
              )}
            </ThemedView>
          )}

          {playingEpisode && playingEpisode.title_id === title.id && (
            <TranscriptView episode={playingEpisode} currentTime={currentTime} />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  hero: {
    alignItems: "center",
    gap: Spacing.one,
    paddingTop: Spacing.three,
  },
  heroPoster: {
    width: 150,
    marginBottom: Spacing.two,
  },
  centered: {
    textAlign: "center",
  },
  playButton: {
    alignSelf: "center",
    backgroundColor: "#8a1f2d",
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  playButtonText: {
    color: "#fffaf6",
    fontWeight: "600",
  },
  ghostButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#e4dbd8",
  },
  parts: {
    gap: Spacing.two,
  },
  part: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
  },
  partLocked: {
    opacity: 0.55,
  },
  partName: {
    flex: 1,
  },
  buybox: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: "center",
  },
  error: {
    color: "#8a1f2d",
  },
});
