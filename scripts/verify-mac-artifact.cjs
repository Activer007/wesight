'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MacArtifactTarget = {
  X64: 'mac-x64',
  Arm64: 'mac-arm64',
};

const NativeArchToken = {
  [MacArtifactTarget.X64]: 'x86_64',
  [MacArtifactTarget.Arm64]: 'arm64',
};

const NativeTargetPathToken = {
  [MacArtifactTarget.X64]: ['x64-darwin', 'darwin-x64'],
  [MacArtifactTarget.Arm64]: ['arm64-darwin', 'darwin-arm64'],
};

const rootDir = path.resolve(__dirname, '..');
const target = (process.argv[2] || '').trim();

function fail(message) {
  console.error(`[verify-mac-artifact] ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[verify-mac-artifact] ${message}`);
}

if (!Object.values(MacArtifactTarget).includes(target)) {
  fail(`Usage: node scripts/verify-mac-artifact.cjs ${MacArtifactTarget.X64}|${MacArtifactTarget.Arm64}`);
}

function walk(dir, visitor) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      visitor(fullPath, entry);
      walk(fullPath, visitor);
    } else {
      visitor(fullPath, entry);
    }
  }
}

function findPackagedApps() {
  const releaseDir = path.join(rootDir, 'release');
  const apps = [];
  walk(releaseDir, (candidate, entry) => {
    if (entry.isDirectory() && candidate.endsWith('.app')) {
      apps.push(candidate);
    }
  });
  return apps.sort();
}

function runFile(filePath) {
  const result = spawnSync('file', [filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    fail(`Could not inspect file architecture for ${filePath}: ${result.stderr || result.error?.message || 'unknown error'}`);
  }
  return (result.stdout || '').trim();
}

function selectApp(apps, expectedToken) {
  const matching = apps.find((appPath) => {
    const executablePath = path.join(appPath, 'Contents', 'MacOS', 'WeSight');
    return fs.existsSync(executablePath) && runFile(executablePath).includes(expectedToken);
  });
  if (matching) return matching;
  return apps[0] || null;
}

function assertFileHasArch(filePath, expectedToken) {
  const output = runFile(filePath);
  if (!output.includes(expectedToken)) {
    fail(`Expected ${filePath} to include ${expectedToken}, got: ${output}`);
  }
  log(output);
}

function shouldInspectNativeModule(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const targetPathTokens = NativeTargetPathToken[target];
  if (targetPathTokens.some((token) => normalizedPath.includes(`/${token}/`) || normalizedPath.includes(`/${token}.node`))) {
    return true;
  }

  const packagedTargetPattern = /\/(?:x64|arm64)-(?:darwin|linux|win32)\/|\/(?:darwin|linux|win32)-(?:x64|arm64)\//;
  return !packagedTargetPattern.test(normalizedPath);
}

const apps = findPackagedApps();
const expectedArchToken = NativeArchToken[target];
const appPath = selectApp(apps, expectedArchToken);
if (!appPath) {
  fail(`No packaged .app found under ${path.join(rootDir, 'release')}`);
}

const executablePath = path.join(appPath, 'Contents', 'MacOS', 'WeSight');

log(`Checking ${appPath}`);

if (!fs.existsSync(executablePath)) {
  fail(`Packaged app executable is missing: ${executablePath}`);
}
assertFileHasArch(executablePath, expectedArchToken);

const nativeModules = [];
const skippedNativeModules = [];
walk(appPath, (candidate, entry) => {
  if (!entry.isFile() || !candidate.endsWith('.node')) {
    return;
  }

  if (shouldInspectNativeModule(candidate)) {
    nativeModules.push(candidate);
  } else {
    skippedNativeModules.push(candidate);
  }
});

if (nativeModules.length === 0) {
  fail('No native .node modules were found in the packaged app.');
}

for (const nativeModule of nativeModules.sort()) {
  assertFileHasArch(nativeModule, expectedArchToken);
}

log(`Verified ${nativeModules.length} native module(s).`);
if (skippedNativeModules.length > 0) {
  log(`Skipped ${skippedNativeModules.length} non-target vendor native module(s).`);
}
