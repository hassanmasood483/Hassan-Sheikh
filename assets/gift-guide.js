(function() {
  const grid = document.querySelector('#gift-grid');
  if (!grid) return;

  const modal = document.getElementById('product-modal');
  const titleEl = document.getElementById('pm-title');
  const priceEl = document.getElementById('pm-price');
  const descEl  = document.getElementById('pm-desc');
  const optionsEl = document.getElementById('pm-options');
  const variantIdEl = document.getElementById('pm-variant-id');
  const form = document.getElementById('pm-form');
  const statusEl = document.getElementById('pm-status');

  let product = null;
  let selectedOptions = []; // array of option values by position

  // Open modal with product JSON embedded in data attribute
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.gift-grid__thumb');
    if (!btn) return;
    product = JSON.parse(btn.dataset.productJson);

    // Populate modal
    titleEl.textContent = product.title;
    priceEl.textContent = product.price ? Shopify.formatMoney(product.price) : '';
    descEl.textContent = (product.body_html || '').replace(/<[^>]*>?/gm, '').slice(0, 240);

    // Build options UI
    optionsEl.innerHTML = '';
    selectedOptions = new Array(product.options.length).fill(null);

    product.options.forEach((opt, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'pm-option';

      const label = document.createElement('label');
      label.textContent = opt.name;
      label.setAttribute('for', `pm-opt-${idx}`);

      const select = document.createElement('select');
      select.id = `pm-opt-${idx}`;
      select.dataset.index = idx;

      opt.values.forEach(v => {
        const o = document.createElement('option');
        o.value = v; o.textContent = v;
        select.appendChild(o);
      });

      // initialize selectedOptions
      selectedOptions[idx] = opt.values[0];

      wrap.appendChild(label);
      wrap.appendChild(select);
      optionsEl.appendChild(wrap);
    });

    // Resolve initial variant
    updateVariantId();

    // Listeners
    optionsEl.onchange = (ev) => {
      const sel = ev.target.closest('select');
      if (!sel) return;
      selectedOptions[Number(sel.dataset.index)] = sel.value;
      updateVariantId();
    };

    modal.hidden = false;
  });

  // Close modal
  modal.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close')) modal.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.hidden = true;
  });

  function findVariantByOptions(values) {
    return product.variants.find(v => {
      return values.every((val, i) => v['option' + (i + 1)] === val);
    });
  }

  function updateVariantId() {
    const v = findVariantByOptions(selectedOptions);
    if (v) {
      variantIdEl.value = v.id;
      priceEl.textContent = Shopify.formatMoney(v.price);
      statusEl.textContent = '';
    } else {
      variantIdEl.value = '';
      statusEl.textContent = 'This combination is unavailable.';
    }
  }

  // Add to cart + special rule
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = 'Adding…';

    const mainId = variantIdEl.value;
    if (!mainId) {
      statusEl.textContent = 'Please choose available options.';
      return;
    }

    try {
      // Add selected product
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(mainId), quantity: 1 }] })
      });

      // SPECIAL RULE: if Color=Black and Size=Medium ⇒ also add upsell product
      const colorIdx = product.options.findIndex(o => /color/i.test(o.name));
      const sizeIdx  = product.options.findIndex(o => /size/i.test(o.name));
      const isBlackMedium =
        colorIdx !== -1 && sizeIdx !== -1 &&
        (selectedOptions[colorIdx] || '').toLowerCase() === 'black' &&
        (selectedOptions[sizeIdx]  || '').toLowerCase() === 'medium';

      if (isBlackMedium) {
        // The upsell product is configured in the section setting and rendered as data on the grid wrapper
        const gridSection = document.getElementById('gift-grid');
        const upsellData = gridSection?.dataset?.upsell;
        if (upsellData) {
          const upsell = JSON.parse(upsellData); // {title, variants:[...]}
          const upsellVariantId = upsell?.variants?.[0]?.id; // choose first variant by default
          if (upsellVariantId) {
            await fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: [{ id: Number(upsellVariantId), quantity: 1 }] })
            });
          }
        }
      }

      statusEl.textContent = 'Added to cart ✔';
      setTimeout(() => { statusEl.textContent = ''; modal.hidden = true; }, 700);
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Failed to add – please try again.';
    }
  });
})();
