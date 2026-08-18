import type { Request, Response, NextFunction } from 'express';

// Last-resort net for anything handed to next(err). Without it an async handler
// that rejects (a requireSession that throws instead of 401) is an unhandled
// rejection, and under Express 4 that exits the process on a single bad request.
export const errorHandler = (error: unknown, _req: Request, res: Response, next: NextFunction) => {
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Internal server error' });
};
