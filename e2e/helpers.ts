import type { Page } from '@playwright/test';

declare global {
  interface Window {
    /** Handler names in call order, recorded by `recordHandlerCalls`. */
    __handlerCalls: string[];
    /** `typeof` of SignalRGB globals at the first line of the effect's main module. */
    __atUserStart: Record<string, string | boolean>;
    /** Canvas API events the test's handler received. */
    __events: unknown[];
    /** Calls of the modes fixture's `onSpeedChanged`. */
    __speedCalls: number;
  }
}

/** Ports of the e2e/fixtures/modes dev servers, one per devtools mode ('full' is basic-2d). */
export const MODE_PORTS = { minimal: 5311, none: 5312 } as const;

/**
 * Records every call of the named handlers, whoever assigns them. The getter/setter pair defined
 * before any page script runs wraps each function the effect assigns.
 */
export async function recordHandlerCalls(page: Page, names: string[]): Promise<void> {
  await page.addInitScript((handlerNames: string[]) => {
    const calls: string[] = [];
    window.__handlerCalls = calls;
    for (const name of handlerNames) {
      let current: unknown;
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => current,
        set: (value: unknown) => {
          current =
            typeof value === 'function'
              ? function (this: unknown, ...args: unknown[]) {
                  calls.push(name);
                  return (value as (...a: unknown[]) => unknown).apply(this, args);
                }
              : value;
        },
      });
    }
  }, names);
}

/**
 * Prepends a probe to the effect's `src/main.ts` that records which SignalRGB globals exist when
 * the module's own code starts.
 */
export async function probeGlobalsAtUserStart(page: Page, names: string[]): Promise<void> {
  await page.route('**/src/main.ts', async (route) => {
    const response = await route.fetch();
    const probe = `window.__atUserStart = { ${names
      .map((name) => `${name}: typeof window.${name}`)
      .join(', ')}, onSpeedChanged: 'onSpeedChanged' in window };\n`;
    await route.fulfill({ response, body: probe + (await response.text()) });
  });
}

/** Collects uncaught page errors. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/**
 * Opens the effect and waits for the load event (the devtools fire the load-time handlers and mount
 * the drawer on DOMContentLoaded, before it) and for Vite's WebSocket, which relays canvas events.
 */
export async function openEffect(page: Page, url = '/'): Promise<void> {
  const connected = page.waitForEvent('console', (message) =>
    message.text().includes('[vite] connected'),
  );
  await page.goto(url);
  await connected;
}
