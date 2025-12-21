describe('Browser Integration Testing - Login', () => {
  it('logs in user and loads dashboard', () => {

    cy.visit('https://localhost:4000/auth/login')

    cy.get('input[name="email"]').type('gurmanpreet1664.be23@chitkara.edu.in')
    cy.get('input[name="password"]').type('Gurman@123')

    cy.get('button[type="submit"]').click()

    cy.url().should('include', '/')
    cy.contains('Campus')
  })
})
