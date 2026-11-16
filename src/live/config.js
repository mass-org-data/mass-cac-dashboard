// Approved Supabase projects. Browser connections are limited to exactly these
// hosts: config validation below and the `connect-src` directive in vercel.json
// (kept equal by tests/frontend/security-policy.test.mjs). Adding a project is a
// reviewed change to this list AND to vercel.json, never a runtime setting.
export const PRODUCTION_PROJECT = 'pbkwpfdpdtelmvbkzgvx';
export const PREVIEW_PROJECT = 'nilzfsahxoxibvrwsqkd';
export const APPROVED_PROJECTS = Object.freeze([PRODUCTION_PROJECT, PREVIEW_PROJECT]);

const PROJECT_URL = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/;

export function projectFromUrl(url) {
  const match = PROJECT_URL.exec(String(url || '').trim());
  return match && APPROVED_PROJECTS.includes(match[1]) ? match[1] : null;
}

export function validateConfig(input = {}) {
  const mode = input.mode || 'live';
  if (!['live', 'demo'].includes(mode)) throw new Error('MASS_APP_MODE must be live or demo.');
  if (mode === 'demo') return Object.freeze({mode});
  const url = String(input.url || '').trim();
  const key = String(input.publishableKey || '').trim();
  const project = projectFromUrl(url);
  if (!project) {
    throw new Error('Configure MASS_SUPABASE_URL for an approved MASS Supabase project.');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) {
    throw new Error('Configure MASS_SUPABASE_PUBLISHABLE_KEY with a publishable key. Secret and service-role keys are forbidden.');
  }
  const readApi = input.readApi || 'frontend-reads-v1';
  if (!['baseline','frontend-reads-v1'].includes(readApi)) throw new Error('Unsupported MASS_READ_API.');
  const directoryApi=input.directoryApi||'off';
  if(!['off','directory-v1'].includes(directoryApi))throw new Error('Unsupported MASS_DIRECTORY_API.');
  if(directoryApi==='directory-v1'&&readApi!=='frontend-reads-v1')throw new Error('Directory requires frontend-reads-v1.');
  return Object.freeze({mode, url, publishableKey: key, project, readApi,directoryApi});
}
