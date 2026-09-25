import { Link } from '@tanstack/react-router'
import { type AnchorHTMLAttributes, forwardRef } from 'react'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }

/** Lets Astryx links navigate with TanStack Router. External links stay plain anchors. */
export const RouterLink = forwardRef<HTMLAnchorElement, Props>(function RouterLink(
  { href = '', ...props },
  ref,
) {
  if (/^(https?:|mailto:|#|blob:)/.test(href) || props.target === '_blank' || props.download) {
    return <a ref={ref} href={href} {...props} />
  }
  const RouterAnchor = Link as unknown as React.ComponentType<Props & { to: string; ref: unknown }>
  return <RouterAnchor ref={ref} to={href} {...props} />
})
