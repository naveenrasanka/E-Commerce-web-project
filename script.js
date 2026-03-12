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

const CART_STORAGE_KEY = 'urbaneats-cart';
const DELIVERY_FEE = 2.99;
const TAX_RATE = 0.08;

function getCartItems() {
  try {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (!storedCart) return [];
    const parsedCart = JSON.parse(storedCart);
    return Array.isArray(parsedCart) ? parsedCart : [];
  } catch (error) {
    return [];
  }
}

function saveCartItems(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

function formatCurrency(amount) {
  return '$' + amount.toFixed(2);
}

function getCartItemCount(items) {
  return items.reduce(function(total, item) {
    return total + item.quantity;
  }, 0);
}

function updateCartBadges() {
  const cartItems = getCartItems();
  const itemCount = getCartItemCount(cartItems);
  const badges = document.querySelectorAll('.navbar__cart-badge, .navbar__mobile-cart-badge');

  badges.forEach(function(badge) {
    badge.textContent = itemCount;
  });
}

function addItemToCart(itemToAdd) {
  const cartItems = getCartItems();
  const existingItem = cartItems.find(function(item) {
    return item.id === itemToAdd.id;
  });

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cartItems.push(itemToAdd);
  }

  saveCartItems(cartItems);
  updateCartBadges();
}

function updateCartTotals(items) {
  const subtotal = items.reduce(function(total, item) {
    return total + item.price * item.quantity;
  }, 0);

  const deliveryFee = items.length > 0 ? DELIVERY_FEE : 0;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + deliveryFee + tax;

  const subtotalElement = document.querySelector('[data-subtotal]');
  const deliveryElement = document.querySelector('[data-delivery]');
  const taxElement = document.querySelector('[data-tax]');
  const totalElement = document.querySelector('[data-total]');

  if (subtotalElement) subtotalElement.textContent = formatCurrency(subtotal);
  if (deliveryElement) deliveryElement.textContent = formatCurrency(deliveryFee);
  if (taxElement) taxElement.textContent = formatCurrency(tax);
  if (totalElement) totalElement.textContent = formatCurrency(total);
}

function renderCartItems() {
  const cartItemsContainer = document.querySelector('.cart-items');
  if (!cartItemsContainer) return;

  const cartItems = getCartItems();

  if (cartItems.length === 0) {
    cartItemsContainer.innerHTML = '<p style="padding: 1rem 0; color: rgba(15, 23, 42, 0.7);">Your cart is empty. Add items from the menu to see them here.</p>';
    updateCartTotals(cartItems);
    return;
  }

  cartItemsContainer.innerHTML = cartItems.map(function(item) {
    return (
      '<div class="cart-item" data-id="' + item.id + '">' +
        '<div class="cart-item__info">' +
          '<p class="cart-item__name">' + item.name + '</p>' +
          '<p class="cart-item__price">' + formatCurrency(item.price) + '</p>' +
        '</div>' +
        '<div class="cart-item__quantity">' +
          '<button type="button" data-action="decrease">−</button>' +
          '<span>' + item.quantity + '</span>' +
          '<button type="button" data-action="increase">+</button>' +
        '</div>' +
        '<button type="button" class="cart-item__remove" data-action="remove">Remove</button>' +
      '</div>'
    );
  }).join('');

  updateCartTotals(cartItems);
}

function handleCartItemActions(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const cartItemElement = actionButton.closest('.cart-item');
  if (!cartItemElement) return;

  const itemId = cartItemElement.getAttribute('data-id');
  let cartItems = getCartItems();
  const targetItem = cartItems.find(function(item) {
    return item.id === itemId;
  });

  if (!targetItem) return;

  const action = actionButton.getAttribute('data-action');

  if (action === 'increase') {
    targetItem.quantity += 1;
  } else if (action === 'decrease') {
    targetItem.quantity -= 1;
    if (targetItem.quantity <= 0) {
      cartItems = cartItems.filter(function(item) {
        return item.id !== itemId;
      });
    }
  } else if (action === 'remove') {
    cartItems = cartItems.filter(function(item) {
      return item.id !== itemId;
    });
  }

  saveCartItems(cartItems);
  updateCartBadges();
  renderCartItems();
}

