import { afterEach, describe, expect, it, vi } from 'vitest'

type BeforeSend = (event: object, hint: { originalException?: unknown }) => object | null

type BeforeSendSpan = (span: { data: Record<string, unknown> }) => { data: Record<string, unknown> }

/** Loads instrument.server.mjs with a DSN and returns the options it gives Sentry. */
async function serverOptions() {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/2')
  const init = vi.fn()
  vi.doMock('@sentry/tanstackstart-react', () => ({
    init,
    consoleLoggingIntegration: (options: object) => ({ name: 'ConsoleLogs', options }),
  }))
  // @ts-expect-error: a plain module that Node loads with --import, without types.
  await import('../../../../instrument.server.mjs')
  return init.mock.calls[0][0] as {
    beforeSend: BeforeSend
    beforeSendSpan: BeforeSendSpan
    enableLogs: boolean
    integrations: { name: string; options: { levels: string[] } }[]
  }
}

async function serverBeforeSend() {
  return (await serverOptions()).beforeSend
}

describe('server error reports', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('@sentry/tanstackstart-react')
    vi.resetModules()
  })

  it('drops the abort when a browser disconnects before its request is read', async () => {
    const beforeSend = await serverBeforeSend()
    const aborted = new DOMException('This operation was aborted', 'AbortError')
    expect(beforeSend({ transaction: 'POST /zna1yjzu' }, { originalException: aborted })).toBeNull()
  })

  it('drops an error whose cause is that abort', async () => {
    const beforeSend = await serverBeforeSend()
    const aborted = new DOMException('This operation was aborted', 'AbortError')
    const wrapped = Object.assign(new Error('This operation was aborted'), { cause: aborted })
    expect(beforeSend({}, { originalException: wrapped })).toBeNull()
  })

  it('keeps every other error', async () => {
    const beforeSend = await serverBeforeSend()
    const event = { transaction: 'GET /api/health' }
    expect(beforeSend(event, { originalException: new TypeError('x is undefined') })).toBe(event)
  })

  it('removes the visitor IP the proxy forwards from every span', async () => {
    const { beforeSendSpan } = await serverOptions()
    const span = beforeSendSpan({
      data: {
        'http.client_ip': '203.0.113.7',
        'client.address': '203.0.113.7',
        'http.target': '/api/health',
      },
    })
    expect(span.data).toEqual({ 'http.target': '/api/health' })
  })

  it('sends what the server writes to the console, as Dokploy shows it, to Sentry logs', async () => {
    const options = await serverOptions()
    expect(options.enableLogs).toBe(true)
    expect(options.integrations).toContainEqual({
      name: 'ConsoleLogs',
      options: { levels: ['log', 'info', 'warn', 'error'] },
    })
  })
})
