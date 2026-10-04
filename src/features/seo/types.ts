import type { QuickTool } from '#/features/quick-tools/tools'

/** The pages search engines may list. Each has its own title, description and share card. */
export type SeoPage = 'home' | 'studio' | 'privacy' | QuickTool

/** What the share card for a page shows. */
export interface ShareCard {
  /** A short uppercase line above the title. */
  eyebrow: string
  /** The first line of the title, in the primary text colour. */
  title: string
  /** The second line of the title, in the brand gradient. */
  accent: string
  /** One or two sentences under the title. */
  body: string
  /** Short labels in a row at the bottom, such as formats or settings. */
  chips: readonly string[]
  /** The Studio screenshot on the right, or the page's tool icon. */
  art: 'studio' | 'icon'
}

export interface SeoPageDefinition {
  path: string
  /** The `<title>`, without the site name, which is appended. The home page's is used as is. */
  title: string
  /** For search results and link previews: about 150 characters, written for people. */
  description: string
  card: ShareCard
  /** How often the content changes, for the sitemap. */
  changeFrequency: 'weekly' | 'monthly' | 'yearly'
  /** From 0 to 1, for the sitemap. */
  priority: number
}
