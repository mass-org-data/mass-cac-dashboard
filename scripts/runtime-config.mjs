// Single source for the build-time runtime configuration used by both the current
// esbuild app (scripts/build.mjs) and the new web/ Vite app. Keys are never written
// to release metadata; the publishable key is public by design.
import {validateConfig,PRODUCTION_PROJECT} from '../src/live/config.js';

export function readRuntimeConfig(env=process.env){
  const input={mode:env.MASS_APP_MODE||'live',url:env.MASS_SUPABASE_URL,publishableKey:env.MASS_SUPABASE_PUBLISHABLE_KEY,readApi:env.MASS_READ_API||'frontend-reads-v1',directoryApi:env.MASS_DIRECTORY_API||'off'};
  // Missing config builds a fail-closed configuration screen. Partial/unsafe config
  // fails the build before any browser bundle is produced.
  const configured=Boolean(input.url||input.publishableKey);
  const config=(input.mode==='demo'||configured)?validateConfig(input):{mode:input.mode};
  if(!['live','demo'].includes(input.mode))throw Error('MASS_APP_MODE must be live or demo.');
  // Data isolation: Vercel Production builds must use the production project, and
  // Preview builds must not (a preview that writes to production data is a defect).
  // MASS_ALLOW_PRODUCTION_IN_PREVIEW=1 is an explicit, reviewed override.
  if(config.project){
    const environment=env.VERCEL_ENV;
    if(environment==='production'&&config.project!==PRODUCTION_PROJECT)throw Error('Production builds must use the production Supabase project.');
    if(environment==='preview'&&config.project===PRODUCTION_PROJECT&&env.MASS_ALLOW_PRODUCTION_IN_PREVIEW!=='1')throw Error('Preview builds must use the preview Supabase project, not production. Set MASS_SUPABASE_URL for the Preview environment.');
  }
  return {input,config};
}
