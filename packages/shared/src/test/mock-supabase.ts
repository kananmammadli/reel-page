import { vi } from "vitest";

export type QueryResult = { data: unknown; error: unknown };

// A minimal fake of the supabase-js fluent query builder: every chain method
// (eq/order/or/...) returns itself, and the chain resolves to `result` when
// awaited (PostgrestFilterBuilder is a thenable, not a Promise).
export function fakeQuery(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "order", "or", "limit"];
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
