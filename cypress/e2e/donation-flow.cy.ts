describe('Donation Flow', () => {
  const dummySlip = 'vhagar.png';

  beforeEach(() => {
    cy.visit('/');
  });

  it('submits a donation and shows a success confirmation', () => {
    cy.get('[data-cy="sender-name-input"]').type('Nattapong');
    cy.get('[data-cy="message-input"]').type('Sending support from Lampang!');
    cy.get('[data-cy="amount-input"]').type('150');

    // The file input is visually hidden behind a styled label,
    // so { force: true } skips Cypress's visibility check.
    cy.get('[data-cy="slip-upload"]').selectFile(`cypress/fixtures/${dummySlip}`, { force: true });

    cy.get('[data-cy="submit-button"]').click();

    // The button briefly shows "Verifying..." while the request is in flight.
    cy.get('[data-cy="submit-button"]').should('contain.text', 'Verifying');

    // The mock SlipOK service resolves after ~500ms — timeout gives it headroom.
    cy.contains('Your message is on its way', { timeout: 10000 }).should('be.visible');
  });

  it('shows an inline error when required fields are missing', () => {
    cy.get('[data-cy="submit-button"]').click();
    cy.contains('Enter your name').should('be.visible');
  });
});