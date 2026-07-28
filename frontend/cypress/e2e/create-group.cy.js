
describe('create group', () => {
  beforeEach(() => {
    cy.intercept('POST', 'http://localhost:3001/api/group').as('createGroup')
  })
  it('create group flow', () => {
    cy.visit('/groups')
    cy.get('#create-group-btn').click();
    cy.get('#name').type('group-expemple');
    cy.get('#description').type('BBQ');
    cy.get('#email-0').type('biescass9@gmail.com');
    cy.get('#add-member').click();
    cy.get('#email-1').type('jorge@gmail.com');
    cy.get('#submit-btn').click();
    cy.wait('@createGroup').then((intercept) => { cy.wrap(intercept.response?.body._id).as('groupId') })
    cy.get('@groupId').then((groupId) => { cy.get(`#group-card-${groupId}`).find('#deleteGroup').first().click() })

  })
})