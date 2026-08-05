import { api, createGroup, registerUser, useSession } from '../support/api';

// Everything behind the dots menu of a group card. Creating and deleting are in
// create-group.cy.js; this is editing, the invite link and the 409.
describe('group actions', () => {
    it('edits a group and the card shows the new data', () => {
        let session;

        registerUser('Jorge', `edit${Date.now()}@test.com`).then((body) => { session = body; });
        cy.then(() => createGroup(session, {
            name: 'Cumple', description: 'Regalo', members: [{ name: 'Ana' }],
        }));

        cy.visit('/groups');
        cy.then(() => useSession(session));
        cy.then(() => cy.visit('/groups'));

        cy.get('#basic-button').first().click();
        cy.contains('Edit group').click();
        cy.get('#name').clear().type('Cumple de Ana');
        cy.get('#description').clear().type('Regalo y cena');
        cy.get('#add-member').click();
        cy.get('#member-2').type('Luis');
        cy.get('#submit-btn').click();

        cy.contains('Group successfully edited').should('exist');
        cy.contains('Cumple de Ana').should('be.visible');
        cy.contains('Regalo y cena').should('be.visible');

        // reopening the form is what proves the list holds the edited members,
        // and not just the name painted over the old card
        cy.get('#basic-button').first().click();
        cy.contains('Edit group').click();
        cy.get('#member-2').should('have.value', 'Luis');
    });

    it('resets the invite link and shares the new code', () => {
        let session;

        registerUser('Jorge', `invite${Date.now()}@test.com`).then((body) => { session = body; });
        cy.then(() => createGroup(session, {
            name: 'Concierto', description: 'Entradas', members: [{ name: 'Ana' }],
        }));

        cy.visit('/groups');
        cy.then(() => useSession(session));
        cy.then(() => cy.visit('/groups'));

        // navigator.share would open the OS sheet, so force the clipboard branch
        cy.window().then((win) => {
            delete win.navigator.share;
            cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves();
        });

        cy.get('#basic-button').first().click();
        cy.get('#reset-invite-link').click();
        cy.contains('button', 'Confirm').click();
        cy.contains('New invite link ready to share').should('exist');

        // The link is built from the group the card is rendering, so sharing the
        // old code here would mean the reset never reached the screen.
        cy.then(() => cy.request({
            url: `${api}/group/user`,
            headers: { Authorization: `Bearer ${session.token}` },
        })).then(({ body }) => {
            const currentCode = body[0].inviteCode;

            cy.get('#basic-button').first().click();
            cy.get('#share-invite-link').click();
            cy.get('@copy').should('have.been.calledWithMatch', new RegExp(`/join/${currentCode}$`));
        });
    });

    it('refuses to drop a member who is in an expense and keeps the form open', () => {
        let session;
        let groupId;

        registerUser('Jorge', `conflict${Date.now()}@test.com`).then((body) => { session = body; });
        // three members: the form only offers to remove one above the minimum
        cy.then(() => createGroup(session, {
            name: 'Cena', description: 'Con gastos', members: [{ name: 'Ana' }, { name: 'Luis' }],
        })).then((group) => { groupId = group._id; });

        cy.visit('/groups');
        cy.then(() => useSession(session));
        cy.then(() => cy.visit(`/groups/${groupId}/expenses`));

        cy.get('[data-type="add"]').last().click();
        cy.get('#description').type('Postre');
        cy.get('#totalAmount').type('10');
        cy.get('#select-payer').select('Ana');
        cy.get('button[type="submit"]').click();
        cy.contains('Postre').should('be.visible');

        // Ana pays an expense, so updateGroup answers 409 and the edit is lost
        // unless the form is still there to try again.
        cy.visit('/groups');
        cy.get('#basic-button').first().click();
        cy.contains('Edit group').click();
        cy.get('#remove-member-1').click();
        cy.get('#submit-btn').click();

        cy.contains('Group successfully edited').should('not.exist');
        cy.get('#submit-btn').should('be.visible');
    });
});
