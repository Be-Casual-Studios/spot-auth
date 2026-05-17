import fs from 'fs';
import path from 'path';

export class FileTokenStore {
  constructor(tokenCachePath) {
    this.path = tokenCachePath || path.join(process.cwd(), '.spotify-tokens.json');
  }

  get() {
    try {
      if (!fs.existsSync(this.path)) return null;
      return JSON.parse(fs.readFileSync(this.path, 'utf8'));
    } catch {
      return null;
    }
  }

  set(tokenData) {
    fs.writeFileSync(this.path, JSON.stringify(tokenData, null, 2));
  }

  clear() {
    try {
      if (fs.existsSync(this.path)) fs.unlinkSync(this.path);
    } catch { /* non-fatal */ }
  }
}
