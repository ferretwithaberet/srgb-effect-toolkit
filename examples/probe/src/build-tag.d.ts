// Which build this is: 'module' or 'classic'. Each Vite config sets it with `define`, which Vite
// replaces at build time, so the classic build may use it (import.meta.env is allowed there).
interface ImportMetaEnv {
  readonly PROBE_BUILD: 'module' | 'classic';
}
