import {validateConfig} from '../src/live/config.js';
try {
  const config=validateConfig({mode:process.env.MASS_APP_MODE,url:process.env.MASS_SUPABASE_URL,publishableKey:process.env.MASS_SUPABASE_PUBLISHABLE_KEY,readApi:process.env.MASS_READ_API,directoryApi:process.env.MASS_DIRECTORY_API});
  if(config.mode!=='live'||config.readApi!=='frontend-reads-v1'||config.directoryApi!=='directory-v1')throw Error('Preview requires live, frontend-reads-v1 and directory-v1.');
  console.log('PASS: approved project URL and publishable-key format; live/read/directory flags valid. Key value withheld.');
  console.log('This check performs no network calls or deployment and does not verify key ownership, Auth accounts, RLS or Vercel targeting.');
} catch(error) {console.error(error.message);process.exitCode=1;}
