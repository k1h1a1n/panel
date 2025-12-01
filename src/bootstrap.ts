import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { RUNTIME_CONFIG } from './app/runtime-config';

async function main() {
  try {
    console.info('[bootstrap] fetching /config.json');
    const resp = await fetch('/config.json', { cache: 'no-store' });
    const cfg = resp.ok ? await resp.json() : {};
    (window as any).__RUNTIME_CONFIG__ = cfg;
    console.info('[bootstrap] loaded config:', cfg);

    const providers = [ ...(appConfig.providers ?? []), { provide: RUNTIME_CONFIG, useValue: cfg } ];

    await bootstrapApplication(App, { providers });
  } catch (err) {
    console.error('[bootstrap] failed to load config, booting without it', err);
    await bootstrapApplication(App, appConfig);
  }
}

main();
