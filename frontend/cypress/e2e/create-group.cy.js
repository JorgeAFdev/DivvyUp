import { api, registerUser } from '../support/api';

describe('create group', () => {
  beforeEach(() => {
    cy.intercept('POST', `${api}/group`).as('createGroup')

    // registerUser sets the session cookie in Cypress's jar (with the Origin
    // header Better Auth's CSRF check needs), shared with the app, so visiting
    // /groups afterwards lands logged in.
    registerUser('Jorge', `jorge${Date.now()}@test.com`).then(() => {
      cy.visit('/groups')
    })
  })
  it('create group flow', () => {
    cy.get('#create-group-btn').click();
    cy.get('#name').type('group-expemple');
    cy.get('#description').type('BBQ');
    cy.get('#member-0').type('Mamá');
    cy.get('#add-member').click();
    cy.get('#member-1').type('Luis');
    cy.get('#submit-btn').click();
    cy.wait('@createGroup').then((intercept) => { cy.wrap(intercept.response?.body._id).as('groupId') })

    // The menu is a MUI portal, so the delete icon lives outside the card, and
    // deleting asks for confirmation in a toast.
    cy.get('@groupId').then((groupId) => {
      cy.get(`#group-card-${groupId}`).find('#basic-button').click()
      cy.get('#deleteGroup').click()
      cy.contains('button', 'Confirm').click()
      cy.get(`#group-card-${groupId}`).should('not.exist')
    })

  })
})
