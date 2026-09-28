# Cookieless analytics with masked autocapture

PostHog starts as its TanStack Start guide shows (`defaults`, `api_host`), with
`cookieless_mode: 'always'` and `person_profiles: 'never'`, so it stores nothing in the browser and
the app needs no consent banner. PostHog hashes each visitor's IP address, user agent and host into
an anonymous ID that changes daily, and the project discards the IP afterwards. The client leaves
`$ip` alone: PostHog drops cookieless events that arrive without one.

PostHog captures pageviews, page leaves, clicks, rage and dead clicks, heatmaps and web vitals by
itself, which fills the web analytics dashboard. File names are shown on screen, so autocapture
masks every element's text and attributes (`mask_all_text`, `mask_all_element_attributes`), and
session replay stays off. PostHog's exception capture is off too: Sentry reports errors after
removing file names.

The app also sends its own named events from one analytics module, each checked against a schema.
They carry the product signal autocapture cannot: tools, pipeline shapes, node types, settings,
counts, timings and error codes. Events never contain file names, paths, pixels, image metadata or
text the user types.

Every event carries the app version and an `environment` property, `production` or `staging`, from
`HEXLODE_ENVIRONMENT`. Staging reports to the same project, since the free plan has one, and
PostHog's test account filter keeps it out of dashboards.

## Considered options

- **Explicit events only** (the first version). Private, but the web analytics dashboard stayed
  empty and nothing showed where people clicked or got stuck.
- **Autocapture with text.** Buttons would be named in PostHog, but clicks on file lists would
  send file names.
