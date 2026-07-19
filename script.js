const buttons = document.querySelectorAll('button');

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.textContent.includes('Add to order')) {
      alert('Added to order! This is a static demo, but you can connect a cart next.');
    } else if (button.textContent === 'RSVP') {
      alert('Thanks! RSVP confirmed for this event in the static demo.');
    }
  });
});
