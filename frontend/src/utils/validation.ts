// Presentational helper text shown under the password field. The validation
// rules and their messages live in @monorepo/validation; this is UI copy only.
export const PASSWORD_HINT = 'At least 8 characters, with upper and lower case and a number.';

// confirmPassword is a client-only field (Better Auth never receives it), so its
// copy lives here, not in the shared @monorepo/validation contract.
export const CONFIRM_PASSWORD_MISMATCH = 'Passwords do not match';
