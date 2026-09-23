import { readFile } from "node:fs/promises";
import {
  verifyLedger,
  reconcileLedgers,
} from "../../apps/review-portal/erasures.mjs";
const [configFile, snapshot, current] = process.argv.slice(2);
const config = JSON.parse(await readFile(configFile, "utf8")),
  key = Buffer.from(config.vaultKey, "hex");
reconcileLedgers(
  verifyLedger(await readFile(snapshot, "utf8"), key),
  verifyLedger(await readFile(current, "utf8"), key),
);
