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
// Configuration: set this to your JoeCoffee public menu endpoint (if public/CORS-enabled).
// Example: 'https://api.joecoffee.com/menus/STORE_ID'
const MENU_API_URL = 'https://shop.joe.coffee/explore/stores/84c55c35-834f-4b94-ad0c-ccea76163b36'; // JoeCoffee store page

function formatPrice(p) {
  if (p == null) return '';
  // handle price in cents or decimal
  if (Number.isInteger(p) && p > 100) return `$${(p/100).toFixed(2)}`;
  return `$${Number(p).toFixed(2)}`;
}

function attachButtonHandlers(container = document) {
  const buttons = container.querySelectorAll('button');
  buttons.forEach((button) => {
    // avoid attaching twice
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      if (button.textContent.includes('Add to order')) {
        alert('Added to order! This is a static demo, but you can connect a cart next.');
      } else if (button.textContent === 'RSVP') {
        alert('Thanks! RSVP confirmed for this event in the static demo.');
      }
    });
  });
}

async function loadMenu() {
  if (!MENU_API_URL) {
    // No remote URL configured — keep static markup and bind buttons
    attachButtonHandlers(document);
    return;
  }

  try {
    const res = await fetch(MENU_API_URL);
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const data = await res.json();

    // Normalise an items array from common shapes
    const items = data.items || data.menu || data.products || [];
    const grid = document.querySelector('.menu-grid');
    if (!grid) return;

    grid.innerHTML = items.map(item => {
      const name = item.name || item.title || 'Untitled';
      const desc = item.description || item.short_description || '';
      const price = item.price || item.price_cents || item.amount || '';
      return `\n          <article class="menu-card">\n            <h3>${escapeHtml(String(name))}</h3>\n            <p>${escapeHtml(String(desc))}</p>\n            <span class="price">${formatPrice(price)}</span>\n            <button>Add to order</button>\n          </article>`;
    }).join('\n');

    attachButtonHandlers(grid);
  } catch (err) {
    console.error('Failed to load remote menu:', err);
    // fallback to static markup
    attachButtonHandlers(document);
  }
}

// Simple HTML escaper used when rendering remote data
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[c]); }

loadMenu();
