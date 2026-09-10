import { equal, match } from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

const validatorPath = resolve(process.cwd(), 'scripts/validate-updates-config.ts');
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const stringsPath = 'android/app/src/main/res/values/strings.xml';
const updateUrl = 'https://u.expo.dev/11111111-1111-1111-1111-111111111111';

function appConfiguration() {
  return {
    expo: {
      name: 'Fixture',
      version: '1.0.2',
      runtimeVersion: '1.0.2',
      android: { package: 'com.example.fixture' },
      updates: {
        url: updateUrl,
        requestHeaders: { 'expo-channel-name': 'production' },
      },
      extra: { eas: { projectId: '11111111-1111-1111-1111-111111111111' } },
    },
  };
}

function write(root: string, filename: string, content: string): void {
  const path = resolve(root, filename);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function writeJson(root: string, filename: string, content: unknown): void {
  write(root, filename, JSON.stringify(content, null, 2));
}

function git(root: string, argumentsList: string[]): string {
  return execFileSync('git', argumentsList, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function fixture(context: TestContext): string {
  const root = mkdtempSync(resolve(tmpdir(), 'shagritm-publication-'));
  context.after(() => {
    if (!root.startsWith(`${resolve(tmpdir())}${sep}shagritm-publication-`)) {
      throw new Error('Refusing to remove a fixture outside the temporary test directory.');
    }
    rmSync(root, { recursive: true, force: true });
  });
  git(root, ['init', '--quiet']);
  git(root, ['config', 'core.autocrlf', 'false']);
  writeJson(root, 'app.json', appConfiguration());
  writeJson(root, 'eas.json', { build: { production: { channel: 'production' } } });
  writeJson(root, 'package.json', { dependencies: { 'expo-updates': '~56.0.22' } });
  writeJson(root, 'package-lock.json', { lockfileVersion: 3, packages: { 'node_modules/expo-updates': { version: '56.0.22' } } });
  write(root, 'android/.gitignore', 'build/\n.gradle/\nlocal.properties\n');
  write(root, 'android/app/src/main/java/StepCounter.kt', 'class StepCounter {}\n');
  write(root, manifestPath, `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application>
    <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="${updateUrl}"/>
    <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>
    <meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;production&quot;}"/>
  </application></manifest>`);
  write(root, stringsPath, '<resources><string name="expo_runtime_version">1.0.2</string></resources>');
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Publication tests', '-c', 'user.email=tests@example.invalid', 'commit', '--quiet', '-m', 'Installed Android runtime']);
  git(root, ['tag', 'v1.0.2']);
  writeJson(root, 'updates/production.json', {
    systemVersion: 1,
    platform: 'android',
    channel: 'production',
    runtimeVersion: '1.0.2',
    nativeSourceRef: 'v1.0.2',
    nativeSourceCommit: git(root, ['rev-parse', 'HEAD']),
  });
  return root;
}

function run(root: string, overrides: Record<string, string> = {}, argumentsList: string[] = []): { status: number | null; output: string } {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name.startsWith('EXPO_UPDATES_') || ['EXPO_RUNTIME_VERSION', 'EXPO_UPDATE_CHANNEL', 'EXPO_TOKEN'].includes(name)) {
      delete environment[name];
    }
  }
  const result = spawnSync(process.execPath, [validatorPath, ...argumentsList], {
    cwd: root,
    env: { ...environment, ...overrides },
    encoding: 'utf8',
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

function expectRejected(root: string, reason: RegExp, overrides: Record<string, string> = {}, argumentsList: string[] = []): void {
  const result = run(root, overrides, argumentsList);
  equal(result.status, 1, result.output);
  match(result.output, reason);
}

test('CLI accepts the installed runtime and JavaScript or asset changes', (context) => {
  const root = fixture(context);
  write(root, 'App.tsx', 'export default function App() { return "New design"; }');
  write(root, 'assets/new-design.svg', '<svg/>');
  write(root, 'android/app/build/generated/local-output.txt', 'ignored build output');
  const result = run(root);
  equal(result.status, 0, result.output);
  match(result.output, /Production OTA configuration verified/);
});

test('CLI rejects modified native code', (context) => {
  const root = fixture(context);
  write(root, 'android/app/src/main/java/StepCounter.kt', 'class ChangedStepCounter {}');
  expectRejected(root, /Native Android files changed.*StepCounter\.kt/);
});

test('CLI rejects untracked native source files', (context) => {
  const root = fixture(context);
  write(root, 'android/app/src/main/java/NewCounter.kt', 'class NewCounter {}');
  expectRejected(root, /Native Android files changed.*NewCounter\.kt/);
});

test('CLI rejects changed dependency ranges', (context) => {
  const root = fixture(context);
  writeJson(root, 'package.json', { dependencies: { 'expo-updates': '~57.0.0' } });
  expectRejected(root, /Runtime dependencies differs/);
});

test('CLI rejects locked transitive dependency drift', (context) => {
  const root = fixture(context);
  writeJson(root, 'package-lock.json', { lockfileVersion: 3, packages: { 'node_modules/expo-updates': { version: '56.0.23' } } });
  expectRejected(root, /Locked dependencies differs/);
});

test('CLI allows package script changes without changing runtime dependencies', (context) => {
  const root = fixture(context);
  writeJson(root, 'package.json', { dependencies: { 'expo-updates': '~56.0.22' }, scripts: { update: 'eas update' } });
  const result = run(root);
  equal(result.status, 0, result.output);
});

test('CLI rejects app configuration changes under the installed runtime', (context) => {
  const root = fixture(context);
  const configuration = appConfiguration();
  configuration.expo.android.package = 'com.example.changed';
  writeJson(root, 'app.json', configuration);
  expectRejected(root, /app\.json differs/);
});

test('CLI rejects a dynamic app configuration that could bypass app.json validation', (context) => {
  const root = fixture(context);
  write(root, 'app.config.ts', 'export default { runtimeVersion: "wrong" };');
  expectRejected(root, /Dynamic app\.config\.ts is not supported/);
});

test('CLI checks the literal Android manifest URL', (context) => {
  const root = fixture(context);
  write(root, manifestPath, readFileSync(resolve(root, manifestPath), 'utf8').replace(updateUrl, 'https://example.invalid/updates'));
  expectRejected(root, /Android update URL differs/);
});

test('CLI checks the actual Android runtime string resource', (context) => {
  const root = fixture(context);
  write(root, stringsPath, '<resources><string name="expo_runtime_version">1.0.1</string></resources>');
  expectRejected(root, /Android runtime version differs/);
});

test('CLI rejects disabled native updates and mismatched native channels', (context) => {
  const root = fixture(context);
  const originalManifest = readFileSync(resolve(root, manifestPath), 'utf8');
  write(root, manifestPath, originalManifest.replace('android:value="true"', 'android:value="false"'));
  expectRejected(root, /Android updates enabled flag differs/);
  write(root, manifestPath, originalManifest.replace('production', 'preview'));
  expectRejected(root, /Android update request headers differs/);
});

test('CLI rejects conflicting update environment overrides without printing their values', (context) => {
  const root = fixture(context);
  for (const variable of ['EXPO_UPDATES_URL', 'EXPO_UPDATES_ENABLED', 'EXPO_RUNTIME_VERSION', 'EXPO_UPDATES_RUNTIME_VERSION', 'EXPO_UPDATE_CHANNEL']) {
    const result = run(root, { [variable]: 'private-override-value' });
    equal(result.status, 1, result.output);
    match(result.output, new RegExp(`${variable} conflicts`));
    equal(result.output.includes('private-override-value'), false);
  }
  expectRejected(root, /EXPO_UPDATES_REQUEST_HEADERS differs/, {
    EXPO_UPDATES_REQUEST_HEADERS: JSON.stringify({ 'expo-channel-name': 'preview' }),
  });
});

test('CLI accepts environment values that match the installed runtime', (context) => {
  const root = fixture(context);
  const result = run(root, {
    EXPO_UPDATES_URL: updateUrl,
    EXPO_UPDATES_ENABLED: 'true',
    EXPO_RUNTIME_VERSION: '1.0.2',
    EXPO_UPDATES_REQUEST_HEADERS: JSON.stringify({ 'expo-channel-name': 'production' }),
  });
  equal(result.status, 0, result.output);
});

test('CLI rejects a release tag that no longer identifies the shipped commit', (context) => {
  const root = fixture(context);
  write(root, 'App.tsx', 'export default "change";');
  git(root, ['add', 'App.tsx']);
  git(root, ['-c', 'user.name=Publication tests', '-c', 'user.email=tests@example.invalid', 'commit', '--quiet', '-m', 'Later source']);
  git(root, ['tag', '-f', 'v1.0.2']);
  expectRejected(root, /Native source tag differs/);
});

test('native build mode permits a new coherent runtime before updating the shipped baseline', (context) => {
  const root = fixture(context);
  const configuration = appConfiguration();
  configuration.expo.runtimeVersion = '1.0.3';
  configuration.expo.version = '1.0.3';
  writeJson(root, 'app.json', configuration);
  write(root, stringsPath, '<resources><string name="expo_runtime_version">1.0.3</string></resources>');
  write(root, 'android/app/src/main/java/StepCounter.kt', 'class ImprovedStepCounter {}');
  const result = run(root, {}, ['--native-build']);
  equal(result.status, 0, result.output);
  match(result.output, /After distributing the APK/);
  expectRejected(root, /Publication runtime version differs/);
});

test('native build mode continues to reject a mismatch between app.json and native metadata', (context) => {
  const root = fixture(context);
  write(root, stringsPath, '<resources><string name="expo_runtime_version">1.0.3</string></resources>');
  expectRejected(root, /Android runtime version differs/, {}, ['--native-build']);
});
