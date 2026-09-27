/**
 * @file icons.tsx
 * @input Uses lucide-react icon components, IconRegistry type
 * @output Exports themeIcons for the Hexlode theme
 * @position Icon configuration for the Hexlode theme; consumed by index.ts
 *
 * Maps semantic icon names to Lucide icon components.
 * These icons are bundled with the theme, not with @astryxdesign/core.
 */

import type { IconRegistry } from '@astryxdesign/core/Icon'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns,
  Copy,
  ExternalLink,
  EyeOff,
  Filter,
  Info,
  Menu,
  Mic,
  MoreHorizontal,
  Search,
  Square,
  Wrench,
  X,
  XCircle,
} from 'lucide-react'
import { createElement } from 'react'

// createElement rather than JSX: `astryx theme build` loads this file with the classic JSX
// transform, which would need React in scope.
const iconProps = {
  size: '1em',
  'aria-hidden': true as const,
}

export const themeIcons: IconRegistry = {
  close: createElement(X, iconProps),
  chevronDown: createElement(ChevronDown, iconProps),
  chevronLeft: createElement(ChevronLeft, iconProps),
  chevronRight: createElement(ChevronRight, iconProps),
  check: createElement(Check, iconProps),
  success: createElement(CheckCircle, iconProps),
  error: createElement(XCircle, iconProps),
  warning: createElement(AlertTriangle, iconProps),
  info: createElement(Info, iconProps),
  calendar: createElement(Calendar, iconProps),
  clock: createElement(Clock, iconProps),
  externalLink: createElement(ExternalLink, iconProps),
  menu: createElement(Menu, iconProps),
  moreHorizontal: createElement(MoreHorizontal, iconProps),
  search: createElement(Search, iconProps),
  arrowUp: createElement(ArrowUp, iconProps),
  arrowDown: createElement(ArrowDown, iconProps),
  arrowsUpDown: createElement(ArrowUpDown, iconProps),
  funnel: createElement(Filter, iconProps),
  eyeSlash: createElement(EyeOff, iconProps),
  viewColumns: createElement(Columns, iconProps),
  copy: createElement(Copy, iconProps),
  checkDouble: createElement(CheckCheck, iconProps),
  wrench: createElement(Wrench, iconProps),
  stop: createElement(Square, iconProps),
  microphone: createElement(Mic, iconProps),
}
