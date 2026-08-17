import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { objectId } from './common.js';

// The amount ladder short-circuits (one message per request) and runs in the
// same order the controller used to. decimal.js — the app's money engine — does
// the decimal-places check, so the rule and its text are shared with the
// frontend instead of duplicated as a string regex there and a Decimal here.
// A third decimal breaks the even split: the leftover stops being a whole
// number of cents and gets handed out twice.
const totalAmount = z.number({ error: 'Total amount must be a number' }).superRefine((amount, ctx) => {
    if (!Number.isFinite(amount)) {
        ctx.addIssue({ code: 'custom', message: 'Total amount must be a number' });
        return;
    }
    if (amount <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Total amount must be greater than 0' });
        return;
    }
    if (amount >= 1000000) {
        ctx.addIssue({ code: 'custom', message: 'Total amount must be less than 1,000,000' });
        return;
    }
    if (new Decimal(amount).decimalPlaces() > 2) {
        ctx.addIssue({ code: 'custom', message: 'Total amount cannot have more than 2 decimals' });
    }
});

export const expenseSchema = z.object({
    description: z
        .string({ error: 'Description is required' })
        .min(1, 'Description is required')
        .max(30, 'description is too large'),
    totalAmount,
    // The member-id shape is checked here; whether it names a real member of the
    // group is a DB check that stays in the controller.
    paidBy: objectId('Payer is required'),
    // A single checkbox makes react-hook-form send a boolean instead of a list,
    // so the array check is what turns that into a 400 rather than a 500.
    participants: z
        .array(z.string(), { error: 'Participants must be a list of members' })
        .min(1, 'At least one participant must be selected')
        .refine((ids) => new Set(ids).size === ids.length, 'Duplicate participants are not allowed'),
});

export const expenseGroupParamsSchema = z.object({
    groupId: objectId('Invalid group or expense ID'),
});

export const expenseParamsSchema = z.object({
    groupId: objectId('Invalid group or expense ID'),
    expenseId: objectId('Invalid group or expense ID'),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
