# Cookieless analytics with explicit events

PostHog runs with `cookieless_mode: 'always'` and `person_profiles: 'never'`, so it stores nothing
in the browser and the app needs no consent banner. IP capture, session replay and autocapture are
off because they would record file names shown on screen. The app sends its own detailed events
from one analytics module instead. Events never contain file names, paths, pixels, image metadata
or text the user types.
