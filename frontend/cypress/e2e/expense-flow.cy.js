import { createGroup, registerUser } from '../support/api';

// The whole life of an expense in one go, because what is being guarded is that
// the balance, the debts and /my-expenses follow every step of it.
describe('expenses, balance and debts', () => {
    it('creates, edits, settles and deletes, and both screens follow', () => {
        let groupId;

        registerUser('Jorge', `flow${Date.now()}@test.com`);
        cy.then(() => createGroup({
            name: 'Viaje', description: 'Finde', members: [{ name: 'Ana' }],
        })).then((group) => { groupId = group._id; });

        cy.then(() => cy.visit(`/groups/${groupId}/expenses`));

        // --- create ---------------------------------------------------------
        cy.get('[data-type="add"]').last().click();
        cy.get('#description').type('Hotel');
        cy.get('#totalAmount').type('30');
        cy.get('#select-payer').select('Jorge');
        cy.get('button[type="submit"]').click();

        cy.contains('Expense successfully created').should('exist');
        cy.contains('Hotel').should('be.visible');
        cy.contains('Ana owes').should('be.visible');
        cy.contains('15€').should('be.visible');

        // --- edit: the debt is derived, so it has to move with the amount ----
        cy.get('[data-type="dots"]').first().click();
        cy.contains('Edit expense').click();
        cy.get('#totalAmount').clear().type('20');
        cy.get('button[type="submit"]').click();

        cy.contains('Expense succesfully edited').should('exist');
        cy.contains('20€').should('be.visible');
        cy.contains('Debts').parent().within(() => {
            cy.contains('10€').should('be.visible');
        });

        // --- the same expense, from the other screen that lists it -----------
        cy.visit('/my-expenses');
        cy.contains('Viaje').should('be.visible');
        cy.contains('20€').should('be.visible');

        // --- settle ----------------------------------------------------------
        cy.then(() => cy.visit(`/groups/${groupId}/expenses`));
        cy.contains('button', 'Mark as paid').click();
        cy.contains('button', 'Confirm').click();

        cy.contains('Debt marked as paid').should('exist');
        cy.contains('Ana owes').should('not.exist');

        // --- delete -----------------------------------------------------------
        cy.get('[data-type="dots"]').first().click();
        cy.contains('Delete expense').click();
        cy.contains('button', 'Confirm').click();

        cy.contains('Expense succesfully deleted').should('exist');
        cy.contains('There are no expenses in this group').should('be.visible');

        cy.visit('/my-expenses');
        cy.contains("You don't have any expenses").should('be.visible');
    });
});
