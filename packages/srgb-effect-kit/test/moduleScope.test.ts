import { afterEach, describe, expect, it } from 'vitest';
import { srgbEffect } from '../src/vite';
import { buildFixture, cleanupFixtures, createFixture } from './helpers/fixture';

afterEach(cleanupFixtures);

const plugins = () => [
  srgbEffect({
    title: 'Scope',
    properties: [{ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 1, default: 0 }],
  }),
];

const root = (main: string) =>
  createFixture({
    'index.html': '<body><script type="module" src="/main.ts"></script></body>',
    'main.ts': main,
  });

describe('module-scope handler warning', () => {
  it('warns about module-scoped handler functions', async () => {
    const { warnings } = await buildFixture(
      root('function onSpeedChanged() { document.title = "x"; }\nonSpeedChanged();'),
      { plugins: plugins() },
    );
    expect(warnings.join('\n')).toMatch(
      /"function onSpeedChanged\(\)" is module-scoped .* window\.onSpeedChanged = /s,
    );
  });

  it('stays quiet for window assignments', async () => {
    const { warnings } = await buildFixture(
      root('window.onSpeedChanged = () => { document.title = "x"; };'),
      { plugins: plugins() },
    );
    expect(warnings.join('\n')).not.toMatch(/module-scoped/);
  });
});
