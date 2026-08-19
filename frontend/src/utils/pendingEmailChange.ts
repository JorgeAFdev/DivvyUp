// The tab that requests an email change stashes the target here for the
// /email-change landing to compare against the session. localStorage — which the
// Better Auth migration otherwise emptied — because the link opens in a separate
// tab and an email address is not a credential.
const KEY = 'divvyup_pending_email_change';

export const setPendingEmailChange = (email: string) => localStorage.setItem(KEY, email.toLowerCase());

export const getPendingEmailChange = () => localStorage.getItem(KEY);

export const clearPendingEmailChange = () => localStorage.removeItem(KEY);
