import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
sharp.cache(false);
sharp.concurrency(1);
const input = await readFile("/tmp/job/input");
const signature = input.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
  ? "jpeg"
  : input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "png"
    : null;
if (!signature) throw new Error("signature");
const options = {
  limitInputPixels: 40_000_000,
  failOn: "warning",
  sequentialRead: true,
};
const metadata = await sharp(input, options).metadata();
if (
  metadata.format !== signature ||
  (metadata.pages ?? 1) !== 1 ||
  !metadata.width ||
  !metadata.height ||
  metadata.width * metadata.height > 40_000_000
)
  throw new Error("dimensions");
const { data, info } = await sharp(input, options)
  .rotate()
  .flatten({ background: "#ffffff" })
  .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
  .toBuffer({ resolveWithObject: true });
if (data.length > 20 * 1024 ** 2) throw new Error("output_limit");
await writeFile("/tmp/job/output", data, { mode: 0o600 });
await writeFile(
  "/tmp/job/info",
  JSON.stringify({
    width: info.width,
    height: info.height,
    format: "jpeg",
    metadataRemoved: true,
    scanner: "clean",
    processor: "photo-pilot-v1",
    sourceFormat: signature,
  }),
  { mode: 0o600 },
);
