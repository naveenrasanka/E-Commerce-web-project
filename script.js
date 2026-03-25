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
const MENU_CACHE_KEY = 'urbaneats-menu-cache';
const DELIVERY_FEE = 2.99;
const TAX_RATE = 0.08;
const MENU_API_ENDPOINT = '/api/menu';
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

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

function getCachedMenuItems() {
  try {
    const raw = localStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveCachedMenuItems(items) {
  try {
    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(items));
  } catch (error) {
    // Ignore quota/storage issues and continue with live rendering.
  }
}

function showMenuSyncNotice(message) {
  return;
}

function formatCurrency(amount) {
  return CURRENCY_FORMATTER.format(amount);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBackendBaseUrl() {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isFileProtocol = window.location.protocol === 'file:';
  const isNonBackendLocalPort = isLocalHost && window.location.port && window.location.port !== '3001';
  const apiHost = isLocalHost ? window.location.hostname : 'localhost';

  if (isFileProtocol || isNonBackendLocalPort) {
    return 'http://' + apiHost + ':3001';
  }

  return '';
}

function resolveMenuImageSrc(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return getBackendBaseUrl() + raw;
  }

  return getBackendBaseUrl() + '/food-images/' + raw.replace(/^\/+/, '');
}

function renderMenuItems(menuItems) {
  const menuGrid = document.querySelector('.menu-items__grid');
  if (!menuGrid || !Array.isArray(menuItems)) return;

  if (!menuItems.length) {
    menuGrid.innerHTML = '<p style="color: rgba(15, 23, 42, 0.72);">No menu items available yet.</p>';
    return;
  }

  menuGrid.innerHTML = menuItems.map(function(item) {
    const category = normalizeCategoryName(item.category || 'other');
    const name = escapeHtml(item.name || 'Untitled Item');
    const description = escapeHtml(item.description || '');
    const price = Number(item.priceLkr || item.price || 0);
    const imageUrl = resolveMenuImageSrc(item.imageUrl);
    const imageMarkup = imageUrl
      ? '<img class="menu-item__img" src="' + escapeHtml(imageUrl) + '" alt="' + name + '" loading="lazy" />'
      : '';

    return (
      '<div class="menu-item" data-category="' + category + '">' +
        '<div class="menu-item__image">' + imageMarkup + '</div>' +
        '<div class="menu-item__content">' +
          '<h3 class="menu-item__title">' + name + '</h3>' +
          '<p class="menu-item__desc">' + description + '</p>' +
          '<div class="menu-item__footer">' +
            '<span class="menu-item__price">' + formatCurrency(price) + '</span>' +
            '<button class="btn btn--accent">Add to Cart</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

async function initializeDynamicMenu() {
  const menuGrid = document.querySelector('.menu-items__grid');
  if (!menuGrid) return;

  try {
    const response = await fetch(getBackendBaseUrl() + MENU_API_ENDPOINT, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) return;

    const data = await response.json();
    if (!Array.isArray(data.items)) return;

    renderMenuItems(data.items);
    saveCachedMenuItems(data.items);
    showMenuSyncNotice('Live menu loaded from server.');
    initializeMenuButtons();
    initializeMenuCategoryFilter();
  } catch (error) {
    const cachedItems = getCachedMenuItems();
    if (cachedItems.length) {
      renderMenuItems(cachedItems);
      initializeMenuButtons();
      initializeMenuCategoryFilter();
      showMenuSyncNotice('Server is offline. Showing last saved menu data. Start backend to refresh.');
      return;
    }

    showMenuSyncNotice('Server is offline and no saved menu data is available. Start backend and refresh.');
  }
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
      const priceText = priceElement.textContent.replace(/[^0-9.]/g, '').trim();
      const price = parseFloat(priceText);
      if (Number.isNaN(price)) return;
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

  function getAuthApiBase() {
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isFileProtocol = window.location.protocol === 'file:';
    const isNonBackendLocalPort = isLocalHost && window.location.port && window.location.port !== '3001';
    const apiHost = isLocalHost ? window.location.hostname : 'localhost';

    if (isFileProtocol || isNonBackendLocalPort) {
      return 'http://' + apiHost + ':3001';
    }

    return '';
  }

  async function authFetchJson(url, options) {
    const response = await fetch(getAuthApiBase() + url, {
      credentials: 'include',
      ...options
    });

    let body = {};
    try {
      body = await response.json();
    } catch (error) {
      body = {};
    }

    if (!response.ok) {
      throw new Error(body.message || 'Request failed.');
    }

    return body;
  }

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
    loginForm.addEventListener('submit', async function(event) {
      event.preventDefault();

      const usernameInput = loginForm.querySelector('[name="email"]');
      const passwordInput = loginForm.querySelector('[name="password"]');

      const payload = {
        username: String(usernameInput ? usernameInput.value : '').trim(),
        password: String(passwordInput ? passwordInput.value : '')
      };

      if (!payload.username || !payload.password) {
        if (feedback) feedback.textContent = 'Username and password are required.';
        return;
      }

      try {
        await authFetchJson('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        window.location.href = 'admin-dashboard.html';
      } catch (error) {
        if (feedback) {
          feedback.textContent = error.message;
        }
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

function initializeHomeAnimations() {
  const heroSection = document.querySelector('.hero');
  if (!heroSection) return;

  document.body.classList.add('home-animate');
  requestAnimationFrame(function() {
    document.body.classList.add('is-loaded');
  });

  const revealItems = document.querySelectorAll('.feature, .cta');
  if (!revealItems.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealItems.forEach(function(item) {
      item.classList.add('is-visible');
    });
    return;
  }

  const revealObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.2,
    rootMargin: '0px 0px -40px 0px'
  });

  revealItems.forEach(function(item) {
    revealObserver.observe(item);
  });
}

function normalizeCategoryName(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}

function toTitleCase(value) {
  return value
    .split('-')
    .filter(Boolean)
    .map(function(word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function initializeCategoryRedirect() {
  const categoryCards = document.querySelectorAll('.category-card');
  if (!categoryCards.length) return;

  categoryCards.forEach(function(card) {
    const title = card.querySelector('.category-card__name');
    if (!title) return;

    const category = normalizeCategoryName(title.textContent || '');
    if (!category) return;

    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', 'Browse ' + title.textContent.trim() + ' menu');

    function goToMenuCategory() {
      window.location.href = 'menu.html?category=' + encodeURIComponent(category);
    }

    card.addEventListener('click', goToMenuCategory);
    card.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goToMenuCategory();
      }
    });
  });
}

function initializeMenuCategoryFilter() {
  const menuItems = document.querySelectorAll('.menu-item[data-category]');
  if (!menuItems.length) return;

  const selectedCategory = new URLSearchParams(window.location.search).get('category');
  if (!selectedCategory) return;

  const normalizedCategory = normalizeCategoryName(selectedCategory);
  let visibleItemsCount = 0;

  menuItems.forEach(function(item) {
    const itemCategory = normalizeCategoryName(item.getAttribute('data-category') || '');
    const isVisible = normalizedCategory === itemCategory;
    item.style.display = isVisible ? '' : 'none';
    if (isVisible) visibleItemsCount += 1;
  });

  const heroTitle = document.querySelector('.menu-hero__title');
  const heroDescription = document.querySelector('.menu-hero .hero__desc');
  const categoryLabel = toTitleCase(normalizedCategory);

  if (heroTitle) {
    heroTitle.textContent = visibleItemsCount > 0 ? categoryLabel + ' Menu' : categoryLabel + ' Menu';
  }

  if (heroDescription) {
    heroDescription.textContent = visibleItemsCount > 0
      ? 'Showing ' + categoryLabel + ' dishes available right now.'
      : 'No items found for ' + categoryLabel + ' yet. Try another category.';
  }
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
  initializeDynamicMenu();
  initializeMenuButtons();
  initializeAuthPage();
  initializeHomeAnimations();
  initializeCategoryRedirect();
  initializeMenuCategoryFilter();
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
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}
