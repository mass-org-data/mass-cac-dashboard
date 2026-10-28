export async function startLiveApp(config) {
  const module = config.readApi === 'frontend-reads-v1'
    ? await import('./workspace.js') : await import('./baseline-app.js');
  return module.startLiveApp(config);
}
