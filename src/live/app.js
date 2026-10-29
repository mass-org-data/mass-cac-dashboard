// The manager-approved interface is the single live entry point. Legacy
// workspaces remain in the repository for reference, not as a replacement UI.
export async function startLiveApp(config) {
 return (await import('./original-review.js')).startOriginalReview(config);
}
