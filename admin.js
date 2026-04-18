const adminCurrencyFormatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function adminGetApiBase() {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isFileProtocol = window.location.protocol === 'file:';
  const isNonBackendLocalPort = isLocalHost && window.location.port && window.location.port !== '3001';
  const apiHost = isLocalHost ? window.location.hostname : 'localhost';

  if (isFileProtocol || isNonBackendLocalPort) {
    return 'http://' + apiHost + ':3001';
  }

  return '';
}

function adminBuildApiUrl(url) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return adminGetApiBase() + url;
}

function adminNormalizeCategory(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-');
}

function adminEscapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function adminResolveImageValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return raw;
  }
  return '/food-images/' + raw.replace(/^\/+/, '');
}

function adminResolveImageSrc(value) {
  const resolved = adminResolveImageValue(value);
  if (!resolved) return '';
  if (/^(https?:)?\/\//i.test(resolved) || resolved.startsWith('data:') || resolved.startsWith('blob:')) {
    return resolved;
  }
  return adminGetApiBase() + resolved;
}

async function adminFetchJson(url, options) {
  const response = await fetch(adminBuildApiUrl(url), {
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

async function adminCheckBackendHealth() {
  try {
    const response = await fetch(adminBuildApiUrl('/api/health'), {
      method: 'GET',
      cache: 'no-store'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

function initializeAdminApiStatus() {
  const status = document.querySelector('[data-admin-api-status]');
  const text = document.querySelector('[data-admin-api-status-text]');
  if (!status || !text) return;

  function setState(isOnline) {
    status.classList.toggle('is-online', isOnline);
    status.classList.toggle('is-offline', !isOnline);
    text.textContent = isOnline ? 'API Online' : 'API Offline';
    status.title = isOnline ? 'Backend is running' : 'Backend is not reachable';
  }

  async function refresh() {
    const isOnline = await adminCheckBackendHealth();
    setState(isOnline);
  }

  refresh();
  setInterval(refresh, 15000);
}

async function initializeAdminAuthPage() {
  const authRoot = document.querySelector('[data-admin-auth]');
  if (!authRoot) return;

  const form = document.querySelector('[data-admin-auth-form]');
  const hint = document.querySelector('[data-admin-auth-hint]');
  const feedback = document.querySelector('[data-admin-auth-feedback]');
  const submitButton = document.querySelector('[data-admin-auth-submit]');
  let authMode = 'login';

  try {
    const status = await adminFetchJson('/api/admin/status');
    authMode = status.hasAdmin ? 'login' : 'register';

    if (hint) {
      hint.textContent = status.hasAdmin
        ? 'Enter admin credentials to open the dashboard.'
        : 'No admin account found. Create the first admin account.';
    }

    if (submitButton) {
      submitButton.textContent = status.hasAdmin ? 'Log in' : 'Create admin account';
    }
  } catch (error) {
    if (feedback) feedback.textContent = error.message;
  }

  if (!form) return;

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    if (feedback) feedback.textContent = '';

    const formData = new FormData(form);
    const payload = {
      username: String(formData.get('username') || '').trim(),
      password: String(formData.get('password') || '')
    };

    try {
      const endpoint = authMode === 'register' ? '/api/admin/register' : '/api/admin/login';
      await adminFetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      window.location.href = 'admin-dashboard.html';
    } catch (error) {
      if (feedback) feedback.textContent = error.message;
    }
  });
}

async function renderAdminMenuList() {
  const list = document.querySelector('[data-admin-menu-list]');
  if (!list) return;

  const response = await adminFetchJson('/api/menu');
  if (!Array.isArray(response.items) || !response.items.length) {
    list.innerHTML = '<p>No menu items available.</p>';
    return;
  }

  list.innerHTML = response.items
    .map(function(item) {
      const imageSrc = adminResolveImageSrc(item.imageUrl);
      const imageTag = imageSrc
        ? '<img class="admin-menu-list__thumb" src="' + adminEscapeHtml(imageSrc) + '" alt="' + adminEscapeHtml(item.name) + '" loading="lazy" />'
        : '<div class="admin-menu-list__thumb admin-menu-list__thumb--placeholder" aria-hidden="true"></div>';

      return (
        '<article class="admin-menu-list__item" data-admin-item-id="' + Number(item.id) + '">' +
          imageTag +
          '<div>' +
            '<h3>' + adminEscapeHtml(item.name) + '</h3>' +
            '<p>' + adminEscapeHtml(item.description) + '</p>' +
            '<p><strong>Category:</strong> ' + adminEscapeHtml(item.category) + '</p>' +
            '<p><strong>Price:</strong> ' + adminCurrencyFormatter.format(Number(item.priceLkr || 0)) + '</p>' +
          '</div>' +
          '<button class="btn btn--outline" type="button" data-admin-delete-item="' + Number(item.id) + '">Delete</button>' +
        '</article>'
      );
    })
    .join('');
}

async function initializeAdminDashboardPage() {
  const dashboardRoot = document.querySelector('[data-admin-dashboard]');
  if (!dashboardRoot) return;

  const usernameElement = document.querySelector('[data-admin-username]');
  const form = document.querySelector('[data-admin-menu-form]');
  const feedback = document.querySelector('[data-admin-dashboard-feedback]');
  const logoutButton = document.querySelector('[data-admin-logout]');
  const menuList = document.querySelector('[data-admin-menu-list]');

  try {
    const me = await adminFetchJson('/api/admin/me');
    if (usernameElement) usernameElement.textContent = me.username;
  } catch (error) {
    window.location.href = 'admin-login.html';
    return;
  }

  await renderAdminMenuList();

  if (form) {
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      if (feedback) feedback.textContent = '';

      const formData = new FormData(form);
      const payload = {
        name: String(formData.get('name') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        imageUrl: adminResolveImageValue(formData.get('imageUrl')),
        category: adminNormalizeCategory(formData.get('category')),
        priceLkr: Number(formData.get('priceLkr'))
      };

      try {
        await adminFetchJson('/api/admin/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        form.reset();
        if (feedback) feedback.textContent = 'Food item added successfully.';
        await renderAdminMenuList();
      } catch (error) {
        if (feedback) feedback.textContent = error.message;
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async function() {
      await adminFetchJson('/api/admin/logout', { method: 'POST' });
      window.location.href = 'admin-login.html';
    });
  }

  if (menuList) {
    menuList.addEventListener('click', async function(event) {
      const target = event.target.closest('[data-admin-delete-item]');
      if (!target) return;

      const itemId = Number(target.getAttribute('data-admin-delete-item'));
      if (!itemId) return;

      try {
        await adminFetchJson('/api/admin/menu/' + itemId, { method: 'DELETE' });
        if (feedback) feedback.textContent = 'Food item deleted.';
        await renderAdminMenuList();
      } catch (error) {
        if (feedback) feedback.textContent = error.message;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initializeAdminApiStatus();
  initializeAdminAuthPage();
  initializeAdminDashboardPage();
});
