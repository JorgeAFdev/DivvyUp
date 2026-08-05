import { createGroup, registerUser, useSession } from '../support/api';

// Following an invite with a session already open. The other half of the flow,
// arriving without one, is invite-landing.cy.js.
describe('joining a group from the link', () => {
    it('joins as a name that is not on the list', () => {
        const stamp = Date.now();
        let owner;
        let guest;
        let inviteCode;

        registerUser('Jorge', `owner${stamp}@test.com`).then((body) => { owner = body; });
        registerUser('Marta', `guest${stamp}@test.com`).then((body) => { guest = body; });
        cy.then(() => createGroup(owner, {
            name: 'Concierto', description: 'Entradas', members: [{ name: 'Ana' }],
        })).then((group) => { inviteCode = group.inviteCode; });

        cy.visit('/groups');
        cy.then(() => useSession(guest));
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
