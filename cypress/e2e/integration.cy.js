describe('Browser Integration Testing - Login', () => {
  it('logs in user and loads dashboard', () => {

    cy.visit('http://localhost:3000/auth/login')

    cy.get('input[name="email"]').type('prabhjot1591.be23@chitkara.edu.in')
    cy.get('input[name="password"]').type('PSNarang@4444')

    cy.get('button[type="submit"]').click()

    cy.url().should('include', '/')
    cy.contains('Campus')
  })
})
