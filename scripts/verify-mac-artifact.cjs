'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MacRuntimeTarget = {
  X64: 'mac-x64',
  Arm64: 'mac-arm64',
};

const NativeArchToken = {
  [MacRuntimeTarget.X64]: 'x86_64',
  [MacRuntimeTarget.Arm64]: 'arm64',
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

if (!Object.values(MacRuntimeTarget).includes(target)) {
  fail(`Usage: node scripts/verify-mac-artifact.cjs ${MacRuntimeTarget.X64}|${MacRuntimeTarget.Arm64}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
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

function readRuntimeTarget(appPath) {
  const buildInfoPath = path.join(
    appPath,
    'Contents',
    'Resources',
    'cfmind',
    'runtime-build-info.json',
  );
  const buildInfo = readJson(buildInfoPath);
  return typeof buildInfo?.target === 'string' ? buildInfo.target : null;
}

function selectApp(apps) {
  const matching = apps.find((appPath) => readRuntimeTarget(appPath) === target);
  if (matching) return matching;
  return apps[0] || null;
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

function assertFileHasArch(filePath, expectedToken) {
  const output = runFile(filePath);
  if (!output.includes(expectedToken)) {
    fail(`Expected ${filePath} to include ${expectedToken}, got: ${output}`);
  }
  log(output);
}

const apps = findPackagedApps();
const appPath = selectApp(apps);
if (!appPath) {
  fail(`No packaged .app found under ${path.join(rootDir, 'release')}`);
}

const resourcesDir = path.join(appPath, 'Contents', 'Resources');
const cfmindDir = path.join(resourcesDir, 'cfmind');
const buildInfoPath = path.join(cfmindDir, 'runtime-build-info.json');
const executablePath = path.join(appPath, 'Contents', 'MacOS', 'WeSight');
const expectedArchToken = NativeArchToken[target];

log(`Checking ${appPath}`);

if (!fs.existsSync(executablePath)) {
  fail(`Packaged app executable is missing: ${executablePath}`);
}
assertFileHasArch(executablePath, expectedArchToken);

if (!fs.existsSync(cfmindDir)) {
  fail(`Packaged OpenClaw runtime is missing: ${cfmindDir}`);
}
if (!fs.existsSync(buildInfoPath)) {
  fail(`OpenClaw runtime build metadata is missing: ${buildInfoPath}`);
}

const buildInfo = readJson(buildInfoPath);
if (buildInfo?.target !== target) {
  fail(`Expected OpenClaw runtime target ${target}, got ${buildInfo?.target || 'unknown'}`);
}
log(`OpenClaw runtime target verified: ${target}`);

const nativeModules = [];
walk(appPath, (candidate, entry) => {
  if (entry.isFile() && candidate.endsWith('.node')) {
    nativeModules.push(candidate);
  }
});

if (nativeModules.length === 0) {
  fail('No native .node modules were found in the packaged app.');
}

for (const nativeModule of nativeModules.sort()) {
  assertFileHasArch(nativeModule, expectedArchToken);
}

log(`Verified ${nativeModules.length} native module(s).`);
