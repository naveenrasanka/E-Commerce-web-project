// Mobile Menu Toggle
function toggleMenu() {
  const menu = document.getElementById('mobile-menu');
  const hamburger = document.getElementById('hamburger-icon');
  const close = document.getElementById('close-icon');
  const btn = document.querySelector('.navbar__hamburger');
  
  if (!menu || !hamburger || !close || !btn) return;
  
  const isOpen = menu.classList.toggle('is-open');
  hamburger.style.display = isOpen ? 'none' : 'block';
  close.style.display = isOpen ? 'block' : 'none';
  btn.setAttribute('aria-expanded', isOpen);
  btn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
}

// Close mobile menu when a link is clicked
document.addEventListener('DOMContentLoaded', function() {
  const mobileLinks = document.querySelectorAll('.navbar__mobile-links a, .navbar__mobile-actions a');
  mobileLinks.forEach(link => {
    link.addEventListener('click', function() {
      const menu = document.getElementById('mobile-menu');
      if (menu) {
        menu.classList.remove('is-open');
        const hamburger = document.getElementById('hamburger-icon');
        const close = document.getElementById('close-icon');
        if (hamburger) hamburger.style.display = 'block';
        if (close) close.style.display = 'none';
      }
    });
  });

  // Cart functionality
  const cartItems = document.querySelectorAll('.cart-item__quantity button');
  cartItems.forEach(btn => {
    btn.addEventListener('click', function() {
      const quantitySpan = this.parentElement.querySelector('span');
      let quantity = parseInt(quantitySpan.textContent);
      
      if (this.textContent === '+') {
        quantity++;
      } else if (this.textContent === '−' && quantity > 1) {
        quantity--;
      }
      
      quantitySpan.textContent = quantity;
      updateCartTotal();
    });
  });

  // Remove item from cart
  const removeButtons = document.querySelectorAll('.cart-item__remove');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.cart-item').remove();
      updateCartTotal();
    });
  });

  updateCartTotal();
});

// Update cart total
function updateCartTotal() {
  const items = document.querySelectorAll('.cart-item');
  let subtotal = 0;

  items.forEach(item => {
    const priceText = item.querySelector('.cart-item__price').textContent;
    const price = parseFloat(priceText.replace('$', ''));
    const quantity = parseInt(item.querySelector('.cart-item__quantity span').textContent);
    subtotal += price * quantity;
  });

  const subtotalElement = document.querySelector('[data-subtotal]');
  const deliveryElement = document.querySelector('[data-delivery]');
  const totalElement = document.querySelector('[data-total]');

  if (subtotalElement) {
    subtotalElement.textContent = '$' + subtotal.toFixed(2);
  }

  const deliveryFee = items.length > 0 ? 2.99 : 0;
  if (deliveryElement) {
    deliveryElement.textContent = '$' + deliveryFee.toFixed(2);
  }

  if (totalElement) {
    const total = subtotal + deliveryFee;
    totalElement.textContent = '$' + total.toFixed(2);
  }
}

// Category filtering (if needed)
function filterCategories(category) {
  const items = document.querySelectorAll('.menu-item');
  items.forEach(item => {
    if (category === 'all' || item.getAttribute('data-category') === category) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}
