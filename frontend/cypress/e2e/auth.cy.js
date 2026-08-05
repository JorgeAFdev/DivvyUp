import { registerUser, useSession } from '../support/api';

// The session lives in localStorage and the rest of the suite seeds it by hand,
// so this is the only spec that goes through the login form itself.
describe('session', () => {
    it('logs in through the form and lands on the groups list', () => {
        const email = `login${Date.now()}@test.com`;

        registerUser('Jorge', email);

        cy.clearLocalStorage();
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

        cy.clearLocalStorage();
        cy.visit('/login');
        cy.get('#email').type(email);
        cy.get('#password').type('Wrongpass1');
        cy.get('button[type="submit"]').click();

        cy.contains('Invalid credentials').should('exist');
        cy.url().should('include', '/login');
    });

    it('edits the profile and the new name survives the reload', () => {
        let session;

        registerUser('Jorge', `profile${Date.now()}@test.com`).then((body) => { session = body; });

        cy.visit('/groups');
        cy.then(() => useSession(session));
        cy.then(() => cy.visit('/profile'));

        cy.contains('Edit profile').click();
        cy.get('input[type="text"]').clear().type('Jorge Alvarez');
        cy.contains('button', 'Guardar cambios').click();

        // The profile reads the user from the session, not from a query, so the
        // form writes localStorage and reloads. This is what checks it wrote.
        cy.contains('h1', 'Jorge Alvarez').should('be.visible');
    });
});
