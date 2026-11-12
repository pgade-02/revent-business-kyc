// Where uploaded files are kept. Local disk in dev, private object storage when
// deployed (ARCHITECTURE §1). src/kyc only knows this shape, never the storage.
export interface FileStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}
