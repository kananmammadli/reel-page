import { vi } from "vitest";

export type QueryResult = { data: unknown; error: unknown };

// A minimal fake of the supabase-js fluent query builder: every chain method
// (eq/order/or/...) returns itself, and the chain resolves to `result` when
// awaited (PostgrestFilterBuilder is a thenable, not a Promise).
export function fakeQuery(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "in", "is", "order", "or", "limit", "upsert", "insert", "delete"];
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

export function mockSupabaseClient(fromResults: Record<string, QueryResult>) {
  return {
    from: vi.fn((table: string) => fakeQuery(fromResults[table] ?? { data: null, error: null })),
    functions: { invoke: vi.fn() },
  };
}

export function mockAuthClient(authResults: Record<string, { data?: unknown; error: unknown }>) {
  return {
    auth: {
      signInWithOtp: vi.fn(() => Promise.resolve(authResults.signInWithOtp ?? { error: null })),
      verifyOtp: vi.fn(() => Promise.resolve(authResults.verifyOtp ?? { data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve(authResults.signOut ?? { error: null })),
    },
  };
}
