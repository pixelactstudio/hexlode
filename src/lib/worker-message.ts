/**
 * Whether a message reached a dedicated worker from the page that started it. Only that page can
 * post to a dedicated worker, and its messages carry no origin, or the worker's own; anything
 * else did not come from Hexlode and is ignored.
 */
export function fromOwnerPage(event: MessageEvent, scope: { location: { origin: string } }) {
  return event.origin === '' || event.origin === scope.location.origin
}
