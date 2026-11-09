/** When the privacy page last changed in substance. Update it with the page. */
export const PRIVACY_UPDATED = '10 November 2026'

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
  {
    label: 'A copy of the app',
    description:
      "Hexlode's own pages, scripts, styles, fonts and image codecs, saved after your first visit so the app opens and runs without a connection. Never your images. Each new version of Hexlode replaces it.",
  },
  {
    label: 'Photos shared to the app',
    description:
      'On Android, photos you share to the installed app wait here until Strip metadata opens them, then they are deleted.',
  },
] as const
