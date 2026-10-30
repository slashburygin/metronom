import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Generate from the finished build, including Vite's copied public assets.
export function offlinePlugin() {
  let outDir;
  return {
    name: 'metronom-offline',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    async closeBundle() {
      const resources = [];
      async function visit(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) await visit(path);
          else {
            const url = relative(outDir, path).replaceAll('\\', '/');
            if (/^(index\.html|favicon\.svg|manifest\.webmanifest|icons\/[^/]+|assets\/[^/]+|lessons\/haimovich\/[^/]+)$/.test(url)) {
              resources.push({ url, hash: digest(await readFile(path)) });
            }
          }
        }
      }
      await visit(outDir);
      resources.sort((a, b) => a.url.localeCompare(b.url, 'en'));
      if (!resources.some(({ url }) => url === 'index.html')) throw new Error('Offline build requires index.html');
      const worker = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
      const manifest = JSON.stringify(resources);
      const version = digest(manifest + worker);
      await writeFile(join(outDir, 'sw.js'), `const VERSION = ${JSON.stringify(version)};\nconst RESOURCES = ${manifest};\n${worker}`);
    },
  };
}
