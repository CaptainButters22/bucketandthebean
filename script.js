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
// Configuration: set this to your JoeCoffee public menu endpoint.
// Because the JoeCoffee store page blocks direct browser fetches, use a CORS-friendly proxy.
const MENU_API_URL = 'https://api.allorigins.win/raw?url=https://shop.joe.coffee/explore/stores/84c55c35-834f-4b94-ad0c-ccea76163b36';

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
    console.info('Loading remote menu from', MENU_API_URL);
    const res = await fetch(MENU_API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      const marker = '<script id="__NEXT_DATA__" type="application/json">';
      const start = text.indexOf(marker);
      if (start === -1) throw new Error('Could not find embedded JSON in response HTML');
      const end = text.indexOf('</script>', start);
      if (end === -1) throw new Error('Embedded JSON script tag not closed');
      const jsonText = text.slice(start + marker.length, end);
      data = JSON.parse(jsonText);
    }

    const items = extractMenuItems(data);
    console.info('Remote menu item count:', items.length);
    const grid = document.querySelector('.menu-grid');
    if (!grid) return;

    if (items.length === 0) {
      console.warn('Remote menu loaded but no items were found, falling back to static markup.');
      attachButtonHandlers(document);
      return;
    }

    grid.innerHTML = items.map(item => {
      const name = item.name || item.title || 'Untitled';
      const desc = item.description || item.short_description || item.subtitle || '';
      const price = item.price || item.price_cents || item.amount || item.listPrice || '';
      return `\n          <article class="menu-card">\n            <h3>${escapeHtml(String(name))}</h3>\n            <p>${escapeHtml(String(desc))}</p>\n            <span class="price">${formatPrice(price)}</span>\n            <button>Add to order</button>\n          </article>`;
    }).join('\n');

    attachButtonHandlers(grid);
  } catch (err) {
    console.error('Failed to load remote menu:', err);
    attachButtonHandlers(document);
  }
}

function extractMenuItems(data) {
  if (!data || typeof data !== 'object') return [];

  if (Array.isArray(data)) {
    return data;
  }

  if (data.items) return data.items;
  if (data.menu) return data.menu;
  if (data.products) return data.products;

  const fallback = data.props?.pageProps?.fallback;
  if (fallback && typeof fallback === 'object') {
    for (const key in fallback) {
      const entry = fallback[key];
      if (entry?.data?.menu) return flattenMenu(entry.data.menu);
      if (entry?.data?.items) return entry.data.items;
      if (entry?.data?.products) return entry.data.products;
    }
  }

  if (data.props?.pageProps?.initialData) {
    const initial = data.props.pageProps.initialData;
    if (initial.menu) return flattenMenu(initial.menu);
  }

  return [];
}

function flattenMenu(menu) {
  if (!Array.isArray(menu)) return [];
  const items = [];
  for (const category of menu) {
    if (!category || typeof category !== 'object') continue;
    if (Array.isArray(category.items)) {
      items.push(...category.items);
    }
    if (Array.isArray(category.subCategories)) {
      for (const sub of category.subCategories) {
        if (sub?.items && Array.isArray(sub.items)) {
          items.push(...sub.items);
        }
      }
    }
  }
  return items;
}

// Simple HTML escaper used when rendering remote data
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[c]); }

function attachUpdateFormHandler() {
  const form = document.getElementById('update-form');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = document.getElementById('update-message')?.value.trim();
    if (!message) {
      return alert('Please enter a message before submitting.');
    }
    const mailto = `mailto:danielgentryadam@gmail.com?subject=${encodeURIComponent('Bucket and the Bean update request')}&body=${encodeURIComponent(message)}`;
    window.location.href = mailto;
  });
}

loadMenu();
attachUpdateFormHandler();
