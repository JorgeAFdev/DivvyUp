import { z } from 'zod';

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const EMAIL_PATTERN = /.+@.+\..+/;

// The type-level `error` message reproduces the backend's old missing-field
// text; the min/regex message reproduces the invalid-field text. Both are set
// so a missing field and a present-but-invalid one keep the exact strings the
// controller used to emit (auth.test.ts pins them, joined with '. ').
const nameField = z
    .string({ error: 'Name must be at least 3 characters long' })
    .min(3, 'Name must be at least 3 characters long')
    .max(40, 'Name must be at most 40 characters long');

const emailField = z
    .string({ error: 'Email not received' })
    .regex(EMAIL_PATTERN, 'Please enter a valid email address');

const passwordField = z
    .string({ error: 'Password not received' })
    .regex(
        PASSWORD_PATTERN,
        'Password must be at least 8 characters long and contain a lowercase letter, an uppercase letter and a number'
    );

// Field order is the join order of the flattened error, so name/email/password
// here is what produces "name msg. email msg. password msg".
export const registerSchema = z.object({
    name: nameField,
    email: emailField,
    password: passwordField,
});

// Login reuses the same rules: there are no pre-strength accounts to lock out.
export const loginSchema = z.object({
    email: emailField,
    password: passwordField,
});

// No server hook enforces this: the reset request is answered the same whether or
// not the email exists, so a malformed one leaks nothing. Frontend form only.
export const forgetPasswordSchema = z.object({
    email: emailField,
});

// `newPassword` (not `password`) matches Better Auth's reset body key, so one
// schema drives both the backend `before` hook and the frontend form.
export const resetPasswordSchema = z.object({
    newPassword: passwordField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgetPasswordInput = z.infer<typeof forgetPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
