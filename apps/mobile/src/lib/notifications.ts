import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken } from "@reel-and-page/shared";
import { supabase } from "@/lib/supabase";

// Not usable until a real EAS project exists (none of us can provision
// that -- see CLAUDE.md): getExpoPushTokenAsync needs a projectId, which
// only comes from `eas init`/`eas build:configure`. The code path is real
// and ready for when one does.
export function isPushConfigured(): boolean {
  return !!Constants.expoConfig?.extra?.eas?.projectId;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Called from Profile's notification toggle (opt-in, per SPEC.md §3.5 --
// never registered silently).
export async function registerForPushNotifications(userId: string): Promise<{ error?: string }> {
  if (!isPushConfigured()) return { error: "Push notifications aren't set up yet" };
  if (!Device.isDevice) return { error: "Push notifications need a real device, not a simulator" };

  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === "granted" ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { error: "Notification permission was denied" };

  const projectId = Constants.expoConfig!.extra!.eas!.projectId as string;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushToken(supabase, userId, token);
  return {};
}
