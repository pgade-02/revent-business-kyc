import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FileStore } from "@/kyc/interfaces/file-store";
import { createLocalFileStore } from "@/providers/local-file-store";

let rootDir: string;
let store: FileStore;

beforeAll(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), "kyc-store-"));
  store = createLocalFileStore(rootDir);
});

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("local file store", () => {
  it("saves a file and reads the same bytes back", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await store.put("applications/12/abc-123.pdf", bytes);
    expect(await store.get("applications/12/abc-123.pdf")).toEqual(bytes);
  });

  it("returns null for a file that does not exist", async () => {
    expect(await store.get("applications/12/missing.pdf")).toBeNull();
  });

  it.each(["../../.env.pdf", "applications/../../secret.pdf", "/etc/passwd.pdf", "note.exe"])(
    "refuses the unsafe key %s",
    async (key) => {
      await expect(store.put(key, new Uint8Array([1]))).rejects.toThrow("unsafe file key");
    },
  );
});
