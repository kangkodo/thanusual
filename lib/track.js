export function trackPlaceOpen(prev, next, posthog = globalThis.posthog) {
  if (next && prev !== next) posthog?.capture("core_action", { action: "place_open" });
}
