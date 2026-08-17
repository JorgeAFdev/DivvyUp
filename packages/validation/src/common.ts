import { z } from 'zod';

// A Mongo id is a 24-hex string. This validates it without pulling mongoose
// into the package, which the frontend bundles: a regex keeps the input
// contract shared, an ObjectId cast would not. The same message covers a
// missing value and a malformed one, so a route param and a body id both
// report the caller's chosen text.
export const objectId = (message: string) =>
    z.string({ error: message }).regex(/^[0-9a-fA-F]{24}$/, message);
