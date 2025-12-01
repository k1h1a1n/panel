import { InjectionToken } from '@angular/core';

export interface RuntimeConfig {
  apiBaseUrl?: string;
  contentUrl?: string;
  [key: string]: any;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

/**
 * Fetch `/config.json` at runtime and store on window for later use.
 * Includes console logs so you can see the loaded config in the browser console.
 */
export function initializeRuntimeConfig(): () => Promise<void> {
  return (): Promise<void> => {
    console.info('[runtime-config] loading /config.json');
    return fetch('/config.json', { cache: 'no-store' })
      .then((resp) => {
        if (!resp.ok) {
          console.warn('[runtime-config] /config.json not found (', resp.status, ')');
          return {} as RuntimeConfig;
        }
        return resp.json() as Promise<RuntimeConfig>;
      })
      .then((cfg) => {
        (window as any).__RUNTIME_CONFIG__ = cfg || {};
        console.info('[runtime-config] loaded config:', (window as any).__RUNTIME_CONFIG__);
      })
      .catch((err) => {
        console.error('[runtime-config] error loading /config.json', err);
        (window as any).__RUNTIME_CONFIG__ = {};
      });
  };
}
