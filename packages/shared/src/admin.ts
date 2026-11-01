import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
import type { Collection, Title } from "./catalog";

type Client = SupabaseClient<Database>;

export type Payment = Tables<"payments">;

export async function isHost(client: Client, userId: string): Promise<boolean> {
  const { data, error } = await client.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.role === "host";
}

export async function getPayments(client: Client): Promise<Payment[]> {
  const { data, error } = await client.from("payments").select("*").order("occurred_at", { ascending: false });
  if (error) throw error;
  return data;
}

type Bucket = { amountCents: number; count: number };
export type SalesBucket = Bucket & { currency: string };
export type MonthlySales = SalesBucket & { month: string };
export type RefSales = SalesBucket & { id: string; label: string };

export type SalesSummary = {
  totals: SalesBucket[];
  byMonth: MonthlySales[];
  byTitle: RefSales[];
  byCollection: RefSales[];
  club: SalesBucket[];
};

function addToBucket(map: Map<string, Bucket>, key: string, amountCents: number) {
  const existing = map.get(key) ?? { amountCents: 0, count: 0 };
  map.set(key, { amountCents: existing.amountCents + amountCents, count: existing.count + 1 });
}

function splitCurrencyKey(key: string): [currency: string, rest: string] {
  const [currency, rest] = key.split("|");
  return [currency!, rest!];
}

// Payments are a currency-tagged append-only ledger (one row per webhook-
// confirmed charge -- see supabase/migrations/..._admin.sql), so summing
// across different currencies would be meaningless; every bucket here is
// keyed by currency first.
export function summarizePayments(payments: Payment[], titles: Pick<Title, "id" | "title">[], collections: Pick<Collection, "id" | "name">[]): SalesSummary {
  const titleNames = new Map(titles.map((t) => [t.id, t.title]));
  const collectionNames = new Map(collections.map((c) => [c.id, c.name]));

  const totals = new Map<string, Bucket>();
  const byMonth = new Map<string, Bucket>();
  const byTitle = new Map<string, Bucket>();
  const byCollection = new Map<string, Bucket>();
  const club = new Map<string, Bucket>();

  for (const payment of payments) {
    addToBucket(totals, payment.currency, payment.amount_cents);

    const month = payment.occurred_at.slice(0, 7);
    addToBucket(byMonth, `${payment.currency}|${month}`, payment.amount_cents);

    if (payment.kind === "title" && payment.ref_id) {
      addToBucket(byTitle, `${payment.currency}|${payment.ref_id}`, payment.amount_cents);
    } else if (payment.kind === "collection" && payment.ref_id) {
      addToBucket(byCollection, `${payment.currency}|${payment.ref_id}`, payment.amount_cents);
    } else if (payment.kind === "club_month") {
      addToBucket(club, payment.currency, payment.amount_cents);
    }
  }

  return {
    totals: [...totals.entries()].map(([currency, bucket]) => ({ currency, ...bucket })),
    byMonth: [...byMonth.entries()]
      .map(([key, bucket]) => {
        const [currency, month] = splitCurrencyKey(key);
        return { currency, month, ...bucket };
      })
      .sort((a, b) => b.month.localeCompare(a.month)),
    byTitle: [...byTitle.entries()]
      .map(([key, bucket]) => {
        const [currency, id] = splitCurrencyKey(key);
        return { currency, id, label: titleNames.get(id) ?? "Unknown title", ...bucket };
      })
      .sort((a, b) => b.amountCents - a.amountCents),
    byCollection: [...byCollection.entries()]
      .map(([key, bucket]) => {
        const [currency, id] = splitCurrencyKey(key);
        return { currency, id, label: collectionNames.get(id) ?? "Unknown collection", ...bucket };
      })
      .sort((a, b) => b.amountCents - a.amountCents),
    club: [...club.entries()].map(([currency, bucket]) => ({ currency, ...bucket })),
  };
}
