// Temporary smoke test for the members-without-accounts flow. Not meant to stay.
const api = 'http://localhost:3001/api';

const registerUser = (name, email) =>
    cy.request('POST', `${api}/auth/register`, { name, email, password: 'Password1' }).its('body');

const useSession = (session) =>
    cy.window().then((win) => win.localStorage.setItem('user-session', JSON.stringify(session)));

describe('members without accounts', () => {
    it('runs the whole flow with one account, then lets a second one join', () => {
        const stamp = Date.now();
        let jorge;
        let ana;
        let inviteCode;

        registerUser('Jorge', `jorge${stamp}@test.com`).then((body) => { jorge = body; });
        registerUser('Ana', `ana${stamp}@test.com`).then((body) => { ana = body; });

        // --- create a group typing only names -------------------------------
        cy.visit('/groups');
        cy.then(() => useSession(jorge));
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

        // --- the second account joins through the link ----------------------
        cy.then(() => {
            return cy.request({
                url: `${api}/group/user`,
                headers: { Authorization: `Bearer ${jorge.token}` },
            }).then((response) => { inviteCode = response.body[0].inviteCode; });
        });

        cy.then(() => useSession(ana));
        cy.then(() => cy.visit(`/join/${inviteCode}`));

        cy.contains('Join Piso').should('be.visible');
        cy.contains('Which one is you?').should('be.visible');
        cy.contains('button', 'Mamá').should('exist');
        cy.contains('button', 'Ana').click();

        cy.url().should('include', '/expenses');
        cy.contains('Cena').should('be.visible');
    });

    it('sends an anonymous visitor to login and back to the invite', () => {
        cy.clearLocalStorage();
        cy.visit('/join/whatever-code');
        cy.url().should('include', '/login?next=%2Fjoin%2Fwhatever-code');
        cy.contains('No account yet?').should('be.visible');
    });
});
