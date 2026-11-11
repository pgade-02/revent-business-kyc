import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

// Lists every key path, e.g. "Shell.brand", so the two files can be compared.
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("customer messages", () => {
  it("has exactly the same keys in English and Arabic", () => {
    expect(keyPaths(ar).sort()).toEqual(keyPaths(en).sort());
  });

  it("has no empty strings", () => {
    for (const messages of [en, ar]) {
      const json = JSON.stringify(messages);
      expect(json).not.toContain('""');
    }
  });
});
