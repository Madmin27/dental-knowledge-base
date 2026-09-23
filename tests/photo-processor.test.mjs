// Run against a dedicated no-network fixture processor; never the production socket.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { processor } from "../apps/review-portal/processor.mjs";
const socket = process.env.TEST_PHOTO_PROCESSOR_SOCKET;
test("isolated image scanner and re-encoder", { skip: !socket }, async (t) => {
  const sharp = createRequire("/processor/package.json")("sharp"),
    processPhoto = processor(socket);
  const input = await sharp({
    create: {
      width: 48,
      height: 32,
      channels: 3,
      background: { r: 210, g: 225, b: 235 },
    },
  })
    .withMetadata({
      exif: {
        IFD0: {
          Artist: "SYNTHETIC-METADATA-ONLY",
          Copyright: "synthetic fixture",
        },
      },
    })
    .png()
    .toBuffer();
  await t.test(
    "real scan/decode creates a bounded metadata-free derivative",
    async () => {
      const out = await processPhoto(input, "image/png");
      assert.equal(out.info.scanner, "clean");
      const m = await sharp(out.bytes).metadata();
      assert.equal(m.width, 48);
      assert.equal(m.height, 32);
      assert.equal(m.exif, undefined);
      assert.equal(m.icc, undefined);
      assert.equal(m.xmp, undefined);
      assert.equal(
        out.bytes.includes(Buffer.from("SYNTHETIC-METADATA-ONLY")),
        false,
      );
    },
  );
  await t.test("wrong signature and declared format are refused", async () => {
    await assert.rejects(
      processPhoto(Buffer.from('<svg onload="synthetic"/>'), "image/png"),
      /processing_unavailable/,
    );
    await assert.rejects(
      processPhoto(input, "image/jpeg"),
      /processing_unavailable/,
    );
  });
  await t.test("truncated images fail full decode", async () => {
    await assert.rejects(
      processPhoto(
        input.subarray(0, Math.floor(input.length / 2)),
        "image/png",
      ),
      /processing_unavailable/,
    );
  });
  await t.test(
    "decoded pixel bomb is refused before pixel allocation",
    async () => {
      const b = Buffer.from(input);
      b.writeUInt32BE(100000, 16);
      b.writeUInt32BE(100000, 20);
      let crc = 0xffffffff;
      for (const byte of b.subarray(12, 29)) {
        crc ^= byte;
        for (let n = 0; n < 8; n++)
          crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
      b.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29);
      await assert.rejects(
        processPhoto(b, "image/png"),
        /processing_unavailable/,
      );
    },
  );
});
