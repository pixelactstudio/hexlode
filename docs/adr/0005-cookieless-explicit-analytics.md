# Cookieless analytics with explicit events

PostHog runs with `cookieless_mode: 'always'` and `person_profiles: 'never'`, so it stores nothing
in the browser and the app needs no consent banner. PostHog hashes each visitor's IP address, user
agent and host into an anonymous ID that changes daily, and the project discards the IP afterwards.
The client leaves `$ip` alone: PostHog drops cookieless events that arrive without one. Session
replay and autocapture are off because they would record file names shown on screen. The app sends its own detailed events
from one analytics module instead. Events never contain file names, paths, pixels, image metadata
or text the user types.
