import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const password = randomBytes(32).toString('hex');
const value = `DENTAL_DB_PASSWORD=${password}\nDATABASE_URL=postgresql://dental_dev:${password}@127.0.0.1:55432/dental_development\n`;
try {
  await writeFile(new URL('../.env', import.meta.url), value, { flag: 'wx', mode: 0o600 });
  console.log('Created private local .env. Credentials are not printed.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved.');
}