function initializeMenuButtons() {
  const addButtons = document.querySelectorAll('.menu-item__footer .btn--accent');

  addButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      const menuItem = this.closest('.menu-item');
      if (!menuItem) return;

      const titleElement = menuItem.querySelector('.menu-item__title');
      const priceElement = menuItem.querySelector('.menu-item__price');
      if (!titleElement || !priceElement) return;

      const name = titleElement.textContent.trim();
      const price = parseFloat(priceElement.textContent.replace('$', '').trim());
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      addItemToCart({
        id: id,
        name: name,
        price: price,
        quantity: 1
      });

      const originalText = this.textContent;
      this.textContent = 'Added';
      setTimeout(() => {
        this.textContent = originalText;
      }, 800);
    });
  });
}

function initializeAuthPage() {
  const authContainer = document.querySelector('[data-auth-page]');
  if (!authContainer) return;

  const modeButtons = document.querySelectorAll('[data-auth-toggle]');
  const loginForm = document.querySelector('[data-auth-form="login"]');
  const signupForm = document.querySelector('[data-auth-form="signup"]');
  const panelTitle = document.querySelector('[data-auth-title]');
  const panelSubtitle = document.querySelector('[data-auth-subtitle]');
  const feedback = document.querySelector('[data-auth-feedback]');

  const modeConfig = {
    login: {
      title: 'Welcome back',
      subtitle: 'Log in to continue your orders and save favorites.'
    },
    signup: {
      title: 'Create your account',
      subtitle: 'Sign up in seconds and start ordering great food.'
    }
  };

  function setAuthMode(mode) {
    const currentMode = mode === 'signup' ? 'signup' : 'login';
    authContainer.setAttribute('data-mode', currentMode);

    if (panelTitle) panelTitle.textContent = modeConfig[currentMode].title;
    if (panelSubtitle) panelSubtitle.textContent = modeConfig[currentMode].subtitle;
    if (feedback) feedback.textContent = '';

    modeButtons.forEach(function(button) {
      button.classList.toggle('is-active', button.getAttribute('data-auth-toggle') === currentMode);
    });

    if (loginForm) loginForm.hidden = currentMode !== 'login';
    if (signupForm) signupForm.hidden = currentMode !== 'signup';
  }

  modeButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      setAuthMode(this.getAttribute('data-auth-toggle'));
    });
  });

  if (loginForm) {
    loginForm.addEventListener('submit', function(event) {
      event.preventDefault();
      if (feedback) {
        feedback.textContent = 'Demo mode: Login submitted successfully.';
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', function(event) {
      event.preventDefault();

      const passwordInput = signupForm.querySelector('[name="password"]');
      const confirmInput = signupForm.querySelector('[name="confirmPassword"]');

      if (!passwordInput || !confirmInput) return;

      if (passwordInput.value !== confirmInput.value) {
        if (feedback) {
          feedback.textContent = 'Passwords do not match. Please try again.';
        }
        return;
      }

      if (feedback) {
        feedback.textContent = 'Demo mode: Account created successfully.';
      }
      signupForm.reset();
      setAuthMode('login');
    });
  }

  const queryMode = new URLSearchParams(window.location.search).get('mode');
  setAuthMode(queryMode === 'signup' ? 'signup' : 'login');
}

// Close mobile menu when a link is clicked
document.addEventListener('DOMContentLoaded', function() {
  const mobileLinks = document.querySelectorAll('.navbar__mobile-links a, .navbar__mobile-actions a');
  mobileLinks.forEach(function(link) {
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

  updateCartBadges();
  initializeMenuButtons();
  initializeAuthPage();
  renderCartItems();

  const cartItemsContainer = document.querySelector('.cart-items');
  if (cartItemsContainer) {
    cartItemsContainer.addEventListener('click', handleCartItemActions);
  }
});

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
