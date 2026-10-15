# probe

A diagnostic effect, not a visual one. It logs facts about SignalRGB's environment (user agents, raw property values, handler calls, property changes with or without a handler call, the `engine` shape over time, frame rates, JavaScript and web features) to the console as `[probe] <section> <json>` lines. Its results replace the toolkit's provisional defaults.

- `pnpm build`: writes `dist/probe.html` (module script) and `dist/probe-classic.html` (classic script).
- `pnpm dev`: runs the probe against the devtools' simulation, which is useful only to check the probe itself.

To run it in SignalRGB and send back the results, follow [TEST-PLAN.md](TEST-PLAN.md).
