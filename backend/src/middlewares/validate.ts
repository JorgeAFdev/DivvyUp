import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

// Gate a route on the shape of its body. On failure it flattens Zod's issues
// into the { error: "reason. reason" } contract the controllers already used,
// so no consumer changes. On success req.body is replaced with the parsed
// value, so the handler downstream sees the trimmed, coerced, stripped shape.
export const validate =
    (schema: ZodType) =>
    (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ error: result.error.issues.map((issue) => issue.message).join('. ') });
            return;
        }
        req.body = result.data;
        next();
    };
