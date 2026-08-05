// Seeding through the API instead of through the UI: a spec that has to click
// its way to a group before testing anything else fails for reasons that have
// nothing to do with what it guards.
export const api = 'http://localhost:3001/api';

export const registerUser = (name, email) =>
    cy.request('POST', `${api}/auth/register`, { name, email, password: 'Password1' }).its('body');

export const createGroup = (session, body) =>
    cy.request({
        method: 'POST',
        url: `${api}/group`,
        headers: { Authorization: `Bearer ${session.token}` },
        body,
    }).its('body');

// The app reads the session on mount, so this needs a page already open and a
// visit afterwards. Everything that depends on a seeded value has to hang off a
// cy.then(): interpolating it outside reads it at queue time, before the
// request that fills it has answered.
export const useSession = (session) =>
    cy.window().then((win) => win.localStorage.setItem('user-session', JSON.stringify(session)));
