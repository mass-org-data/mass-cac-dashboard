import {runtimeConfig} from 'mass-runtime-config';
import {validateConfig} from './live/config.js';

function configError(message) {
  const root = document.querySelector('#app');
  root.innerHTML = '<main class="auth-page"><section class="card auth-card"><img src="mass-logo.jpg" alt="MASS" width="100"><h1>Workspace configuration required</h1><p role="alert"></p><p>Contact the administrator. No programme records have been loaded.</p></section></main>';
  root.querySelector('[role=alert]').textContent = message;
}
try {
  const config = validateConfig(runtimeConfig);
  if (config.mode === 'demo') {
    await import('./app.js');
  } else {
    const {startLiveApp} = await import('./live/app.js');
    await startLiveApp(config);
  }
} catch (error) {
  configError(error.message);
}
