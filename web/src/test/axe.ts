import axe from 'axe-core';

// Runs axe-core against a rendered container and returns readable violation summaries.
export async function violations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {rules: {'color-contrast': {enabled: false}}}); // jsdom has no layout/colour; contrast is checked in the browser pass
  return results.violations.map(v => `${v.id}: ${v.help} (${v.nodes.map(n => n.target.join(' ')).join('; ')})`);
}
