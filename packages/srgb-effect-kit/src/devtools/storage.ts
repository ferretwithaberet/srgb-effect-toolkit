/** First segment of every key: `srgb-effect-kit:<title>:<key>`. */
export const STORAGE_PREFIX = 'srgb-effect-kit';

/** localStorage scoped to one effect. Every call tolerates missing, blocked or full storage. */
export interface DevtoolsStorage {
  /** `srgb-effect-kit:<title>:` */
  readonly prefix: string;
  /** The stored JSON value, or undefined when it is missing, unparsable or fails `isValid`. */
  read<T>(key: string, isValid: (value: unknown) => value is T): T | undefined;
  /** Stores `value` as JSON. Failures (quota, blocked storage) are ignored. */
  write(key: string, value: unknown): void;
  remove(key: string): void;
}

/** Storage that keeps nothing: every read is undefined, every write is dropped. */
export const NO_STORAGE: DevtoolsStorage = {
  prefix: '',
  read: () => undefined,
  write: () => {},
  remove: () => {},
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Namespaces keys by effect title, because every effect served from `localhost:5173` shares one
 * origin and therefore one localStorage.
 */
export function createStorage(
  title: string,
  getStorage: () => Storage | undefined,
): DevtoolsStorage {
  const prefix = `${STORAGE_PREFIX}:${title}:`;
  const storage = (): Storage | undefined => {
    try {
      return getStorage();
    } catch {
      // Accessing localStorage throws when the browser blocks site data.
      return undefined;
    }
  };
  return {
    prefix,
    read<T>(key: string, isValid: (value: unknown) => value is T): T | undefined {
      let raw: string | null | undefined;
      try {
        raw = storage()?.getItem(prefix + key);
      } catch {
        return undefined;
      }
      if (raw === null || raw === undefined) return undefined;
      try {
        const value: unknown = JSON.parse(raw);
        return isValid(value) ? value : undefined;
      } catch {
        return undefined;
      }
    },
    write(key, value) {
      try {
        storage()?.setItem(prefix + key, JSON.stringify(value));
      } catch {
        // Quota exceeded or storage blocked: the setting just doesn't persist.
      }
    },
    remove(key) {
      try {
        storage()?.removeItem(prefix + key);
      } catch {
        // Storage blocked: nothing to remove.
      }
    },
  };
}
