export async function startLiveApp(config) {
  if(config.readApi==='frontend-reads-v1' && new URLSearchParams(window.location.search).get('view')!=='workspace') return (await import('./original-review.js')).startOriginalReview(config);
  const module = config.readApi === 'frontend-reads-v1'
    ? await import('./workspace.js') : await import('./baseline-app.js');
  return module.startLiveApp(config);
}
