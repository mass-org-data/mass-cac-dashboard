const PROJECT = 'pbkwpfdpdtelmvbkzgvx';

export function validateConfig(input = {}) {
  const mode = input.mode || 'live';
  if (!['live', 'demo'].includes(mode)) throw new Error('MASS_APP_MODE must be live or demo.');
  if (mode === 'demo') return Object.freeze({mode});
  const url = String(input.url || '').trim();
  const key = String(input.publishableKey || '').trim();
  if (url !== `https://${PROJECT}.supabase.co`) {
    throw new Error('Configure MASS_SUPABASE_URL for the approved MASS Supabase project.');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) {
    throw new Error('Configure MASS_SUPABASE_PUBLISHABLE_KEY with a publishable key. Secret and service-role keys are forbidden.');
  }
  const readApi = input.readApi || 'frontend-reads-v1';
  if (!['baseline','frontend-reads-v1'].includes(readApi)) throw new Error('Unsupported MASS_READ_API.');
  const directoryApi=input.directoryApi||'off';
  if(!['off','directory-v1'].includes(directoryApi))throw new Error('Unsupported MASS_DIRECTORY_API.');
  if(directoryApi==='directory-v1'&&readApi!=='frontend-reads-v1')throw new Error('Directory requires frontend-reads-v1.');
  return Object.freeze({mode, url, publishableKey: key, project: PROJECT, readApi,directoryApi});
}
