import Purchases from "react-native-purchases";

// Not usable until a real RevenueCat project + App Store Connect/Play
// Console products exist (neither of us can provision those -- see
// CLAUDE.md). The code path is real and ready for when they do.
//
// Convention (matches supabase/functions/revenuecat-webhook): one-time
// title/collection products are identified "title:<uuid>"/"collection:<uuid>".

export function isPurchasesConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
}

let configuredForUserId: string | null = null;

// appUserID must equal the Supabase user id so RevenueCat webhook events
// carry it as app_user_id (see supabase/functions/revenuecat-webhook).
export function configurePurchases(userId: string) {
  if (!isPurchasesConfigured() || configuredForUserId === userId) return;
  Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY!, appUserID: userId });
  configuredForUserId = userId;
}

export async function purchaseProduct(kind: "title" | "collection", refId: string): Promise<void> {
  const productId = `${kind}:${refId}`;
  const offerings = await Purchases.getOfferings();
  const pkg = Object.values(offerings.all)
    .flatMap((offering) => offering.availablePackages)
    .find((p) => p.product.identifier === productId);
  if (!pkg) throw new Error("This commentary isn't available for purchase yet");
  await Purchases.purchasePackage(pkg);
}

export async function restorePurchases(): Promise<void> {
  await Purchases.restorePurchases();
}
