// Temporary smoke test for the members-without-accounts flow. Not meant to stay.
const api = 'http://localhost:3001/api';

// origin set by hand: Better Auth's endpoints 403 "Missing or null Origin" once a
// session cookie is present, and cy.request (unlike a browser) sends none.
const ORIGIN = 'http://localhost:3000';

const registerUser = (name, email) =>
    cy.request({
        method: 'POST',
        url: `${api}/auth/sign-up/email`,
        headers: { origin: ORIGIN },
        body: { name, email, password: 'Password1' },
    }).its('body');

const loginAs = (email) =>
    cy.request({
        method: 'POST',
        url: `${api}/auth/sign-in/email`,
        headers: { origin: ORIGIN },
        body: { email, password: 'Password1' },
    });

describe('members without accounts', () => {
    it('runs the whole flow with one account, then lets a second one join', () => {
        const stamp = Date.now();
        const jorgeEmail = `jorge${stamp}@test.com`;
        const anaEmail = `ana${stamp}@test.com`;
        let inviteCode;

        registerUser('Jorge', jorgeEmail);
        registerUser('Ana', anaEmail);

        // --- create a group typing only names -------------------------------
        cy.then(() => loginAs(jorgeEmail));
        cy.visit('/groups');

        cy.get('#create-group-btn').click();
        cy.get('#name').type('Piso');
        cy.get('#description').type('Gastos del piso');
        cy.get('#member-0').type('Mamá');
        cy.get('#add-member').click();
        cy.get('#member-1').type('Ana');
        cy.get('#submit-btn').click();

        cy.contains('Piso').should('be.visible');
        cy.contains('Group succesfully created').should('exist');

        // --- an expense paid by the member without an account ---------------
        cy.contains('Piso').click();
        cy.url().should('include', '/expenses');
        cy.get('[data-type="add"]').last().click();
        cy.get('#description').type('Cena');
        cy.get('#totalAmount').type('30');
        cy.get('#select-payer').select('Mamá');
        cy.get('button[type="submit"]').click();

        cy.contains('Cena').should('be.visible');
        cy.contains('Paid by').should('be.visible');
        cy.contains('Mamá').should('be.visible');
        cy.contains('owes').should('be.visible');

        // the balance credits the member who has no account
        cy.contains('Balance').parent().within(() => {
            cy.contains('Mamá').should('exist');
            cy.contains('+20€').should('exist');
        });

        // --- the same expense, seen from "my expenses" ----------------------
        cy.visit('/my-expenses');
        cy.contains('Piso').should('be.visible');
        cy.contains('Cena').should('be.visible');
        // the edit form needs the members that now travel per group, not per expense
        cy.get('[data-type="dots"]').first().click();
        cy.contains('Edit expense').click();
        cy.contains('label', 'Mamá').should('be.visible');
        cy.get('form').find('svg').first().click();

        // --- the second account joins through the link ----------------------
        cy.then(() => cy.request(`${api}/group/user`)).then((response) => {
            inviteCode = response.body[0].inviteCode;
        });

        cy.then(() => loginAs(anaEmail));
        cy.then(() => cy.visit(`/join/${inviteCode}`));

        cy.contains('Join Piso').should('be.visible');
        cy.contains('Which one is you?').should('be.visible');
        cy.contains('button', 'Mamá').should('exist');
        cy.contains('button', 'Ana').click();

        cy.url().should('include', '/expenses');
        cy.contains('Cena').should('be.visible');
    });

    // The invite link has its own landing now, covered by invite-landing.cy.js.
    // Every other private route still bounces to login keeping the destination.
    it('sends an anonymous visitor to login and back to where they were going', () => {
        cy.clearCookies();
        cy.visit('/my-expenses');
        cy.url().should('include', '/login?next=%2Fmy-expenses');
        cy.contains('No account yet?').should('be.visible');
    });
});
