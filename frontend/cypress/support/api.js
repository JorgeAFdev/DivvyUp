// Seeding through the API instead of through the UI: a spec that has to click
// its way to a group before testing anything else fails for reasons that have
// nothing to do with what it guards.
export const api = 'http://localhost:3001/api';

// Better Auth's own endpoints (sign-up/sign-in) enforce a CSRF origin check once
// a session cookie is present: without an Origin they answer 403
// "Missing or null Origin". A browser always sends Origin; cy.request does not,
// so seeding a second account (which carries the first's cookie) needs it set by
// hand to CLIENT_URL. Our own /group endpoint only reads the session, so it is
// unaffected — but sending it everywhere is harmless.
const ORIGIN = 'http://localhost:3000';

// Better Auth sets the session as an httpOnly cookie. Cypress keeps it in its
// cookie jar and shares it with the app under test, so signing up (or in) here
// is enough — no token and no localStorage to plant. sign-up auto-signs-in, so
// the last registerUser/loginAs is the active session for the next cy.visit.
export const registerUser = (name, email) =>
    cy.request({
        method: 'POST',
        url: `${api}/auth/sign-up/email`,
        headers: { origin: ORIGIN },
        body: { name, email, password: 'Password1' },
    }).its('body');

export const loginAs = (email) =>
    cy.request({
        method: 'POST',
        url: `${api}/auth/sign-in/email`,
        headers: { origin: ORIGIN },
        body: { email, password: 'Password1' },
    });

export const createGroup = (body) =>
    cy.request({ method: 'POST', url: `${api}/group`, body }).its('body');
