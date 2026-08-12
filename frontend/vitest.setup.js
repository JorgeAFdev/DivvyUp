import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder, TextEncoder } from 'node:util';

// react-router 7 reads these at import time; jsdom does not always provide them.
globalThis.TextEncoder = globalThis.TextEncoder ?? TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder ?? TextDecoder;

// CSS module imports are aliased to identity-obj-proxy, so App.css never reaches
// jsdom and createAppTheme has no palette to read. Inject the real file.
const dir = path.dirname(fileURLToPath(import.meta.url));
const appCss = readFileSync(path.join(dir, 'src/App.css'), 'utf8');
const style = document.createElement('style');
style.textContent = appCss;
document.head.appendChild(style);
