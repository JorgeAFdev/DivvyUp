// Mirrors PASSWORD_PATTERN in backend/src/routers/auth.routes.ts. Keeping the
// two in step by hand is what TODO 11 replaces with a shared package.
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const PASSWORD_MESSAGE =
    'Password must be at least 8 characters long and contain a lowercase letter, an uppercase letter and a number';

export const PASSWORD_HINT = 'At least 8 characters, with upper and lower case and a number.';
