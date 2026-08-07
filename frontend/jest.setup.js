import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

globalThis.TextEncoder = globalThis.TextEncoder ?? TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder ?? TextDecoder;
