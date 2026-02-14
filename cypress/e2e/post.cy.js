describe('Browser Integration Testing - Gossip Post', () => {

  // Ignore frontend JS errors
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  it('logs in and posts a gossip successfully', () => {

    // STEP 1: Login
    cy.visit('http://localhost:3000/auth/login');

    cy.get('input[name="email"]').type('prabhjot1591.be23@chitkara.edu.in');
    cy.get('input[name="password"]').type('PSNarang@4444');

    cy.contains('SIGN IN').click();

    // Ensure login success
    cy.url().should('not.include', '/auth/login');

    // STEP 2: Visit gossip page (now authenticated)
    cy.visit('http://localhost:3000/gossip');

    // STEP 3: Post gossip
   // STEP 3: Post gossip
cy.get('textarea')
  .first()
  .type('This gossip is posted using Cypress browser integration testing');

cy.contains('POST ANONYMOUSLY').click();

// STEP 4: Verify gossip appears
cy.contains('This gossip is posted using Cypress browser integration testing')
  .should('be.visible');

  });

});
