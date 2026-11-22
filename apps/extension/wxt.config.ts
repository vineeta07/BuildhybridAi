import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// WXT writes the final manifest. After every build, open .output/chrome-mv3/manifest.json
// and confirm it matches SPEC.md (no content_scripts, no host_permissions).
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  zip: { artifactTemplate: 'satark-{{version}}-chrome.zip' },
  manifest: {
    name: 'Satark: scam and fine-print shield',
    description:
      'Reads scams and fine print for you. On-device AI first, with a private cloud fallback.',
    minimum_chrome_version: '139',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage', 'contextMenus'],
    optional_host_permissions: ['<all_urls>'], // Guardian mode only, requested on click
    action: { default_title: 'Check this page with Satark' },
    side_panel: { default_path: 'sidepanel.html' },
    commands: {
      'check-page': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Check this page with Satark',
      },
    },
    ...(process.env.EXTENSION_PUBLIC_KEY ? { key: process.env.EXTENSION_PUBLIC_KEY } : {}),
  },
});
