// src/utils/fs.ts
import * as fs from 'fs';
import * as path from 'path';

export async function writeFileEnsured(p: string, data: string) {
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  await fs.promises.writeFile(p, data, 'utf8');
}
