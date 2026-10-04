/** When the privacy page last changed in substance. Update it with the page. */
export const PRIVACY_UPDATED = '4 October 2026'

/** Everything Hexlode keeps in the browser, for the privacy page. */
export const STORED_IN_BROWSER = [
  {
    label: 'Run files',
    description:
      "While a run is active, items and step results are kept in your browser's private file storage. Run files are deleted after delivery, when a new run starts and on your next visit. Step results are kept up to the size you set, then the oldest are deleted.",
  },
  {
    label: 'Saved pipelines and settings',
    description: 'Only when you click Save or change a setting.',
  },
  {
    label: 'The pipeline open in the Studio',
    description:
      'Its nodes, settings and name, so a reload does not lose your work, kept for that tab only. Unsaved changes are also kept for a day, so a new tab can offer them back. Never your images.',
  },
  {
    label: 'Your colour mode',
    description: 'Dark, light or system, once you pick one in the top bar.',
  },
] as const
