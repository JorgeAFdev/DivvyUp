import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';

globalThis.TextEncoder = globalThis.TextEncoder ?? TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder ?? TextDecoder;

// moduleNameMapper sends stylesheets to identity-obj-proxy, so App.css is absent
// from jsdom and createAppTheme has no palette to read.
const appCss = readFileSync(path.join(__dirname, 'src/App.css'), 'utf8');
const style = document.createElement('style');
style.textContent = appCss;
document.head.appendChild(style);
