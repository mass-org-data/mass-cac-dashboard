import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {runtimeConfig} from 'mass-runtime-config';
import {validateConfig} from '../../src/live/config.js';
import {App} from './app/App';
import type {RuntimeConfig} from './session/backend';
import './index.css';

const root = createRoot(document.getElementById('root')!);
try {
  // Same fail-closed check as the current application: an unapproved or missing configuration shows a notice, never data.
  const config = validateConfig(runtimeConfig) as RuntimeConfig;
  if (config.mode === 'demo') throw new Error('The new interface has no demo mode.');
  root.render(<StrictMode><App config={config} /></StrictMode>);
} catch (error) {
  root.render(<main className="mx-auto max-w-xl p-6"><h1 className="text-xl font-bold">Workspace configuration required</h1><p role="alert" className="mt-2 text-bad">{(error as Error).message}</p></main>);
}
