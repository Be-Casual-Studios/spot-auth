import fs from 'fs';
import path from 'path';

/**
 * Appends the token cache filename to the project's .gitignore if not already present.
 * Non-fatal — logs a warning on failure but does not throw.
 */
export function ensureGitignored(filename = '.spotify-tokens.json') {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  try {
    const existing = fs.existsSync(gitignorePath)
      ? fs.readFileSync(gitignorePath, 'utf8')
      : '';

    const lines = existing.split('\n').map(l => l.trim());
    if (!lines.includes(filename)) {
      fs.appendFileSync(gitignorePath, `\n# spot-auth token cache\n${filename}\n`);
    }
  } catch (err) {
    console.warn(`spot-auth: could not update .gitignore (${err.message}). Add "${filename}" manually.`);
  }
}
