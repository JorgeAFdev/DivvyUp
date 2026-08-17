import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

// Gate a route on the shape of one part of the request. On failure it flattens
// Zod's issues into the { error: "reason. reason" } contract the controllers
// already used, so no consumer changes. On a body it replaces req.body with the
// parsed value, so the handler downstream sees the trimmed, coerced, stripped
// shape; params are only checked (a valid id needs no transform, and req.params
// carries the other route segments this schema does not describe).
export const validate =
    (schema: ZodType, source: 'body' | 'params' = 'body') =>
    (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            res.status(400).json({ error: result.error.issues.map((issue) => issue.message).join('. ') });
            return;
        }
        if (source === 'body') {
            req.body = result.data;
        }
        next();
    };
