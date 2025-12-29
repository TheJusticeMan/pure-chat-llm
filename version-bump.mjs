import { readFileSync, writeFileSync } from 'fs';

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));

let appSett = JSON.parse(readFileSync('src/assets/s.json', 'utf8'));
appSett.version = targetVersion;
appSett.readme = readFileSync('README.md').toString();
appSett.splash = readFileSync('src/assets/splash.md').toString();
Object.entries(getObjectFromMarkdown(readFileSync('src/assets/templates.md').toString(), 1, 2)).forEach(
  ([k, v]) => (appSett[k] = v),
);
console.log(
  JSON.stringify(
    getObjectFromMarkdown(readFileSync('src/assets/templates.md').toString(), 1, 2),
    null,
    '\t',
  ),
);
writeFileSync('src/assets/s.json', JSON.stringify(appSett, null, '\t'));

function getObjectFromMarkdown(rawMarkdown, level = 1, maxlevel = 6) {
  return Object.fromEntries(
    rawMarkdown
      .trim()
      .split(new RegExp(`^${'#'.repeat(level)} `, 'gm'))
      .slice(1)
      .map(s => {
        const [title, ...content] = s.split('\n');
        const joinedContent = content.join('\n');
        if (level < maxlevel && joinedContent.includes('\n' + '#'.repeat(level + 1) + ' ')) {
          return [title.trim(), getObjectFromMarkdown(joinedContent, level + 1, maxlevel)];
        }
        return [title.trim(), joinedContent.trim()];
      }),
  );
}
