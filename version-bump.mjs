import { readFileSync, writeFileSync } from 'fs';

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync('versions.json', 'utf8'));
if (!Object.values(versions).includes(minAppVersion)) {
  versions[targetVersion] = minAppVersion;
  writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
}

let appSett = JSON.parse(readFileSync('src/assets/s.json', 'utf8'));
appSett.version = targetVersion;
appSett.readme = readFileSync('README.md').toString();
appSett.splash = readFileSync('src/assets/splash.md').toString();
writeFileSync('src/assets/s.json', JSON.stringify(appSett, null, '\t'));
