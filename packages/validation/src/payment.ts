import { z } from 'zod';
import { objectId } from './common.js';

// pay has no body — the only input shape is the settled debt's id.
export const paymentParamsSchema = z.object({
    paymentId: objectId('Invalid payment ID'),
});
