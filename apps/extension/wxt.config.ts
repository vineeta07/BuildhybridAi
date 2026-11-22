import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// WXT writes the final manifest. After every build, open .output/<target>/manifest.json
// and confirm it matches SPEC.md (no content_scripts, no host_permissions).
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3, // also for Firefox (WXT defaults Firefox to MV2)
  vite: () => ({ plugins: [tailwindcss()] }),
  zip: {
    artifactTemplate: 'satark-{{version}}-{{browser}}.zip',
    sourcesTemplate: 'satark-{{version}}-sources.zip',
    // Mozilla reviews the source of minified add-ons: include the whole monorepo (core lives outside this app).
    sourcesRoot: '../..',
    excludeSources: ['**/node_modules/**', '**/.output/**', '**/.wxt/**', 'functions/lib/**', '**/.env.local', '**/*.zip', '.git/**', '.firebase/**'],
  },
  manifest: ({ browser }) => {
    const firefox = browser === 'firefox';
    return {
      name: 'Satark: scam and fine-print shield',
      description:
        'Reads scams and fine print for you. On-device AI first, with a private cloud fallback.',
      // Firefox has no sidePanel API: WXT turns the side panel into a sidebar_action there.
      permissions: ['activeTab', 'scripting', 'storage', 'contextMenus', ...(firefox ? [] : ['sidePanel'])],
      optional_host_permissions: ['<all_urls>'], // Guardian mode only, requested on click
      action: { default_title: 'Check this page with Satark' },
      commands: {
        'check-page': {
          suggested_key: { default: 'Alt+Shift+S' },
          description: 'Check this page with Satark',
        },
      },
      ...(firefox
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'satark@satark-demo.web.app',
                strict_min_version: '140.0',
                // Redacted page text is sent to the cloud model after the user consents.
                data_collection_permissions: { required: ['websiteContent'] },
              },
            },
          }
        : {
            minimum_chrome_version: '139',
            side_panel: { default_path: 'sidepanel.html' },
            ...(process.env.EXTENSION_PUBLIC_KEY ? { key: process.env.EXTENSION_PUBLIC_KEY } : {}),
          }),
    };
  },
});
