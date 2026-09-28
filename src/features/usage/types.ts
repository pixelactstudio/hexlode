/**
 * The analytics and error report settings the browser needs. They are public: the PostHog project
 * key and the Sentry DSN only allow sending events. The server reads them from its environment on
 * each page load, so a deployment changes them without a new image.
 */
export interface PublicConfig {
  posthogKey?: string
  posthogHost?: string
  sentryDsn?: string
  /** The running image's version, from `HEXLODE_VERSION`. Labels events and error reports. */
  appVersion?: string
}
