import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJsonPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const lockJson = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

const lockRoot = lockJson?.packages?.[''] ?? {};

const sections = ['dependencies', 'devDependencies'];
const mismatches = [];

for (const section of sections) {
  const pkgSection = packageJson[section] ?? {};
  const lockSection = lockRoot[section] ?? {};

  for (const [name, version] of Object.entries(pkgSection)) {
    if (!(name in lockSection)) {
      mismatches.push(`${section}: missing ${name} in package-lock.json`);
      continue;
    }

    if (lockSection[name] !== version) {
      mismatches.push(
        `${section}: ${name} is ${lockSection[name]} in package-lock.json but ${version} in package.json`
      );
    }
  }

  for (const name of Object.keys(lockSection)) {
    if (!(name in pkgSection)) {
      mismatches.push(`${section}: extra ${name} present in package-lock.json`);
    }
  }
}

if (mismatches.length > 0) {
  console.error('package-lock.json is out of sync with package.json:');
  for (const mismatch of mismatches) {
    console.error(` - ${mismatch}`);
  }
  process.exit(1);
}

if (packageJson.overrides && Object.keys(packageJson.overrides).length > 0) {
  console.log(
    'Note: npm lockfile v3 does not mirror package.json overrides under packages[""].overrides; verify effective versions in node_modules entries if needed.'
  );
}

console.log('package-lock.json is in sync with package.json.');
