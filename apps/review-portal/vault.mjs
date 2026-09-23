import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from "node:crypto";
import {
  mkdir,
  readFile,
  open,
  rename,
  unlink,
  statfs,
} from "node:fs/promises";
import { join } from "node:path";
import { id, requireThat, LIMITS } from "./policy.mjs";

export class Vault {
  constructor(root, key) {
    requireThat(Buffer.isBuffer(key) && key.length === 32, "invalid_vault_key");
    this.root = root;
    this.key = key;
  }
  path(object, part) {
    id(object);
    requireThat(/^(raw|preview|chunk-[0-9]{1,2})$/.test(part), "invalid_part");
    return join(this.root, `${object}.${part}.enc`);
  }
  seal(bytes, context) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(context));
    return Buffer.concat([
      Buffer.from("DOP1"),
      iv,
      cipher.update(bytes),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
  }
  open(bytes, context) {
    requireThat(
      bytes.length >= 32 && bytes.subarray(0, 4).toString() === "DOP1",
      "invalid_ciphertext",
    );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      bytes.subarray(4, 16),
    );
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([
      decipher.update(bytes.subarray(16, -16)),
      decipher.final(),
    ]);
  }
  fingerprint(bytes) {
    return createHmac("sha256", this.key).update(bytes).digest("hex");
  }
  async init() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }
  async space() {
    const s = await statfs(this.root);
    requireThat(
      s.bavail * s.bsize >= LIMITS.reserve,
      "storage_unavailable",
      503,
    );
  }
  async sync() {
    const dir = await open(this.root, "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  }
  async put(object, part, bytes) {
    requireThat(bytes.length <= LIMITS.file, "file_limit", 413);
    const path = this.path(object, part),
      tmp = path + ".pending";
    const f = await open(tmp, "w", 0o600);
    try {
      await f.writeFile(this.seal(bytes, `${object}/${part}`));
      await f.sync();
    } finally {
      await f.close();
    }
    await rename(tmp, path);
    await this.sync();
  }
  async get(object, part) {
    return this.open(
      await readFile(this.path(object, part)),
      `${object}/${part}`,
    );
  }
  async remove(object) {
    for (const part of [
      "raw",
      "preview",
      ...Array.from({ length: 20 }, (_, i) => `chunk-${i}`),
    ])
      for (const suffix of ["", ".pending"])
        await unlink(this.path(object, part) + suffix).catch((e) => {
          if (e.code !== "ENOENT") throw e;
        });
  }
  async removeChunks(object) {
    for (let i = 0; i < 20; i++)
      await unlink(this.path(object, `chunk-${i}`)).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
  }
}
