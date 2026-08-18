import { createGroup, loginAs, registerUser } from '../support/api';

// Following an invite with a session already open. The other half of the flow,
// arriving without one, is invite-landing.cy.js.
describe('joining a group from the link', () => {
    it('joins as a name that is not on the list', () => {
        const stamp = Date.now();
        const ownerEmail = `owner${stamp}@test.com`;
        const guestEmail = `guest${stamp}@test.com`;
        let inviteCode;

        registerUser('Jorge', ownerEmail);
        registerUser('Marta', guestEmail);
        // createGroup runs as the owner, then the guest's session is the active
        // cookie for the visit.
        cy.then(() => loginAs(ownerEmail));
        cy.then(() => createGroup({
            name: 'Concierto', description: 'Entradas', members: [{ name: 'Ana' }],
        })).then((group) => { inviteCode = group.inviteCode; });
        cy.then(() => loginAs(guestEmail));

        cy.then(() => cy.visit(`/join/${inviteCode}`));

        cy.contains('Join Concierto').should('be.visible');
        cy.get('#not-on-the-list').click();
        cy.get('#new-member-name').type('Marta');
        cy.contains('button', 'Join').click();

        cy.url().should('include', '/expenses');

        // getUserGroups filters by members.user, so the group only shows up here
        // because joining linked the account to a member.
        cy.visit('/groups');
        cy.contains('Concierto').should('be.visible');
    });
});
