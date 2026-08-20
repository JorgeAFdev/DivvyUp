// Step 33: someone with no account follows the link and ends up inside the
// group, without ever pasting the link twice.
import { registerUser, createGroup } from '../support/api';

const seedGroup = (stamp) =>
    registerUser('Jorge', `jorge${stamp}@test.com`)
        .then(() => createGroup({ name: 'Viaje', description: 'Fin de semana', members: [{ name: 'Ana' }] }))
        .then((body) => body.inviteCode);

describe('landing on an invite without a session', () => {
    it('explains the invite, registers from there and claims a member', () => {
        const stamp = Date.now();

        // Everything hangs off this callback: interpolating the code outside it
        // would read the value at queue time, before the request answered.
        seedGroup(stamp).then((inviteCode) => {
            // seedGroup signed the owner in; clear the cookie to arrive as a
            // logged-out visitor.
            cy.clearCookies();
            cy.visit(`/join/${inviteCode}`);

            // the group is named before asking for anything
            cy.contains('You have been invited to Viaje').should('be.visible');

            cy.get('#invite-register').click();
            cy.url().should('include', `/register?next=%2Fjoin%2F${inviteCode}`);

            // no profile picture: it is optional now
            cy.get('input[name="name"]').type('Ana');
            cy.get('input[name="email"]').type(`ana${stamp}@test.com`);
            cy.get('input[name="password"]').type('Password1');
            cy.get('input[name="confirmPassword"]').type('Password1');
            cy.get('button[type="submit"]').click();

            // straight back to the invite, no pasting the link again
            cy.url().should('include', `/join/${inviteCode}`);
            cy.contains('Which one is you?').should('be.visible');
            cy.contains('button', 'Ana').click();

            cy.url().should('include', '/expenses');
        });
    });

    it('says so when the link was already reset', () => {
        cy.clearCookies();
        cy.visit('/join/this-code-does-not-exist');

        cy.contains('This invite link is not valid').should('be.visible');
    });
});
