// Prints the coverage totals as a Markdown table, for the CI job summary.
import { readFileSync } from 'node:fs'

const { total } = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'))
const rows = ['statements', 'branches', 'functions', 'lines'].map(
  (key) => `| ${key} | ${total[key].pct}% | ${total[key].covered} / ${total[key].total} |`,
)
console.log(['## Coverage', '', '| | Covered | |', '| --- | --- | --- |', ...rows].join('\n'))
