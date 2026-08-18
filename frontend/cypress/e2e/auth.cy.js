import { registerUser } from '../support/api';

// The session is an httpOnly cookie and the rest of the suite seeds it by hand,
// so this is the only spec that goes through the login form itself.
describe('session', () => {
    it('logs in through the form and lands on the groups list', () => {
        const email = `login${Date.now()}@test.com`;

        // sign-up auto-signs-in, so clear the cookie to start logged out and let
        // the form create the session.
        registerUser('Jorge', email);
        cy.clearCookies();

        cy.visit('/login');
        cy.get('#email').type(email);
        cy.get('#password').type('Password1');
        cy.get('button[type="submit"]').click();

        cy.url().should('include', '/groups');
        cy.contains('There are no groups').should('be.visible');
    });

    it('surfaces a failed login and stays on the form', () => {
        const email = `bad${Date.now()}@test.com`;

        registerUser('Jorge', email);
        cy.clearCookies();

        cy.visit('/login');
        cy.get('#email').type(email);
        cy.get('#password').type('Wrongpass1');
        cy.get('button[type="submit"]').click();

        cy.contains('Invalid email or password').should('exist');
        cy.url().should('include', '/login');
    });

    it('edits the profile and the new name survives the reload', () => {
        registerUser('Jorge', `profile${Date.now()}@test.com`);

        cy.visit('/profile');

        cy.contains('Edit profile').click();
        cy.get('input[type="text"]').clear().type('Jorge Alvarez');
        cy.contains('button', 'Save changes').click();

        // updateUser writes through Better Auth and the form reloads; the profile
        // reads the user from the refreshed session. This is what checks it wrote.
        cy.contains('h1', 'Jorge Alvarez').should('be.visible');
    });
});
