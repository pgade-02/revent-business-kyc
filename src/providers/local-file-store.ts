import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStore } from "@/kyc/interfaces/file-store";

// Keys are made by our server (e.g. "applications/12/3f9c.pdf"), but we still refuse
// anything that could step outside the storage folder, such as "../../.env".
const SAFE_KEY = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.(pdf|png|jpg|jpeg)$/;

// Dev storage on local disk (ARCHITECTURE §1). Deployed builds swap in object storage.
export function createLocalFileStore(rootDir: string): FileStore {
  function pathFor(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error("unsafe file key");
    return path.join(rootDir, key);
  }

  return {
    async put(key, bytes) {
      const filePath = pathFor(key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(pathFor(key)));
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
        throw error;
      }
    },
  };
}
