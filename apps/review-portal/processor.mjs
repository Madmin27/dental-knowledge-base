import http from "node:http";
import { Denied, requireThat, LIMITS } from "./policy.mjs";

export function processor(socketPath) {
  return async (bytes, type) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath,
          path: "/process",
          method: "POST",
          headers: { "Content-Type": type, "Content-Length": bytes.length },
        },
        (res) => {
          let size = 0;
          const parts = [];
          res.on("data", (part) => {
            size += part.length;
            if (size > LIMITS.file) {
              res.destroy();
              reject(new Denied("processor_output_limit", 503));
            } else parts.push(part);
          });
          res.on("error", reject);
          res.on("end", () => {
            try {
              requireThat(
                res.statusCode === 200,
                "processing_unavailable",
                503,
              );
              const output = Buffer.concat(parts);
              requireThat(
                output.length > 0 &&
                  output.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
                "processor_output_invalid",
                503,
              );
              const info = JSON.parse(
                String(res.headers["x-image-info"] ?? ""),
              );
              requireThat(
                Number.isInteger(info.width) &&
                  Number.isInteger(info.height) &&
                  info.width > 0 &&
                  info.height > 0 &&
                  info.width * info.height <= LIMITS.pixels &&
                  info.metadataRemoved === true &&
                  info.scanner === "clean",
                "processor_output_invalid",
                503,
              );
              resolve({ bytes: output, info });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.setTimeout(60000, () =>
        req.destroy(new Denied("processing_timeout", 503)),
      );
      req.on("error", reject);
      req.end(bytes);
    });
}
