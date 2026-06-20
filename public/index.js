// RESIN / RIPPER DESIGNER - Wallpaper Culture
// Front-end Interactions & Dynamic API Controller

(() => {
  const nativeFetch = window.fetch.bind(window);
  let csrfTokenPromise = null;

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  function isSameOriginApi(inputUrl) {
    const url = new URL(inputUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  }

  function readMethod(input, init) {
    return (init && init.method) || (input instanceof Request && input.method) || 'GET';
  }

  async function getCsrfToken() {
    if (!csrfTokenPromise) {
      csrfTokenPromise = nativeFetch('/api/csrf-token', {
        credentials: 'same-origin',
        cache: 'no-store'
      })
        .then(res => {
          if (!res.ok) throw new Error('Unable to load CSRF token.');
          return res.json();
        })
        .then(data => data.csrfToken);
    }
    return csrfTokenPromise;
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = readMethod(input, init).toUpperCase();
    const unsafeMethod = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method);

    if (unsafeMethod && isSameOriginApi(url)) {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('X-CSRF-Token')) {
        headers.set('X-CSRF-Token', await getCsrfToken());
      }
      init = { ...init, headers, credentials: init.credentials || 'same-origin' };
    }

    return nativeFetch(input, init);
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE VARIABLES ---
  let currentCategory = 'home';
  let previousCategory = 'home';
  let currentSearch = '';
  let activeTag = 'all';

  // Community Pulse State & Base Metrics
  let pollVotes = [1242, 976, 739];
  const initialTotalPollVotes = 2957;
  let metricDownloads = 1294804;
  let metricUpvotes = 429812;
  let metricMembers = 12842;
  let currentActivities = [];

  // Advanced Search Parameters Filters State
  let filterState = {
    orientation: 'any',
    resolution: 'any',
    color: 'any'
  };

  // --- ELEMENT SELECTORS ---
  const col1 = document.getElementById('col-1');
  const col2 = document.getElementById('col-2');
  const col3 = document.getElementById('col-3');
  const wallpaperGrid = document.getElementById('wallpaper-grid-element');
  const emptyState = document.getElementById('empty-state');
  
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const searchSubmitBtn = document.getElementById('search-submit-btn');
  
  const navItems = document.querySelectorAll('.nav-item');
  const tagPills = document.querySelectorAll('.tag-pill');
  const viewTitle = document.getElementById('view-title');
  const viewSubtitle = document.getElementById('view-subtitle');
  const tagsPanel = document.getElementById('categories-tags-panel');
  
  const notificationBtn = document.getElementById('notification-btn');
  const mobileNotificationBtn = document.getElementById('mobile-notification-btn');

  // Mobile Menu Elements
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileOverlay = document.getElementById('mobile-sidebar-overlay');
  const sidebar = document.getElementById('sidebar');

  function toggleMobileMenu() {
    sidebar.classList.toggle('mobile-active');
    mobileOverlay.classList.toggle('active');
  }

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
  }
  
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', toggleMobileMenu);
  }
  const notificationBadge = document.getElementById('notif-badge');
  const notificationDropdown = document.getElementById('notification-dropdown');
  const markAllReadBtn = document.getElementById('mark-all-read');
  const notificationListItems = document.querySelectorAll('.dropdown-item');
  
  const profileCard = document.getElementById('profile-card');
  const settingsModal = document.getElementById('settings-modal');
  const closeModalX = document.getElementById('close-modal-x');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const settingsForm = document.getElementById('settings-form');
  const usernameInput = document.getElementById('username-input');
  const premiumCheckbox = document.getElementById('premium-checkbox');
  const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
  
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarBadge = document.getElementById('sidebar-badge');
  
  const statDownloads = document.getElementById('stat-downloads');
  const statFavorites = document.getElementById('stat-favorites');
  
  const toast = document.getElementById('toast-notification');
  const toastDesc = document.getElementById('toast-desc');

  // Advanced Search Parameters Elements selectors
  const filterToggleBtn = document.getElementById('filter-toggle-btn');
  const filterCard = document.getElementById('filter-card');
  const resetFiltersBtn = document.getElementById('reset-filters');
  const ratioSlider = document.getElementById('ratio-slider');
  const segmentBtns = document.querySelectorAll('.segment-btn');
  const resRangeSlider = document.getElementById('res-range-slider');
  const resSliderFill = document.getElementById('res-slider-fill');
  const resLabels = document.querySelectorAll('.res-label');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  const filterMatchCount = document.getElementById('filter-match-count');

  // Mobile Bottom Navigation Dock selectors
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');

  // Community View Selectors
  const communityView = document.getElementById('community-view');
  const settingsView = document.getElementById('settings-view');
  const historyView = document.getElementById('history-view');
  const dmcaView = document.getElementById('dmca-view');
  const privacyView = document.getElementById('privacy-view');
  const desktopMetricDownloads = document.getElementById('desktop-metric-downloads');
  const desktopMetricUpvotes = document.getElementById('desktop-metric-upvotes');
  const desktopMetricMembers = document.getElementById('desktop-metric-members');
  const mobileMetricDownloads = document.getElementById('mobile-metric-downloads');
  const mobileMetricUpvotes = document.getElementById('mobile-metric-upvotes');
  const mobileMetricMembers = document.getElementById('mobile-metric-members');

  // Track viewport mode to avoid unnecessary renders
  let isMobileViewport = window.innerWidth <= 900;

  // --- 1. INITIALIZE & FETCH INITIAL DATA ---
  initApp();

  async function initApp() {
    try {
      await fetchProfileSettings();
    } catch (e) {
      console.error("Error loading profile settings:", e);
    }
    fetchPublicSettingsInit();
    fetchWallpapers();
    updateLocalStats();
    updateResolutionSlider(); // set initial slider positions
    updateMatchCount();
    bindRankingsDownloads();
    bindFavoritesEvents();
    bindHistoryEvents();
    initSimulator();
    bindRankingsDetails();
  }

  // --- 2. PROFILE SETTINGS MANAGEMENT ---
  async function fetchProfileSettings() {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const profile = await response.json();
        window.userProfile = profile;
        updateProfileUI(profile);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }

  function updateProfileUI(profile) {
    // Sidebar sync
    if (sidebarUsername) sidebarUsername.textContent = profile.username;
    if (sidebarBadge) sidebarBadge.textContent = profile.role;
    if (sidebarAvatar) sidebarAvatar.src = profile.avatar;
    
    // Old modal sync (if elements exist)
    if (settingsAvatarPreview) settingsAvatarPreview.src = profile.avatar;
    if (usernameInput) usernameInput.value = profile.username;
    if (premiumCheckbox) premiumCheckbox.checked = profile.role === 'Premium Member';
    
    // New Settings View sync
    const settingsAvatarImg = document.getElementById('settings-avatar-img');
    const settingsProfileUsername = document.getElementById('settings-profile-username');
    const settingsProfileRole = document.getElementById('settings-profile-role');
    const settingsFullname = document.getElementById('settings-fullname');
    const settingsEmail = document.getElementById('settings-email');
    const settingsUsername = document.getElementById('settings-username');
    const settingsLocation = document.getElementById('settings-location');
    const settingsWebsite = document.getElementById('settings-website');
    const settingsBio = document.getElementById('settings-bio');
    const settingsLanguage = document.getElementById('settings-language');
    const settingsTimezone = document.getElementById('settings-timezone');

    if (settingsAvatarImg) settingsAvatarImg.src = profile.avatar;
    if (settingsProfileUsername) settingsProfileUsername.textContent = `@${profile.username}`;
    if (settingsProfileRole) settingsProfileRole.textContent = `Account Role: ${profile.role}`;
    
    if (settingsFullname) settingsFullname.value = profile.fullName || '';
    if (settingsEmail) settingsEmail.value = profile.email || '';
    if (settingsUsername) settingsUsername.value = profile.username || '';
    if (settingsLocation) settingsLocation.value = profile.location || '';
    if (settingsWebsite) settingsWebsite.value = profile.website || '';
    if (settingsBio) settingsBio.value = profile.bio || '';
    if (settingsLanguage) settingsLanguage.value = profile.language || '';
    if (settingsTimezone) settingsTimezone.value = profile.timezone || '';

    // Update active class in avatar picker grid options
    const pickerOptions = document.querySelectorAll('.picker-avatar-option');
    pickerOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.avatar === profile.avatar);
    });

    // Control Save & Disconnect/Login Button Layout based on Guest status
    const settingsLogoutBtn = document.getElementById('settings-logout-btn');
    const settingsSaveBtn = document.getElementById('settings-save-btn');
    const settingsInputs = document.querySelectorAll('#settings-view .settings-input, #settings-view .settings-textarea');
    const settingsAvatarWrapper = document.querySelector('.settings-avatar-wrapper');

    if (profile.username === 'guest') {
      if (settingsLogoutBtn) {
        settingsLogoutBtn.textContent = 'LOG IN';
        settingsLogoutBtn.style.background = '#111111';
        settingsLogoutBtn.style.borderColor = '#111111';
        settingsLogoutBtn.style.color = '#FFFFFF';
        settingsLogoutBtn.style.width = ''; // Standardized size (removed 100% width)
        settingsLogoutBtn.style.boxShadow = 'var(--elevation-outset)';
      }
      if (settingsSaveBtn) settingsSaveBtn.style.display = 'none';
      if (settingsAvatarWrapper) settingsAvatarWrapper.style.pointerEvents = 'none';
      settingsInputs.forEach(input => input.disabled = true);
    } else {
      if (settingsLogoutBtn) {
        settingsLogoutBtn.textContent = 'SIGN OUT';
        settingsLogoutBtn.style.background = 'rgba(255, 51, 102, 0.05)';
        settingsLogoutBtn.style.borderColor = '#FF3366';
        settingsLogoutBtn.style.color = '#FF3366';
        settingsLogoutBtn.style.width = '';
        settingsLogoutBtn.style.boxShadow = '0 4px 12px rgba(255, 51, 102, 0.15)';
      }
      if (settingsSaveBtn) settingsSaveBtn.style.display = 'block';
      if (settingsAvatarWrapper) settingsAvatarWrapper.style.pointerEvents = 'auto';
      settingsInputs.forEach(input => input.disabled = false);
    }

    // Dynamic Sidebar Profile Dropdown Menu updates
    const popoutUserInfo = document.getElementById('popout-user-info');
    const popoutAvatar = document.getElementById('popout-avatar');
    const popoutUsername = document.getElementById('popout-username');
    const popoutBadge = document.getElementById('popout-badge');
    const popoutItemLogin = document.getElementById('popout-item-login');
    const popoutItemSignup = document.getElementById('popout-item-signup');
    const popoutItemLogout = document.getElementById('popout-item-logout');

    const popoutItemAdmin = document.getElementById('popout-item-admin');
    if (profile.username === 'guest') {
      if (popoutUserInfo) popoutUserInfo.style.display = 'none';
      if (popoutItemLogin) popoutItemLogin.style.display = 'flex';
      if (popoutItemSignup) popoutItemSignup.style.display = 'flex';
      if (popoutItemLogout) popoutItemLogout.style.display = 'none';
      if (popoutItemAdmin) popoutItemAdmin.style.display = 'none';
    } else {
      if (popoutUserInfo) {
        popoutUserInfo.style.display = 'flex';
        if (popoutAvatar) popoutAvatar.src = profile.avatar;
        if (popoutUsername) popoutUsername.textContent = profile.username;
        if (popoutBadge) popoutBadge.textContent = profile.role;
      }
      if (popoutItemLogin) popoutItemLogin.style.display = 'none';
      if (popoutItemSignup) popoutItemSignup.style.display = 'none';
      if (popoutItemLogout) popoutItemLogout.style.display = 'flex';
      if (popoutItemAdmin) popoutItemAdmin.style.display = profile.role === 'Administrator' ? 'flex' : 'none';
    }
  }

  // Bind custom input focus active border highlight states
  const settingsInputs = document.querySelectorAll('.settings-input, .settings-textarea');
  settingsInputs.forEach(input => {
    input.addEventListener('focus', () => {
      const group = input.closest('.settings-input-group');
      if (group) group.classList.add('active-focus');
    });
    input.addEventListener('blur', () => {
      const group = input.closest('.settings-input-group');
      if (group) group.classList.remove('active-focus');
    });
  });

  // Toggling Avatar Picker Bubble
  const avatarWrapper = document.querySelector('.settings-avatar-wrapper');
  const avatarPickerBubble = document.getElementById('avatar-picker-bubble');
  
  if (avatarWrapper && avatarPickerBubble) {
    avatarWrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = window.getComputedStyle(avatarPickerBubble).display === 'flex';
      avatarPickerBubble.style.display = isVisible ? 'none' : 'flex';
    });
    
    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
      if (!avatarPickerBubble.contains(e.target) && !avatarWrapper.contains(e.target)) {
        avatarPickerBubble.style.display = 'none';
      }
    });
  }

  // Bind avatar selection triggers in picker
  const pickerOptions = document.querySelectorAll('.picker-avatar-option');
  const settingsAvatarImg = document.getElementById('settings-avatar-img');
  
  pickerOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      
      const newAvatarUrl = opt.dataset.avatar;
      if (settingsAvatarImg) {
        settingsAvatarImg.src = newAvatarUrl;
      }
      
      showToast('Avatar Updated', 'Selected avatar preview updated.');
    });
  });

  // Save Settings from New Settings View Form
  const settingsSaveBtn = document.getElementById('settings-save-btn');
  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const fullName = document.getElementById('settings-fullname').value.trim();
      const email = document.getElementById('settings-email').value.trim();
      const username = document.getElementById('settings-username').value.trim();
      const location = document.getElementById('settings-location').value.trim();
      const website = document.getElementById('settings-website').value.trim();
      const bio = document.getElementById('settings-bio').value.trim();
      const language = document.getElementById('settings-language').value.trim();
      const timezone = document.getElementById('settings-timezone').value.trim();
      
      const tempAvatarImg = document.getElementById('settings-avatar-img');
      const avatar = tempAvatarImg ? tempAvatarImg.getAttribute('src') : '/images/avatars/avatar_alpha.png';

      if (!username) {
        showToast('Save Error', 'Username is required.');
        return;
      }

      try {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            fullName,
            email,
            avatar,
            location,
            website,
            bio,
            language,
            timezone
          })
        });

        if (response.ok) {
          const updatedProfile = await response.json();
          updateProfileUI(updatedProfile);
          showToast('Settings Saved', 'Your account profile has been successfully updated.');
          
          // Optionally hide avatar picker if open
          if (avatarPickerBubble) avatarPickerBubble.style.display = 'none';
        } else {
          showToast('Save Error', 'Failed to save settings.');
        }
      } catch (err) {
        console.error('Error saving settings:', err);
        showToast('Save Error', 'Network error while saving settings.');
      }
    });
  }

  // Toggle profile dropdown flyout bubble when clicking the profile card
  const profilePopout = document.getElementById('profile-popout');
  if (profileCard && profilePopout) {
    profileCard.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isHidden = profilePopout.style.display === 'none';
      profilePopout.style.display = isHidden ? 'flex' : 'none';
    });
  }

  // Dismiss dropdown on outside clicks
  document.addEventListener('click', (e) => {
    if (profilePopout && !profilePopout.contains(e.target) && e.target !== profileCard) {
      profilePopout.style.display = 'none';
    }
  });
  
  // Also open settings on Sidebar "SETTINGS" item click
  document.getElementById('nav-settings').addEventListener('click', (e) => {
    e.preventDefault();
    openSettingsModal();
  });

  function openSettingsModal() {
    selectCategory('settings');
  }

  function closeSettingsModal() {
    settingsModal.classList.remove('active');
  }

  [closeModalX, closeModalBtn].forEach(btn => {
    btn.addEventListener('click', closeSettingsModal);
  });

  // Handle settings form submit (Legacy Modal)
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const isPremium = premiumCheckbox.checked;

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, role: isPremium ? 'Premium Member' : 'Standard Member' })
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        updateProfileUI(updatedProfile);
        showToast('Settings Saved', 'Your profile preferences have been updated.');
        closeSettingsModal();
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  });

  // Fetch local session stats for settings card
  async function updateLocalStats() {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const stats = await response.json();
        statDownloads.textContent = stats.totalDownloads;
        statFavorites.textContent = stats.favoritesCount;
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  // --- 3. DYNAMIC WALLPAPER LOADER & RENDERER ---
  async function fetchWallpapers() {
    if (currentCategory === 'magazine' || currentCategory === 'magazine-reader' || currentCategory === 'rankings' || currentCategory === 'favorites') return;
    try {
      // Build API query parameters
      let url = `/api/wallpapers?category=${currentCategory}`;
      
      // If tag is active and is not 'all', override category parameter with targeted tag filter
      if (currentCategory === 'home' || currentCategory === 'categories') {
        if (activeTag !== 'all') {
          url = `/api/wallpapers?category=${encodeURIComponent(activeTag)}`;
        }
      }
      
      if (currentSearch) {
        url += `&search=${encodeURIComponent(currentSearch)}`;
      }

      // Append Advanced Search parameters
      if (filterState.orientation !== 'any') {
        url += `&orientation=${filterState.orientation}`;
      }
      if (filterState.resolution !== 'any') {
        url += `&resolution=${filterState.resolution}`;
      }
      if (filterState.color !== 'any') {
        url += `&color=${filterState.color}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('API network response error');
      
      const wallpapers = await response.json();
      renderWallpapers(wallpapers);
    } catch (err) {
      console.error('Error loading wallpapers:', err);
      showEmptyState(true);
    }
  }

  function renderWallpapers(wallpapers) {
    // Clear the columns
    col1.innerHTML = '';
    col2.innerHTML = '';
    col3.innerHTML = '';

    if (wallpapers.length === 0) {
      showEmptyState(true);
      return;
    }

    showEmptyState(false);

    const isMobile = window.innerWidth <= 900;

    // Distribute wallpapers to match both layouts perfectly:
    wallpapers.forEach((w, index) => {
      const card = createWallpaperCard(w);

      if (isMobile) {
        // Alternate between Col 1 and Col 2 for a perfect mobile grid matching mockup
        if (index % 2 === 0) {
          col1.appendChild(card);
        } else {
          col2.appendChild(card);
        }
      } else {
        // Desktop 3-column dynamic masonry distribution:
        // Always append the card to the column that currently has the fewest children.
        // This ensures the grid fills from left-to-right and maintains perfect height balance!
        const col1Count = col1.children.length;
        const col2Count = col2.children.length;
        const col3Count = col3.children.length;

        if (col1Count <= col2Count && col1Count <= col3Count) {
          col1.appendChild(card);
        } else if (col2Count <= col1Count && col2Count <= col3Count) {
          col2.appendChild(card);
        } else {
          col3.appendChild(card);
        }
      }
    });
  }

  function createWallpaperCard(w) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `wallpaper-card ratio-${w.ratio}`;
    cardDiv.dataset.id = w.id;

    // Favorite button
    const favBtn = document.createElement('button');
    favBtn.className = `favorite-icon-btn ${w.isFavorited ? 'active' : ''}`;
    favBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
    `;
    
    // Toggle Favorite Action
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: w.id })
        });
        if (response.ok) {
          const resData = await response.json();
          favBtn.classList.toggle('active', resData.isFavorited);
          
          // Re-render in favorites category dynamically
          if (currentCategory === 'favorites') {
            fetchWallpapers();
          } else {
            // Update the downloads and favorites counts labels
            const dlNum = cardDiv.querySelector('.dl-num');
            const favNum = cardDiv.querySelector('.fav-num');
            if (dlNum) dlNum.textContent = w.downloads.toLocaleString();
            if (favNum) favNum.textContent = resData.favoritesCount.toLocaleString();
          }

          if (resData.isFavorited) {
            showToast('Added to Favorites', `You favorited "${w.title}".`);
          } else {
            showToast('Removed Favorite', `Removed "${w.title}" from favorites.`);
          }
          updateLocalStats();
        }
      } catch (err) {
        console.error('Error toggling favorite:', err);
      }
    });

    // Image section
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'card-image-wrapper';
    
    const img = document.createElement('img');
    const imageFilename = w.image ? w.image.split('/').pop() : '';
    img.src = w.image || '/images/avatars/avatar_retro.png';
    if (w.image) {
      img.srcset = `/api/images/thumb/${imageFilename} 600w, ${w.image} 1200w`;
      img.sizes = "(max-width: 900px) 100vw, (max-width: 1150px) 50vw, 33vw";
    }
    img.alt = w.title;
    img.className = 'card-image';
    img.loading = 'lazy';
    img.onerror = function() {
      this.onerror = null;
      this.src = '/images/avatars/avatar_retro.png';
    };
    
    imageWrapper.appendChild(img);


    // Footer panel
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const details = document.createElement('div');
    details.className = 'card-details';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = w.title;

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const tag = document.createElement('span');
    tag.className = 'card-tag';
    tag.textContent = w.quality;

    const stats = document.createElement('span');
    stats.className = 'card-stats-text downloads-count';
    stats.innerHTML = `
      <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span class="dl-num">${w.downloads.toLocaleString()}</span>
      <span class="stat-separator">•</span>
      <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
      <span class="fav-num">${w.favoritesCount.toLocaleString()}</span>
    `;

    meta.appendChild(tag);
    meta.appendChild(stats);
    details.appendChild(title);
    details.appendChild(meta);

    // Download action button
    const dlBtn = document.createElement('button');
    dlBtn.className = 'download-btn';
    dlBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
      </svg>
    `;

    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Start download
      const a = document.createElement('a');
      a.href = `/api/wallpapers/${w.id}/download`;
      a.download = `${w.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      showToast('Downloading Wallpaper', `Saving high-resolution "${w.title}" in 4K...`);
      
      // Increment count visual locally right away
      w.downloads += 1;
      const dlNum = cardDiv.querySelector('.dl-num');
      if (dlNum) dlNum.textContent = w.downloads.toLocaleString();
      
      setTimeout(() => {
        updateLocalStats();
        // If history view is active, refresh cards
        if (currentCategory === 'history') {
          fetchWallpapers();
        }
      }, 1000);
    });

    footer.appendChild(details);
    footer.appendChild(dlBtn);

    cardDiv.appendChild(favBtn);
    cardDiv.appendChild(imageWrapper);
    cardDiv.appendChild(footer);

    cardDiv.addEventListener('click', () => {
      showWallpaperDetails(w.id);
    });

    return cardDiv;
  }

  function showEmptyState(show) {
    if (show) {
      emptyState.style.display = 'flex';
      wallpaperGrid.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      wallpaperGrid.style.display = 'grid';
    }
  }

  // --- 4. SIDEBAR NAVIGATION CONTROLLER ---
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const category = item.dataset.category;
      
      e.preventDefault();
      selectCategory(category);
    });
  });

  // Share selection logic between sidebar and bottom navigation tabs
  function selectCategory(category) {
    if (category !== 'admin' && !category.startsWith('magazine-reader')) {
      window.history.replaceState(null, null, '#' + category);
    } else if (category === 'admin') {
      window.history.replaceState(null, null, '#admin-' + (window.activeAdminSubview || 'dashboard'));
    }

    const adminView = document.getElementById('admin-view');
    const mainSidebar = document.querySelector('.sidebar');
    
    if (category === 'admin') {
      if (adminView) adminView.style.display = 'block';
      if (mainSidebar) mainSidebar.style.display = 'none';
      const topBar = document.querySelector('.topbar');
      const mobileHeader = document.querySelector('.mobile-header');
      const viewHeader = document.querySelector('.view-header');
      const tagsPanel = document.getElementById('categories-tags-panel');
      const collectionsView = document.getElementById('collections-detail-view');
      const categoriesView = document.getElementById('categories-view');
      const magazineView = document.getElementById('magazine-view');
      const readerView = document.getElementById('article-reader-view');
      const rankingsView = document.getElementById('rankings-view');
      const favoritesView = document.getElementById('favorites-view');
      const emptyState = document.getElementById('empty-state');
      const wallpaperGrid = document.getElementById('wallpaper-grid-element');
      const detailsView = document.getElementById('details-view');
      const communityView = document.getElementById('community-view');
      const settingsView = document.getElementById('settings-view');
      const historyView = document.getElementById('history-view');
      const dmcaView = document.getElementById('dmca-view');
      const privacyView = document.getElementById('privacy-view');
      
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      if (detailsView) detailsView.style.display = 'none';
      if (communityView) communityView.style.display = 'none';
      if (settingsView) settingsView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (dmcaView) dmcaView.style.display = 'none';
      if (privacyView) privacyView.style.display = 'none';
      
      switchAdminSubview('ingestion');
      return;
    } else {
      if (adminView) adminView.style.display = 'none';
      if (mainSidebar) mainSidebar.style.display = 'flex';
    }

    const detailsView = document.getElementById('details-view');
    if (detailsView) detailsView.style.display = 'none';

    const highlightCategory = category === 'details' ? previousCategory : category;

    // Reset desktop nav items active highlight
    navItems.forEach(n => {
      const isMag = (highlightCategory === 'magazine' || highlightCategory === 'magazine-reader') && n.dataset.category === 'magazine';
      n.classList.toggle('active', n.dataset.category === highlightCategory || isMag);
    });

    // Reset mobile bottom nav items active highlight
    mobileNavItems.forEach(m => {
      const isMag = (highlightCategory === 'magazine' || highlightCategory === 'magazine-reader') && m.dataset.category === 'magazine';
      m.classList.toggle('active', m.dataset.category === highlightCategory || isMag);
    });

    // Update state
    currentCategory = category;
    activeTag = 'all'; // reset tags filter on nav click
    
    // Reset active tag pills classes
    tagPills.forEach(p => {
      p.classList.toggle('active', p.dataset.anime === 'all');
    });

    // Update Title Header
    updateViewHeaders(category);

    // Get views elements
    const topBar = document.querySelector('.topbar');
    const mobileHeader = document.querySelector('.mobile-header');
    const viewHeader = document.querySelector('.view-header');
    const collectionsView = document.getElementById('collections-detail-view');
    const categoriesView = document.getElementById('categories-view');
    const magazineView = document.getElementById('magazine-view');
    const readerView = document.getElementById('article-reader-view');
    const rankingsView = document.getElementById('rankings-view');
    const favoritesView = document.getElementById('favorites-view');
    const navMag = document.getElementById('nav-magazine');

    // Toggle active sphere/icon for all desktop nav items dynamically
    navItems.forEach(n => {
      const isSelected = n.dataset.category === highlightCategory || 
                         ((highlightCategory === 'magazine' || highlightCategory === 'magazine-reader') && n.dataset.category === 'magazine');
      
      const sphere = n.querySelector('.active-sphere-container');
      const icon = n.querySelector('.nav-icon');
      
      if (sphere) {
        sphere.style.display = isSelected ? 'flex' : 'none';
      }
      if (icon) {
        icon.style.display = isSelected ? 'none' : 'block';
      }
    });

    // Hide community view & history view by default, will override if active
    if (communityView) communityView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (historyView) historyView.style.display = 'none';
    if (dmcaView) dmcaView.style.display = 'none';
    if (privacyView) privacyView.style.display = 'none';

    // Show/Hide curated collections, categories page, or normal wallpaper grid views
    if (category === 'details') {
      if (detailsView) detailsView.style.display = 'block';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide search bar, mobileHeader, and tagsPanel but show details content
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';
    } else if (category === 'collections') {
      // Show Collections Detail SPA view
      if (collectionsView) collectionsView.style.display = 'block';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide search bar, categories tag panel, and normal view headers
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';
      
      // Load Curated collections cards
      loadCuratedCollections();
    } else if (category === 'categories') {
      // Show Browse Genres SPA view
      if (categoriesView) categoriesView.style.display = 'block';
      if (collectionsView) collectionsView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide search bar, tags panel, and normal view headers
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';
    } else if (category === 'magazine') {
      // Show Browse Magazine SPA view
      if (magazineView) magazineView.style.display = 'block';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide search bar, tags panel, and normal view headers
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';
      
      // Reset tag filtering to "all" when entering magazine view
      syncMagazineTags('all');
      const articleCards = document.querySelectorAll('.magazine-card, .mag-mobile-row-card');
      articleCards.forEach(card => card.style.display = '');
      const featuredCards = document.querySelectorAll('.magazine-featured-card, .magazine-mobile-featured-card');
      featuredCards.forEach(card => card.style.display = '');
    } else if (category === 'magazine-reader') {
      // Show Widescreen Article Reader View
      if (readerView) readerView.style.display = 'block';
      if (magazineView) magazineView.style.display = 'none';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide search bar, tags panel, and normal view headers
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';
    } else if (category === 'rankings') {
      // Show Rankings View
      if (rankingsView) rankingsView.style.display = 'block';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide standard topbar, mobileHeader, and tagsPanel but show rankings content
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';
    } else if (category === 'favorites') {
      // Show Favorites View
      if (favoritesView) favoritesView.style.display = 'block';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide standard topbar, mobileHeader, and tagsPanel but show favorites content
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';

      // Load Favorites dynamically
      loadFavoritesPage();
    } else if (category === 'community') {
      // Show Community Pulse View
      if (communityView) communityView.style.display = 'block';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide standard topbar, mobileHeader, and tagsPanel
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';

      // Call community init function
      initCommunityView();
    } else if (category === 'history') {
      // Show History View
      if (historyView) historyView.style.display = 'block';
      if (favoritesView) favoritesView.style.display = 'none';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide standard topbar, mobileHeader, and tagsPanel
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';

      // Load Download History dynamically
      loadHistoryPage();
    } else if (category === 'settings') {
      // Show Settings / Account Profile View
      if (settingsView) settingsView.style.display = 'block';
      if (historyView) historyView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide standard topbar, mobileHeader, and tagsPanel
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';
    } else if (category === 'dmca') {
      // Show Legal & DMCA View
      if (dmcaView) dmcaView.style.display = 'block';
      if (settingsView) settingsView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide standard topbar, mobileHeader, and tagsPanel
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';

      // Initialize the DMCA form wizard state
      initDmcaWizard();
    } else if (category === 'privacy') {
      // Show Privacy Policy & Terms View
      if (privacyView) privacyView.style.display = 'block';
      if (settingsView) settingsView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (wallpaperGrid) wallpaperGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      
      // Hide standard topbar, mobileHeader, and tagsPanel
      if (topBar) topBar.style.display = 'none';
      if (mobileHeader) mobileHeader.style.display = 'none';
      if (viewHeader) viewHeader.style.display = 'none';
      if (tagsPanel) tagsPanel.style.display = 'none';

      initPrivacyPolicy();
    } else {
      // Normal SPA pages view routing
      if (collectionsView) collectionsView.style.display = 'none';
      if (categoriesView) categoriesView.style.display = 'none';
      if (magazineView) magazineView.style.display = 'none';
      if (readerView) readerView.style.display = 'none';
      if (rankingsView) rankingsView.style.display = 'none';
      if (favoritesView) favoritesView.style.display = 'none';
      
      if (topBar) topBar.style.display = '';
      if (mobileHeader) mobileHeader.style.display = '';
      if (viewHeader) viewHeader.style.display = '';
      
      // Show/Hide sub-categories tags panel
      if (category === 'home') {
        if (tagsPanel) tagsPanel.style.display = '';
      } else {
        if (tagsPanel) tagsPanel.style.display = 'none';
      }

      // Fetch wallpapers list normal
      fetchWallpapers();
    }
    
    updateMatchCount();
  }

  // --- BROWSE GENRES (CATEGORIES) CARD CLICK NAVIGATION ---
  const bentoCards = document.querySelectorAll('.bento-card');
  const mobGenreCards = document.querySelectorAll('.genre-mobile-row-card');

  const handleGenreClick = (genreTag) => {
    // Select the category tag pill corresponding to the clicked genre
    const pill = Array.from(tagPills).find(p => p.dataset.anime.toLowerCase() === genreTag.toLowerCase());
    
    if (pill) {
      // Deactivate all tag pills, activate the clicked one
      tagPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeTag = pill.dataset.anime;
    }

    // Transition back to home view showing matching category wallpapers
    selectCategory('home');
    
    // Smooth transition
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Genre Selected', `Browsing curated premium wallpapers in "${genreTag}"...`);
  };

  bentoCards.forEach(card => {
    card.addEventListener('click', () => {
      const genre = card.dataset.genre;
      if (genre) handleGenreClick(genre);
    });
  });

  mobGenreCards.forEach(card => {
    card.addEventListener('click', () => {
      const genre = card.dataset.genre;
      if (genre) handleGenreClick(genre);
    });
  });

  // --- COLLECTIONS VIEW DETAIL INTERACTION LOGIC ---
  const desktopBackBtn = document.getElementById('desktop-back-btn');
  const mobileBackBtn = document.getElementById('mobile-back-btn');
  const desktopZipBtn = document.getElementById('desktop-download-zip-btn');
  const mobileZipBtn = document.getElementById('mobile-download-zip-btn');
  const desktopGrid = document.getElementById('collections-desktop-grid');
  const mobileGrid = document.getElementById('collections-mobile-grid');

  // Back button clicks return to Home page
  [desktopBackBtn, mobileBackBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectCategory('home');
      });
    }
  });

  // ZIP pack download triggers
  [desktopZipBtn, mobileZipBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadZipPacks(
          '/api/collections/chainsaw-man/zip',
          'chainsaw_man_complete_pack.zip',
          'Downloading Pack ZIP',
          'Downloading Chainsaw Man Complete Pack (24 Wallpapers, 4K)...'
        );
      });
    }
  });

  // Load and render Curated Wallpapers from active collection dynamically
  async function loadCuratedCollections() {
    try {
      const colResponse = await fetch('/api/collections');
      if (!colResponse.ok) throw new Error('Failed to fetch collections');
      const collections = await colResponse.json();

      if (collections.length === 0) return;

      // Select featured collection or the first published one
      const activeCol = collections.find(c => c.featured) || collections[0];

      // Fetch wallpapers
      const wpResponse = await fetch('/api/wallpapers');
      if (!wpResponse.ok) throw new Error('Failed to fetch wallpapers');
      const allWps = await wpResponse.json();

      // Filter wallpapers in this collection
      const wallpapers = allWps.filter(w => activeCol.assets.includes(w.id));

      // 1. Update title and meta info in public page
      const heroTitle = document.querySelector('.collections-hero-title');
      const heroMeta = document.querySelector('.collections-hero-meta');
      const mobileHeroTitle = document.querySelector('.collections-mobile-title');

      if (heroTitle) {
        heroTitle.innerHTML = activeCol.title.replace(' Complete Pack', '<br>Complete Pack');
      }
      if (heroMeta) {
        const animatedCount = wallpapers.filter(w => w.tags && w.tags.some(t => t.toLowerCase() === '#animated' || t.toLowerCase() === 'animated')).length;
        const animatedText = animatedCount ? ` &bull; ${animatedCount} Animated` : '';
        heroMeta.innerHTML = `${wallpapers.length} Wallpapers${animatedText} &bull; 4K Ultra-HD Resolution`;
      }
      if (mobileHeroTitle) {
        mobileHeroTitle.textContent = activeCol.title.toUpperCase();
      }

      // 2. Update 3D card deck images
      const deckImgs = document.querySelectorAll('.card-deck-3d .deck-card-img');
      const mobileDeckImgs = document.querySelectorAll('.mobile-deck-wrapper .deck-card-img');
      const sampleWps = wallpapers.slice(0, 3);
      
      deckImgs.forEach((img, idx) => {
        if (sampleWps[idx]) img.src = sampleWps[idx].image;
      });
      mobileDeckImgs.forEach((img, idx) => {
        if (sampleWps[idx]) img.src = sampleWps[idx].image;
      });

      // 3. Update ZIP download event listeners dynamically
      const desktopZip = document.getElementById('desktop-download-zip-btn');
      const mobileZip = document.getElementById('mobile-download-zip-btn');

      const handleZipClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const safeFilename = activeCol.title.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_pack.zip';
        downloadZipPacks(
          `/api/collections/${activeCol.id}/zip`,
          safeFilename,
          'Downloading Pack ZIP',
          `Downloading ${activeCol.title} (${wallpapers.length} Wallpapers, 4K)...`
        );
      };

      if (desktopZip) {
        const newDesktopZip = desktopZip.cloneNode(true);
        desktopZip.parentNode.replaceChild(newDesktopZip, desktopZip);
        newDesktopZip.addEventListener('click', handleZipClick);
      }
      if (mobileZip) {
        const newMobileZip = mobileZip.cloneNode(true);
        mobileZip.parentNode.replaceChild(newMobileZip, mobileZip);
        newMobileZip.addEventListener('click', handleZipClick);
      }

      // 4. Render grids
      renderCuratedDesktop(wallpapers);
      renderCuratedMobile(wallpapers);
    } catch (err) {
      console.error('Error loading collections:', err);
    }
  }

  function renderCuratedDesktop(wallpapers) {
    if (!desktopGrid) return;
    desktopGrid.innerHTML = '';
    wallpapers.forEach((w, idx) => {
      const card = document.createElement('div');
      card.className = 'collection-item-card';
      
      const indexStr = String(idx + 1).padStart(2, '0');
      
      card.innerHTML = `
        <div class="col-item-img-wrapper">
          <img src="${w.image}" alt="${w.title}" class="col-item-img" loading="lazy">
        </div>
        <div class="col-item-footer">
          <div class="col-item-info">
            <h3 class="col-item-index-title">${indexStr} ${w.title}</h3>
          </div>
          <button class="col-item-download-btn" title="Download Wallpaper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </button>
        </div>
      `;

      // Bind individual download action
      const btn = card.querySelector('.col-item-download-btn');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = `/api/wallpapers/${w.id}/download`;
        a.download = `${w.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Downloading Wallpaper', `Saving high-res "${w.title}" in 4K...`);
        
        setTimeout(() => {
          updateLocalStats();
        }, 1000);
      });

      card.addEventListener('click', () => {
        showWallpaperDetails(w.id);
      });

      desktopGrid.appendChild(card);
    });
  }

  function renderCuratedMobile(wallpapers) {
    if (!mobileGrid) return;
    mobileGrid.innerHTML = '';
    wallpapers.forEach((w, idx) => {
      const card = document.createElement('div');
      card.className = 'collection-mobile-card';
      
      const indexStr = String(idx + 1).padStart(2, '0');
      
      card.innerHTML = `
        <div class="col-item-mobile-img-wrapper">
          <img src="${w.image}" alt="${w.title}" class="col-item-mobile-img" loading="lazy">
        </div>
        <div class="col-item-mobile-footer">
          <span class="col-item-mobile-index">${indexStr}</span>
          <button class="col-item-mobile-download-btn" title="Download Wallpaper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </button>
        </div>
      `;

      // Bind individual download action
      const btn = card.querySelector('.col-item-mobile-download-btn');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = `/api/wallpapers/${w.id}/download`;
        a.download = `chainsaw_man_${indexStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Downloading Wallpaper', `Saving high-res Chainsaw Man ${indexStr}...`);
        
        setTimeout(() => {
          updateLocalStats();
        }, 1000);
      });

      card.addEventListener('click', () => {
        showWallpaperDetails(w.id);
      });

      mobileGrid.appendChild(card);
    });
  }

  function updateViewHeaders(category) {
    const titles = {
      home: { title: "ALL WALLPAPERS", sub: "High-fidelity curated collection of premium wallpapers of all types" },
      collections: { title: "COLLECTION LEADERBOARD", sub: "Trending custom wallpaper packs curated by editors" },
      categories: { title: "GENRE CATEGORIES", sub: "Browse premium wallpapers by specific franchise series" },
      magazine: { title: "MAGAZINE HUB", sub: "Culture columns & design post-mortems" },
      editorial: { title: "EDITORIAL PICKS", sub: "Premium art handpicked by the RESIN editorial committee" },
      rankings: { title: "TOP CURRENT RANKINGS", sub: "Highly-rated masterpieces sorted by weekly downloads" },
      activity: { title: "RECENT ACTIVITY", sub: "Wallpapers currently trending and popular in active groups" },
      community: { title: "COMMUNITY FAVORITES", sub: "Most loved anime art compiled by public members" },
      favorites: { title: "MY FAVORITE SAVES", sub: "Your personally customized wallpapers collection" },
      history: { title: "DOWNLOAD HISTORY", sub: "List of wallpapers you have recently downloaded" }
    };

    const header = titles[category] || { title: "WALLPAPER COLLECTION", sub: "Premium high-resolution wallpaper art" };
    viewTitle.textContent = header.title;
    viewSubtitle.textContent = header.sub;
  }

  // --- 5. CATEGORY TAGS FILTER ---
  tagPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tagPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      activeTag = pill.dataset.anime;
      fetchWallpapers();
      updateMatchCount();
    });
  });

  // --- 6. REAL-TIME SEARCH ENGINE ---
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    
    // Toggle clear search button visibility
    clearSearchBtn.style.display = currentSearch ? 'block' : 'none';
    
    // Perform dynamic instant search
    fetchWallpapers();
    updateMatchCount();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    clearSearchBtn.style.display = 'none';
    fetchWallpapers();
    updateMatchCount();
    searchInput.focus();
  });

  // Magnifying-glass nested submit button inside mobile search bar
  if (searchSubmitBtn) {
    searchSubmitBtn.addEventListener('click', () => {
      currentSearch = searchInput.value.trim();
      fetchWallpapers();
      updateMatchCount();
      searchInput.blur();
    });
  }

  function toggleNotifPanel(e) {
    e.stopPropagation();
    notificationDropdown.classList.toggle('active');
    filterCard.classList.remove('active'); // Close other cards
  }

  notificationBtn.addEventListener('click', toggleNotifPanel);
  if (mobileNotificationBtn) {
    mobileNotificationBtn.addEventListener('click', toggleNotifPanel);
  }

  // Close dropdown on outside document click
  document.addEventListener('click', () => {
    notificationDropdown.classList.remove('active');
    filterCard.classList.remove('active');
  });

  notificationDropdown.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent closing on panel inner elements clicks
  });

  markAllReadBtn.addEventListener('click', () => {
    notificationListItems.forEach(item => {
      item.classList.remove('unread');
      const dot = item.querySelector('.dot');
      if (dot) dot.remove();
    });
    notificationBadge.style.display = 'none';
    const mobileBadge = document.querySelector('.mobile-header .notification-badge');
    if (mobileBadge) mobileBadge.style.display = 'none';
    showToast('Notifications Cleared', 'All pending notifications marked as read.');
  });

  // --- 8. ADVANCED SEARCH FILTERS CONTROLLER ---
  
  // Toggle Filters popover card
  filterToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    filterCard.classList.toggle('active');
    notificationDropdown.classList.remove('active'); // Close other dropdowns
  });

  filterCard.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent closing card when clicking inside
  });

  // Section A: Segment Buttons (Orientation)
  segmentBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      filterState.orientation = btn.dataset.ratio;

      // Adjust the white elevated sliding panel position
      if (index === 0) ratioSlider.style.left = '4px';
      else if (index === 1) ratioSlider.style.left = 'calc(33.333% + 2px)';
      else if (index === 2) ratioSlider.style.left = 'calc(66.666% + 0px)';

      updateMatchCount();
    });
  });

  // Section B: Custom Range Slider (Resolution)
  function updateResolutionSlider() {
    const val = parseInt(resRangeSlider.value);
    const percentage = val * 33.333;
    
    // Slide range track visual fill bar width adjustment
    resSliderFill.style.width = `calc(${percentage}% - ${val * 1.5}px)`;

    resLabels.forEach((label, idx) => {
      label.classList.toggle('active', idx === val);
    });

    const resMap = ['any', '1440p', '4k', '8k'];
    filterState.resolution = resMap[val];
    updateMatchCount();
  }

  resRangeSlider.addEventListener('input', updateResolutionSlider);

  // Click labels directly shifts the slider
  resLabels.forEach(label => {
    label.addEventListener('click', () => {
      const idx = parseInt(label.dataset.idx);
      resRangeSlider.value = idx;
      updateResolutionSlider();
    });
  });

  // Section C: Color Palette Swatches
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');

      filterState.color = swatch.dataset.color;
      updateMatchCount();
    });
  });

  // Dynamic Background Match Counter
  let matchCountTimeout = null;
  async function updateMatchCount() {
    if (currentCategory === 'magazine' || currentCategory === 'magazine-reader') return;
    
    if (matchCountTimeout) clearTimeout(matchCountTimeout);
    
    matchCountTimeout = setTimeout(async () => {
      try {
        let url = `/api/wallpapers?category=${currentCategory}&countOnly=true`;
        
        if (currentCategory === 'home' || currentCategory === 'categories') {
          if (activeTag !== 'all') {
            url = `/api/wallpapers?category=${encodeURIComponent(activeTag)}&countOnly=true`;
          }
        }

        if (currentSearch) {
          url += `&search=${encodeURIComponent(currentSearch)}`;
        }

        if (filterState.orientation !== 'any') {
          url += `&orientation=${filterState.orientation}`;
        }
        if (filterState.resolution !== 'any') {
          url += `&resolution=${filterState.resolution}`;
        }
        if (filterState.color !== 'any') {
          url += `&color=${filterState.color}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const resData = await response.json();
          filterMatchCount.textContent = `( ${resData.count} ${resData.count === 1 ? 'MATCH' : 'MATCHES'} )`;
          applyFiltersBtn.innerHTML = `Show ${resData.count} Results`;
        }
      } catch (err) {
        console.error('Error counting matches:', err);
      }
    }, 200);
  }

  // Section D: Apply Parameters Dock Button
  applyFiltersBtn.addEventListener('click', () => {
    filterCard.classList.remove('active');
    fetchWallpapers();
    showToast('Filters Applied', 'Search parameters applied successfully.');
  });

  // Reset Filters Button
  resetFiltersBtn.addEventListener('click', () => {
    // Reset Orientation segment slider
    segmentBtns.forEach((btn, index) => {
      btn.classList.toggle('active', index === 0);
    });
    ratioSlider.style.left = '4px';
    filterState.orientation = 'any';

    // Reset Resolution slider
    resRangeSlider.value = 0;
    updateResolutionSlider();

    // Reset Color swatches
    colorSwatches.forEach((swatch, index) => {
      swatch.classList.toggle('active', index === 0);
    });
    filterState.color = 'any';

    updateMatchCount();
    showToast('Filters Reset', 'All search parameters set to default.');
  });


  // --- 9. MOBILE BOTTOM NAVIGATION EVENTS ---
  mobileNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const category = item.dataset.category;

      if (category === 'profile') {
        // Mobile header profile icon triggers settings view
        selectCategory('settings');
      } else if (category === 'settings') {
        selectCategory('settings');
      } else {
        // Trigger page view route
        selectCategory(category);
      }
    });
  });

  // Mobile menu click triggers profile card popup too (acts as sidebar drawer trigger)
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      openSettingsModal();
      showToast('Profile Drawer', 'Accessing your profile statistics and account settings.');
    });
  }

  // Handle window viewport resizing to redistribute cards dynamically on layout shift
  window.addEventListener('resize', () => {
    const isMobileNow = window.innerWidth <= 900;
    if (isMobileNow !== isMobileViewport) {
      isMobileViewport = isMobileNow;
      if (currentCategory === 'community') {
        const mobLayout = document.querySelector('.community-mobile-layout');
        const deskLayout = document.querySelector('.community-desktop-layout');
        if (isMobileViewport) {
          if (mobLayout) mobLayout.style.setProperty('display', 'block', 'important');
          if (deskLayout) deskLayout.style.setProperty('display', 'none', 'important');
        } else {
          if (mobLayout) mobLayout.style.setProperty('display', 'none', 'important');
          if (deskLayout) deskLayout.style.setProperty('display', 'block', 'important');
        }
      } else if (currentCategory !== 'collections' && currentCategory !== 'categories' && currentCategory !== 'magazine' && currentCategory !== 'rankings' && currentCategory !== 'favorites') {
        fetchWallpapers(); // Trigger full redraw and column re-distribution
      }
    }
  });


  // --- 10. PREMIUM TOAST UTILITY ---
  let toastTimeout;
  function showToast(title, desc) {
    // Clear active timeouts
    clearTimeout(toastTimeout);
    
    // Update elements
    const toastTitle = toast.querySelector('.toast-title');
    toastTitle.textContent = title;
    toastDesc.textContent = desc;

    // Trigger animation
    toast.classList.add('active');

    // Auto-close toast
    toastTimeout = setTimeout(() => {
      toast.classList.remove('active');
    }, 4000);
  }

  // --- 10b. PREMIUM CONFIRM MODAL UTILITY ---
  function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('admin-confirm-modal');
    const msgEl = document.getElementById('admin-confirm-message');
    const cancelBtn = document.getElementById('admin-confirm-cancel');
    const okBtn = document.getElementById('admin-confirm-ok');
    
    if (!modal || !msgEl || !cancelBtn || !okBtn) {
      if (confirm(message)) {
        onConfirm();
      }
      return;
    }

    msgEl.textContent = message;
    modal.style.display = 'flex';

    // Clone nodes to clear previous listeners
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newOkBtn = okBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newCancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    newOkBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      onConfirm();
    });
  }


  // --- 11. MAGAZINE HUB LOGIC (ARTICLES DATA & READER VIEWPORT) ---
  let activeArticleId = null;

  // Magazine Hub Articles local cache is loaded dynamically from the backend APIs

  // Helper to format large numbers to "K" format
  function formatLikesCount(count) {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count;
  }

  // Sync / Filter Category Tags Bar across desktop and mobile
  function syncMagazineTags(filterValue) {
    const magTagPills = document.querySelectorAll('.mag-tag-pill');
    magTagPills.forEach(pill => {
      const isMatching = pill.dataset.filter === filterValue;
      pill.classList.toggle('active', isMatching);
      
      const sphereContainer = pill.querySelector('.mag-tag-sphere-container');
      if (isMatching) {
        if (!sphereContainer) {
          const span = document.createElement('span');
          span.className = 'mag-tag-sphere-container';
          span.innerHTML = '<span class="pink-sphere small-sphere"></span>';
          pill.insertBefore(span, pill.firstChild);
        }
      } else {
        if (sphereContainer) {
          sphereContainer.remove();
        }
      }
    });
  }

  // Handle Category Tag Clicks using Event Delegation
  document.addEventListener('click', (e) => {
    const pill = e.target.closest('.mag-tag-pill');
    if (pill) {
      e.preventDefault();
      const filterValue = pill.dataset.filter;
      syncMagazineTags(filterValue);
      
      // Filter secondary article cards
      const articleCards = document.querySelectorAll('.magazine-card, .mag-mobile-row-card');
      articleCards.forEach(card => {
        const isMatch = (filterValue === 'all') || (card.dataset.category === filterValue);
        card.style.display = isMatch ? '' : 'none';
      });
      
      // Toggle featured hero cards (hide when filtering specific categories)
      const featuredCards = document.querySelectorAll('.magazine-featured-card, .magazine-mobile-featured-card');
      featuredCards.forEach(card => {
        card.style.display = (filterValue === 'all') ? '' : 'none';
      });
    }
  });

  // --- Article Reader View Controller ---
  const readerBackBtn = document.getElementById('reader-back-btn');
  const readerMobBackBtn = document.getElementById('reader-mob-back-btn');
  
  const readerViewCategory = document.getElementById('reader-view-category');
  const readerViewReadTime = document.getElementById('reader-view-read-time');
  const readerViewDate = document.getElementById('reader-view-date');
  const readerViewTitle = document.getElementById('reader-view-title');
  const readerViewIntro = document.getElementById('reader-view-intro');
  const readerViewCover = document.getElementById('reader-view-cover');
  const readerViewCaption = document.getElementById('reader-view-caption');
  const readerViewBody = document.getElementById('reader-view-body');
  const readerViewDownloadBtn = document.getElementById('reader-view-download-btn');
  
  const sideLikeBtn = document.getElementById('side-like-btn');
  const sideLikeCount = document.getElementById('side-like-count');
  const sideCommentBtn = document.getElementById('side-comment-btn');
  const sideCommentCount = document.getElementById('side-comment-count');
  const sideSaveBtn = document.getElementById('side-save-btn');
  const sideSaveLabel = document.getElementById('side-save-label');
  
  const mobLikeBtn = document.getElementById('mob-like-btn');
  const mobLikeCount = document.getElementById('mob-like-count');
  const mobCommentBtn = document.getElementById('mob-comment-btn');
  const mobCommentCount = document.getElementById('mob-comment-count');

  // Handle article card clicks using Event Delegation
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.magazine-featured-card, .magazine-mobile-featured-card, .magazine-card, .mag-mobile-row-card');
    if (card) {
      e.preventDefault();
      const articleId = card.dataset.articleId;
      try {
        const response = await fetch(`/api/articles/${articleId}`);
        if (!response.ok) throw new Error('Failed to fetch article details');
        const article = await response.json();
        
        activeArticleId = articleId;

        // Populate elements contents
        readerViewCategory.textContent = article.category;
        readerViewReadTime.textContent = article.readTime;
        readerViewDate.textContent = article.publishDate;
        readerViewTitle.textContent = article.title;
        readerViewIntro.textContent = article.intro;
        readerViewCover.src = article.image;
        readerViewCover.alt = article.title;
        readerViewCaption.textContent = article.caption;
        
        // Render paragraphs with headlines
        readerViewBody.innerHTML = '';
        article.paragraphs.forEach(para => {
          if (para.startsWith('<h2>')) {
            const h2 = document.createElement('h2');
            h2.innerHTML = para.replace('<h2>', '').replace('</h2>', '');
            readerViewBody.appendChild(h2);
          } else if (para.startsWith('<blockquote')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = para;
            readerViewBody.appendChild(tempDiv.firstChild);
          } else {
            const pEl = document.createElement('p');
            pEl.textContent = para;
            readerViewBody.appendChild(pEl);
          }
        });

        // Set likes & comments metrics
        const likesStr = formatLikesCount(article.likes);
        sideLikeCount.textContent = likesStr;
        mobLikeCount.textContent = likesStr;
        sideCommentCount.textContent = 'x' + article.comments;
        mobCommentCount.textContent = 'x' + article.comments;

        // Toggle Like states
        const heartIcons = document.querySelectorAll('.heart-icon');
        heartIcons.forEach(icon => {
          icon.classList.toggle('active', article.liked);
        });
        sideLikeBtn.classList.toggle('liked', article.liked);
        mobLikeBtn.classList.toggle('liked', article.liked);

        // Toggle Save states
        sideSaveBtn.classList.toggle('saved', article.saved);
        sideSaveLabel.textContent = article.saved ? 'Saved' : 'Save';

        // Transition viewport to magazine-reader
        selectCategory('magazine-reader');

        // Smooth scroll main dashboard view container to the top
        const mainContainer = document.querySelector('.dashboard-main');
        if (mainContainer) {
          mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (err) {
        console.error('Error opening article:', err);
        showToast('Error', 'Failed to load article contents from the grid.');
      }
    }
  });

  // Toggle Likes status
  async function toggleArticleLike() {
    if (!activeArticleId) return;
    try {
      const response = await fetch(`/api/articles/${activeArticleId}/like`, { method: 'POST' });
      if (response.ok) {
        const resData = await response.json();
        
        const likesStr = formatLikesCount(resData.likes);
        if (sideLikeCount) sideLikeCount.textContent = likesStr;
        if (mobLikeCount) mobLikeCount.textContent = likesStr;
        
        const heartIcons = document.querySelectorAll('.heart-icon');
        heartIcons.forEach(icon => {
          icon.classList.toggle('active', resData.liked);
        });
        if (sideLikeBtn) sideLikeBtn.classList.toggle('liked', resData.liked);
        if (mobLikeBtn) mobLikeBtn.classList.toggle('liked', resData.liked);
        
        if (resData.liked) {
          showToast('Liked Article', `You liked this article.`);
        } else {
          showToast('Unliked Article', `Removed like from this article.`);
        }
      }
    } catch (err) {
      console.error('Error liking article:', err);
    }
  }

  // Toggle Bookmark status
  async function toggleArticleSave() {
    if (!activeArticleId) return;
    try {
      const response = await fetch(`/api/articles/${activeArticleId}/save`, { method: 'POST' });
      if (response.ok) {
        const resData = await response.json();
        
        if (sideSaveBtn) sideSaveBtn.classList.toggle('saved', resData.saved);
        if (sideSaveLabel) sideSaveLabel.textContent = resData.saved ? 'Saved' : 'Save';
        
        if (resData.saved) {
          showToast('Saved to Reading List', `Saved to reading bookmarks.`);
        } else {
          showToast('Removed Bookmark', `Removed from reading list.`);
        }
      }
    } catch (err) {
      console.error('Error saving article:', err);
    }
  }

  // Bind clicks on heart likes icons
  [sideLikeBtn, mobLikeBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleArticleLike();
      });
    }
  });

  // Bind click on Save bookmark icon
  if (sideSaveBtn) {
    sideSaveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleArticleSave();
    });
  }

  // Bind image card download button
  if (readerViewDownloadBtn) {
    readerViewDownloadBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeArticleId) return;
      try {
        const response = await fetch(`/api/articles/${activeArticleId}`);
        if (response.ok) {
          const article = await response.json();
          const a = document.createElement('a');
          a.href = article.image;
          a.download = article.image.split('/').pop();
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          showToast('Downloading Image', `Saving high-res visual cover "${article.caption}"...`);
        }
      } catch (err) {
        console.error('Error downloading article cover:', err);
      }
    });
  }

  // Bind back buttons to return to the Magazine Hub
  [readerBackBtn, readerMobBackBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectCategory('magazine');
      });
    }
  });

  // --- DISCUSSION COMMENTS ENGINE CONTROLLER ---
  const discussionDrawer = document.getElementById('discussion-drawer');
  const commentsListContainer = document.getElementById('comments-list-container');
  const closeDiscussionBtn = document.getElementById('close-discussion-btn');
  const commentSubmitForm = document.getElementById('comment-submit-form');
  const commentInputText = document.getElementById('comment-input-text');
  const drawerCommentCount = document.getElementById('drawer-comment-count');

  function openDiscussionDrawer() {
    if (!activeArticleId) return;
    discussionDrawer.classList.add('active');
    renderDiscussionComments(activeArticleId);
  }

  function closeDiscussionDrawer() {
    discussionDrawer.classList.remove('active');
  }

  async function renderDiscussionComments(articleId) {
    try {
      const response = await fetch(`/api/articles/${articleId}`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      const article = await response.json();

      // Update count in header
      drawerCommentCount.textContent = article.comments;

      // Clear list
      commentsListContainer.innerHTML = '';

      if (!article.commentsList || article.commentsList.length === 0) {
        commentsListContainer.innerHTML = '<p class="empty-comments" style="text-align: center; color: var(--text-light-gray); padding: 40px 0; font-weight: 500; font-size: 13px;">No comments yet. Be the first to join the conversation!</p>';
        return;
      }

      // Render cards
      article.commentsList.forEach(comment => {
        const card = document.createElement('div');
        card.className = 'comment-card';
        card.innerHTML = `
          <div class="comment-header">
            <div class="comment-user-info">
              <img src="${comment.avatar}" alt="${escapeHtml(comment.username)}" class="comment-avatar">
              <span class="comment-username">${escapeHtml(comment.username)}</span>
            </div>
            <span class="comment-timestamp">${escapeHtml(comment.time)}</span>
          </div>
          <p class="comment-text">${escapeHtml(comment.text)}</p>
          <div class="comment-footer">
            <button class="comment-heart-capsule ${comment.liked ? 'active' : ''}" data-comment-id="${comment.id}">
              <svg class="comment-heart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span class="comment-heart-count">${comment.likes}</span>
            </button>
          </div>
        `;

        // Hook up like toggle event inside card
        const likeBtn = card.querySelector('.comment-heart-capsule');
        likeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleCommentLike(articleId, comment.id, likeBtn);
        });

        commentsListContainer.appendChild(card);
      });
    } catch (err) {
      console.error('Error rendering comments:', err);
    }
  }

  let likedCommentsSet = new Set();
  function toggleCommentLike(articleId, commentId, likeBtn) {
    const active = likedCommentsSet.has(commentId);
    const countSpan = likeBtn.querySelector('.comment-heart-count');
    let currentCount = parseInt(countSpan.textContent);
    
    if (active) {
      likedCommentsSet.delete(commentId);
      likeBtn.classList.remove('active');
      countSpan.textContent = Math.max(0, currentCount - 1);
    } else {
      likedCommentsSet.add(commentId);
      likeBtn.classList.add('active');
      countSpan.textContent = currentCount + 1;
      showToast('Comment Liked', 'You liked this comment.');
    }
  }

  // Bind comments buttons click triggers
  [sideCommentBtn, mobCommentBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDiscussionDrawer();
      });
    }
  });

  // Bind close events
  if (closeDiscussionBtn) {
    closeDiscussionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeDiscussionDrawer();
    });
  }

  if (discussionDrawer) {
    discussionDrawer.addEventListener('click', (e) => {
      if (e.target === discussionDrawer) {
        closeDiscussionDrawer();
      }
    });
  }

  // Bind submission form
  if (commentSubmitForm) {
    commentSubmitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeArticleId) return;

      const commentText = commentInputText.value.trim();
      if (!commentText) return;

      try {
        const response = await fetch(`/api/articles/${activeArticleId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: commentText })
        });
        if (response.ok) {
          const resData = await response.json();
          
          // Update counters globally
          if (sideCommentCount) sideCommentCount.textContent = 'x' + resData.commentsCount;
          if (mobCommentCount) mobCommentCount.textContent = 'x' + resData.commentsCount;

          // Render and reset
          renderDiscussionComments(activeArticleId);
          commentInputText.value = '';
          
          // Toast notification
          showToast('Comment Published', 'Your developer response has been successfully posted.');

          // Scroll comments area to top
          commentsListContainer.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const resData = await response.json().catch(() => ({}));
          showToast('Comment Failed', resData.error || 'Failed to publish comment.');
        }
      } catch (err) {
        console.error('Error posting comment:', err);
      }
    });
  }

  // Bind Share button
  const sideShareBtn = document.getElementById('side-share-btn');
  if (sideShareBtn) {
    sideShareBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeArticleId) {
        navigator.clipboard.writeText(window.location.origin + '/magazine/' + activeArticleId)
          .then(() => showToast('Link Copied', 'Article link copied to clipboard.'))
          .catch(() => showToast('Share Error', 'Unable to copy link. Please try again.'));
      }
    });
  }

  // --- 16. WIRE RANKINGS DOWNLOADS & MOBILE NOTIFICATION ---
  function bindRankingsDownloads() {
    const desktopDlButtons = document.querySelectorAll('.rank-download-btn-wrapper');
    const mobileHeroButtons = document.querySelectorAll('.mob-rank-download-btn');
    const mobileRowButtons = document.querySelectorAll('.mob-rank-row-btn');

    const handleDownloadClick = (e, btn) => {
      e.preventDefault();
      e.stopPropagation();

      const parent = btn.closest('[data-wallpaper-id]');
      if (!parent) return;

      const wallpaperId = parent.getAttribute('data-wallpaper-id');
      const title = btn.getAttribute('data-name') || 'Wallpaper';

      if (wallpaperId) {
        const a = document.createElement('a');
        a.href = `/api/wallpapers/${wallpaperId}/download`;
        a.download = `${wallpaperId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Downloading Wallpaper', `Saving high-resolution "${title}" in 4K...`);

        setTimeout(() => {
          updateLocalStats();
        }, 1000);
      }
    };

    desktopDlButtons.forEach(btn => {
      btn.addEventListener('click', (e) => handleDownloadClick(e, btn));
    });

    mobileHeroButtons.forEach(btn => {
      btn.addEventListener('click', (e) => handleDownloadClick(e, btn));
    });

    mobileRowButtons.forEach(btn => {
      btn.addEventListener('click', (e) => handleDownloadClick(e, btn));
    });

    // Bind Rankings Mobile Notification Button to Toggle Notification Dropdown panel
    const rankingsMobileNotifBtn = document.getElementById('rankings-mobile-notification-btn');
    if (rankingsMobileNotifBtn) {
      rankingsMobileNotifBtn.addEventListener('click', toggleNotifPanel);
    }
  }

  // --- 17. BROWSE FAVORITES PAGE DYNAMIC LOAD & ZIP ---
  async function loadFavoritesPage() {
    const favoritesGrid = document.getElementById('favorites-grid-element');
    const favCountDesktop = document.getElementById('fav-count-desktop');
    const favCountMobile = document.getElementById('fav-count-mobile');
    
    if (!favoritesGrid) return;

    favoritesGrid.innerHTML = '';

    try {
      const response = await fetch('/api/wallpapers?category=favorites');
      if (!response.ok) throw new Error('API favorites query error');

      const favs = await response.json();

      // Update counters dynamically matching mockup exactly
      if (favCountDesktop) favCountDesktop.textContent = `${favs.length} items saved to this device`;
      if (favCountMobile) favCountMobile.textContent = `${favs.length} items saved`;

      if (favs.length === 0) {
        favoritesGrid.innerHTML = `
          <div class="empty-state-fav" style="grid-column: span 4; text-align: center; padding: 48px 0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-light-gray)" stroke-width="2" style="width: 48px; height: 48px; margin-bottom: 12px; margin-left: auto; margin-right: auto; display: block;">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <h3 style="font-family: 'Inter Tight', sans-serif; font-size: 16px; font-weight: 800; color: var(--text-charcoal); margin: 0;">No Favorites Yet</h3>
            <p style="font-size: 12px; color: var(--text-light-gray); margin-top: 4px;">Select the heart icon on any wallpaper to curate your custom portfolio.</p>
          </div>
        `;
        return;
      }

      favs.forEach(w => {
        const card = document.createElement('div');
        card.className = 'fav-card';
        card.dataset.id = w.id;
        card.innerHTML = `
          <div class="fav-card-image-wrapper">
            <img src="${w.image}" alt="${w.title}" class="fav-card-img">
          </div>
          <div class="fav-card-footer">
            <div class="fav-card-meta">
              <span class="fav-card-title">${w.title}</span>
              <button class="fav-card-heart-btn active" type="button" title="Remove from Favorites">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
            </div>
            <button class="fav-card-dl-btn" type="button" data-name="${w.title}" title="Download 4K Wallpaper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
        `;

        // Bind Remove from Favorites Heart Click Action
        const heartBtn = card.querySelector('.fav-card-heart-btn');
        heartBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          try {
            const res = await fetch('/api/favorites', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: w.id })
            });
            if (res.ok) {
              const resData = await res.json();
              if (!resData.isFavorited) {
                showToast('Removed from Favorites', `You removed "${w.title}" from your saves.`);
                loadFavoritesPage(); // Dynamically reload grid to show updated items list
              }
            }
          } catch (err) {
            console.error('Error toggling favorite in Favorites view:', err);
          }
        });

        // Bind Download button
        const dlBtn = card.querySelector('.fav-card-dl-btn');
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const a = document.createElement('a');
          a.href = `/api/wallpapers/${w.id}/download`;
          a.download = `${w.id}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          showToast('Downloading Wallpaper', `Saving high-resolution "${w.title}" in 4K...`);
          setTimeout(() => {
            updateLocalStats();
          }, 1000);
        });

        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) {
            return;
          }
          showWallpaperDetails(w.id);
        });

        favoritesGrid.appendChild(card);
      });
      bindFavoritesEvents();
    } catch (err) {
      console.error('Error fetching favorites list:', err);
    }
  }

  // Bind ZIP package downloads
  function bindFavoritesEvents() {
    const desktopZip = document.getElementById('fav-zip-btn');
    const mobileZip = document.getElementById('fav-mobile-zip-btn');

    const handleZipClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Select active card elements to display exact dynamic count in the toast
      const favCards = document.querySelectorAll('.fav-card');
      const count = favCards.length;

      if (count === 0) {
        showToast('Download Error', 'No favorited wallpapers to package.');
        return;
      }

      downloadZipPacks(
        '/api/favorites/zip',
        'my_favorites_pack.zip',
        'Downloading Favorites ZIP',
        `Downloading your Favorites pack (${count} Wallpapers, 4K)...`
      );
    };

    if (desktopZip) {
      const newDesktopZip = desktopZip.cloneNode(true);
      desktopZip.parentNode.replaceChild(newDesktopZip, desktopZip);
      newDesktopZip.addEventListener('click', handleZipClick);
    }
    if (mobileZip) {
      const newMobileZip = mobileZip.cloneNode(true);
      mobileZip.parentNode.replaceChild(newMobileZip, mobileZip);
      newMobileZip.addEventListener('click', handleZipClick);
    }
  }

  // --- 18. COMMUNITY PULSE WIDGET & SIMULATED TICKER FUNCTIONS ---
  let isCommunityViewInitialized = false;
  let activityTickerInterval = null;

  async function initCommunityView() {
    // Sync responsive layout blocks explicitly
    const mobLayout = document.querySelector('.community-mobile-layout');
    const deskLayout = document.querySelector('.community-desktop-layout');
    if (window.innerWidth <= 900) {
      if (mobLayout) mobLayout.style.setProperty('display', 'block', 'important');
      if (deskLayout) deskLayout.style.setProperty('display', 'none', 'important');
    } else {
      if (mobLayout) mobLayout.style.setProperty('display', 'none', 'important');
      if (deskLayout) deskLayout.style.setProperty('display', 'block', 'important');
    }

    try {
      const response = await fetch('/api/community/pulse');
      if (!response.ok) throw new Error('Failed to fetch community pulse');
      const pulse = await response.json();

      pollVotes = pulse.pollVotes;
      metricDownloads = pulse.downloads;
      metricUpvotes = pulse.upvotes;
      metricMembers = pulse.members;
      currentActivities = pulse.activities;

      // Render initial stream
      renderActivityStream();
      updatePollUI(false);
    } catch (err) {
      console.error('Error initializing community view:', err);
    }

    if (isCommunityViewInitialized) return;
    isCommunityViewInitialized = true;

    // Bind upvote poll buttons
    const pollButtons = document.querySelectorAll('.poll-vote-btn');
    pollButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const themeIdx = parseInt(btn.getAttribute('data-theme-index'));
        const themes = ["Vanguard Mech Theme", "Shibuya Street Theme", "Retro Anime Theme"];
        
        try {
          const response = await fetch('/api/community/poll/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ themeIndex: themeIdx })
          });
          if (response.ok) {
            const resData = await response.json();
            pollVotes = resData.pollVotes;
            metricUpvotes = resData.totalUpvotes;
            
            updatePollUI(true);
            showToast('Vote Registered', `Thank you for supporting ${themes[themeIdx]}!`);
          }
        } catch (err) {
          console.error('Error submitting vote:', err);
        }
      });
    });

    // Start live tickers
    runLiveActivityTicker();
  }

  function updatePollUI(animate = true) {
    const totalVotes = pollVotes[0] + pollVotes[1] + pollVotes[2];
    
    // Recalculate percentages
    const pct0 = Math.round((pollVotes[0] / totalVotes) * 100);
    const pct1 = Math.round((pollVotes[1] / totalVotes) * 100);
    const pct2 = 100 - pct0 - pct1; // to ensure they always sum to exactly 100%

    // Update text labels
    const desktopPct0 = document.getElementById('desktop-pct-0');
    const desktopPct1 = document.getElementById('desktop-pct-1');
    const desktopPct2 = document.getElementById('desktop-pct-2');
    const mobilePct0 = document.getElementById('mobile-pct-0');
    const mobilePct1 = document.getElementById('mobile-pct-1');
    const mobilePct2 = document.getElementById('mobile-pct-2');

    if (desktopPct0) desktopPct0.textContent = pct0 + '%';
    if (desktopPct1) desktopPct1.textContent = pct1 + '%';
    if (desktopPct2) desktopPct2.textContent = pct2 + '%';
    if (mobilePct0) mobilePct0.textContent = pct0 + '%';
    if (mobileMetricUpvotes) mobileMetricUpvotes.textContent = (metricUpvotes + (totalVotes - initialTotalPollVotes)).toLocaleString(); // fallback sync
    if (mobilePct1) mobilePct1.textContent = pct1 + '%';
    if (mobilePct2) mobilePct2.textContent = pct2 + '%';

    // Update progress fills
    const desktopFill0 = document.getElementById('desktop-fill-0');
    const desktopFill1 = document.getElementById('desktop-fill-1');
    const desktopFill2 = document.getElementById('desktop-fill-2');
    const mobileFill0 = document.getElementById('mobile-fill-0');
    const mobileFill1 = document.getElementById('mobile-fill-1');
    const mobileFill2 = document.getElementById('mobile-fill-2');

    if (desktopFill0) desktopFill0.style.width = pct0 + '%';
    if (desktopFill1) desktopFill1.style.width = pct1 + '%';
    if (desktopFill2) desktopFill2.style.width = pct2 + '%';
    if (mobileFill0) mobileFill0.style.width = pct0 + '%';
    if (mobileFill1) mobileFill1.style.width = pct1 + '%';
    if (mobileFill2) mobileFill2.style.width = pct2 + '%';

    // Update TOTAL UPVOTES metric in top widgets
    if (desktopMetricUpvotes) desktopMetricUpvotes.textContent = metricUpvotes.toLocaleString();
    if (mobileMetricUpvotes) mobileMetricUpvotes.textContent = metricUpvotes.toLocaleString();
    
    if (desktopMetricDownloads) desktopMetricDownloads.textContent = metricDownloads.toLocaleString();
    if (mobileMetricDownloads) mobileMetricDownloads.textContent = metricDownloads.toLocaleString();
    if (desktopMetricMembers) desktopMetricMembers.textContent = metricMembers.toLocaleString();
    if (mobileMetricMembers) mobileMetricMembers.textContent = metricMembers.toLocaleString();
  }

  function renderActivityStream() {
    const desktopGrid = document.getElementById('desktop-activity-grid');
    const mobileList = document.getElementById('mobile-activity-list');

    if (desktopGrid) {
      desktopGrid.innerHTML = '';
      currentActivities.forEach(item => {
        const isDownload = item.action === 'downloaded';
        const badgeSvg = isDownload ? `
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-pink)" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        ` : `
          <svg viewBox="0 0 24 24" fill="var(--accent-pink)" stroke="var(--accent-pink)" stroke-width="1">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        `;

        const card = document.createElement('div');
        card.className = 'activity-card clay-outset';
        card.innerHTML = `
          <div class="activity-badge-overlay">
            ${badgeSvg}
          </div>
          <div class="activity-img-wrapper">
            <img src="${item.wallpaper}" alt="${item.target}" class="activity-img" loading="lazy">
          </div>
          <div class="activity-info">
            <span class="activity-user-action">${item.user} ${item.action}</span>
            <h3 class="activity-wallpaper-title">${item.target}</h3>
            <span class="activity-time">${item.time}</span>
          </div>
        `;
        desktopGrid.appendChild(card);
      });
    }

    if (mobileList) {
      mobileList.innerHTML = '';
      currentActivities.forEach(item => {
        const isDownload = item.action === 'downloaded';
        const badgeSvg = isDownload ? `
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-charcoal)" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        ` : `
          <svg viewBox="0 0 24 24" fill="var(--text-charcoal)" stroke="var(--text-charcoal)" stroke-width="1">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        `;

        const row = document.createElement('div');
        row.className = 'mobile-activity-row clay-outset';
        row.innerHTML = `
          <div class="mobile-activity-img-wrapper">
            <img src="${item.wallpaper}" alt="${item.target}" class="mobile-activity-img" loading="lazy">
          </div>
          <div class="mobile-activity-details">
            <span class="mobile-activity-action">${item.user} ${item.action}</span>
            <h3>${item.target}</h3>
            <span class="mobile-activity-time">${item.time}</span>
          </div>
          <div class="mobile-activity-badge metric-icon-circle inset-circle">
            ${badgeSvg}
          </div>
        `;
        mobileList.appendChild(row);
      });
    }
  }

  function runLiveActivityTicker() {
    if (activityTickerInterval) return;

    activityTickerInterval = setInterval(async () => {
      if (currentCategory !== 'community') return;

      try {
        const response = await fetch('/api/community/pulse');
        if (response.ok) {
          const pulse = await response.json();
          pollVotes = pulse.pollVotes;
          metricDownloads = pulse.downloads;
          metricUpvotes = pulse.upvotes;
          metricMembers = pulse.members;
          currentActivities = pulse.activities;

          renderActivityStream();
          updatePollUI(false);
        }
      } catch (err) {
        console.error('Error fetching live activity ticker:', err);
      }
    }, 6000);
  }

  // --- 19. PREMIUM ASYNC ZIP PACK DOWNLOAD PIPELINE ---
  async function downloadZipPacks(apiUrl, filename, toastTitle, toastMsg) {
    showToast(toastTitle, `${toastMsg} - preparing packaging...`);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      window.URL.revokeObjectURL(objectUrl);
      showToast(toastTitle, `${filename} successfully downloaded.`);
      updateLocalStats();
    } catch (err) {
      console.error('Error downloading pack:', err);
      showToast('Download Failed', `Could not download ${filename}. ${err.message}`);
    }
  }

  // --- 20. DOWNLOAD HISTORY RELATIVE TIMESTAMP CALCULATOR ---
  function formatRelativeTime(isoString) {
    if (!isoString) return 'recently';
    const date = new Date(isoString);
    const now = new Date();
    const deltaMs = now - date;
    const deltaSeconds = Math.round(deltaMs / 1000);
    const deltaMinutes = Math.round(deltaSeconds / 60);
    const deltaHours = Math.round(deltaMinutes / 60);
    const deltaDays = Math.round(deltaHours / 24);

    if (deltaSeconds < 60) {
      return 'just now';
    } else if (deltaMinutes < 60) {
      return `${deltaMinutes} minute${deltaMinutes > 1 ? 's' : ''} ago`;
    } else if (deltaHours < 24) {
      return `${deltaHours} hour${deltaHours > 1 ? 's' : ''} ago`;
    } else {
      return `${deltaDays} day${deltaDays > 1 ? 's' : ''} ago`;
    }
  }

  // --- 21. PREMIUM DOWNLOAD HISTORY DYNAMIC VIEWS CONTROLLER ---
  async function loadHistoryPage() {
    const historyGrid = document.getElementById('history-grid-element');
    const historyEmpty = document.getElementById('history-empty-element');
    const historyCountDesktop = document.getElementById('history-count-desktop');
    const historyCountMobile = document.getElementById('history-count-mobile');

    if (!historyGrid) return;

    historyGrid.innerHTML = '';

    try {
      const response = await fetch('/api/wallpapers?category=history');
      if (!response.ok) throw new Error('API history query error');

      const historyData = await response.json();

      if (historyCountDesktop) {
        historyCountDesktop.textContent = `Showing your last ${historyData.length} downloaded assets · May 2026`;
      }
      if (historyCountMobile) {
        historyCountMobile.textContent = `Last ${historyData.length} downloaded assets`;
      }

      if (historyData.length === 0) {
        if (historyEmpty) historyEmpty.style.display = 'flex';
        historyGrid.style.display = 'none';
        return;
      }

      if (historyEmpty) historyEmpty.style.display = 'none';
      historyGrid.style.display = 'grid';

      historyData.forEach(w => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.dataset.id = w.id;
        
        const relativeTime = formatRelativeTime(w.downloadedAt);

        card.innerHTML = `
          <div class="history-card-image-wrapper">
            <img src="${w.image}" alt="${w.title}" class="history-card-img">
          </div>
          <div class="history-card-footer">
            <div class="history-card-details">
              <span class="history-card-title">${w.title}</span>
              <span class="history-card-time">${relativeTime}</span>
            </div>
            <button class="history-card-dl-btn" type="button" data-name="${w.title}" title="Download 4K Wallpaper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
        `;

        // Bind Download button
        const dlBtn = card.querySelector('.history-card-dl-btn');
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const a = document.createElement('a');
          a.href = `/api/wallpapers/${w.id}/download`;
          a.download = `${w.id}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          showToast('Downloading Wallpaper', `Saving high-resolution "${w.title}" in 4K...`);
          setTimeout(() => {
            updateLocalStats();
            // Refresh history view list to update relative time / order immediately
            loadHistoryPage();
          }, 1200);
        });

        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) {
            return;
          }
          showWallpaperDetails(w.id);
        });

        historyGrid.appendChild(card);
      });
    } catch (err) {
      console.error('Error fetching history list:', err);
    }
  }

  // --- 22. HISTORY CLEARDOWN ENDPOINT CONTROLLER ---
  function bindHistoryEvents() {
    const desktopClear = document.getElementById('history-clear-btn');
    const mobileClear = document.getElementById('history-mobile-clear-btn');

    const handleClearClick = async (e) => {
      e.preventDefault();
      
      const confirmClear = confirm('Are you sure you want to clear your entire download history?');
      if (!confirmClear) return;

      try {
        const response = await fetch('/api/history/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          showToast('History Cleared', 'Your download history was successfully wiped.');
          loadHistoryPage();
          updateLocalStats();
        } else {
          showToast('Error', 'Failed to clear download history.');
        }
      } catch (err) {
        console.error('Error clearing history:', err);
        showToast('Error', 'Failed to clear history.');
      }
    };

    if (desktopClear) desktopClear.addEventListener('click', handleClearClick);
    if (mobileClear) mobileClear.addEventListener('click', handleClearClick);
  }

  // --- 23. SPA WALLPAPER DETAILS TERMINAL ---
  let simulatorTimer = null;

  async function showWallpaperDetails(id) {
    if (currentCategory !== 'details') {
      previousCategory = currentCategory;
    }

    try {
      const response = await fetch(`/api/wallpapers/${id}`);
      if (!response.ok) throw new Error('Failed to fetch wallpaper details');
      const w = await response.json();

      // Update basic fields
      const deskImg = document.getElementById('desktop-details-img');
      const mobImg = document.getElementById('mobile-details-img');
      if (deskImg) deskImg.src = w.image;
      if (mobImg) mobImg.src = w.image;

      const deskTitle = document.getElementById('desktop-details-title');
      const mobTitle = document.getElementById('mobile-details-title');
      if (deskTitle) deskTitle.textContent = w.title.toUpperCase();
      if (mobTitle) mobTitle.textContent = w.title.toUpperCase();

      const deskArtist = document.getElementById('desktop-details-artist');
      const mobArtist = document.getElementById('mobile-details-artist');
      if (deskArtist) deskArtist.textContent = w.artist;
      if (mobArtist) mobArtist.textContent = w.artist;

      // Update favorited state
      const deskFavBtn = document.getElementById('desktop-details-fav-btn');
      const mobFavBtn = document.getElementById('mobile-details-fav-btn');
      if (deskFavBtn) deskFavBtn.classList.toggle('favorited', w.isFavorited);
      if (mobFavBtn) mobFavBtn.classList.toggle('favorited', w.isFavorited);

      // Update statistics
      const deskSize = document.getElementById('desktop-stat-size');
      const mobSize = document.getElementById('mobile-stat-size');
      if (deskSize) deskSize.textContent = w.fileSize;
      if (mobSize) mobSize.textContent = w.fileSize;

      const deskRes = document.getElementById('desktop-stat-resolution');
      const mobRes = document.getElementById('mobile-stat-resolution');
      if (deskRes) deskRes.textContent = w.resolution;
      if (mobRes) mobRes.textContent = w.resolution;

      const deskRatio = document.getElementById('desktop-stat-ratio');
      const mobRatio = document.getElementById('mobile-stat-ratio');
      if (deskRatio) deskRatio.textContent = w.aspectRatio;
      if (mobRatio) mobRatio.textContent = w.aspectRatio;

      const deskDl = document.getElementById('desktop-stat-downloads');
      const mobDl = document.getElementById('mobile-stat-downloads');
      if (deskDl) deskDl.textContent = w.downloads.toLocaleString();
      if (mobDl) mobDl.textContent = formatLikesCount(w.downloads);

      // Extracted claymorphic specular palette spheres
      const paletteRows = [document.getElementById('desktop-palette-row'), document.getElementById('mobile-palette-row')];
      paletteRows.forEach(row => {
        if (!row) return;
        row.innerHTML = '';
        w.extractedPalette.forEach(color => {
          const sphereItem = document.createElement('div');
          sphereItem.className = 'palette-sphere-item';
          sphereItem.innerHTML = `
            <div class="palette-sphere" style="background-color: ${color};"></div>
            <span class="palette-hex">${color.toUpperCase()}</span>
          `;
          sphereItem.addEventListener('click', (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(color)
              .then(() => {
                showToast('Color Copied', `Hex code ${color.toUpperCase()} copied to clipboard successfully.`);
              })
              .catch(() => {
                showToast('Copy Error', 'Failed to copy hex code.');
              });
          });
          row.appendChild(sphereItem);
        });
      });

      // Render Dynamic Pill Tags
      const tagContainers = [document.getElementById('desktop-tags-container'), document.getElementById('mobile-tags-container')];
      tagContainers.forEach(container => {
        if (!container) return;
        container.innerHTML = '';
        w.tags.forEach(tagText => {
          const tagPill = document.createElement('span');
          tagPill.className = 'tag-pill';
          tagPill.textContent = tagText;
          tagPill.addEventListener('click', (e) => {
            e.preventDefault();
            const cleanTag = tagText.replace('#', '');
            
            // Sync active tags/search
            const matchingPill = Array.from(tagPills).find(p => p.dataset.anime.toLowerCase() === cleanTag.toLowerCase());
            if (matchingPill) {
              tagPills.forEach(p => p.classList.remove('active'));
              matchingPill.classList.add('active');
              activeTag = matchingPill.dataset.anime;
              currentSearch = '';
              searchInput.value = '';
              clearSearchBtn.style.display = 'none';
            } else {
              tagPills.forEach(p => p.classList.remove('active'));
              const allPill = Array.from(tagPills).find(p => p.dataset.anime === 'all');
              if (allPill) allPill.classList.add('active');
              activeTag = 'all';
              currentSearch = cleanTag;
              searchInput.value = cleanTag;
              clearSearchBtn.style.display = 'block';
            }
            
            selectCategory('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast('Tag Filter Applied', `Browsing premium wallpapers with tag "${tagText}"...`);
          });
          container.appendChild(tagPill);
        });
      });

      // Bind dynamic details button behaviors
      const bindFavButton = (btn) => {
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const response = await fetch('/api/favorites', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: w.id })
            });
            if (response.ok) {
              const resData = await response.json();
              document.getElementById('desktop-details-fav-btn').classList.toggle('favorited', resData.isFavorited);
              document.getElementById('mobile-details-fav-btn').classList.toggle('favorited', resData.isFavorited);
              
              updateLocalStats();
              if (resData.isFavorited) {
                showToast('Added to Favorites', `You favorited "${w.title}".`);
              } else {
                showToast('Removed Favorite', `Removed "${w.title}" from favorites.`);
              }
            }
          } catch (err) {
            console.error('Error toggling details favorite:', err);
          }
        });
      };

      bindFavButton(document.getElementById('desktop-details-fav-btn'));
      bindFavButton(document.getElementById('mobile-details-fav-btn'));

      const bindDlButton = (btn) => {
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const a = document.createElement('a');
          a.href = `/api/wallpapers/${w.id}/download`;
          a.download = `${w.id}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          showToast('Downloading Wallpaper', `Saving high-resolution "${w.title}" in 4K...`);
          w.downloads += 1;
          const deskDlVal = document.getElementById('desktop-stat-downloads');
          const mobDlVal = document.getElementById('mobile-stat-downloads');
          if (deskDlVal) deskDlVal.textContent = w.downloads.toLocaleString();
          if (mobDlVal) mobDlVal.textContent = formatLikesCount(w.downloads);
          
          setTimeout(() => {
            updateLocalStats();
          }, 1000);
        });
      };

      bindDlButton(document.getElementById('desktop-details-dl-btn'));
      bindDlButton(document.getElementById('mobile-details-dl-btn'));

      const bindBackButton = (btn) => {
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectCategory(previousCategory);
        });
      };

      bindBackButton(document.getElementById('desktop-details-back-btn'));
      bindBackButton(document.getElementById('mobile-details-back-btn'));

      const bindSimButton = (btnId, mode) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openSimulator(mode, w.image);
        });
      };

      bindSimButton('desktop-sim-desktop', 'desktop');
      bindSimButton('desktop-sim-mobile', 'mobile');
      bindSimButton('mobile-sim-desktop', 'desktop');
      bindSimButton('mobile-sim-mobile', 'mobile');

      selectCategory('details');

      // Scroll details container to top
      const mainContainer = document.querySelector('.dashboard-main');
      if (mainContainer) {
        mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }

    } catch (err) {
      console.error('Error loading wallpaper details view:', err);
    }
  }

  // --- 24. FULL-SCREEN SKEUOMORPHIC LIVE PREVIEW SIMULATOR ---
  function openSimulator(mode, imageUrl) {
    const overlay = document.getElementById('simulator-overlay');
    const monitorShell = document.getElementById('simulator-monitor-shell');
    const phoneShell = document.getElementById('simulator-phone-shell');
    const monitorScreen = document.getElementById('monitor-wallpaper-screen');
    const phoneScreen = document.getElementById('phone-wallpaper-screen');

    if (!overlay) return;

    if (simulatorTimer) {
      clearInterval(simulatorTimer);
      simulatorTimer = null;
    }

    // Set simulator shell display state
    overlay.style.display = 'flex';
    if (mode === 'desktop') {
      if (monitorShell) monitorShell.style.display = 'flex';
      if (phoneShell) phoneShell.style.display = 'none';
      if (monitorScreen) monitorScreen.style.backgroundImage = `url("${imageUrl}")`;
    } else {
      if (monitorShell) monitorShell.style.display = 'none';
      if (phoneShell) phoneShell.style.display = 'flex';
      if (phoneScreen) phoneScreen.style.backgroundImage = `url("${imageUrl}")`;
    }

    // Update time widgets recursively every second
    function updateSimulatorClocks() {
      const now = new Date();
      
      let hours12 = now.getHours();
      const ampm = hours12 >= 12 ? 'PM' : 'AM';
      hours12 = hours12 % 12;
      hours12 = hours12 ? hours12 : 12;
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const desktopTimeStr = `${hours12}:${minutes} ${ampm}`;
      
      const hours24 = String(now.getHours()).padStart(2, '0');
      const phoneTimeStr = `${hours24}:${minutes}`;
      
      const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      const weekdayStr = weekdays[now.getDay()];
      const monthStr = months[now.getMonth()];
      const dateStr = `${weekdayStr}, ${monthStr} ${now.getDate()}`;
      
      const desktopTimeEl = document.getElementById('desktop-taskbar-time');
      const phoneStatusTimeEl = document.getElementById('phone-status-time');
      const phoneLockClockEl = document.getElementById('phone-lock-clock');
      const phoneLockDateEl = document.getElementById('phone-lock-date');
      
      if (desktopTimeEl) desktopTimeEl.textContent = desktopTimeStr;
      if (phoneStatusTimeEl) phoneStatusTimeEl.textContent = phoneTimeStr;
      if (phoneLockClockEl) phoneLockClockEl.textContent = phoneTimeStr;
      if (phoneLockDateEl) phoneLockDateEl.textContent = dateStr;
    }

    updateSimulatorClocks();
    simulatorTimer = setInterval(updateSimulatorClocks, 1000);
  }

  function initSimulator() {
    const overlay = document.getElementById('simulator-overlay');
    const closeBtn = document.getElementById('simulator-close-btn');

    const dismissSimulator = () => {
      if (overlay) overlay.style.display = 'none';
      if (simulatorTimer) {
        clearInterval(simulatorTimer);
        simulatorTimer = null;
      }
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissSimulator();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          dismissSimulator();
        }
      });
    }
  }

  function bindRankingsDetails() {
    const rankingCards = document.querySelectorAll('.rankings-featured-hero, .ranking-row-card, .rankings-mobile-hero, .ranking-mob-row-card');
    rankingCards.forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a.rank-download-btn-wrapper')) {
          return;
        }
        
        const wallpaperId = card.getAttribute('data-wallpaper-id');
        if (wallpaperId) {
          showWallpaperDetails(wallpaperId);
        }
      });
    });
  }

  // --- 25. LEGAL & DMCA COPYRIGHT TAKEDOWN WIZARD ---
  let currentDmcaStep = 1;
  let dmcaUploadedFiles = [{ name: "copyright_certificate.pdf", size: "1.2 MB" }]; // initial mockup file

  // Navigation binders for settings dmca links
  const settingsDmcaLink = document.getElementById('settings-dmca-link');
  if (settingsDmcaLink) {
    settingsDmcaLink.addEventListener('click', (e) => {
      e.preventDefault();
      selectCategory('dmca');
    });
  }

  const settingsPrivacyLink = document.getElementById('settings-privacy-link');
  if (settingsPrivacyLink) {
    settingsPrivacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      selectCategory('privacy');
    });
  }

  const privacyMobileBackBtn = document.getElementById('privacy-mobile-back-btn');
  if (privacyMobileBackBtn) {
    privacyMobileBackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      selectCategory('settings');
    });
  }

  function initDmcaWizard() {
    currentDmcaStep = 1;
    updateMobileStepperUI();
    
    // Clear inputs if fresh
    const desktopUrl = document.getElementById('dmca-desktop-url');
    const desktopDesc = document.getElementById('dmca-desktop-desc');
    const desktopSwear = document.getElementById('dmca-desktop-swear');
    const mobileUrl = document.getElementById('dmca-mobile-url');
    const mobileDesc = document.getElementById('dmca-mobile-desc');
    const mobileSwear = document.getElementById('dmca-mobile-swear');

    if (desktopUrl) desktopUrl.value = '';
    if (desktopDesc) desktopDesc.value = '';
    if (desktopSwear) desktopSwear.checked = false;
    if (mobileUrl) mobileUrl.value = '';
    if (mobileDesc) mobileDesc.value = '';
    if (mobileSwear) mobileSwear.checked = false;

    // Reset checkboxes visually
    const desktopCheckbox = document.querySelector('#dmca-desktop-swear + .custom-checkbox');
    if (desktopCheckbox) {
      desktopCheckbox.classList.remove('active');
    }
    const mobileCheckbox = document.querySelector('#dmca-mobile-swear + .custom-checkbox');
    if (mobileCheckbox) {
      mobileCheckbox.classList.remove('active');
    }

    // Refresh uploaded grids
    renderUploadedFiles();
  }

  // Mobile Stepper Stepping Logic
  function updateMobileStepperUI() {
    // Hide all step panels
    const stepPanels = document.querySelectorAll('.dmca-mobile-step-container');
    stepPanels.forEach(p => p.classList.remove('active'));

    // Show current panel
    const currentPanel = document.getElementById(`dmca-mobile-step-${currentDmcaStep}`);
    if (currentPanel) currentPanel.classList.add('active');

    // Update Step circle classes & dots
    for (let i = 1; i <= 3; i++) {
      const node = document.getElementById(`step-node-${i}`);
      const line = document.getElementById(`step-line-${i}`);
      const dot = node ? node.querySelector('.active-dot-indicator') : null;

      if (!node) continue;

      const circle = node.querySelector('.step-circle');
      if (!circle) continue;

      if (i < currentDmcaStep) {
        // Completed step
        node.classList.add('completed');
        node.classList.remove('active');
        circle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        if (line) line.classList.add('active');
        if (dot) dot.style.display = 'none';
      } else if (i === currentDmcaStep) {
        // Active step
        node.classList.add('active');
        node.classList.remove('completed');
        circle.textContent = i;
        if (line) line.classList.remove('active');
        if (dot) dot.style.display = 'block';
      } else {
        // Inactive step
        node.classList.remove('active', 'completed');
        circle.textContent = i;
        if (line) line.classList.remove('active');
        if (dot) dot.style.display = 'none';
      }
    }
  }

  // Focus highlighters for DMCA input groups
  const dmcaInputs = document.querySelectorAll('#dmca-view .settings-input, #dmca-view .settings-textarea');
  dmcaInputs.forEach(input => {
    input.addEventListener('focus', () => {
      const group = input.closest('.dmca-input-group');
      if (group) group.classList.add('active-focus');
    });
    input.addEventListener('blur', () => {
      const group = input.closest('.dmca-input-group');
      if (group) group.classList.remove('active-focus');
    });
  });

  // Custom Skeuomorphic Checkbox Toggles
  const dmcaSwearInputs = document.querySelectorAll('#dmca-desktop-swear, #dmca-mobile-swear');
  dmcaSwearInputs.forEach(cb => {
    cb.addEventListener('change', () => {
      const customBox = cb.nextElementSibling;
      if (customBox && customBox.classList.contains('custom-checkbox')) {
        customBox.classList.toggle('active', cb.checked);
      }
    });
  });

  // File Upload Simulators
  const setupFileUpload = (boxId, fileInputId, progressWrapperId, progressFillId, filenameId, percentId) => {
    const box = document.getElementById(boxId);
    const input = document.getElementById(fileInputId);
    
    if (!box || !input) return;

    box.addEventListener('click', () => input.click());

    // Drag events
    box.addEventListener('dragover', (e) => {
      e.preventDefault();
      box.classList.add('dragover');
    });

    box.addEventListener('dragleave', () => {
      box.classList.remove('dragover');
    });

    box.addEventListener('drop', (e) => {
      e.preventDefault();
      box.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        handleSelectedFiles(e.dataTransfer.files, progressWrapperId, progressFillId, filenameId, percentId);
      }
    });

    input.addEventListener('change', () => {
      if (input.files.length) {
        handleSelectedFiles(input.files, progressWrapperId, progressFillId, filenameId, percentId);
      }
    });
  };

  const handleSelectedFiles = (filesList, progressWrapperId, progressFillId, filenameId, percentId) => {
    const wrapper = document.getElementById(progressWrapperId);
    const fill = document.getElementById(progressFillId);
    const filenameLabel = document.getElementById(filenameId);
    const percentLabel = document.getElementById(percentId);

    if (!wrapper || !fill) return;

    const file = filesList[0];
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    
    filenameLabel.textContent = `uploading "${file.name}"...`;
    percentLabel.textContent = "0%";
    fill.style.width = "0%";
    wrapper.style.display = 'block';

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/dmca/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        percentLabel.textContent = `${pct}%`;
        fill.style.width = `${pct}%`;
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          wrapper.style.display = 'none';
          
          dmcaUploadedFiles.push({
            name: file.name,
            size: `${sizeMB} MB`,
            path: res.filePath
          });
          
          renderUploadedFiles();
          showToast('File Uploaded', `Successfully uploaded cryptographic proof "${file.name}".`);
        } catch (err) {
          console.error("Error parsing upload response:", err);
          showToast('Upload Error', 'Invalid response from upload server.');
        }
      } else {
        let errorMsg = 'Failed to upload file to grid node.';
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.error) errorMsg = res.error;
        } catch (err) {}
        showToast('Upload Error', errorMsg);
      }
    };

    xhr.onerror = () => {
      showToast('Upload Error', 'Network error during file upload.');
    };

    xhr.send(formData);
  };

  // Render uploaded cards dynamically
  function renderUploadedFiles() {
    const deskGrid = document.getElementById('dmca-desktop-uploads-grid');
    const mobList = document.getElementById('dmca-mobile-uploads-list');

    const renderCard = (file) => {
      const card = document.createElement('div');
      card.className = 'uploaded-file-card';
      card.setAttribute('data-filename', file.name);
      card.innerHTML = `
        <div class="file-thumb-wrapper">
          <img src="/images/copyright_certificate.png" alt="File Thumbnail" class="file-thumb">
        </div>
        <div class="file-info-text">
          <span class="file-name">${file.name}</span>
          <span class="file-size-time">${file.size} · Uploaded just now</span>
        </div>
        <button class="file-delete-btn" type="button" title="Delete upload">
          <span>&times;</span>
        </button>
      `;

      // Bind delete handler
      card.querySelector('.file-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        dmcaUploadedFiles = dmcaUploadedFiles.filter(f => f.name !== file.name);
        renderUploadedFiles();
        showToast('Proof Removed', `Deleted verification document "${file.name}".`);
      });

      return card;
    };

    if (deskGrid) {
      deskGrid.innerHTML = '';
      if (dmcaUploadedFiles.length === 0) {
        deskGrid.innerHTML = '<div style="font-size: 12px; color: var(--text-gray); font-style: italic; padding: 12px 0;">No proof documents uploaded yet.</div>';
      } else {
        dmcaUploadedFiles.forEach(f => deskGrid.appendChild(renderCard(f)));
      }
    }

    if (mobList) {
      mobList.innerHTML = '';
      if (dmcaUploadedFiles.length === 0) {
        mobList.innerHTML = '<div style="font-size: 12px; color: var(--text-gray); font-style: italic; padding: 12px 0;">No proof documents uploaded yet.</div>';
      } else {
        dmcaUploadedFiles.forEach(f => mobList.appendChild(renderCard(f)));
      }
    }
  }

  // Setup upload zones
  setupFileUpload(
    'dmca-desktop-upload-box',
    'dmca-desktop-file-input',
    'dmca-desktop-progress-wrapper',
    'dmca-desktop-progress-fill',
    'dmca-desktop-progress-filename',
    'dmca-desktop-progress-percent'
  );
  setupFileUpload(
    'dmca-mobile-upload-box',
    'dmca-mobile-file-input',
    'dmca-mobile-progress-wrapper',
    'dmca-mobile-progress-fill',
    'dmca-mobile-progress-filename',
    'dmca-mobile-progress-percent'
  );

  // Mobile Back Button Handler
  const dmcaMobileBackBtn = document.getElementById('dmca-mobile-back-btn');
  if (dmcaMobileBackBtn) {
    dmcaMobileBackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentDmcaStep > 1) {
        currentDmcaStep--;
        updateMobileStepperUI();
      } else {
        selectCategory('settings');
      }
    });
  }

  // Mobile Next 1 Button: Target -> Proof
  const mobileNext1Btn = document.getElementById('dmca-mobile-next-1-btn');
  if (mobileNext1Btn) {
    mobileNext1Btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = document.getElementById('dmca-mobile-url').value.trim();
      const desc = document.getElementById('dmca-mobile-desc').value.trim();

      if (!url) {
        showToast('Validation Error', 'Please enter the infringing asset URL.');
        return;
      }
      if (!desc) {
        showToast('Validation Error', 'Please describe the copyright allegation details.');
        return;
      }

      // Sync to desktop inputs just in case
      const deskUrl = document.getElementById('dmca-desktop-url');
      const deskDesc = document.getElementById('dmca-desktop-desc');
      if (deskUrl) deskUrl.value = url;
      if (deskDesc) deskDesc.value = desc;

      currentDmcaStep = 2;
      updateMobileStepperUI();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Mobile Next 2 Button: Proof -> Swear
  const mobileNext2Btn = document.getElementById('dmca-mobile-next-2-btn');
  if (mobileNext2Btn) {
    mobileNext2Btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (dmcaUploadedFiles.length === 0) {
        showToast('Validation Error', 'Please upload at least one proof of ownership document.');
        return;
      }

      currentDmcaStep = 3;
      updateMobileStepperUI();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Submit DMCA Handler
  const submitTakedownRequest = async (infringingUrl, allegationDescription, swearSignature) => {
    if (!infringingUrl) {
      showToast('Validation Error', 'Please specify the infringing asset URL.');
      return;
    }
    if (!allegationDescription) {
      showToast('Validation Error', 'Please provide allegation details.');
      return;
    }
    if (!swearSignature) {
      showToast('Signature Required', 'You must agree to the perjury swear declaration before submitting.');
      return;
    }

    try {
      const response = await fetch('/api/dmca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          infringingUrl,
          allegationDescription,
          swearSignature,
          files: dmcaUploadedFiles
        })
      });

      if (response.ok) {
        const data = await response.json();
        showToast('Request Filed', 'Takedown request successfully filed for review.');
        
        // Show high-fidelity custom Neumorphic popup for successful claim
        showDmcaSuccessPopup(data.claimId);

        // Reset wizard
        initDmcaWizard();
        selectCategory('settings');
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast('Submission Error', errorData.error || 'Failed to register takedown request.');
      }
    } catch (err) {
      console.error('Error submitting DMCA:', err);
      showToast('Submission Error', 'Network error while registering claim.');
    }
  };

  // Bind Desktop Submit
  const deskSubmitBtn = document.getElementById('dmca-desktop-submit-btn');
  if (deskSubmitBtn) {
    deskSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = document.getElementById('dmca-desktop-url').value.trim();
      const desc = document.getElementById('dmca-desktop-desc').value.trim();
      const swear = document.getElementById('dmca-desktop-swear').checked;
      
      submitTakedownRequest(url, desc, swear);
    });
  }

  // Bind Mobile Submit
  const mobSubmitBtn = document.getElementById('dmca-mobile-submit-btn');
  if (mobSubmitBtn) {
    mobSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = document.getElementById('dmca-mobile-url').value.trim();
      const desc = document.getElementById('dmca-mobile-desc').value.trim();
      const swear = document.getElementById('dmca-mobile-swear').checked;
      
      submitTakedownRequest(url, desc, swear);
    });
  }

  // Custom Success Neumorphic modal overlay popup for DMCA
  function showDmcaSuccessPopup(claimId) {
    const popupOverlay = document.createElement('div');
    popupOverlay.className = 'modal-overlay active';
    popupOverlay.style.zIndex = '9999';
    popupOverlay.innerHTML = `
      <div class="modal-card" style="text-align: center; max-width: 420px; padding: 32px 24px;">
        <div style="background: rgba(255, 51, 102, 0.05); border: 2px solid #FF3366; border-radius: 50px; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 4px 12px rgba(255, 51, 102, 0.15);">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FF3366" stroke-width="3" width="28" height="28">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2 style="font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: var(--text-charcoal); letter-spacing: 0.05em; margin-bottom: 8px;">TAKEDOWN CLAIM REGISTERED</h2>
        <p style="font-size: 13px; color: var(--text-gray); line-height: 1.5; margin-bottom: 20px;">
          Your formal copyright violation request has been securely compiled and registered as node ID <strong style="color: #111111;">${claimId}</strong>. 
          Our legal team will verify proof within 24 hours.
        </p>
        <button class="btn-black-pill" id="dmca-popup-close-btn" style="width: 100%;">ACKNOWLEDGE & CLOSE</button>
      </div>
    `;

    document.body.appendChild(popupOverlay);

    popupOverlay.querySelector('#dmca-popup-close-btn').addEventListener('click', () => {
      popupOverlay.remove();
    });
  }

  // --- 26. PRIVACY POLICY & TERMS CONTROLLER ---
  let privacyData = null;

  function initPrivacyPolicy() {
    if (privacyData) {
      // Reset scroll position to top when entering again
      const desktopContainer = document.getElementById('privacy-desktop-sections');
      const mobileContainer = document.getElementById('privacy-mobile-sections');
      if (desktopContainer) desktopContainer.scrollTop = 0;
      if (mobileContainer) mobileContainer.scrollTop = 0;
      return;
    }

    // Fetch from backend dynamic API
    fetch('/api/privacy')
      .then(res => {
        if (!res.ok) throw new Error('Response error');
        return res.json();
      })
      .then(data => {
        privacyData = data;
        renderPrivacyPolicy(data);
      })
      .catch(err => {
        console.error('Failed to retrieve legal nodes:', err);
        showToast('Error', 'Failed to dynamic-stream Privacy & Terms data.');
      });
  }

  function renderPrivacyPolicy(data) {
    const desktopTocList = document.getElementById('privacy-desktop-toc-list');
    const desktopSections = document.getElementById('privacy-desktop-sections');
    const mobileTabsList = document.getElementById('privacy-mobile-tabs-list');
    const mobileSections = document.getElementById('privacy-mobile-sections');

    if (!desktopTocList || !desktopSections || !mobileTabsList || !mobileSections) return;

    desktopTocList.innerHTML = '';
    desktopSections.innerHTML = '';
    mobileTabsList.innerHTML = '';
    mobileSections.innerHTML = '';

    data.forEach((item, index) => {
      // 1. Render Desktop TOC item
      const tocLi = document.createElement('li');
      tocLi.className = `privacy-toc-item ${index === 0 ? 'active' : ''}`;
      tocLi.dataset.section = `section-${item.id}`;
      tocLi.innerHTML = `
        <div class="toc-active-marble"></div>
        <span>${item.tocTitle}</span>
      `;
      desktopTocList.appendChild(tocLi);

      tocLi.addEventListener('click', () => {
        const target = document.getElementById(`section-${item.id}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      // 2. Render Desktop Section block
      const desktopSectionDiv = document.createElement('div');
      desktopSectionDiv.className = 'legal-section-block';
      desktopSectionDiv.id = `section-${item.id}`;
      
      let desktopHtml = `<h3>${item.sectionTitle}</h3>`;
      if (item.paragraphs) {
        item.paragraphs.forEach(p => {
          desktopHtml += `<p>${p}</p>`;
        });
      }
      if (item.bullets) {
        desktopHtml += '<ul>';
        item.bullets.forEach(b => {
          desktopHtml += `<li>${b}</li>`;
        });
        desktopHtml += '</ul>';
      }
      if (item.paragraphs2) {
        item.paragraphs2.forEach(p => {
          desktopHtml += `<p>${p}</p>`;
        });
      }
      if (item.notice) {
        desktopHtml += `
          <div class="important-notice-card">
            <div class="notice-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <div class="notice-text-content">
              <h4>${item.notice.title}</h4>
              <p>${item.notice.text}</p>
            </div>
          </div>
        `;
      }
      desktopSectionDiv.innerHTML = desktopHtml;
      desktopSections.appendChild(desktopSectionDiv);

      // 3. Render Mobile Stepper Tab Pill
      const mobileTab = document.createElement('div');
      mobileTab.className = `mobile-tab-pill ${index === 0 ? 'active' : ''}`;
      mobileTab.dataset.section = `mobile-section-${item.id}`;
      mobileTab.innerHTML = `
        <span>${item.mobileTitle}</span>
        <div class="mobile-active-dot"></div>
      `;
      mobileTabsList.appendChild(mobileTab);

      mobileTab.addEventListener('click', () => {
        const target = document.getElementById(`mobile-section-${item.id}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      // 4. Render Mobile Section block
      const mobileSectionDiv = document.createElement('div');
      mobileSectionDiv.className = 'legal-section-block';
      mobileSectionDiv.id = `mobile-section-${item.id}`;
      
      let mobileHtml = `<h3>${item.sectionTitle}</h3>`;
      if (item.paragraphs) {
        item.paragraphs.forEach(p => {
          mobileHtml += `<p>${p}</p>`;
        });
      }
      if (item.bullets) {
        mobileHtml += '<ul>';
        item.bullets.forEach(b => {
          mobileHtml += `<li>${b}</li>`;
        });
        mobileHtml += '</ul>';
      }
      if (item.paragraphs2) {
        item.paragraphs2.forEach(p => {
          mobileHtml += `<p>${p}</p>`;
        });
      }
      if (item.notice) {
        mobileHtml += `
          <div class="important-notice-card">
            <div class="notice-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <div class="notice-text-content">
              <h4>${item.notice.title}</h4>
              <p>${item.notice.text}</p>
            </div>
          </div>
        `;
      }
      mobileSectionDiv.innerHTML = mobileHtml;
      mobileSections.appendChild(mobileSectionDiv);
    });

    setupPrivacyScrollSpy();
  }

  function setupPrivacyScrollSpy() {
    const desktopContainer = document.getElementById('privacy-desktop-sections');
    const mobileContainer = document.getElementById('privacy-mobile-sections');

    if (desktopContainer) {
      desktopContainer.addEventListener('scroll', () => {
        const sections = desktopContainer.querySelectorAll('.legal-section-block');
        let activeSectionId = null;
        const containerTop = desktopContainer.getBoundingClientRect().top;

        sections.forEach(section => {
          const rect = section.getBoundingClientRect();
          const relativeTop = rect.top - containerTop;
          if (relativeTop <= 40) {
            activeSectionId = section.id;
          }
        });

        if (!activeSectionId && sections.length > 0) {
          activeSectionId = sections[0].id;
        }

        const tocItems = document.querySelectorAll('.privacy-toc-item');
        tocItems.forEach(item => {
          const isActive = item.dataset.section === activeSectionId;
          item.classList.toggle('active', isActive);
        });
      });
    }

    if (mobileContainer) {
      mobileContainer.addEventListener('scroll', () => {
        const sections = mobileContainer.querySelectorAll('.legal-section-block');
        let activeSectionId = null;
        const containerTop = mobileContainer.getBoundingClientRect().top;

        sections.forEach(section => {
          const rect = section.getBoundingClientRect();
          const relativeTop = rect.top - containerTop;
          if (relativeTop <= 40) {
            activeSectionId = section.id;
          }
        });

        if (!activeSectionId && sections.length > 0) {
          activeSectionId = sections[0].id;
        }

        const pills = document.querySelectorAll('.mobile-tab-pill');
        pills.forEach(pill => {
          const isActive = pill.dataset.section === activeSectionId;
          pill.classList.toggle('active', isActive);
          if (isActive) {
            pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        });
      });
    }
  }

  // --- 27. PORTAL ACCESS (LOGIN & SIGN UP) CONTROLLER ---
  const authOverlay = document.getElementById('auth-overlay');
  const authCloseBtn = document.getElementById('auth-close-btn');
  const goToSignup = document.getElementById('go-to-signup');
  const goToLogin = document.getElementById('go-to-login');
  const loginState = document.getElementById('auth-login-state');
  const signupState = document.getElementById('auth-signup-state');
  const authForgotBtn = document.getElementById('auth-forgot-btn');
  const recoveryState = document.getElementById('auth-recovery-state');
  const resetState = document.getElementById('auth-reset-state');
  const authLoginForm = document.getElementById('auth-login-form');
  const authSignupForm = document.getElementById('auth-signup-form');
  const authRecoveryForm = document.getElementById('auth-recovery-form');
  const authResetForm = document.getElementById('auth-reset-form');
  const goToLoginFromRecovery = document.getElementById('go-to-login-from-recovery');
  const goToRecoveryFromReset = document.getElementById('go-to-recovery-from-reset');

  // Track the element that had focus before opening the auth overlay (for return-focus)
  let authOverlayOpener = null;

  // Focusable selector for the focus trap
  const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openAuthOverlay() {
    if (authOverlay) {
      // Remember the element that triggered the modal for return-focus on close
      authOverlayOpener = document.activeElement;

      authOverlay.style.display = 'flex';
      authOverlay.offsetHeight; // trigger browser reflow
      authOverlay.classList.add('active');
      
      // Reset forms and states to login default
      if (loginState && signupState && recoveryState && resetState) {
        loginState.style.display = 'block';
        signupState.style.display = 'none';
        recoveryState.style.display = 'none';
        resetState.style.display = 'none';
      }
      if (authLoginForm) authLoginForm.reset();
      if (authSignupForm) authSignupForm.reset();
      if (authRecoveryForm) authRecoveryForm.reset();
      if (authResetForm) authResetForm.reset();
      
      // Reset toggle eye states and input types
      const passwordInputs = authOverlay.querySelectorAll('.password-input-group input');
      passwordInputs.forEach(input => input.type = 'password');
      
      const eyeOpens = authOverlay.querySelectorAll('.eye-open');
      const eyeCloseds = authOverlay.querySelectorAll('.eye-closed');
      eyeOpens.forEach(el => el.style.display = 'block');
      eyeCloseds.forEach(el => el.style.display = 'none');

      // Move focus into the modal (first focusable element)
      const firstFocusable = authOverlay.querySelector(FOCUSABLE_SELECTORS);
      if (firstFocusable) firstFocusable.focus();
    }
  }

  function closeAuthOverlay() {
    if (authOverlay) {
      authOverlay.classList.remove('active');
      setTimeout(() => {
        authOverlay.style.display = 'none';
        // Return focus to the element that triggered the modal (WCAG 2.1 SC 2.4.3)
        if (authOverlayOpener && typeof authOverlayOpener.focus === 'function') {
          authOverlayOpener.focus();
        }
        authOverlayOpener = null;
      }, 300);
    }
  }

  if (authCloseBtn) {
    authCloseBtn.addEventListener('click', closeAuthOverlay);
  }

  if (authOverlay) {
    // Close on backdrop click
    authOverlay.addEventListener('click', (e) => {
      if (e.target === authOverlay) {
        closeAuthOverlay();
      }
    });

    // ESC key closes the overlay
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && authOverlay.classList.contains('active')) {
        closeAuthOverlay();
      }
    });

    // Focus trap: keep Tab navigation inside the auth overlay
    authOverlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(authOverlay.querySelectorAll(FOCUSABLE_SELECTORS)).filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // Toggle view state anchors
  if (goToSignup && goToLogin && loginState && signupState) {
    goToSignup.addEventListener('click', (e) => {
      e.preventDefault();
      loginState.style.display = 'none';
      signupState.style.display = 'block';
      if (recoveryState) recoveryState.style.display = 'none';
      if (resetState) resetState.style.display = 'none';
    });
    goToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      signupState.style.display = 'none';
      loginState.style.display = 'block';
      if (recoveryState) recoveryState.style.display = 'none';
      if (resetState) resetState.style.display = 'none';
    });
  }

  // Password recovery view toggle bindings
  if (authForgotBtn && loginState && recoveryState) {
    authForgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginState.style.display = 'none';
      recoveryState.style.display = 'block';
    });
  }

  if (goToLoginFromRecovery && recoveryState && loginState) {
    goToLoginFromRecovery.addEventListener('click', (e) => {
      e.preventDefault();
      recoveryState.style.display = 'none';
      loginState.style.display = 'block';
    });
  }

  if (goToRecoveryFromReset && resetState && recoveryState) {
    goToRecoveryFromReset.addEventListener('click', (e) => {
      e.preventDefault();
      resetState.style.display = 'none';
      recoveryState.style.display = 'block';
    });
  }

  // Password visibility triggers
  const passwordToggleBtns = document.querySelectorAll('.password-toggle-btn');
  passwordToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.password-input-group').querySelector('input');
      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');
      
      if (input.type === 'password') {
        input.type = 'text';
        if (eyeOpen) eyeOpen.style.display = 'none';
        if (eyeClosed) eyeClosed.style.display = 'block';
      } else {
        input.type = 'password';
        if (eyeOpen) eyeOpen.style.display = 'block';
        if (eyeClosed) eyeClosed.style.display = 'none';
      }
    });
  });

  // Submit Login
  if (authLoginForm) {
    authLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value.trim();
      
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        if (res.ok) {
          showToast('Grid Session Initialized', `Welcome back Voyager, @${data.user.username}!`);
          closeAuthOverlay();
          fetchProfileSettings(); // Refresh settings page UI and sidebar
        } else {
          showToast('Authorization Rejected', data.error || 'Failed to authenticate.');
        }
      } catch (err) {
        console.error('Login error:', err);
        showToast('Connection Error', 'Failed to communicate with authentication nodes.');
      }
    });
  }

  // Submit Signup
  if (authSignupForm) {
    authSignupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value.trim();
      
      if (password.length < 8) {
        showToast('Validation Warning', 'Security key must be at least 8 characters.');
        return;
      }

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        
        const data = await res.json();
        if (res.ok) {
          showToast('Identity Established', `Voyager profile @${data.user.username} initialized!`);
          closeAuthOverlay();
          fetchProfileSettings(); // Refresh settings page and sidebar
        } else {
          showToast('Registration Rejected', data.error || 'Failed to establish identity.');
        }
      } catch (err) {
        console.error('Signup error:', err);
        showToast('Connection Error', 'Failed to communicate with authentication nodes.');
      }
    });
  }

  // Submit Forgot Password Recovery
  if (authRecoveryForm) {
    authRecoveryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('recovery-email').value.trim();
      
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        
        const data = await res.json();
        if (res.ok) {
          showToast('Recovery Key Dispatched', 'Check your local mail spool (data/mail_spool/) for the hex reset token.');
          
          // Switch to Reset view dynamically
          if (recoveryState && resetState) {
            recoveryState.style.display = 'none';
            resetState.style.display = 'block';
          }
          
          // Pre-fill confirm email
          const resetEmailInput = document.getElementById('reset-email');
          if (resetEmailInput) {
            resetEmailInput.value = email;
          }
        } else {
          showToast('Recovery Rejected', data.error || 'Failed to dispatch reset key.');
        }
      } catch (err) {
        console.error('Recovery error:', err);
        showToast('Connection Error', 'Failed to communicate with authentication nodes.');
      }
    });
  }

  // Submit Password Reset
  if (authResetForm) {
    authResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reset-email').value.trim();
      const token = document.getElementById('reset-token').value.trim().toLowerCase();
      const password = document.getElementById('reset-password').value.trim();
      
      if (password.length < 8) {
        showToast('Validation Warning', 'New security key must be at least 8 characters.');
        return;
      }
      
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token, password })
        });
        
        const data = await res.json();
        if (res.ok) {
          showToast('Credentials Secured', 'Your security key has been updated successfully. Please sign in.');
          
          // Switch back to Login card
          if (resetState && loginState) {
            resetState.style.display = 'none';
            loginState.style.display = 'block';
          }
          
          // Wipe form inputs
          if (authResetForm) authResetForm.reset();
          if (authRecoveryForm) authRecoveryForm.reset();
        } else {
          showToast('Reset Rejected', data.error || 'Failed to establish new key.');
        }
      } catch (err) {
        console.error('Reset error:', err);
        showToast('Connection Error', 'Failed to communicate with authentication nodes.');
      }
    });
  }

  // Social Login Mock & Interactive Google OAuth
  const googleOverlay = document.getElementById('google-oauth-overlay');
  const googleClose = document.getElementById('google-oauth-close');
  const googleAccountsList = document.getElementById('google-accounts-list');
  const googleCustomForm = document.getElementById('google-custom-form');
  const googleCustomTrigger = document.getElementById('google-account-custom-trigger');
  const googleFormBack = document.getElementById('google-form-back');
  const googleSyncOverlay = document.getElementById('google-sync-overlay');
  const googleSyncStatus = document.getElementById('google-sync-status');

  function openGoogleOAuth() {
    if (googleOverlay) {
      googleOverlay.classList.add('active');
      googleAccountsList.style.display = 'flex';
      googleCustomForm.style.display = 'none';
      googleSyncOverlay.classList.remove('active');
    }
  }

  function closeGoogleOAuth() {
    if (googleOverlay) {
      googleOverlay.classList.remove('active');
    }
  }

  if (googleClose) {
    googleClose.addEventListener('click', closeGoogleOAuth);
  }

  if (googleCustomTrigger) {
    googleCustomTrigger.addEventListener('click', () => {
      googleAccountsList.style.display = 'none';
      googleCustomForm.style.display = 'flex';
      document.getElementById('google-custom-name').value = '';
      document.getElementById('google-custom-email').value = '';
    });
  }

  if (googleFormBack) {
    googleFormBack.addEventListener('click', () => {
      googleAccountsList.style.display = 'flex';
      googleCustomForm.style.display = 'none';
    });
  }

  const customFormSubmit = document.getElementById('google-custom-form');
  if (customFormSubmit) {
    customFormSubmit.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('google-custom-name').value.trim();
      const email = document.getElementById('google-custom-email').value.trim();
      if (!email) {
        showToast('Validation Warning', 'Please provide an email address.');
        return;
      }
      handleGoogleAuthSubmit(name, email);
    });
  }

  const accountItems = document.querySelectorAll('.google-account-item:not(#google-account-custom-trigger)');
  accountItems.forEach(item => {
    item.addEventListener('click', () => {
      const email = item.getAttribute('data-email');
      const name = item.getAttribute('data-name');
      handleGoogleAuthSubmit(name, email);
    });
  });

  async function handleGoogleAuthSubmit(name, email) {
    if (!googleSyncOverlay || !googleSyncStatus) return;
    googleSyncStatus.textContent = 'Synchronizing Google identity token...';
    googleSyncOverlay.classList.add('active');

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: `mock-google-token-${Date.now()}`,
          name: name,
          email: email
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Identity Synchronized', `Welcome back, @${data.user.username}!`);
        closeGoogleOAuth();
        closeAuthOverlay();
        fetchProfileSettings();
      } else {
        showToast('Google Sync Rejected', data.error || 'Failed to authenticate Google token.');
      }
    } catch (err) {
      console.error('Google Auth submit error:', err);
      showToast('Connection Error', 'Failed to communicate with authentication nodes.');
    } finally {
      googleSyncOverlay.classList.remove('active');
    }
  }

  const socialBtns = document.querySelectorAll('#discord-login-btn, #google-login-btn, #discord-signup-btn, #google-signup-btn');
  socialBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id.includes('google')) {
        openGoogleOAuth();
      } else {
        showToast('Social Sign-In Unavailable', 'This sign-in provider needs secure server setup before launch.');
      }
    });
  });

  // Bind settings page Disconnect/Login button actions
  const settingsLogoutBtn = document.getElementById('settings-logout-btn');
  if (settingsLogoutBtn) {
    settingsLogoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (settingsLogoutBtn.textContent.includes('LOG IN') || settingsLogoutBtn.textContent.includes('PORTAL')) {
        openAuthOverlay();
      } else {
        try {
          const res = await fetch('/api/auth/logout', { method: 'POST' });
          if (res.ok) {
            showToast('Session Purged', 'Grid identity disconnected. Session set to Guest mode.');
            fetchProfileSettings();
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  }

  // --- 27b. SIDEBAR PROFILE DROPDOWN MENU BINDERS ---
  const popoutItemSettings = document.getElementById('popout-item-settings');
  const popoutItemLogin = document.getElementById('popout-item-login');
  const popoutItemSignup = document.getElementById('popout-item-signup');
  const popoutItemLogout = document.getElementById('popout-item-logout');
  
  if (profilePopout) {
    profilePopout.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  if (popoutItemSettings) {
    popoutItemSettings.addEventListener('click', () => {
      selectCategory('settings');
      if (profilePopout) profilePopout.style.display = 'none';
    });
  }

  if (popoutItemLogin) {
    popoutItemLogin.addEventListener('click', () => {
      openAuthOverlay();
      if (profilePopout) profilePopout.style.display = 'none';
    });
  }

  if (popoutItemSignup) {
    popoutItemSignup.addEventListener('click', () => {
      openAuthOverlay();
      // Swap to signup state immediately
      if (loginState && signupState) {
        loginState.style.display = 'none';
        signupState.style.display = 'block';
      }
      if (profilePopout) profilePopout.style.display = 'none';
    });
  }

  if (popoutItemLogout) {
    popoutItemLogout.addEventListener('click', async () => {
      if (profilePopout) profilePopout.style.display = 'none';
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
          showToast('Session Purged', 'Grid identity disconnected. Session set to Guest mode.');
          fetchProfileSettings();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // ==========================================================
  // TACTILE ADMIN OVERRIDE & INGESTION DYNAMICS
  // ==========================================================
  
  const popoutItemAdmin = document.getElementById('popout-item-admin');
  if (popoutItemAdmin) {
    popoutItemAdmin.addEventListener('click', () => {
      if (profilePopout) profilePopout.style.display = 'none';
      selectCategory('admin');
    });
  }

  // Active subview tracker
  let activeAdminSubview = 'ledger';
  let activeIngestionTags = [];
  let currentIngestionPayload = null; // Store base64 payload of original
  let currentCompressedPayload = null; // Store base64 payload of WebP compressed
  let currentIngestionFileProps = {
    resolution: "—",
    aspectRatio: "—",
    fileSize: "—",
    ratio: "",
    quality: "",
    color: ""
  };

  // Switch Sub-views
  function switchAdminSubview(subview) {
    window.history.replaceState(null, null, '#admin-' + subview);
    window.activeAdminSubview = subview;
    activeAdminSubview = subview;
    
    // Toggle active sidebar class
    const navItems = document.querySelectorAll('.admin-nav-item, .admin-nav-subitem');
    navItems.forEach(n => {
      n.classList.toggle('active', n.getAttribute('data-admin-subview') === subview);
    });

    // Toggle panel visibility
    const panels = document.querySelectorAll('.admin-subview-panel');
    panels.forEach(p => {
      if (p.id === `admin-subview-${subview}`) {
        p.style.display = p.classList.contains('user-matrix-layout') ? 'flex' : 'block';
      } else {
        p.style.display = 'none';
      }
    });

    // Trigger loader functions
    if (subview === 'dashboard') {
      loadAdminDashboard();
    } else if (subview === 'content') {
      loadAdminContent();
    } else if (subview === 'ledger') {
      loadAdminLedger();
    } else if (subview === 'logs') {
      loadAdminAuditLogs();
    } else if (subview === 'cms') {
      loadAdminCMS();
    } else if (subview === 'rankings') {
      loadAdminRankings();
    } else if (subview === 'legal') {
      loadAdminLegal();
    } else if (subview === 'users') {
      loadAdminUsersMatrix();
    } else if (subview === 'community') {
      loadAdminCommunity();
    } else if (subview === 'reports') {
      loadAdminReports();
    } else if (subview === 'collections') {
      loadAdminCollections();
    } else if (subview === 'settings') {
      loadAdminSettings();
    } else if (subview === 'media') {
      loadAdminMedia();
    } else if (subview === 'categories') {
      loadAdminCategories();
    }
  }

  // Setup admin navigation event listeners
  const adminNavItems = document.querySelectorAll('.admin-nav-item, .admin-nav-subitem');
  adminNavItems.forEach(item => {
    const subview = item.getAttribute('data-admin-subview');
    if (subview) {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        switchAdminSubview(subview);
      });
    }
  });

  const adminNavExit = document.getElementById('admin-nav-exit');
  if (adminNavExit) {
    adminNavExit.addEventListener('click', () => {
      selectCategory('home');
    });
  }

  const btnShowAuditLogs = document.getElementById('btn-show-audit-logs');
  if (btnShowAuditLogs) {
    btnShowAuditLogs.addEventListener('click', () => {
      switchAdminSubview('logs');
    });
  }

  // --- 1. TAG PILLS MANAGER ---
  const ingestionTagsInput = document.getElementById('ingestion-tags-input');
  const ingestionTagsList = document.getElementById('ingestion-tags-list');

  function renderIngestionTags() {
    if (!ingestionTagsList) return;
    ingestionTagsList.innerHTML = '';
    activeIngestionTags.forEach((tag, idx) => {
      const pill = document.createElement('div');
      pill.className = 'tag-pill-admin';
      pill.innerHTML = `
        <span>${tag}</span>
        <button class="btn-remove-tag" data-tag-idx="${idx}" type="button">&times;</button>
      `;
      ingestionTagsList.appendChild(pill);
    });

    // Add dashed plus button at the end
    const addPillBtn = document.createElement('button');
    addPillBtn.className = 'btn-add-tag-pill';
    addPillBtn.type = 'button';
    addPillBtn.textContent = '+';
    addPillBtn.addEventListener('click', () => {
      if (ingestionTagsInput) ingestionTagsInput.focus();
    });
    ingestionTagsList.appendChild(addPillBtn);

    // Wire remove click events
    const removeButtons = ingestionTagsList.querySelectorAll('.btn-remove-tag');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-tag-idx'));
        activeIngestionTags.splice(idx, 1);
        renderIngestionTags();
      });
    });
  }

  if (ingestionTagsInput) {
    ingestionTagsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        let value = ingestionTagsInput.value.trim();
        if (value) {
          if (!value.startsWith('#')) value = '#' + value;
          // Capitalize camelcase tag formatting
          value = value.charAt(0) + value.slice(1).charAt(0).toUpperCase() + value.slice(2);
          if (!activeIngestionTags.includes(value)) {
            activeIngestionTags.push(value);
            renderIngestionTags();
          }
          ingestionTagsInput.value = '';
        }
      }
    });

    // Paste tags shortcut
    ingestionTagsInput.addEventListener('paste', (e) => {
      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      const pastedText = clipboardData.getData('text');
      if (pastedText) {
        // Split by commas, spaces, or hashes
        const tagsList = pastedText.split(/[\s,]+/)
          .map(t => t.trim().replace(/^#/, ''))
          .filter(t => t.length > 0);

        tagsList.forEach(t => {
          // Capitalize camelcase tag formatting
          let formattedTag = t.charAt(0).toUpperCase() + t.slice(1);
          formattedTag = '#' + formattedTag;
          if (!activeIngestionTags.includes(formattedTag)) {
            activeIngestionTags.push(formattedTag);
          }
        });
        renderIngestionTags();
        ingestionTagsInput.value = '';
      }
    });
  }

  // Initialize tags display
  renderIngestionTags();

  // --- 2. DRAG AND DROP FILE INGESTION ---
  const ingestionDropzone = document.getElementById('ingestion-dropzone');
  const ingestionFileInput = document.getElementById('ingestion-file-input');
  const ingestionPreviewImg = document.getElementById('ingestion-preview-img');
  const ingestionResBadge = document.getElementById('ingestion-res-badge');
  const ingestionRatioBadge = document.getElementById('ingestion-ratio-badge');
  const ingestionSizeBadge = document.getElementById('ingestion-size-badge');
  const ingestionTitleInput = document.getElementById('ingestion-title-input');

  if (ingestionDropzone && ingestionFileInput) {
    ingestionDropzone.addEventListener('click', (e) => {
      if (e.target !== ingestionFileInput) {
        ingestionFileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      ingestionDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        ingestionDropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      ingestionDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        ingestionDropzone.classList.remove('dragover');
      }, false);
    });

    ingestionDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        handleIngestionFile(files[0]);
      }
    });

    ingestionFileInput.addEventListener('change', (e) => {
      if (ingestionFileInput.files.length > 0) {
        handleIngestionFile(ingestionFileInput.files[0]);
      }
    });
  }

  function handleIngestionFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      currentIngestionPayload = reader.result;

      // Check if file is a video (MP4)
      if (file.type.startsWith('video/') || file.name.endsWith('.mp4')) {
        currentCompressedPayload = currentIngestionPayload; // No WebP compression for videos
        
        const video = document.createElement('video');
        video.src = currentIngestionPayload;
        video.muted = true;
        video.playsInline = true;
        
        video.onloadedmetadata = () => {
          const width = video.videoWidth || 1920;
          const height = video.videoHeight || 1080;
          
          currentIngestionFileProps.resolution = `${width}x${height}`;
          currentIngestionFileProps.ratio = width >= height ? 'landscape' : 'portrait';
          currentIngestionFileProps.aspectRatio = getAspectRatioStr(width, height);
          currentIngestionFileProps.fileSize = (file.size / 1024 / 1024).toFixed(1) + " MB";
          currentIngestionFileProps.palette = ["#0A0D14", "#1F2937", "#111827", "#374151", "#4B5563"]; // Video default dark palette

          if (ingestionResBadge) {
            ingestionResBadge.textContent = currentIngestionFileProps.resolution;
            ingestionResBadge.style.display = 'block';
          }
          if (ingestionRatioBadge) {
            ingestionRatioBadge.textContent = currentIngestionFileProps.aspectRatio;
            ingestionRatioBadge.style.display = 'block';
          }
          if (ingestionSizeBadge) {
            ingestionSizeBadge.textContent = currentIngestionFileProps.fileSize;
            ingestionSizeBadge.style.display = 'block';
          }

          if (ingestionTitleInput) {
            const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const cleanName = rawName.split('_').join(' ').split('-').join(' ').toUpperCase();
            ingestionTitleInput.value = cleanName;
          }

          // Seek to 0.5s to get a frame preview
          video.currentTime = 0.5;
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1920;
            canvas.height = video.videoHeight || 1080;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameData = canvas.toDataURL('image/jpeg', 0.8);
            if (ingestionPreviewImg) {
              ingestionPreviewImg.src = frameData;
              ingestionPreviewImg.style.display = 'block';
            }
            const placeholder = document.getElementById('ingestion-preview-placeholder');
            if (placeholder) placeholder.style.display = 'none';
            showToast('Asset Ingested', `Analyzed video ${file.name} successfully. Video frame extracted.`);
          } catch(e) {
            console.error("Video frame capture failed:", e);
            if (ingestionPreviewImg) {
              ingestionPreviewImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
              ingestionPreviewImg.style.display = 'none';
            }
            const placeholder = document.getElementById('ingestion-preview-placeholder');
            if (placeholder) {
              placeholder.style.display = 'flex';
              const textSpan = placeholder.querySelector('span');
              if (textSpan) textSpan.textContent = "VIDEO INGESTED (PREVIEW N/A)";
            }
            showToast('Asset Ingested', `Analyzed video ${file.name} successfully. (Preview N/A)`);
          }
        };

        video.onerror = () => {
          showToast('Ingestion Error', 'Failed to load video file.', true);
        };
      } else {
        // Extract properties using virtual image uploader
        const img = new Image();
        img.src = currentIngestionPayload;
        img.onload = () => {
          const width = img.width || 3840;
          const height = img.height || 2160;
          
          // Save properties
          currentIngestionFileProps.resolution = `${width}x${height}`;
          currentIngestionFileProps.ratio = width >= height ? 'landscape' : 'portrait';
          currentIngestionFileProps.aspectRatio = getAspectRatioStr(width, height);
          currentIngestionFileProps.fileSize = (file.size / 1024 / 1024).toFixed(1) + " MB";

          // Generate WebP compressed version at 80% quality for preview/website speed
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            currentCompressedPayload = canvas.toDataURL('image/webp', 0.8);
          } catch(e) {
            console.error("Canvas compression failed, falling back to original payload", e);
            currentCompressedPayload = currentIngestionPayload;
          }

          // Generate dynamic palette from canvas context
          currentIngestionFileProps.palette = extractPaletteFromImage(img);

          // Update UI preview (use WebP compressed payload for preview)
          if (ingestionPreviewImg) {
            ingestionPreviewImg.src = currentCompressedPayload;
            ingestionPreviewImg.style.display = 'block';
          }
          const placeholder = document.getElementById('ingestion-preview-placeholder');
          if (placeholder) placeholder.style.display = 'none';

          if (ingestionResBadge) {
            ingestionResBadge.textContent = currentIngestionFileProps.resolution;
            ingestionResBadge.style.display = 'block';
          }
          if (ingestionRatioBadge) {
            ingestionRatioBadge.textContent = currentIngestionFileProps.aspectRatio;
            ingestionRatioBadge.style.display = 'block';
          }
          if (ingestionSizeBadge) {
            ingestionSizeBadge.textContent = currentIngestionFileProps.fileSize;
            ingestionSizeBadge.style.display = 'block';
          }

          // Auto-title name
          if (ingestionTitleInput) {
            const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const cleanName = rawName.split('_').join(' ').split('-').join(' ').toUpperCase();
            ingestionTitleInput.value = cleanName;
          }

          showToast('Asset Ingested', `Analyzed and compressed ${file.name} successfully. WebP preview generated.`);
        };
      }
    };
  }

  function getAspectRatioStr(w, h) {
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(w, h);
    return `${w / divisor}:${h / divisor}`;
  }

  function extractPaletteFromImage(img) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 50;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 50, 50);
      const data = ctx.getImageData(0, 0, 50, 50).data;
      
      // Simple color bucket grouping
      const colors = {};
      for (let i = 0; i < data.length; i += 20) { // sample pixels
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        colors[hex] = (colors[hex] || 0) + 1;
      }

      // Sort and pick top 5
      const sorted = Object.keys(colors).sort((a, b) => colors[b] - colors[a]);
      const palette = sorted.slice(0, 5);
      
      // Fallback filler
      while(palette.length < 5) {
        palette.push("#0A0D14");
      }
      return palette;
    } catch(e) {
      // Hardcoded skeuomorphic anime default palette
      return ["#120101", "#FF1E2D", "#0A0D14", "#FF8A00", "#E1E1E6"];
    }
  }

  const btnIngestionBack = document.getElementById('ingestion-mobile-back');
  if (btnIngestionBack) {
    btnIngestionBack.addEventListener('click', () => {
      switchAdminSubview('dashboard');
    });
  }

  // --- 3. PUBLISH PAYLOAD SUBMISSION ---
  const btnPublishFeed = document.getElementById('btn-publish-feed');
  if (btnPublishFeed) {
    btnPublishFeed.addEventListener('click', async () => {
      const title = ingestionTitleInput ? ingestionTitleInput.value.trim() : '';
      const anime = document.getElementById('ingestion-anime-input') ? document.getElementById('ingestion-anime-input').value.trim() : 'Original';
      const artist = document.getElementById('ingestion-artist-input') ? document.getElementById('ingestion-artist-input').value.trim() : 'RESIN_AI';
      const collection = document.getElementById('ingestion-collection-select') ? document.getElementById('ingestion-collection-select').value : 'Standalone Masterpieces';
      const isDraft = document.getElementById('ingestion-draft-switch') ? document.getElementById('ingestion-draft-switch').checked : false;
      const styleSelect = document.getElementById('ingestion-style-select') ? document.getElementById('ingestion-style-select').value : 'neon';
      const qualitySelect = document.getElementById('ingestion-quality-select') ? document.getElementById('ingestion-quality-select').value : '4K';

      if (!currentIngestionPayload) {
        showToast('Payload Missing', 'Please drag & drop or browse a wallpaper file to upload.', true);
        return;
      }

      if (!title) {
        showToast('Title Required', 'Please assign a display title to your ingested wallpaper.', true);
        return;
      }

      // Lock button visually
      btnPublishFeed.disabled = true;
      btnPublishFeed.innerHTML = '<span>PUBLISHING SEQUENCE...</span>';

      try {
        const body = {
          title,
          anime,
          artist,
          tags: activeIngestionTags,
          collection,
          isDraft,
          imagePayload: currentIngestionPayload,
          compressedPayload: currentCompressedPayload,
          resolution: currentIngestionFileProps.resolution,
          aspectRatio: currentIngestionFileProps.aspectRatio,
          fileSize: currentIngestionFileProps.fileSize,
          ratio: currentIngestionFileProps.ratio,
          quality: qualitySelect,
          color: styleSelect,
          palette: currentIngestionFileProps.palette
        };

        const res = await fetch('/api/admin/wallpapers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        
        if (res.ok) {
          showToast('Override Success', `Wallpaper "${title}" published live onto global feed.`);
          
          // Clear uploader form
          currentIngestionPayload = null;
          currentCompressedPayload = null;
          if (ingestionTitleInput) ingestionTitleInput.value = '';
          if (ingestionPreviewImg) {
            ingestionPreviewImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            ingestionPreviewImg.style.display = 'none';
          }
          const placeholder = document.getElementById('ingestion-preview-placeholder');
          if (placeholder) {
            placeholder.style.display = 'flex';
            const textSpan = placeholder.querySelector('span');
            if (textSpan) textSpan.textContent = "AWAITING PAYLOAD";
          }
          if (ingestionResBadge) {
            ingestionResBadge.textContent = "—";
            ingestionResBadge.style.display = 'none';
          }
          if (ingestionRatioBadge) {
            ingestionRatioBadge.textContent = "—";
            ingestionRatioBadge.style.display = 'none';
          }
          if (ingestionSizeBadge) {
            ingestionSizeBadge.textContent = "—";
            ingestionSizeBadge.style.display = 'none';
          }
          activeIngestionTags = [];
          renderIngestionTags();
          
          // Pull fresh list of wallpapers
          await fetchWallpapers();

          // Redirect to Home
          selectCategory('home');
        } else {
          showToast('Ingestion Error', data.error || 'Server rejected published package.', true);
        }
      } catch (err) {
        console.error(err);
        showToast('System Exception', 'Communication node failure. Server rejected payload.', true);
      } finally {
        // Unlock button
        btnPublishFeed.disabled = false;
        btnPublishFeed.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="17"></line>
            <path d="M20 21H4a2 2 0 0 1-2-2V15"></path>
          </svg>
          <span>PUBLISH TO GLOBAL FEED</span>
        `;
      }
    });
  }

  // --- 4. DYNAMIC LOADER INTERACTIVE BINDINGS ---
  
  // Dashboard Metrics Loader
  let dashboardClockInterval = null;

  async function loadAdminDashboard() {
    // Start Clock
    if (dashboardClockInterval) clearInterval(dashboardClockInterval);
    const updateClock = () => {
      const now = new Date();
      const dateEl = document.getElementById('cmd-date');
      const timeEl = document.getElementById('cmd-time');
      if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    };
    updateClock();
    dashboardClockInterval = setInterval(updateClock, 1000);

    try {
      const res = await fetch('/api/admin/dashboard');
      if (checkAdminAuthStatus(res)) return;
      if (res.ok) {
        const data = await res.json();
        
        // Inject real metrics if available
        const usersEl = document.getElementById('cmd-val-users');
        if (usersEl && data.totalUsers !== undefined) {
           usersEl.textContent = data.totalUsers.toLocaleString();
        }

        const sessionsEl = document.getElementById('cmd-val-sessions');
        if (sessionsEl && data.activeSessions !== undefined) {
           sessionsEl.textContent = data.activeSessions.toLocaleString();
        }

        const flagsEl = document.getElementById('cmd-val-flags');
        if (flagsEl && data.totalFlags !== undefined) {
           flagsEl.textContent = data.totalFlags.toLocaleString();
           const flagsActionPill = document.querySelector('.cmd-card-flags .cmd-action-pill');
           if (flagsActionPill) {
             flagsActionPill.style.display = data.totalFlags > 0 ? 'block' : 'none';
           }
        }

        const serverLoadEl = document.querySelector('.cmd-donut-label strong');
        const serverLoadCircle = document.querySelector('.cmd-donut circle[stroke="#ff3e3e"]');
        const serverLoadStatus = document.querySelector('.cmd-donut-label span');
        if (data.serverLoad !== undefined) {
          if (serverLoadEl) serverLoadEl.textContent = `${data.serverLoad}%`;
          if (serverLoadCircle) {
            const offset = 251.2 * (1 - data.serverLoad / 100);
            serverLoadCircle.setAttribute('stroke-dashoffset', offset);
          }
          if (serverLoadStatus) {
            if (data.serverLoad < 50) {
              serverLoadStatus.textContent = 'Nominal';
            } else if (data.serverLoad < 80) {
              serverLoadStatus.textContent = 'Moderate';
            } else {
              serverLoadStatus.textContent = 'High';
            }
          }
        }
      }
    } catch(e) {
      console.error(e);
    }

    // Populate Live Terminal Activity from real audit logs
    try {
      const logsRes = await fetch('/api/admin/audit-logs');
      if (logsRes.ok) {
        const auditLogs = await logsRes.json();
        adminLogsList = auditLogs.slice(0, 12).map(mapAuditLogToTerminal);
        if (adminLogsList.length === 0) {
          adminLogsList = [
            { time: getFormattedTime(), user: '@system', action: 'System running. No audit logs recorded yet.', dot: 'green' }
          ];
        }
        populateLiveTerminal();
      }
    } catch(err) {
      console.error("Error loading terminal activity logs:", err);
      populateLiveTerminal();
    }
  }

  // Helper to map audit logs to terminal rows
  function mapAuditLogToTerminal(log) {
    const time = new Date(log.timestamp).toTimeString().split(' ')[0];
    const user = log.adminEmail ? `@${log.adminEmail.split('@')[0]}` : '@system';
    
    let actionStr = log.action;
    if (log.action === 'announcement_broadcasted') {
      actionStr = `Broadcast announcement: "${log.details.title}"`;
    } else if (log.action === 'wallpaper_published') {
      actionStr = `Published wallpaper asset (ID: ${log.details.id})`;
    } else if (log.action === 'wallpaper_deleted') {
      actionStr = `Deleted wallpaper asset (ID: ${log.details.id})`;
    } else if (log.action === 'user_banned') {
      actionStr = `Banned user account: @${log.details.username}`;
    } else if (log.action === 'system_settings_updated') {
      actionStr = `Updated system settings: [${log.details.keys.join(', ')}]`;
    } else if (log.action === 'support_ticket_replied') {
      actionStr = `Replied to ticket ${log.details.id} (${log.details.user})`;
    } else if (log.action === 'support_ticket_resolved') {
      actionStr = `Resolved ticket ${log.details.id} (${log.details.user})`;
    } else if (log.action === 'cache_flushed') {
      actionStr = `Flushed cache segments: [${log.details.segments.join(', ').toUpperCase()}]`;
    } else if (log.details && log.details.title) {
      actionStr = `${log.action.replace(/_/g, ' ')}: "${log.details.title}"`;
    } else if (log.details && log.details.name) {
      actionStr = `${log.action.replace(/_/g, ' ')}: "${log.details.name}"`;
    } else {
      actionStr = log.action.replace(/_/g, ' ');
    }
    
    actionStr = actionStr.charAt(0).toUpperCase() + actionStr.slice(1);
    const dot = ['deleted', 'banned', 'purge', 'strike'].some(k => log.action.includes(k)) ? 'red' : 'green';
    
    return { time, user, action: actionStr, dot };
  }

  // --- COMMAND CENTER MODALS AND INTERACTIONS ---
  let adminLogsList = [];

  function populateLiveTerminal() {
    const terminalBody = document.getElementById('cmd-terminal-body');
    if (!terminalBody) return;
    
    terminalBody.innerHTML = '';
    adminLogsList.forEach(log => {
      terminalBody.innerHTML += `
        <div class="cmd-term-row">
          <div class="cmd-term-dot ${log.dot}"></div>
          <div class="cmd-term-time">${log.time}</div>
          <div class="cmd-term-user">${log.user}</div>
          <div class="cmd-term-action">${log.action}</div>
        </div>
      `;
    });
  }

  // Bind Command Center Modal Triggers
  const cmdModals = {
    announcement: {
      modal: document.getElementById('admin-modal-announcement'),
      triggers: [document.getElementById('cmd-btn-announcement'), document.getElementById('cmd-btn-announcement-mobile')],
      closeBtns: [document.getElementById('admin-modal-announcement-close'), document.getElementById('admin-modal-announcement-cancel')]
    },
    inbox: {
      modal: document.getElementById('admin-modal-inbox'),
      triggers: [document.getElementById('cmd-btn-inbox'), document.getElementById('cmd-btn-inbox-mobile')],
      closeBtns: [document.getElementById('admin-modal-inbox-close')]
    },
    cache: {
      modal: document.getElementById('admin-modal-cache'),
      triggers: [document.getElementById('cmd-btn-cache'), document.getElementById('cmd-btn-cache-mobile')],
      closeBtns: [document.getElementById('admin-modal-cache-close'), document.getElementById('admin-modal-cache-cancel')]
    }
  };

  // Helper to format current time to HH:MM:SS
  function getFormattedTime() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  }

  // Setup generic open/close actions
  Object.keys(cmdModals).forEach(key => {
    const item = cmdModals[key];
    if (item.modal) {
      item.triggers.forEach(trigger => {
        if (trigger) {
          trigger.addEventListener('click', () => {
            // Close other modals first to prevent overlap
            Object.keys(cmdModals).forEach(otherKey => {
              if (cmdModals[otherKey].modal) {
                cmdModals[otherKey].modal.style.display = 'none';
              }
            });
            item.modal.style.display = 'flex';
            
            // Trigger load states if needed
            if (key === 'inbox') {
              loadSupportInboxTickets();
            }
          });
        }
      });

      item.closeBtns.forEach(btn => {
        if (btn) {
          btn.addEventListener('click', () => {
            item.modal.style.display = 'none';
          });
        }
      });
      
      // Close on clicking backdrop
      item.modal.addEventListener('click', (e) => {
        if (e.target === item.modal) {
          // If cache is in progress, block backdrop close to prevent state loss
          const progressContainer = document.getElementById('cache-progress-container');
          if (key === 'cache' && progressContainer && progressContainer.style.display === 'block') {
            return;
          }
          item.modal.style.display = 'none';
        }
      });
    }
  });

  // Esc key closure
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      Object.keys(cmdModals).forEach(key => {
        const item = cmdModals[key];
        if (item.modal && item.modal.style.display === 'flex') {
          const progressContainer = document.getElementById('cache-progress-container');
          if (key === 'cache' && progressContainer && progressContainer.style.display === 'block') {
            return;
          }
          item.modal.style.display = 'none';
        }
      });
    }
  });

  // 1. CREATE ANNOUNCEMENT FORM SUBMIT HANDLER
  const announcementForm = document.getElementById('admin-form-announcement');
  if (announcementForm) {
    announcementForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('announcement-title').value.trim();
      const body = document.getElementById('announcement-body').value.trim();
      const typeEl = document.querySelector('input[name="announcement-type"]:checked');
      const type = typeEl ? typeEl.value : 'info';
      const isPinned = document.getElementById('announcement-pin').checked;

      try {
        const res = await fetch('/api/admin/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, type, isPinned })
        });
        
        if (res.ok) {
          showToast('Announcement Broadcasted', `"${title}" has been published successfully.`);
          await loadAdminDashboard();
        } else {
          showToast('Broadcast Failed', 'Could not send announcement.', true);
        }
      } catch (err) {
        console.error(err);
        showToast('System Exception', 'Failed to connect to server.', true);
      }

      // Reset form and close
      announcementForm.reset();
      if (cmdModals.announcement.modal) {
        cmdModals.announcement.modal.style.display = 'none';
      }
    });
  }

  // 2. SUPPORT INBOX TRIAGE SYSTEM
  // 2. SUPPORT INBOX TRIAGE SYSTEM
  let supportTickets = [];
  let selectedTicketId = null;

  async function loadSupportInboxTickets() {
    const ticketListEl = document.getElementById('inbox-ticket-list');
    const searchVal = document.getElementById('inbox-search-input') ? document.getElementById('inbox-search-input').value.toLowerCase().trim() : '';
    if (!ticketListEl) return;

    try {
      const res = await fetch('/api/admin/tickets');
      if (res.ok) {
        supportTickets = await res.json();
      }
    } catch (err) {
      console.error("Error fetching support tickets:", err);
    }

    ticketListEl.innerHTML = '';
    const filtered = supportTickets.filter(t => 
      t.id.toLowerCase().includes(searchVal) || 
      t.user.toLowerCase().includes(searchVal) || 
      t.subject.toLowerCase().includes(searchVal) || 
      t.category.toLowerCase().includes(searchVal)
    );

    if (filtered.length === 0) {
      ticketListEl.innerHTML = '<div style="padding:20px;text-align:center;font-size:12px;color:#9ca3af;">No tickets match filter query.</div>';
      return;
    }

    filtered.forEach(ticket => {
      const activeClass = selectedTicketId === ticket.id ? 'active' : '';
      const statusClass = ticket.status === 'Resolved' ? 'resolved' : 'unresolved';
      
      const item = document.createElement('div');
      item.className = `inbox-ticket-item ${activeClass}`;
      item.innerHTML = `
        <div class="inbox-ticket-meta">
          <span class="inbox-ticket-id">${ticket.id}</span>
          <span class="inbox-ticket-time">${ticket.time}</span>
        </div>
        <div class="inbox-ticket-user">${ticket.user}</div>
        <div class="inbox-ticket-subject">${ticket.subject}</div>
        <div class="inbox-ticket-badges">
          <span class="inbox-tag-badge">${ticket.category}</span>
          <span class="inbox-status-pill ${statusClass}">${ticket.status}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        selectSupportTicket(ticket.id);
      });

      ticketListEl.appendChild(item);
    });
  }

  // Handle Search Input in Inbox
  const inboxSearchInput = document.getElementById('inbox-search-input');
  if (inboxSearchInput) {
    inboxSearchInput.addEventListener('input', loadSupportInboxTickets);
  }

  async function selectSupportTicket(ticketId) {
    selectedTicketId = ticketId;
    
    try {
      const res = await fetch('/api/admin/tickets');
      if (res.ok) {
        supportTickets = await res.json();
      }
    } catch (err) {
      console.error(err);
    }
    
    // Rerender lists to update highlight
    const ticketListEl = document.getElementById('inbox-ticket-list');
    if (ticketListEl) {
      const items = ticketListEl.querySelectorAll('.inbox-ticket-item');
      items.forEach(item => {
        const itemTicketId = item.querySelector('.inbox-ticket-id').textContent;
        if (itemTicketId === ticketId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    const ticket = supportTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const placeholderState = document.getElementById('inbox-placeholder-state');
    const threadContainer = document.getElementById('inbox-thread-container');
    const chatPane = document.getElementById('inbox-chat-pane');

    if (placeholderState) placeholderState.style.display = 'none';
    if (threadContainer) threadContainer.style.display = 'flex';
    
    if (chatPane && window.innerWidth <= 900) {
      chatPane.classList.add('mobile-active');
    }

    // Bind values
    document.getElementById('inbox-current-id').textContent = ticket.id;
    document.getElementById('inbox-current-user').textContent = ticket.user;
    document.getElementById('inbox-current-email').textContent = ticket.email;
    document.getElementById('inbox-current-subject').textContent = ticket.subject;
    
    const catBadge = document.getElementById('inbox-current-category');
    if (catBadge) catBadge.textContent = ticket.category;

    const statusPill = document.getElementById('inbox-current-status');
    if (statusPill) {
      statusPill.textContent = ticket.status;
      statusPill.className = `inbox-status-pill ${ticket.status === 'Resolved' ? 'resolved' : 'unresolved'}`;
    }

    // Render messages
    renderInboxMessages(ticket.messages);
  }

  function renderInboxMessages(messages) {
    const msgContainer = document.getElementById('inbox-thread-messages');
    if (!msgContainer) return;

    msgContainer.innerHTML = '';
    messages.forEach(msg => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `inbox-message ${msg.sender}`;
      msgDiv.innerHTML = `
        <div>${msg.content}</div>
        <div class="inbox-message-meta">
          <span>${msg.sender === 'user' ? 'User' : 'Support Specialist'}</span>
          <span>${msg.time}</span>
        </div>
      `;
      msgContainer.appendChild(msgDiv);
    });

    setTimeout(() => {
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }, 50);
  }

  // Reply Composer Form Submission
  const inboxReplyForm = document.getElementById('inbox-reply-composer');
  if (inboxReplyForm) {
    inboxReplyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedTicketId) return;

      const replyInput = document.getElementById('inbox-reply-input');
      const markResolved = document.getElementById('inbox-mark-resolved');
      const replyText = replyInput.value.trim();
      const isResolved = markResolved ? markResolved.checked : false;

      try {
        const res = await fetch(`/api/admin/tickets/${encodeURIComponent(selectedTicketId)}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: replyText, markResolved: isResolved })
        });
        
        if (res.ok) {
          showToast('Reply Transmitted', `Your message has been dispatched successfully.`);
          replyInput.value = '';
          if (markResolved) markResolved.checked = false;
          
          await selectSupportTicket(selectedTicketId);
          await loadAdminDashboard();
        } else {
          showToast('Delivery Failure', 'Could not transmit reply.', true);
        }
      } catch (err) {
        console.error(err);
        showToast('System Exception', 'Communication node failure.', true);
      }
    });
  }

  // Mobile Back Button inside Chat Thread
  const inboxMobileBackBtn = document.getElementById('inbox-mobile-back');
  if (inboxMobileBackBtn) {
    inboxMobileBackBtn.addEventListener('click', () => {
      const chatPane = document.getElementById('inbox-chat-pane');
      if (chatPane) {
        chatPane.classList.remove('mobile-active');
      }
    });
  }

  // 3. CACHE PURGE SIMULATION LOOP
  // 3. CACHE PURGE HANDLER
  const cacheForm = document.getElementById('admin-form-cache');
  if (cacheForm) {
    cacheForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Gather selected checkboxes
      const checkedBoxes = document.querySelectorAll('.cache-checkbox:checked');
      if (checkedBoxes.length === 0) {
        showToast('Selection Required', 'Please select at least one cache segment to flush.', true);
        return;
      }

      const selectedSegments = Array.from(checkedBoxes).map(cb => cb.value);

      // Disable buttons during process
      const progressContainer = document.getElementById('cache-progress-container');
      const progressBar = document.getElementById('cache-progress-fill');
      const progressStatus = document.getElementById('cache-progress-status');
      const progressPercentage = document.getElementById('cache-progress-percentage');
      const consoleLogEl = document.getElementById('cache-console-log');
      
      const submitBtn = cacheForm.querySelector('button[type="submit"]');
      const cancelBtn = document.getElementById('admin-modal-cache-cancel');
      
      if (submitBtn) submitBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;

      // Show progress
      if (progressContainer) progressContainer.style.display = 'block';
      if (consoleLogEl) consoleLogEl.innerHTML = '';

      function writeConsoleLog(text, isSuccess = false) {
        if (!consoleLogEl) return;
        const entry = document.createElement('div');
        entry.className = `cache-log-entry ${isSuccess ? 'success' : ''}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
        consoleLogEl.appendChild(entry);
        consoleLogEl.scrollTop = consoleLogEl.scrollHeight;
      }

      try {
        const res = await fetch('/api/admin/cache/flush', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segments: selectedSegments })
        });
        
        if (!res.ok) {
          showToast('Flush Denied', 'Server rejected the flush request.', true);
          if (submitBtn) submitBtn.disabled = false;
          if (cancelBtn) cancelBtn.disabled = false;
          if (progressContainer) progressContainer.style.display = 'none';
          return;
        }

        const data = await res.json();
        const serverLogs = data.logs;

        // Run progress animation synced with logs
        let progress = 0;
        progressBar.style.width = '0%';
        progressPercentage.textContent = '0%';
        let printedLogsCount = 0;

        const interval = setInterval(() => {
          progress += 5;
          if (progress > 100) progress = 100;

          progressBar.style.width = `${progress}%`;
          progressPercentage.textContent = `${progress}%`;

          // Determine expected number of logs to write based on progress
          const expectedLogsPrinted = Math.floor((progress / 100) * serverLogs.length);
          while (printedLogsCount < expectedLogsPrinted) {
            const currentLog = serverLogs[printedLogsCount];
            writeConsoleLog(currentLog);
            if (progressStatus) {
              progressStatus.textContent = currentLog.includes('SYS [') 
                ? currentLog.substring(currentLog.indexOf(']:') + 2).trim()
                : currentLog;
            }
            printedLogsCount++;
          }

          if (progress >= 100) {
            clearInterval(interval);
            
            setTimeout(async () => {
              showToast('Cache Evacuated', 'Selected system caches have been purged successfully.');

              // Re-enable and reset
              if (submitBtn) submitBtn.disabled = false;
              if (cancelBtn) cancelBtn.disabled = false;
              if (progressContainer) progressContainer.style.display = 'none';
              
              // Close modal
              if (cmdModals.cache.modal) {
                cmdModals.cache.modal.style.display = 'none';
              }

              // Reload dashboard stats and activity
              await loadAdminDashboard();
            }, 800);
          }
        }, 80);

      } catch (err) {
        console.error(err);
        showToast('System Exception', 'Communication node failure.', true);
        if (submitBtn) submitBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
      }
    });
  }

  // Content Ledger Loader
  async function loadAdminContent() {
    const tableBody = document.getElementById('admin-content-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Synchronizing content indexes...</td></tr>';
    
    try {
      // Reload wallpapers catalog
      const res = await fetch('/api/wallpapers');
      if (res.ok) {
        const list = await res.json();
        tableBody.innerHTML = '';
        
        if (list.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Grid holds no asset entries.</td></tr>';
          return;
        }

        list.forEach(w => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td><img src="${w.image}" class="content-table-thumb" alt="thumb"></td>
            <td style="font-family:monospace;color:#ff3e3e;">${w.id}</td>
            <td><strong>${w.title}</strong></td>
            <td>${w.anime}</td>
            <td>@${w.artist}</td>
            <td>${w.downloads || 0}</td>
            <td>${w.favoritesCount || 0}</td>
            <td>
              <button class="btn-table-delete" data-wp-id="${w.id}" type="button">DELETE</button>
            </td>
          `;
          tableBody.appendChild(row);
        });

        // Wire delete buttons
        const deleteButtons = tableBody.querySelectorAll('.btn-table-delete');
        deleteButtons.forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-wp-id');
            showConfirmModal(`Permanently purge asset "${id}" from platform indices?`, async () => {
              try {
                const dRes = await fetch(`/api/admin/wallpapers/${id}`, { method: 'DELETE' });
                if (dRes.ok) {
                  showToast('Asset Purged', `Wallpaper row "${id}" successfully deleted.`);
                  loadAdminContent(); // Reload grid
                } else {
                  showToast('Purge Failed', 'Security override denied action.', true);
                }
              } catch(e) {
                console.error(e);
              }
            });
          });
        });
      }
    } catch(e) {
      console.error(e);
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ff3e3e;">Connection node timeout.</td></tr>';
    }
  }

  // Audit Logs Terminal Display
  async function loadAdminAuditLogs() {
    const display = document.getElementById('admin-console-logs-display');
    if (!display) return;
    
    display.innerHTML = '<div class="console-log-row">&gt; Establishing telemetry handshakes...</div>';
    
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const logs = await res.json();
        display.innerHTML = '';
        
        if (logs.length === 0) {
          display.innerHTML = '<div class="console-log-row">&gt; Telemetry ledger empty. Override logs normal.</div>';
          return;
        }

        logs.forEach(l => {
          const time = new Date(l.timestamp).toLocaleTimeString();
          const details = JSON.stringify(l.details || {});
          const row = document.createElement('div');
          row.className = 'console-log-row';
          row.innerHTML = `
            <span class="console-log-time">[${time}]</span>
            <span class="console-log-action">${l.action.toUpperCase()}</span> by 
            <span class="console-log-email">${l.adminEmail}</span>: 
            <span class="console-log-info">${details}</span>
          `;
          display.appendChild(row);
        });
        
        // Auto-scroll to top
        display.scrollTop = 0;
      }
    } catch(e) {
      display.innerHTML = '<div class="console-log-row" style="color:#ff3e3e;">&gt; Telemetry handshake failed. Spooler timeout.</div>';
    }
  }

  // Clear Terminal Button
  const btnClearTerminalLogs = document.getElementById('btn-clear-terminal-logs');
  if (btnClearTerminalLogs) {
    btnClearTerminalLogs.addEventListener('click', () => {
      const display = document.getElementById('admin-console-logs-display');
      if (display) display.innerHTML = '<div class="console-log-row">&gt; Display cleared. Spooler listening...</div>';
    });
  }

  // ==========================================================
  // ASSET LEDGER LOGIC
  // ==========================================================
  let allLedgerData = [];
  let ledgerData = [];
  let selectedLedgerIds = new Set();
  let ledgerViewMode = 'list'; // 'list' or 'grid'
  let ledgerEventsInitialized = false;

  function formatCount(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num;
  }

  async function loadAdminLedger() {
    if (!ledgerEventsInitialized) {
      initLedgerEvents();
      ledgerEventsInitialized = true;
    }
    try {
      const res = await fetch('/api/admin/wallpapers');
      if (checkAdminAuthStatus(res)) return;
      if (res.ok) {
        const data = await res.json();
        allLedgerData = data.wallpapers || [];
        applyLedgerFilters();
      }
    } catch(err) {
      console.error("Failed to load asset ledger data", err);
    }
  }

  function applyLedgerFilters() {
    const searchInput = document.getElementById('ledger-search-input');
    const resFilter = document.getElementById('ledger-filter-res');
    const dateFilter = document.getElementById('ledger-filter-date');
    const tagFilter = document.getElementById('ledger-filter-tag');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const resVal = resFilter ? resFilter.value : 'all';
    const dateVal = dateFilter ? dateFilter.value : 'all';
    const tagVal = tagFilter ? tagFilter.value : 'all';

    ledgerData = allLedgerData.filter(wp => {
      // 1. Search filter
      if (searchVal) {
        const titleMatch = wp.title && wp.title.toLowerCase().includes(searchVal);
        const idMatch = wp.id && wp.id.toLowerCase().includes(searchVal);
        const tagsMatch = wp.tags && wp.tags.some(t => t.toLowerCase().includes(searchVal));
        if (!titleMatch && !idMatch && !tagsMatch) {
          return false;
        }
      }

      // 2. Resolution filter
      if (resVal !== 'all') {
        const wpRes = (wp.resolution || '').toLowerCase();
        if (resVal === '4k' && !wpRes.includes('3840x2160')) return false;
        if (resVal === '1440p' && !wpRes.includes('2560x1440')) return false;
        if (resVal === '1080p' && !wpRes.includes('1920x1080')) return false;
      }

      // 3. Date filter
      if (dateVal !== 'all') {
        const createdAt = wp.createdAt ? new Date(wp.createdAt) : new Date();
        const now = new Date();
        const diffTime = Math.abs(now - createdAt);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (dateVal === 'today' && diffDays > 1) return false;
        if (dateVal === 'week' && diffDays > 7) return false;
        if (dateVal === 'month' && diffDays > 30) return false;
      }

      // 4. Tag Cluster filter
      if (tagVal !== 'all') {
        const tags = (wp.tags || []).map(t => t.toLowerCase().replace('#', ''));
        if (!tags.includes(tagVal.toLowerCase())) return false;
      }

      return true;
    });

    // Update pagination / count text
    const infoText = document.getElementById('ledger-page-info-text');
    if (infoText) {
      if (ledgerData.length === 0) {
        infoText.textContent = `Showing 0 of 0 Assets`;
      } else {
        infoText.textContent = `Showing 1-${ledgerData.length} of ${ledgerData.length} Assets`;
      }
    }

    // Keep checkboxes in check
    // Remove selected IDs that are no longer in the loaded set to prevent ghost bulk selection
    const currentWpIds = new Set(allLedgerData.map(wp => wp.id));
    selectedLedgerIds.forEach(id => {
      if (!currentWpIds.has(id)) selectedLedgerIds.delete(id);
    });

    renderAllLedgerViews();
  }

  let currentViewingAssetId = null;

  function openEditAssetModal(id, focusId = null) {
    const wp = allLedgerData.find(w => w.id === id);
    if (!wp) return;

    document.getElementById('edit-asset-id').value = wp.id;
    document.getElementById('edit-asset-title').value = wp.title;
    document.getElementById('edit-asset-artist').value = wp.artist || 'RESIN_AI';
    document.getElementById('edit-asset-anime').value = wp.anime || 'Original';
    document.getElementById('edit-asset-res').value = wp.resolution || '3840x2160';
    document.getElementById('edit-asset-size').value = wp.fileSize || '1.2 MB';
    document.getElementById('edit-asset-tags').value = (wp.tags || []).join(', ');

    const modal = document.getElementById('admin-modal-ledger-edit');
    if (modal) modal.style.display = 'flex';

    if (focusId) {
      setTimeout(() => {
        const input = document.getElementById(focusId);
        if (input) input.focus();
      }, 100);
    }
  }

  function openViewAssetModal(id) {
    const wp = allLedgerData.find(w => w.id === id);
    if (!wp) return;

    currentViewingAssetId = id;

    const imageUrl = wp.image || wp.path || '/images/placeholder.png';
    document.getElementById('view-asset-img').src = imageUrl;
    document.getElementById('view-asset-title').textContent = wp.title;
    document.getElementById('view-asset-id').textContent = wp.id;
    document.getElementById('view-asset-anime').textContent = wp.anime || 'Original';
    document.getElementById('view-asset-artist').textContent = wp.artist || 'RESIN_AI';
    document.getElementById('view-asset-res').textContent = wp.resolution || '3840x2160';
    document.getElementById('view-asset-size').textContent = wp.fileSize || '1.2 MB';
    document.getElementById('view-asset-downloads').textContent = formatCount(wp.downloads || 0);
    document.getElementById('view-asset-saves').textContent = formatCount(wp.saves || 0);

    const tagsContainer = document.getElementById('view-asset-tags');
    if (tagsContainer) {
      tagsContainer.innerHTML = (wp.tags || []).map(t => {
        const cleanTag = t.startsWith('#') ? t : '#' + t;
        return `<span class="tag-chip">${cleanTag}</span>`;
      }).join('');
    }

    const modal = document.getElementById('admin-modal-ledger-view');
    if (modal) modal.style.display = 'flex';
  }

  function renderAllLedgerViews() {
    renderLedgerTableContent();
    renderLedgerGridContent();
    renderLedgerMobileContent();
    bindLedgerEvents();
    updateLedgerBulkDock();
  }

  function renderLedgerTableContent() {
    const tbody = document.getElementById('ledger-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (ledgerData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No assets found.</td></tr>';
      return;
    }

    ledgerData.forEach(wp => {
      const tr = document.createElement('tr');
      const isSelected = selectedLedgerIds.has(wp.id);
      if (isSelected) tr.classList.add('selected-row');

      // Checkbox
      const tdCb = document.createElement('td');
      tdCb.className = 'col-checkbox';
      tdCb.innerHTML = `
        <label class="custom-checkbox">
          <input type="checkbox" class="ledger-row-cb" data-id="${wp.id}" ${isSelected ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      `;

      // Preview image
      const tdPrev = document.createElement('td');
      tdPrev.className = 'col-preview';
      const imageUrl = wp.image || wp.path || '/images/placeholder.png';
      tdPrev.innerHTML = `<img src="${imageUrl}" class="ledger-thumbnail action-view-btn" data-id="${wp.id}" style="cursor: pointer;" alt="${wp.title}">`;

      // Metadata
      const tdMeta = document.createElement('td');
      const format = (imageUrl && imageUrl.includes('.')) ? imageUrl.split('.').pop().split('?')[0].toUpperCase() : 'PNG';
      tdMeta.className = 'col-metadata';
      tdMeta.innerHTML = `
        <div class="meta-title">${wp.title}</div>
        <div class="meta-sub">
          <span>${wp.resolution || 'N/A'} • ${wp.fileSize || 'Unknown Size'} • <span class="meta-format">${format}</span></span>
        </div>
      `;

      // Taxonomy (Tags)
      const tdTax = document.createElement('td');
      tdTax.className = 'col-taxonomy';
      
      let tagsHtml = (wp.tags || []).slice(0, 3).map(t => {
        const cleanTag = t.startsWith('#') ? t : '#' + t;
        return `<span class="tag-chip">${cleanTag}</span>`;
      }).join('');
      if ((wp.tags || []).length > 3) {
        tagsHtml += `<span class="tag-chip-add tag-add-btn" data-id="${wp.id}">+${wp.tags.length - 3}</span>`;
      } else {
        tagsHtml += `<button class="tag-chip-add tag-add-btn" data-id="${wp.id}" title="Add Tag">+</button>`;
      }
      tdTax.innerHTML = `<div class="taxonomy-wrapper">${tagsHtml}</div>`;

      // Performance
      const tdPerf = document.createElement('td');
      tdPerf.className = 'col-performance';
      tdPerf.innerHTML = `
        <div class="perf-stats">
          <span>Downloads: ${formatCount(wp.downloads || 0)}</span>
          <span>Saves: ${formatCount(wp.saves || 0)}</span>
        </div>
      `;

      // Actions
      const tdActs = document.createElement('td');
      tdActs.className = 'col-actions';
      tdActs.innerHTML = `
        <button class="action-icon-btn action-edit-btn" data-id="${wp.id}" title="Edit Asset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg></button>
        <button class="action-icon-btn action-view-btn" data-id="${wp.id}" title="View Details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
        <button class="action-icon-btn action-delete" data-id="${wp.id}" title="Purge Asset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      `;

      tr.appendChild(tdCb);
      tr.appendChild(tdPrev);
      tr.appendChild(tdMeta);
      tr.appendChild(tdTax);
      tr.appendChild(tdPerf);
      tr.appendChild(tdActs);
      tbody.appendChild(tr);
    });
  }

  function renderLedgerGridContent() {
    const grid = document.getElementById('ledger-desktop-grid');
    if (!grid) return;

    grid.innerHTML = '';
    
    if (ledgerData.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #8e8e93;">No assets found.</div>';
      return;
    }

    ledgerData.forEach(wp => {
      const isSelected = selectedLedgerIds.has(wp.id);
      const card = document.createElement('div');
      card.className = 'ledger-grid-card' + (isSelected ? ' selected-grid-card' : '');

      let tagsHtml = (wp.tags || []).slice(0, 3).map(t => {
        const cleanTag = t.startsWith('#') ? t : '#' + t;
        return `<span class="tag-chip">${cleanTag}</span>`;
      }).join('');
      if ((wp.tags || []).length > 3) {
        tagsHtml += `<span class="tag-chip-add tag-add-btn" data-id="${wp.id}">+${wp.tags.length - 3}</span>`;
      } else {
        tagsHtml += `<button class="tag-chip-add tag-add-btn" data-id="${wp.id}" title="Add Tag">+</button>`;
      }

      const imageUrl = wp.image || wp.path || '/images/placeholder.png';
      const format = (imageUrl && imageUrl.includes('.')) ? imageUrl.split('.').pop().split('?')[0].toUpperCase() : 'PNG';

      card.innerHTML = `
        <div class="grid-card-thumb-wrapper action-view-btn" data-id="${wp.id}" style="cursor: pointer;">
          <img src="${imageUrl}" class="grid-card-thumb" alt="${wp.title}">
          <label class="custom-checkbox grid-card-cb-label" onclick="event.stopPropagation();">
            <input type="checkbox" class="ledger-row-cb" data-id="${wp.id}" ${isSelected ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
        </div>
        <div class="grid-card-info">
          <div class="grid-card-title" title="${wp.title}">${wp.title}</div>
          <div class="grid-card-meta">${wp.resolution || 'N/A'} • ${wp.fileSize || 'Unknown Size'} • <span class="meta-format">${format}</span></div>
          <div class="grid-card-taxonomy">${tagsHtml}</div>
          <div class="grid-card-perf">
            <span>Downloads: ${formatCount(wp.downloads || 0)}</span>
            <span>Saves: ${formatCount(wp.saves || 0)}</span>
          </div>
          <div class="grid-card-actions">
            <button class="action-icon-btn action-edit-btn" data-id="${wp.id}" title="Edit Asset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg></button>
            <button class="action-icon-btn action-view-btn" data-id="${wp.id}" title="View Details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
            <button class="action-icon-btn action-delete" data-id="${wp.id}" title="Purge Asset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderLedgerMobileContent() {
    const listBody = document.getElementById('ledger-mobile-list-body');
    if (!listBody) return;
    
    listBody.innerHTML = '';
    if (ledgerData.length === 0) {
      listBody.innerHTML = '<div style="text-align: center; padding: 2rem; color: #8e8e93;">No assets found.</div>';
      return;
    }

    ledgerData.forEach(wp => {
      const isSelected = selectedLedgerIds.has(wp.id);
      const card = document.createElement('div');
      card.className = 'ledger-mob-card' + (isSelected ? ' selected-mob-card' : '');
      
      const tagsHtml = (wp.tags || []).slice(0, 2).map(t => {
        const cleanTag = t.startsWith('#') ? t : '#' + t;
        return `<span class="mob-tag-chip">${cleanTag}</span>`;
      }).join('');
      
      const imageUrl = wp.image || wp.path || '/images/placeholder.png';
      card.innerHTML = `
        <div class="mob-card-left">
          <label class="custom-checkbox">
            <input type="checkbox" class="ledger-row-cb" data-id="${wp.id}" ${isSelected ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
        </div>
        <img src="${imageUrl}" class="mob-card-thumb action-view-btn" data-id="${wp.id}" style="cursor: pointer;" alt="${wp.title}">
        <div class="mob-card-info action-view-btn" data-id="${wp.id}" style="cursor: pointer;">
          <h4 class="mob-card-title">${wp.title}</h4>
          <span class="mob-card-meta">${wp.resolution || 'N/A'} • ${wp.fileSize || '? MB'}</span>
          <div class="mob-card-tags">${tagsHtml}</div>
        </div>
        <button class="mob-card-menu-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>
      `;
      listBody.appendChild(card);
    });
  }

  function bindLedgerEvents() {
    // Checkbox selections
    const checkboxes = document.querySelectorAll('.ledger-row-cb');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        if (e.target.checked) {
          selectedLedgerIds.add(id);
        } else {
          selectedLedgerIds.delete(id);
        }
        
        // Re-render UI content states quickly without complete filter engine re-run
        document.querySelectorAll(`.ledger-row-cb[data-id="${id}"]`).forEach(box => {
          box.checked = e.target.checked;
        });

        // Sync visual rows
        const trs = document.querySelectorAll('#ledger-table-body tr');
        trs.forEach(tr => {
          const rowCb = tr.querySelector('.ledger-row-cb');
          if (rowCb && rowCb.getAttribute('data-id') === id) {
            tr.classList.toggle('selected-row', e.target.checked);
          }
        });

        // Sync visual cards
        const cards = document.querySelectorAll('.ledger-grid-card');
        cards.forEach(card => {
          const cardCb = card.querySelector('.ledger-row-cb');
          if (cardCb && cardCb.getAttribute('data-id') === id) {
            card.classList.toggle('selected-grid-card', e.target.checked);
          }
        });

        // Sync mobile cards
        const mobCards = document.querySelectorAll('.ledger-mob-card');
        mobCards.forEach(card => {
          const cardCb = card.querySelector('.ledger-row-cb');
          if (cardCb && cardCb.getAttribute('data-id') === id) {
            card.classList.toggle('selected-mob-card', e.target.checked);
          }
        });

        updateLedgerBulkDock();
        
        // Update Select All Checkbox state
        const selectAllCb = document.getElementById('ledger-select-all');
        if (selectAllCb) {
          const visibleIds = ledgerData.map(wp => wp.id);
          const checkedVisibleCount = visibleIds.filter(id => selectedLedgerIds.has(id)).length;
          selectAllCb.checked = checkedVisibleCount === visibleIds.length && visibleIds.length > 0;
          selectAllCb.indeterminate = checkedVisibleCount > 0 && checkedVisibleCount < visibleIds.length;
        }
      });
    });

    // Select-All checkbox
    const selectAllCb = document.getElementById('ledger-select-all');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        if (e.target.checked) {
          ledgerData.forEach(wp => selectedLedgerIds.add(wp.id));
        } else {
          ledgerData.forEach(wp => selectedLedgerIds.delete(wp.id));
        }
        
        // Re-render views to project bulk checks
        renderAllLedgerViews();
      });

      const visibleIds = ledgerData.map(wp => wp.id);
      const checkedVisibleCount = visibleIds.filter(id => selectedLedgerIds.has(id)).length;
      selectAllCb.checked = checkedVisibleCount === visibleIds.length && visibleIds.length > 0;
      selectAllCb.indeterminate = checkedVisibleCount > 0 && checkedVisibleCount < visibleIds.length;
    }
    
    // Delete individual
    const deleteBtns = document.querySelectorAll('.action-delete');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        const wp = allLedgerData.find(w => w.id === id);
        const name = wp ? wp.title : 'asset';
        showConfirmModal(`Are you sure you want to permanently purge "${name}"?`, async () => {
          try {
            const res = await fetch(`/api/admin/wallpapers/${id}`, { method: 'DELETE' });
            if (res.ok) {
              selectedLedgerIds.delete(id);
              showToast("Asset Purged", "The asset was permanently deleted.");
              loadAdminLedger();
            } else {
              showToast("Error", "Failed to delete asset.");
            }
          } catch(err) {
            console.error(err);
          }
        });
      });
    });

    // Edit individual
    const editBtns = document.querySelectorAll('.action-edit-btn');
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        openEditAssetModal(id);
      });
    });

    // View details individual
    const viewBtns = document.querySelectorAll('.action-view-btn');
    viewBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        openViewAssetModal(id);
      });
    });

    // Add tag individual
    const tagAddBtns = document.querySelectorAll('.tag-add-btn');
    tagAddBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        openEditAssetModal(id, 'edit-asset-tags');
      });
    });
  }

  function initLedgerEvents() {
    // View mode toggles
    const btnListView = document.getElementById('ledger-btn-list-view');
    const btnGridView = document.getElementById('ledger-btn-grid-view');

    if (btnListView && btnGridView) {
      btnListView.addEventListener('click', () => {
        ledgerViewMode = 'list';
        btnListView.classList.add('active');
        btnGridView.classList.remove('active');
        
        const table = document.getElementById('ledger-desktop-table');
        const grid = document.getElementById('ledger-desktop-grid');
        if (table) table.style.display = 'table';
        if (grid) grid.style.display = 'none';
      });

      btnGridView.addEventListener('click', () => {
        ledgerViewMode = 'grid';
        btnGridView.classList.add('active');
        btnListView.classList.remove('active');
        
        const table = document.getElementById('ledger-desktop-table');
        const grid = document.getElementById('ledger-desktop-grid');
        if (table) table.style.display = 'none';
        if (grid) grid.style.display = 'grid';
      });
    }

    // Filters event binding
    const searchInput = document.getElementById('ledger-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', applyLedgerFilters);
    }
    const resFilter = document.getElementById('ledger-filter-res');
    if (resFilter) {
      resFilter.addEventListener('change', applyLedgerFilters);
    }
    const dateFilter = document.getElementById('ledger-filter-date');
    if (dateFilter) {
      dateFilter.addEventListener('change', applyLedgerFilters);
    }
    const tagFilter = document.getElementById('ledger-filter-tag');
    if (tagFilter) {
      tagFilter.addEventListener('change', applyLedgerFilters);
    }

    // Bulk tag operations
    const btnBulkTag = document.getElementById('bulk-tag-btn');
    if (btnBulkTag) {
      btnBulkTag.addEventListener('click', async () => {
        if (selectedLedgerIds.size === 0) return;
        const tagInput = prompt(`Enter tags to add to ${selectedLedgerIds.size} selected assets (comma separated, e.g. Cyberpunk, Neon):`);
        if (tagInput === null) return;
        
        const tags = tagInput.split(',')
          .map(t => t.trim().replace('#', ''))
          .filter(t => t.length > 0);

        if (tags.length === 0) {
          alert("No tags provided.");
          return;
        }

        try {
          const res = await fetch('/api/admin/wallpapers/bulk-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: Array.from(selectedLedgerIds),
              tags: tags
            })
          });

          if (res.ok) {
            showToast("Bulk Tagged", `Added tags ${tags.map(t => '#' + t).join(', ')} to selected assets.`);
            selectedLedgerIds.clear();
            loadAdminLedger();
          } else {
            showToast("Error", "Failed to apply bulk tagging.");
          }
        } catch (err) {
          console.error(err);
          showToast("Error", "An unexpected error occurred.");
        }
      });
    }

    // Bulk export operations
    const btnBulkExport = document.getElementById('bulk-export-btn');
    if (btnBulkExport) {
      btnBulkExport.addEventListener('click', () => {
        if (selectedLedgerIds.size === 0) return;
        
        const exportData = allLedgerData.filter(wp => selectedLedgerIds.has(wp.id));
        const jsonStr = JSON.stringify(exportData, null, 2);
        
        // Trigger download
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ledger_export_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast("Payload Exported", `Downloaded metadata payload for ${selectedLedgerIds.size} assets.`);
        selectedLedgerIds.clear();
        renderAllLedgerViews();
      });
    }

    // Bulk purge operations
    const btnPurgeSelected = document.getElementById('bulk-purge-btn');
    if (btnPurgeSelected) {
      btnPurgeSelected.addEventListener('click', async () => {
        if (selectedLedgerIds.size === 0) return;
        showConfirmModal(`Are you sure you want to permanently purge ${selectedLedgerIds.size} selected assets?`, async () => {
          try {
            const res = await fetch('/api/admin/wallpapers/bulk-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: Array.from(selectedLedgerIds) })
            });
            if (res.ok) {
              selectedLedgerIds.clear();
              showToast("Assets Purged", "The selected assets were permanently deleted.");
              loadAdminLedger();
            } else {
              showToast("Error", "Failed to bulk delete assets.");
            }
          } catch(err) {
            console.error(err);
          }
        });
      });
    }

    // --- Ledger Modals & Forms wiring ---
    const closeEditBtn = document.getElementById('admin-modal-ledger-edit-close');
    const cancelEditBtn = document.getElementById('admin-modal-ledger-edit-cancel');
    const closeViewBtn = document.getElementById('admin-modal-ledger-view-close');

    if (closeEditBtn) {
      closeEditBtn.addEventListener('click', () => {
        const modal = document.getElementById('admin-modal-ledger-edit');
        if (modal) modal.style.display = 'none';
      });
    }
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        const modal = document.getElementById('admin-modal-ledger-edit');
        if (modal) modal.style.display = 'none';
      });
    }
    if (closeViewBtn) {
      closeViewBtn.addEventListener('click', () => {
        const modal = document.getElementById('admin-modal-ledger-view');
        if (modal) modal.style.display = 'none';
      });
    }

    // Modal Details Actions
    const btnViewEdit = document.getElementById('view-asset-btn-edit');
    if (btnViewEdit) {
      btnViewEdit.addEventListener('click', () => {
        if (currentViewingAssetId) {
          openEditAssetModal(currentViewingAssetId);
        }
      });
    }

    const btnViewDelete = document.getElementById('view-asset-btn-delete');
    if (btnViewDelete) {
      btnViewDelete.addEventListener('click', async () => {
        if (!currentViewingAssetId) return;
        const id = currentViewingAssetId;
        const wp = allLedgerData.find(w => w.id === id);
        const name = wp ? wp.title : 'asset';
        showConfirmModal(`Are you sure you want to permanently purge "${name}"?`, async () => {
          try {
            const res = await fetch(`/api/admin/wallpapers/${id}`, { method: 'DELETE' });
            if (res.ok) {
              selectedLedgerIds.delete(id);
              const viewModal = document.getElementById('admin-modal-ledger-view');
              if (viewModal) viewModal.style.display = 'none';
              showToast("Asset Purged", "The asset was permanently deleted.");
              loadAdminLedger();
            } else {
              showToast("Error", "Failed to delete asset.");
            }
          } catch(err) {
            console.error(err);
          }
        });
      });
    }

    const btnViewSim = document.getElementById('view-asset-btn-simulator');
    if (btnViewSim) {
      btnViewSim.addEventListener('click', () => {
        if (currentViewingAssetId) {
          const wp = allLedgerData.find(w => w.id === currentViewingAssetId);
          if (wp) {
            const imageUrl = wp.image || wp.path;
            const viewModal = document.getElementById('admin-modal-ledger-view');
            if (viewModal) viewModal.style.display = 'none';
            openSimulator('desktop', imageUrl);
          }
        }
      });
    }

    // Submit Edit Form
    const editForm = document.getElementById('admin-ledger-edit-form');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-asset-id').value;
        const title = document.getElementById('edit-asset-title').value;
        const artist = document.getElementById('edit-asset-artist').value;
        const anime = document.getElementById('edit-asset-anime').value;
        const resolution = document.getElementById('edit-asset-res').value;
        const fileSize = document.getElementById('edit-asset-size').value;
        const tagsInput = document.getElementById('edit-asset-tags').value;
        
        const tags = tagsInput.split(',')
          .map(t => t.trim().replace(/^#/, ''))
          .filter(t => t.length > 0);

        try {
          const res = await fetch(`/api/admin/wallpapers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, artist, anime, resolution, fileSize, tags })
          });
          if (res.ok) {
            showToast("Success", "Wallpaper metadata updated successfully.");
            const modal = document.getElementById('admin-modal-ledger-edit');
            if (modal) modal.style.display = 'none';
            const viewModal = document.getElementById('admin-modal-ledger-view');
            if (viewModal) viewModal.style.display = 'none';
            loadAdminLedger();
          } else {
            showToast("Error", "Failed to update wallpaper metadata.");
          }
        } catch(err) {
          console.error(err);
          showToast("Error", "An unexpected error occurred.");
        }
      });
    }
  }

  function updateLedgerBulkDock() {
    const dock = document.getElementById('ledger-bulk-dock');
    const badge = document.getElementById('bulk-selected-count');
    const mobileBadge = document.getElementById('bulk-mobile-count-text');
    if (!dock) return;

    if (selectedLedgerIds.size > 0) {
      dock.classList.add('visible');
      if (badge) badge.textContent = selectedLedgerIds.size;
      if (mobileBadge) mobileBadge.textContent = `MANAGE ${selectedLedgerIds.size} ASSET${selectedLedgerIds.size === 1 ? '' : 'S'}`;
    } else {
      dock.classList.remove('visible');
    }
  }

  // ==========================================
  // EDITORIAL CMS LOGIC
  // ==========================================
  
  let cmsTags = [];
  let currentCMSDocId = null;

  async function loadAdminCMS() {
    document.getElementById('cms-editor-view').style.display = 'none';
    document.getElementById('cms-list-view').style.display = 'block';
    const tbody = document.getElementById('cms-document-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">Loading Documents...</td></tr>';
    
    try {
      const res = await fetch('/api/admin/documents');
      if (res.ok) {
        const docs = await res.json();
        tbody.innerHTML = '';
        if (docs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">No documents found. <button onclick="openCMSEditor()" style="padding:8px 16px; background:#111; color:#fff; border:none; border-radius:4px; margin-left:16px; cursor:pointer;">Create New</button></td></tr>';
        } else {
          docs.forEach(doc => {
            const d = new Date(doc.lastModified);
            const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
            let dateStr = `${d.toLocaleDateString('en-US', dateOptions)} - ${d.toLocaleTimeString('en-US', timeOptions)}`;
            const statusColor = doc.status === 'Published' ? '#10B981' : '#8e8e93';
            tbody.innerHTML += `
              <tr>
                <td style="font-weight: 600; color: #111;">${doc.title}</td>
                <td>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path></svg>
                    ${doc.author}
                  </div>
                </td>
                <td>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${statusColor};"></span>
                    <span style="font-weight:600; font-size:12px;">${doc.status}</span>
                  </div>
                </td>
                <td><span style="color:#666; font-size:12px;">${dateStr}</span></td>
                <td>
                  <button onclick="editCMSDocument('${doc.id}')" style="background:none; border:none; cursor:pointer; color:#666; padding:4px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
                  <button onclick="deleteCMSDocument('${doc.id}')" style="background:none; border:none; cursor:pointer; color:#666; padding:4px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle><circle cx="5" cy="12" r="2"></circle></svg></button>
                </td>
              </tr>
            `;
          });
        }
      }
    } catch(err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff3e3e;">Failed to load documents.</td></tr>';
    }
  }

  window.openCMSEditor = function() {
    currentCMSDocId = null;
    document.getElementById('cms-doc-title').value = '';
    document.getElementById('cms-doc-content').innerHTML = '<p>Start writing your document here...</p>';
    document.getElementById('cms-url-slug').value = '/blog/untitled-document';
    document.getElementById('cms-excerpt').value = '';
    document.querySelector('input[name="cms_status"][value="Published"]').checked = true;
    cmsTags = [];
    renderCMSTags();
    document.getElementById('cms-cover-preview').style.display = 'none';
    document.getElementById('cms-cover-input').value = '';
    
    document.getElementById('cms-list-view').style.display = 'none';
    document.getElementById('cms-editor-view').style.display = 'block';
    const createNewBtn = document.getElementById('cms-create-new-btn');
    if (createNewBtn) createNewBtn.style.display = 'none';
  };

  window.editCMSDocument = async function(id) {
    try {
      const res = await fetch('/api/admin/documents');
      const docs = await res.json();
      const doc = docs.find(d => d.id === id);
      if (doc) {
        currentCMSDocId = id;
        document.getElementById('cms-doc-title').value = doc.title;
        document.getElementById('cms-doc-content').innerHTML = doc.content;
        document.getElementById('cms-url-slug').value = doc.urlSlug;
        document.getElementById('cms-excerpt').value = doc.excerpt;
        document.querySelector(`input[name="cms_status"][value="${doc.status}"]`).checked = true;
        cmsTags = doc.tags || [];
        renderCMSTags();
        
        const preview = document.getElementById('cms-cover-preview');
        if (doc.coverAsset) {
          preview.style.backgroundImage = `url('${doc.coverAsset}')`;
          preview.style.display = 'block';
        } else {
          preview.style.display = 'none';
        }
        
        document.getElementById('cms-list-view').style.display = 'none';
        document.getElementById('cms-editor-view').style.display = 'block';
        const createNewBtn = document.getElementById('cms-create-new-btn');
        if (createNewBtn) createNewBtn.style.display = 'none';
      }
    } catch(err) {
      console.error(err);
    }
  };

  window.deleteCMSDocument = async function(id) {
    showConfirmModal("Are you sure you want to delete this document?", async () => {
      try {
        const res = await fetch(`/api/admin/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showToast("Document Deleted", "The document has been removed.");
          loadAdminCMS();
        }
      } catch(err) {
        console.error(err);
      }
    });
  };

  window.saveCMSDocument = async function(statusOverride) {
    const title = document.getElementById('cms-doc-title').value;
    const content = document.getElementById('cms-doc-content').innerHTML;
    const excerpt = document.getElementById('cms-excerpt').value;
    const urlSlug = document.getElementById('cms-url-slug').value;
    const status = statusOverride || document.querySelector('input[name="cms_status"]:checked').value;
    
    const payload = {
      title, content, excerpt, urlSlug, status, tags: cmsTags
    };

    const fileInput = document.getElementById('cms-cover-input');
    if (fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        payload.coverAsset = e.target.result;
        submitCMSPayload(payload);
      };
      reader.readAsDataURL(file);
    } else {
      submitCMSPayload(payload);
    }
  };

  async function submitCMSPayload(payload) {
    try {
      const method = currentCMSDocId ? 'PUT' : 'POST';
      const url = currentCMSDocId ? `/api/admin/documents/${currentCMSDocId}` : '/api/admin/documents';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showToast("Success", `Document ${payload.status.toLowerCase()} successfully.`);
        document.getElementById('cms-editor-view').style.display = 'none';
        document.getElementById('cms-list-view').style.display = 'block';
        const createNewBtn = document.getElementById('cms-create-new-btn');
        if (createNewBtn) createNewBtn.style.display = 'block';
        loadAdminCMS();
      } else {
        showToast("Error", "Failed to save document.");
      }
    } catch(err) {
      console.error(err);
    }
  }

  // WYSIWYG Floating Toolbar Logic
  const wysiwygEditor = document.getElementById('cms-doc-content');
  const wysiwygToolbar = document.getElementById('wysiwyg-toolbar');

  if (wysiwygEditor && wysiwygToolbar) {
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (!selection.rangeCount || selection.isCollapsed) {
        wysiwygToolbar.style.display = 'none';
        return;
      }
      
      const range = selection.getRangeAt(0);
      if (wysiwygEditor.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        const editorRect = wysiwygEditor.getBoundingClientRect();
        
        wysiwygToolbar.style.display = 'flex';
        // Position relative to the selection but constrained to the viewport
        wysiwygToolbar.style.top = `${rect.top + window.scrollY - 40}px`;
        wysiwygToolbar.style.left = `${Math.max(rect.left + (rect.width / 2) - (wysiwygToolbar.offsetWidth / 2), editorRect.left)}px`;
      } else {
        wysiwygToolbar.style.display = 'none';
      }
    });
  }

  // Tags logic
  const cmsTagInput = document.getElementById('cms-tag-input');
  if (cmsTagInput) {
    cmsTagInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCMSTagFromInput();
      }
    });
  }

  window.addCMSTagFromInput = function() {
    const tagInput = document.getElementById('cms-tag-input');
    if (!tagInput) return;
    const tag = tagInput.value.trim();
    if (tag && !cmsTags.includes(tag)) {
      cmsTags.push(tag);
      renderCMSTags();
    }
    tagInput.value = '';
  };

  // Editor Real-time metrics
  const wordCount = document.getElementById('cms-word-count');
  const charCount = document.getElementById('cms-char-count');
  if (wysiwygEditor && wordCount && charCount) {
    wysiwygEditor.addEventListener('input', () => {
      const text = wysiwygEditor.innerText || '';
      const wCount = text.trim().split(/\\s+/).filter(w => w.length > 0).length;
      wordCount.innerText = wCount;
      charCount.innerText = text.length;
    });
  }

  const excerptInput = document.getElementById('cms-excerpt');
  const excerptCounter = document.querySelector('.cms-char-counter');
  if (excerptInput && excerptCounter) {
    excerptInput.addEventListener('input', () => {
      excerptCounter.innerText = `${excerptInput.value.length} / 160`;
    });
  }

  function renderCMSTags() {
    const container = document.getElementById('cms-tags-container');
    if (!container) return;
    container.innerHTML = '';
    cmsTags.forEach(tag => {
      const el = document.createElement('span');
      el.className = 'cms-tag';
      el.innerHTML = `${tag} <span class="remove-tag" onclick="removeCMSTag('${tag}')">×</span>`;
      container.appendChild(el);
    });
  }

  window.removeCMSTag = function(tag) {
    cmsTags = cmsTags.filter(t => t !== tag);
    renderCMSTags();
  };

  // Cover Drag and Drop
  const cmsDropzone = document.getElementById('cms-cover-dropzone');
  const cmsCoverInput = document.getElementById('cms-cover-input');
  const cmsCoverPreview = document.getElementById('cms-cover-preview');

  if (cmsDropzone && cmsCoverInput) {
    cmsDropzone.addEventListener('click', () => cmsCoverInput.click());
    cmsDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      cmsDropzone.style.borderColor = '#ff3e3e';
    });
    cmsDropzone.addEventListener('dragleave', () => {
      cmsDropzone.style.borderColor = '#ddd';
    });
    cmsDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      cmsDropzone.style.borderColor = '#ddd';
      if (e.dataTransfer.files.length) {
        cmsCoverInput.files = e.dataTransfer.files;
        handleCMSCoverPreview(cmsCoverInput.files[0]);
      }
    });
    cmsCoverInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleCMSCoverPreview(e.target.files[0]);
    });
  }

  function handleCMSCoverPreview(file) {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        cmsCoverPreview.style.backgroundImage = `url('${e.target.result}')`;
        cmsCoverPreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  }

  // --- RANKINGS ENGINE LOGIC ---
  async function loadAdminRankings() {
    const listContainer = document.getElementById('rankings-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Synchronizing rankings chart...</div>';

    try {
      const configRes = await fetch('/api/admin/rankings/config');
      if (checkAdminAuthStatus(configRes)) return;
      if (configRes.ok) {
        const config = await configRes.json();
        document.getElementById('slider-dl').value = config.weights.dl;
        document.getElementById('val-dl').textContent = config.weights.dl.toFixed(1) + 'x';
        document.getElementById('slider-sv').value = config.weights.sv;
        document.getElementById('val-sv').textContent = config.weights.sv.toFixed(1) + 'x';
        document.getElementById('slider-vw').value = config.weights.vw;
        document.getElementById('val-vw').textContent = config.weights.vw.toFixed(1) + 'x';
        
        document.querySelectorAll('.tuner-pill-group button').forEach(b => {
          b.classList.toggle('active', b.textContent === config.timeframe);
        });
        
        const selects = document.querySelectorAll('.tuner-select-row select');
        if (selects.length >= 3) {
          selects[0].value = config.advanced.botSensitivity;
          selects[1].value = config.advanced.cooldown;
          selects[2].value = config.advanced.minSharedSaves.toString();
          
          selects[0].dispatchEvent(new Event('change', { bubbles: true }));
          selects[1].dispatchEvent(new Event('change', { bubbles: true }));
          selects[2].dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      const res = await fetch('/api/admin/rankings');
      if (!res.ok) throw new Error("Rankings fetch failed");
      const list = await res.json();
      listContainer.innerHTML = '';

      const topList = list.slice(0, 15);
      
      if (topList.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No wallpapers indexed for rankings.</div>';
        return;
      }

      topList.forEach((w, index) => {
        const rankNum = String(index + 1).padStart(2, '0');
        const wrapper = document.createElement('div');
        wrapper.className = 'ranking-item-wrapper';
        
        const isPinned = w.rank === 1;
        const pinnedHtml = isPinned ? 
          `<button class="r-btn-pinned" data-wp-id="${w.id}">PINNED</button>` : 
          `<button class="r-btn-pin" data-wp-id="${w.id}">PIN TO TOP</button>`;

        wrapper.innerHTML = `
          <div class="ranking-item">
            <div class="r-col-rank">${rankNum}</div>
            <div class="r-col-asset">
              <img src="${w.image}" class="r-asset-img" alt="${w.title}">
              <div class="r-asset-info">
                <span class="r-asset-title">${w.title}</span>
                <span class="r-asset-author">@${w.artist || 'anonymous'}</span>
              </div>
            </div>
            <div class="r-col-score">
              <span class="r-score-val">${(w.velocityScore || 0).toLocaleString()}</span>
              <span class="r-score-label">Velocity Pts</span>
            </div>
            <div class="r-col-admin">
              ${pinnedHtml}
              <button class="r-btn-purge" data-wp-id="${w.id}">PURGE FROM TRENDING</button>
            </div>
            <div class="r-col-dots">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </div>
          </div>
          <div class="ranking-swipe-actions">
            <button class="swipe-btn swipe-btn-pin" data-wp-id="${w.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:4px;"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg> PIN TO #1</button>
            <button class="swipe-btn swipe-btn-remove" data-wp-id="${w.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:4px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> REMOVE FROM TRENDING</button>
          </div>
        `;
        listContainer.appendChild(wrapper);
      });

      const wireActions = (selector, endpoint, successMsg) => {
        listContainer.querySelectorAll(selector).forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-wp-id');
            showConfirmModal(`Execute rank adjustment sequence for asset "${id}"?`, async () => {
              try {
                const actionRes = await fetch(`/api/admin/wallpapers/${id}/${endpoint}`, { method: 'POST' });
                if (actionRes.ok) {
                  showToast("Rank Recalibrated", successMsg);
                  loadAdminRankings();
                } else {
                  showToast("Adjustment Denied", "System rejected rankings overwrite.", true);
                }
              } catch(e) {
                console.error(e);
              }
            });
          });
        });
      };

      wireActions('.r-col-admin .r-btn-pin, .swipe-btn-pin', 'pin', 'Asset promoted to top rank.');
      wireActions('.r-col-admin .r-btn-pinned', 'unpin', 'Asset unpinned from top rank.');
      wireActions('.r-col-admin .r-btn-purge, .swipe-btn-remove', 'unpin', 'Asset demoted from trending charts.');

    } catch(e) {
      console.error(e);
      listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Failed to retrieve rankings database.</div>';
    }

    if (!window.tunerEventsBound) {
      bindRankingsTunerEvents();
      window.tunerEventsBound = true;
    }
  }

  function bindRankingsTunerEvents() {
    const sliderDl = document.getElementById('slider-dl');
    const sliderSv = document.getElementById('slider-sv');
    const sliderVw = document.getElementById('slider-vw');

    const valDl = document.getElementById('val-dl');
    const valSv = document.getElementById('val-sv');
    const valVw = document.getElementById('val-vw');

    if (sliderDl && valDl) {
      sliderDl.addEventListener('input', () => {
        valDl.textContent = parseFloat(sliderDl.value).toFixed(1) + 'x';
      });
    }
    if (sliderSv && valSv) {
      sliderSv.addEventListener('input', () => {
        valSv.textContent = parseFloat(sliderSv.value).toFixed(1) + 'x';
      });
    }
    if (sliderVw && valVw) {
      sliderVw.addEventListener('input', () => {
        valVw.textContent = parseFloat(sliderVw.value).toFixed(1) + 'x';
      });
    }

    const timeframeButtons = document.querySelectorAll('.tuner-pill-group button');
    timeframeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        timeframeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const commitBtn = document.querySelector('.btn-commit-algo');
    if (commitBtn) {
      commitBtn.addEventListener('click', async () => {
        const activeTimeframeBtn = document.querySelector('.tuner-pill-group button.active');
        const timeframe = activeTimeframeBtn ? activeTimeframeBtn.textContent : '24H';
        
        const weights = {
          dl: parseFloat(sliderDl ? sliderDl.value : 1.5),
          sv: parseFloat(sliderSv ? sliderSv.value : 2.0),
          vw: parseFloat(sliderVw ? sliderVw.value : 0.5)
        };

        const selects = document.querySelectorAll('.tuner-select-row select');
        const advanced = {
          botSensitivity: selects[0] ? selects[0].value : 'High',
          cooldown: selects[1] ? selects[1].value : '60 minutes',
          minSharedSaves: selects[2] ? parseInt(selects[2].value) : 10
        };

        try {
          const res = await fetch('/api/admin/rankings/weights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeframe, weights, advanced })
          });

          if (checkAdminAuthStatus(res)) return;

          if (res.ok) {
            showToast("Tuner Synchronized", "Algorithm weights and advanced constraints reloaded successfully.");
            loadAdminRankings();
          } else {
            showToast("Synchronization Failed", "System rejected algorithm tuning request.", true);
          }
        } catch (e) {
          console.error(e);
          showToast("Network Error", "Could not submit algorithm parameters to backend.", true);
        }
      });
    }
  }

  // --- LEGAL INBOX LOGIC ---
  let currentLegalFilter = 'Action Required';
  let allLegalClaims = [];

  async function loadAdminLegal() {
    const listContainer = document.getElementById('legal-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Fetching copyright complaints...</div>';

    try {
      const res = await fetch('/api/admin/dmca');
      if (!res.ok) throw new Error("Failed to fetch DMCA claims");
      const data = await res.json();
      allLegalClaims = data.claims || [];

      const actionCount = allLegalClaims.filter(c => c.status === 'Pending Investigation' || (!c.status.includes('RESOLVED') && !c.status.includes('DISMISSED'))).length;
      const resolvedCount = allLegalClaims.filter(c => c.status && c.status.includes('RESOLVED')).length;
      const rejectedCount = allLegalClaims.filter(c => c.status && c.status.includes('DISMISSED')).length;

      const filters = document.querySelectorAll('.legal-filters .filter-btn');
      if (filters.length >= 3) {
        filters[0].innerHTML = `Action Required <span class="badge dark">${actionCount}</span>`;
        filters[1].innerHTML = `Resolved <span class="badge">${resolvedCount}</span>`;
        filters[2].innerHTML = `Rejected <span class="badge">${rejectedCount}</span>`;
      }

      const pendingBadge = document.querySelector('.legal-badge-pill');
      if (pendingBadge) {
        pendingBadge.textContent = `${actionCount} PENDING`;
      }

      renderLegalList();

      if (!window.legalFiltersBound) {
        filters.forEach((btn, idx) => {
          btn.addEventListener('click', () => {
            filters.forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            if (idx === 0) currentLegalFilter = 'Action Required';
            if (idx === 1) currentLegalFilter = 'Resolved';
            if (idx === 2) currentLegalFilter = 'Rejected';
            renderLegalList();
          });
        });
        window.legalFiltersBound = true;
      }
    } catch (e) {
      console.error(e);
      listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Failed to load copyright inbox database.</div>';
    }
  }

  function renderLegalList() {
    const listContainer = document.getElementById('legal-list-container');
    if (!listContainer) return;

    let displayClaims = [];
    if (currentLegalFilter === 'Action Required') {
      displayClaims = allLegalClaims.filter(c => c.status === 'Pending Investigation' || (!c.status.includes('RESOLVED') && !c.status.includes('DISMISSED')));
    } else if (currentLegalFilter === 'Resolved') {
      displayClaims = allLegalClaims.filter(c => c.status && c.status.includes('RESOLVED'));
    } else if (currentLegalFilter === 'Rejected') {
      displayClaims = allLegalClaims.filter(c => c.status && c.status.includes('DISMISSED'));
    }

    listContainer.innerHTML = '';
    if (displayClaims.length === 0) {
      listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No copyright claims in this category.</div>';
      clearLegalDetails();
      return;
    }

    displayClaims.forEach((claim, index) => {
      let dotClass = 'dot-yellow';
      if (claim.status && claim.status.includes('RESOLVED')) {
        dotClass = 'dot-green';
      } else if (claim.status && claim.status.includes('DISMISSED')) {
        dotClass = 'dot-red';
      }

      const hasPdf = claim.files && claim.files.length > 0;
      const pdfHtml = hasPdf ? `<div class="pdf-pill">PDF ATTACHED</div>` : ``;

      const card = document.createElement('div');
      card.className = `legal-ticket ${index === 0 ? 'active' : ''}`;
      card.setAttribute('data-id', claim.id);
      card.innerHTML = `
        <div class="legal-ticket-header">
          <span class="ticket-id"><span class="${dotClass}"></span> ${claim.id}</span>
          <span class="ticket-date">${claim.submittedAt || ''}</span>
        </div>
        <div class="ticket-claimant">${claim.claimant}</div>
        <div class="ticket-url">Infringing URL: ${claim.infringingUrl}</div>
        ${pdfHtml}
      `;
      listContainer.appendChild(card);
    });

    bindLegalEvents(displayClaims);
  }

  function clearLegalDetails() {
    const elId = document.getElementById('detail-claim-id');
    const elDate = document.getElementById('detail-claim-date');
    const elUrl = document.getElementById('detail-target-url');
    const elAllegation = document.getElementById('detail-allegation');
    const elSig = document.getElementById('detail-signature');
    const elIp = document.getElementById('detail-ip');
    const elDoc = document.getElementById('detail-doc-img');
    const statusRow = document.querySelector('.claim-title-row');

    if (elId) elId.textContent = 'None';
    if (elDate) elDate.textContent = 'No claim selected';
    if (elUrl) elUrl.textContent = 'N/A';
    if (elAllegation) elAllegation.textContent = 'No active copyright claim selected.';
    if (elSig) elSig.textContent = 'N/A';
    if (elIp) elIp.textContent = 'N/A';
    if (elDoc) elDoc.src = '';
    
    if (statusRow) {
      const oldPill = statusRow.querySelector('.status-pill');
      if (oldPill) oldPill.remove();
    }
  }

  function bindLegalEvents(claims) {
    const listContainer = document.getElementById('legal-list-container');
    const tickets = listContainer.querySelectorAll('.legal-ticket');
    const drawer = document.getElementById('legal-details-drawer');
    const closeBtn = document.getElementById('btn-close-legal');

    const elId = document.getElementById('detail-claim-id');
    const elDate = document.getElementById('detail-claim-date');
    const elUrl = document.getElementById('detail-target-url');
    const elAllegation = document.getElementById('detail-allegation');
    const elSig = document.getElementById('detail-signature');
    const elIp = document.getElementById('detail-ip');
    const elDoc = document.getElementById('detail-doc-img');
    const statusRow = document.querySelector('.claim-title-row');

    let activeClaim = null;

    function selectClaim(claim) {
      activeClaim = claim;
      if (!claim) {
        clearLegalDetails();
        return;
      }

      if (elId) elId.textContent = claim.id;
      if (elDate) elDate.textContent = 'Filed: ' + (claim.submittedAt || '');
      if (elUrl) elUrl.textContent = claim.infringingUrl;
      if (elAllegation) elAllegation.textContent = claim.allegationDescription || claim.allegation || '';

      if (elSig) {
        const nameMatch = claim.claimant.match(/^(.*?)\s*\(/);
        elSig.textContent = nameMatch ? nameMatch[1] : (claim.swearSignature || claim.claimant);
      }
      if (elIp) elIp.textContent = claim.ip || 'Recorded';

      if (elDoc) {
        let docSrc = 'https://images.unsplash.com/photo-1614590740924-118bd314db83?w=600&h=400&fit=crop';
        if (claim.files && claim.files[0]) {
          docSrc = typeof claim.files[0] === 'object' ? (claim.files[0].path || claim.files[0].url || docSrc) : claim.files[0];
        }
        elDoc.src = docSrc;
      }
      
      if (statusRow) {
        let statusClass = 'pending';
        let statusText = 'PENDING REVIEW';
        if (claim.status && claim.status.includes('RESOLVED')) {
          statusClass = 'resolved';
          statusText = 'RESOLVED';
        } else if (claim.status && claim.status.includes('DISMISSED')) {
          statusClass = 'rejected';
          statusText = 'REJECTED';
        }
        const oldPill = statusRow.querySelector('.status-pill');
        if (oldPill) oldPill.remove();
        const pill = document.createElement('span');
        pill.className = `status-pill ${statusClass}`;
        pill.textContent = statusText;
        statusRow.appendChild(pill);
      }

      const jumpBtn = document.querySelector('.target-url-box .btn-jump');
      if (jumpBtn) {
        jumpBtn.onclick = () => {
          if (claim.infringingUrl) window.open(claim.infringingUrl, '_blank');
        };
      }

      const downloadBtn = document.querySelector('.btn-download-doc');
      if (downloadBtn) {
        downloadBtn.onclick = () => {
          let fileUrl = '#';
          if (claim.files && claim.files[0]) {
            fileUrl = typeof claim.files[0] === 'object' ? (claim.files[0].path || claim.files[0].url || fileUrl) : claim.files[0];
          }
          window.open(fileUrl, '_blank');
        };
      }

      const rejectBtn = document.querySelector('.btn-legal-reject');
      const executeBtn = document.querySelector('.btn-legal-execute');
      const isResolved = claim.status && (claim.status.includes('RESOLVED') || claim.status.includes('DISMISSED'));
      if (rejectBtn) rejectBtn.disabled = isResolved;
      if (executeBtn) executeBtn.disabled = isResolved;
    }

    if (claims.length > 0) {
      selectClaim(claims[0]);
    }

    tickets.forEach(ticket => {
      ticket.addEventListener('click', () => {
        tickets.forEach(t => t.classList.remove('active'));
        ticket.classList.add('active');

        const id = ticket.getAttribute('data-id');
        const claim = claims.find(c => c.id === id);
        if (claim) selectClaim(claim);

        if (window.innerWidth <= 900 && drawer) drawer.classList.add('open');
      });
    });

    if (closeBtn) {
      closeBtn.onclick = () => { if (drawer) drawer.classList.remove('open'); };
    }

    if (drawer) {
      const dragHandle = drawer.querySelector('.drawer-drag-handle');
      if (dragHandle) {
        dragHandle.onclick = () => drawer.classList.remove('open');
      }
    }

    const rejectBtn = document.querySelector('.btn-legal-reject');
    const executeBtn = document.querySelector('.btn-legal-execute');

    if (rejectBtn) {
      rejectBtn.onclick = () => {
        if (!activeClaim) return;
        showConfirmModal(`Reject claim ${activeClaim.id}? This will dismiss the infringement allegation.`, async () => {
          try {
            const res = await fetch(`/api/admin/dmca/${activeClaim.id}/dismiss`, { method: 'POST' });
            if (res.ok) {
              showToast("Claim Rejected", `DMCA claim ${activeClaim.id} was dismissed.`);
              loadAdminLegal();
            } else {
              showToast("Dismissal Failed", "System could not update claim status.", true);
            }
          } catch (e) {
            console.error(e);
            showToast("Error", "A network error occurred.", true);
          }
        });
      };
    }

    if (executeBtn) {
      executeBtn.onclick = () => {
        if (!activeClaim) return;
        showConfirmModal(`EXECUTE TAKEDOWN for claim ${activeClaim.id}? Offending asset will be deleted from the platform.`, async () => {
          try {
            const res = await fetch(`/api/admin/dmca/${activeClaim.id}/execute`, { method: 'POST' });
            if (res.ok) {
              showToast("Takedown Completed", `Asset was successfully purged. Claim ${activeClaim.id} resolved.`);
              loadAdminLegal();
            } else {
              showToast("Takedown Failed", "System could not execute takedown.", true);
            }
          } catch (e) {
            console.error(e);
            showToast("Error", "A network error occurred.", true);
          }
        });
      };
    }
  }
  // ==========================================
  // COMMUNITY HUB (MODERATION ENGINE)
  // ==========================================

  async function loadAdminCommunity() {
    const listContainer = document.getElementById('mod-list-container');
    const threadVisualizer = document.getElementById('mod-thread-visualizer');
    const reportLedger = document.getElementById('mod-report-ledger');
    if (!listContainer || !threadVisualizer || !reportLedger) return;

    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Synchronizing comment and voting logs...</div>';

    try {
      const res = await fetch('/api/admin/community/flags');
      if (!res.ok) throw new Error("Failed to fetch flag tickets");
      const data = await res.json();
      const tickets = data.tickets || [];

      let filteredTickets = [...tickets];
      let activeTabIdx = 0; // Default to Flagged Content

      function renderList() {
        // Filter depending on selected tab
        if (activeTabIdx === 0) {
          // Flagged Content: reports > 0, severity is not anomalous
          filteredTickets = tickets.filter(t => t.reports > 0 && t.reportsText !== 'Anomalous');
        } else if (activeTabIdx === 1) {
          // Anomalous Votes: reportsText is Anomalous
          filteredTickets = tickets.filter(t => t.reportsText === 'Anomalous');
        } else {
          // Global Stream: show all
          filteredTickets = [...tickets];
        }

        listContainer.innerHTML = '';
        if (filteredTickets.length === 0) {
          listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No items in this queue.</div>';
          clearCommunityDetails();
          return;
        }

        listContainer.innerHTML = filteredTickets.map((t, index) => {
          let iconHTML = '';
          if (t.severity === 'high') {
            iconHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2v-4h2v4z"></path></svg>`;
          } else if (t.severity === 'medium') {
            iconHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2v-4h2v4z"></path></svg>`;
          }

          let countClass = '';
          if (t.severity === 'high') countClass = 'red';
          else if (t.severity === 'medium') countClass = 'yellow';

          return `
            <div class="mod-ticket severity-${t.severity} ${index === 0 ? 'active' : ''}" data-id="${t.id}">
              <div class="mod-icon">${iconHTML}</div>
              <div class="mod-avatar"><img src="${t.avatar || '/images/avatars/avatar_retro.png'}" alt="${t.user}"></div>
              <div class="mod-content">
                <div class="mod-user-row">
                  <span class="mod-username">${t.user}</span>
                  <span class="mod-time">${t.time || ''}</span>
                </div>
                <div class="mod-text">${t.text}</div>
              </div>
              <div class="mod-meta">
                <span class="mod-meta-count ${countClass}">${t.reportsText || (t.reports + ' Reports')}</span>
                ${t.reports > 0 ? `<span class="mod-meta-label"></span>` : ''}
              </div>
            </div>
          `;
        }).join('');

        bindCommunityEvents(filteredTickets);
      }

      // Bind tabs
      const tabs = document.querySelectorAll('.mod-tabs button, .mod-filter-pills-mobile button');
      tabs.forEach((tab, index) => {
        tab.onclick = (e) => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const txt = tab.textContent.toLowerCase();
          if (txt.includes('flagged') || txt.includes('high severity')) {
            activeTabIdx = 0;
          } else if (txt.includes('anomalous') || txt.includes('vote')) {
            activeTabIdx = 1;
          } else {
            activeTabIdx = 2;
          }
          renderList();
        };
      });

      renderList();
    } catch(e) {
      console.error(e);
      listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Failed to fetch community moderation logs.</div>';
    }
  }

  function clearCommunityDetails() {
    const threadVisualizer = document.getElementById('mod-thread-visualizer');
    const reportLedger = document.getElementById('mod-report-ledger');
    if (threadVisualizer) threadVisualizer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No details available.</div>';
    if (reportLedger) reportLedger.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888;">No reports.</td></tr>';
  }

  function bindCommunityEvents(tickets) {
    const listContainer = document.getElementById('mod-list-container');
    const ticketElements = listContainer.querySelectorAll('.mod-ticket');
    const threadVisualizer = document.getElementById('mod-thread-visualizer');
    const reportLedger = document.getElementById('mod-report-ledger');
    const drawer = document.getElementById('mod-details-drawer');

    let activeTicket = null;

    function renderDetails(ticket) {
      activeTicket = ticket;
      if (!ticket) {
        clearCommunityDetails();
        return;
      }

      // Render Thread
      threadVisualizer.innerHTML = ticket.thread ? ticket.thread.map(item => {
        const replyClass = item.isReply ? 'reply' : '';
        const flaggedClass = item.isFlagged ? 'flagged' : '';
        return `
          <div class="thread-item ${replyClass} ${flaggedClass}">
            <div class="thread-avatar"><img src="${item.avatar || '/images/avatars/avatar_retro.png'}"></div>
            <div class="thread-content">
              <div class="thread-meta">
                <span class="username">${item.user}</span>
                <span class="time">&bull; ${item.time || ''}</span>
                ${item.isFlagged ? '<span class="flag-badge">FLAGGED <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" style="vertical-align:middle;margin-left:4px;"><path d="M12 2L1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2v-4h2v4z"></path></svg></span>' : ''}
              </div>
              <div class="thread-text">${item.text}</div>
              <div class="thread-actions">
                <span>↑ ${item.up || 0}</span>
                <span>↓ ${item.down || 0}</span>
                <span>...</span>
              </div>
            </div>
          </div>
        `;
      }).join('') : '';

      // Render Ledger
      reportLedger.innerHTML = ticket.reporters && ticket.reporters.length > 0 ? ticket.reporters.map(r => `
        <tr>
          <td>${r.name}</td>
          <td>${r.time || ''}</td>
          <td>${r.reason}</td>
        </tr>
      `).join('') : '<tr><td colspan="3" style="text-align:center;color:#888;">No explicit reports (System Flagged)</td></tr>';

      // Recalibration block visibility
      const recalHeader = document.querySelector('.voting-recal-header .spike-alert');
      const voteCountText = document.querySelector('.votes-count');
      if (recalHeader && voteCountText) {
        if (ticket.reportsText === 'Anomalous') {
          recalHeader.style.display = 'flex';
          voteCountText.innerHTML = '12,041 <br><small>Votes (Last 60 Min)</small>';
        } else {
          recalHeader.style.display = 'none';
          voteCountText.innerHTML = '2,847 <br><small>Votes (Last 60 Min)</small>';
        }
      }
    }

    // Select first ticket by default
    if (tickets.length > 0) {
      renderDetails(tickets[0]);
    }

    ticketElements.forEach(ticketEl => {
      ticketEl.addEventListener('click', () => {
        ticketElements.forEach(t => t.classList.remove('active'));
        ticketEl.classList.add('active');

        const id = parseInt(ticketEl.getAttribute('data-id'));
        const ticketData = tickets.find(t => t.id === id);
        if (ticketData) {
          renderDetails(ticketData);
        }

        if (window.innerWidth <= 900 && drawer) {
          drawer.classList.add('open');
        }
      });
    });

    if (drawer) {
      const dragHandle = drawer.querySelector('.drawer-drag-handle');
      if (dragHandle) {
        dragHandle.addEventListener('click', () => drawer.classList.remove('open'));
      }
    }

    // Wire recalibration slider and revert button
    const recalSlider = document.getElementById('mod-recal-slider');
    const recalLabel = document.querySelector('.slider-time-label');
    if (recalSlider && recalLabel) {
      recalSlider.oninput = (e) => {
        recalLabel.textContent = `${e.target.value} minutes ago`;
      };

      recalSlider.onchange = (e) => {
        triggerRecalibrate(parseInt(e.target.value));
      };
    }

    const revertBtn = document.querySelector('.btn-revert-vote');
    if (revertBtn) {
      revertBtn.onclick = () => {
        const val = recalSlider ? parseInt(recalSlider.value) : 30;
        triggerRecalibrate(val);
      };
    }

    async function triggerRecalibrate(minutes) {
      showConfirmModal(`Revert voting logs and filter velocity spikes from the last ${minutes} minutes?`, async () => {
        try {
          const res = await fetch('/api/admin/community/recalibrate-votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limitMinutes: minutes })
          });
          if (res.ok) {
            showToast("Recalibration Completed", `Rolled back anomalous votes from last ${minutes} min.`);
            loadAdminCommunity();
          } else {
            showToast("Action Denied", "Voting rollback failed.", true);
          }
        } catch(e) {
          console.error(e);
        }
      });
    }

    // Wire up moderator actions
    const ignoreBtns = document.querySelectorAll('.btn-mod-ignore');
    const purgeBtns = document.querySelectorAll('.btn-mod-purge');
    const strikeBtns = document.querySelectorAll('.btn-mod-strike');

    ignoreBtns.forEach(btn => {
      btn.onclick = () => {
        if (!activeTicket) return;
        showConfirmModal("Are you sure you want to dismiss report flags for this comment?", async () => {
          try {
            const res = await fetch(`/api/admin/community/comments/${activeTicket.id}/approve`, { method: 'POST' });
            if (res.ok) {
              showToast("Flags Cleared", "Comment approved and flags removed.");
              loadAdminCommunity();
            } else {
              showToast("Action Failed", "Failed to clear flags.", true);
            }
          } catch(e) {
            console.error(e);
          }
        });
      };
    });

    purgeBtns.forEach(btn => {
      btn.onclick = () => {
        if (!activeTicket) return;
        showConfirmModal("Confirm deletion of this flagged content. It will be permanently removed.", async () => {
          try {
            const res = await fetch(`/api/admin/community/comments/${activeTicket.id}/delete`, { method: 'POST' });
            if (res.ok) {
              showToast("Content Deleted", "Comment has been removed.");
              loadAdminCommunity();
            } else {
              showToast("Action Failed", "Failed to delete comment.", true);
            }
          } catch(e) {
            console.error(e);
          }
        });
      };
    });

    strikeBtns.forEach(btn => {
      btn.onclick = () => {
        if (!activeTicket) return;
        const cleanUser = activeTicket.user.replace(/^@/, '');
        showConfirmModal(`Confirm banning user @${cleanUser} and purging all flagged content?`, async () => {
          try {
            const res = await fetch(`/api/admin/community/users/${activeTicket.user}/ban`, { method: 'POST' });
            if (res.ok) {
              showToast("User Banned", `@${cleanUser} has been banned.`);
              loadAdminCommunity();
            } else {
              showToast("Action Failed", "Failed to ban user.", true);
            }
          } catch(e) {
            console.error(e);
          }
        });
      };
    });
  }

  /* ==========================================================================
     OPERATIONS TRIAGE / REPORT QUEUE LOGIC
     ========================================================================== */
  function checkAdminAuthStatus(res) {
    if (!res) return false;
    if (res.status === 401 || res.status === 403) {
      showToast("Session Expired", "Please log in again as administrator.");
      openAuthOverlay();
      selectCategory('home');
      return true;
    }
    return false;
  }

  async function loadAdminReports() {
    const listContainer = document.getElementById('triage-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Fetching system triage reports...</div>';

    try {
      const res = await fetch('/api/admin/reports');
      if (checkAdminAuthStatus(res)) return;
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      const reports = data.reports || [];

      let filteredReports = [...reports];
      let activeTabIdx = 0; // Default to Asset Flags

      function renderList() {
        // Filter depending on selected tab
        if (activeTabIdx === 0) {
          // Asset Flags: type is image or tag
          filteredReports = reports.filter(r => r.type === 'image' || r.type === 'tag');
        } else if (activeTabIdx === 1) {
          // User Reports: type is user
          filteredReports = reports.filter(r => r.type === 'user');
        } else if (activeTabIdx === 2) {
          // Spam/Bot Nets: type is bot
          filteredReports = reports.filter(r => r.type === 'bot');
        } else {
          filteredReports = [...reports];
        }

        listContainer.innerHTML = '';
        if (filteredReports.length === 0) {
          listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No reports in this queue.</div>';
          clearReportsDetails();
          return;
        }

        filteredReports.forEach((ticket, index) => {
          const el = document.createElement('div');
          el.className = `triage-ticket ${ticket.severity === 'high' ? 'severity-high' : ''} ${index === 0 ? 'active' : ''}`;
          el.setAttribute('data-id', ticket.id);

          el.innerHTML = `
            <div class="triage-dot-col">
              <span class="${ticket.severity === 'high' ? 'dot-red' : 'dot-yellow'}"></span>
            </div>
            <div class="triage-icon-box">
              ${ticket.iconHtml || ''}
            </div>
            <div class="triage-content">
              <div class="triage-title">${ticket.title}</div>
              <div class="triage-meta-row">TARGET: <span>${ticket.target}</span></div>
              <div class="triage-meta-row">BY: <span>${ticket.by}</span></div>
            </div>
            <div class="triage-stats">
              <div class="triage-time">${ticket.time || ''}</div>
              <div class="triage-report-count">${ticket.reports || 0}</div>
              <div class="triage-nested">Reports Nested &gt;</div>
            </div>
          `;
          listContainer.appendChild(el);
        });

        bindReportsEvents(filteredReports);
      }

      // Bind tabs
      const tabs = document.querySelectorAll('.triage-tabs button, .triage-filter-pills-mobile button');
      tabs.forEach((tab, index) => {
        tab.onclick = (e) => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const txt = tab.textContent.toLowerCase();
          if (txt.includes('asset') || txt.includes('image') || txt.includes('quality')) {
            activeTabIdx = 0;
          } else if (txt.includes('user')) {
            activeTabIdx = 1;
          } else if (txt.includes('spam') || txt.includes('bot')) {
            activeTabIdx = 2;
          } else {
            activeTabIdx = 3;
          }
          renderList();
        };
      });

      renderList();
    } catch(e) {
      console.error(e);
      listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Failed to retrieve triage database.</div>';
    }
  }

  function clearReportsDetails() {
    const reportIdEl = document.querySelector('.report-id');
    const viewer = document.getElementById('triage-target-viewer');
    const ledger = document.getElementById('triage-interrogation-ledger');
    const contextGrid = document.getElementById('triage-context-grid');
    const metricsGrid = document.getElementById('triage-metrics-grid');

    if (reportIdEl) reportIdEl.textContent = 'Report ID: None';
    if (viewer) viewer.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #888;">No asset loaded.</div>';
    if (ledger) ledger.innerHTML = '<table class="ledger-table"><tbody><tr><td style="text-align:center;color:#888;">No reports.</td></tr></tbody></table>';
    if (contextGrid) contextGrid.innerHTML = '';
    if (metricsGrid) metricsGrid.innerHTML = '';
  }

  function bindReportsEvents(reports) {
    const listContainer = document.getElementById('triage-list-container');
    const ticketElements = listContainer.querySelectorAll('.triage-ticket');
    const drawer = document.getElementById('triage-drawer');
    const drawerClose = document.querySelector('.triage-drawer-close');

    let activeReport = null;

    const renderTriageDetails = (ticket) => {
      activeReport = ticket;
      if (!ticket) {
        clearReportsDetails();
        return;
      }

      const reportIdEl = document.querySelector('.report-id');
      if (reportIdEl) reportIdEl.textContent = `Report ID: ${ticket.id}`;

      const viewer = document.getElementById('triage-target-viewer');
      if (viewer) {
        viewer.innerHTML = `
          <img src="${ticket.imageFull || 'https://images.unsplash.com/photo-1542451542907-6cf80ff362d6?w=600&h=337&fit=crop'}" alt="Target">
          <div class="target-overlay">
            <span>UPLOADER: ${ticket.uploader || 'anonymous'}</span>
            <span>UPLOADED: ${ticket.uploadTime || ''}</span>
          </div>
        `;
      }

      const ledger = document.getElementById('triage-interrogation-ledger');
      if (ledger) {
        let ledgerRows = ticket.ledger && ticket.ledger.length > 0 ? ticket.ledger.map(row => `
          <tr>
            <td>
              <div class="ledger-reporter">
                <img src="${row.avatar || 'https://i.pravatar.cc/100?img=33'}" alt="${row.rep}">
                ${row.rep}
              </div>
            </td>
            <td><div class="ledger-reason">${row.text}</div></td>
            <td><div class="ledger-score ${row.scoreClass || 'score-med'}">${row.score || 70}</div></td>
            <td><div class="ledger-time">${row.time || ''}</div></td>
          </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center;color:#888;">No explicit reports.</td></tr>';

        ledger.innerHTML = `
          <table class="ledger-table">
            <thead>
              <tr>
                <th>REPORTER</th>
                <th>COMPLAINT / REASON</th>
                <th style="text-align:center;">TRUST SCORE</th>
                <th style="text-align:right;">REPORTED</th>
              </tr>
            </thead>
            <tbody>${ledgerRows}</tbody>
          </table>
        `;
      }

      const contextGrid = document.getElementById('triage-context-grid');
      if (contextGrid && ticket.context) {
        contextGrid.innerHTML = `
          <div class="metric-box"><span class="metric-label">CATEGORY</span><span class="metric-val">${ticket.context.category || 'N/A'}</span></div>
          <div class="metric-box"><span class="metric-label">RESOLUTION</span><span class="metric-val">${ticket.context.res || 'N/A'}</span></div>
          <div class="metric-box"><span class="metric-label">FILE SIZE</span><span class="metric-val">${ticket.context.size || 'N/A'}</span></div>
          <div class="metric-box"><span class="metric-label">UPVOTES</span><span class="metric-val">${ticket.context.upvotes || 'N/A'}</span></div>
          <div class="metric-box"><span class="metric-label">VIEWS</span><span class="metric-val">${ticket.context.views || 'N/A'}</span></div>
        `;
      }

      const metricsGrid = document.getElementById('triage-metrics-grid');
      if (metricsGrid && ticket.metrics) {
        metricsGrid.innerHTML = `
          <div class="metric-box"><span class="metric-label">Reports Nested</span><span class="metric-val">${ticket.metrics.nested || 0}</span></div>
          <div class="metric-box"><span class="metric-label">First Reported</span><span class="metric-val">${ticket.metrics.first || ''}</span></div>
          <div class="metric-box"><span class="metric-label">Last Reported</span><span class="metric-val">${ticket.metrics.last || ''}</span></div>
          <div class="metric-box"><span class="metric-label">Total Upvotes</span><span class="metric-val">${ticket.metrics.totalUp || 0}</span></div>
          <div class="metric-box" style="border:none;"><span class="metric-label">Violations</span><span class="metric-val">${ticket.metrics.violations || 'None'}</span></div>
        `;
      }
    };

    // Render initial state
    if (reports.length > 0) {
      renderTriageDetails(reports[0]);
    }

    ticketElements.forEach(ticketEl => {
      ticketEl.addEventListener('click', () => {
        ticketElements.forEach(t => t.classList.remove('active'));
        ticketEl.classList.add('active');

        const id = ticketEl.getAttribute('data-id');
        const ticketData = reports.find(t => t.id === id);
        if (ticketData) {
          renderTriageDetails(ticketData);
        }

        if (window.innerWidth <= 900 && drawer) {
          drawer.classList.add('open');
        }
      });
    });

    if (drawerClose) {
      drawerClose.addEventListener('click', () => {
        if (drawer) drawer.classList.remove('open');
      });
    }

    if (drawer) {
      const dragHandle = drawer.querySelector('.drawer-drag-handle');
      if (dragHandle) {
        dragHandle.addEventListener('click', () => drawer.classList.remove('open'));
      }
    }

    // Action Buttons
    const ignoreBtns = document.querySelectorAll('.btn-triage-ignore');
    const purgeBtns = document.querySelectorAll('.btn-triage-purge');
    const strikeBtns = document.querySelectorAll('.btn-triage-strike');

    ignoreBtns.forEach(btn => {
      btn.onclick = () => {
        if (!activeReport) return;
        showConfirmModal("Are you sure you want to dismiss all flags on this asset? This clears the report status.", async () => {
          try {
            const res = await fetch(`/api/admin/reports/${activeReport.id}/dismiss`, { method: 'POST' });
            if (res.ok) {
              showToast("Report Dismissed", "Triage flags successfully dismissed.");
              loadAdminReports();
            } else {
              showToast("Action Failed", "Failed to dismiss reports.", true);
            }
          } catch(e) {
            console.error(e);
          }
        });
      };
    });

    purgeBtns.forEach(btn => {
      btn.onclick = () => {
        if (!activeReport) return;
        showConfirmModal("Purge this asset from feed? This will delete the wallpaper from the database.", async () => {
          try {
            const res = await fetch(`/api/admin/reports/${activeReport.id}/purge`, { method: 'POST' });
            if (res.ok) {
              showToast("Asset Purged", "The asset was removed and the report completed.");
              loadAdminReports();
            } else {
              showToast("Action Failed", "Failed to purge asset.", true);
            }
          } catch(e) {
            console.error(e);
          }
        });
      };
    });

    strikeBtns.forEach(btn => {
      btn.onclick = () => {
        if (!activeReport) return;
        const cleanUploader = activeReport.uploader.replace(/^@/, '');
        showConfirmModal(`Strike uploader @${cleanUploader} and purge the reported asset?`, async () => {
          try {
            const res = await fetch(`/api/admin/reports/${activeReport.id}/strike`, { method: 'POST' });
            if (res.ok) {
              showToast("User Banned & Asset Purged", `Struck uploader @${cleanUploader} and purged asset.`);
              loadAdminReports();
            } else {
              showToast("Action Failed", "Failed to execute strike action.", true);
            }
          } catch(e) {
            console.error(e);
          }
        });
      };
    });
  }

  // --- USER IDENTITY MATRIX LOGIC ---
  async function loadAdminUsersMatrix() {
    try {
      const res = await fetch('/api/admin/users');
      if (checkAdminAuthStatus(res)) return;
      if (!res.ok) throw new Error('Failed to fetch users');
      const users = await res.json();
      
      window.adminUsersData = users; // Cache for filtering
      renderUserMatrix(users);
      
      // Setup Search
      const searchInput = document.getElementById('user-matrix-search-input');
      if (searchInput) {
        searchInput.removeEventListener('input', filterUserMatrix);
        searchInput.addEventListener('input', filterUserMatrix);
      }
      
      // Setup Sidebar Close
      const closeBtn = document.getElementById('telemetry-close-btn');
      if (closeBtn) {
        closeBtn.removeEventListener('click', closeUserTelemetrySidebar);
        closeBtn.addEventListener('click', closeUserTelemetrySidebar);
      }
      
      // Setup Purge Button
      const btnPurge = document.getElementById('btn-sanction-purge');
      if (btnPurge) {
        const newBtn = btnPurge.cloneNode(true);
        btnPurge.parentNode.replaceChild(newBtn, btnPurge);
        newBtn.addEventListener('click', async () => {
          if (!window.activeTelemetryUsername) return;
          if (confirm(`Are you sure you want to permanently delete user @${window.activeTelemetryUsername}?`)) {
            try {
              await fetch(`/api/admin/users/${window.activeTelemetryUsername}`, { method: 'DELETE' });
              showToast("Success", "User Purged successfully.", false);
              loadAdminUsersMatrix();
              closeUserTelemetrySidebar();
            } catch(e) {
              console.error(e);
            }
          }
        });
      }
    } catch(err) {
      console.error(err);
      showToast("Error", "Could not load User Matrix.", true);
    }
  }
  window.loadAdminUsersMatrix = loadAdminUsersMatrix;

  function renderUserMatrix(users) {
    const tbody = document.getElementById('user-matrix-tbody');
    const countEl = document.getElementById('user-matrix-count');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    countEl.textContent = `Showing ${users.length} users`;
    
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.className = 'user-matrix-row';
      tr.style.cursor = 'pointer';
      tr.dataset.username = u.username;
      
      const isBanned = u.role === 'Banned' || u.status === 'SHADOWBANNED';
      const statusClass = isBanned ? 'status-shadowbanned' : 'status-active';
      const statusText = isBanned ? 'SHADOWBANNED' : 'ACTIVE';
      
      tr.innerHTML = `
        <td>
          <div class="user-identity-cell">
            <img src="${u.avatar || '/images/avatars/avatar_vagrant.png'}" class="user-identity-avatar" alt="">
            <div class="user-identity-info">
              <span class="user-identity-name">${u.fullName || u.username}</span>
              <span class="user-identity-handle">@${u.username}</span>
            </div>
          </div>
        </td>
        <td><span class="user-contact-email">${u.email}</span></td>
        <td><span class="user-join-date">${u.joinedAt || '--'}</span></td>
        <td>
          <div class="user-status-cell ${statusClass}">
            <div class="status-dot" style="margin-right: 6px;"></div> ${statusText}
          </div>
        </td>
        <td><button class="user-action-btn">Inspect</button></td>
      `;
      
      tr.addEventListener('click', () => {
        document.querySelectorAll('.user-matrix-row').forEach(row => row.classList.remove('selected'));
        tr.classList.add('selected');
        openUserTelemetrySidebar(u);
      });
      tbody.appendChild(tr);
    });
  }

  function filterUserMatrix(e) {
    const query = e.target.value.toLowerCase();
    if (!window.adminUsersData) return;
    
    const filtered = window.adminUsersData.filter(u => {
      return (u.username && u.username.toLowerCase().includes(query)) ||
             (u.fullName && u.fullName.toLowerCase().includes(query)) ||
             (u.email && u.email.toLowerCase().includes(query)) ||
             (u.lastKnownIp && u.lastKnownIp.includes(query));
    });
    renderUserMatrix(filtered);
  }

  function openUserTelemetrySidebar(u) {
    window.activeTelemetryUsername = u.username;
    const sidebar = document.getElementById('telemetry-sidebar');
    if (!sidebar) return;
    
    document.getElementById('telemetry-avatar').src = u.avatar || '/images/avatars/avatar_vagrant.png';
    document.getElementById('telemetry-username').textContent = '@' + u.username;
    document.getElementById('telemetry-email').textContent = u.email;
    document.getElementById('telemetry-ip').textContent = u.lastKnownIp || '--';
    document.getElementById('telemetry-device').textContent = u.deviceType || '--';
    document.getElementById('telemetry-location').textContent = u.location || '--';
    document.getElementById('telemetry-uploads').textContent = u.totalUploads || 0;
    document.getElementById('telemetry-saves').textContent = u.totalSaves || 0;
    document.getElementById('telemetry-last-active').textContent = 'Just now';
    document.getElementById('telemetry-trust').textContent = u.trustScore ? u.trustScore + '/100' : '--';
    
    const statusBadge = document.getElementById('telemetry-status-badge');
    const isBanned = u.role === 'Banned' || u.status === 'SHADOWBANNED';
    
    if (isBanned) {
      statusBadge.className = 'status-badge shadowbanned';
      statusBadge.innerHTML = '<div class="status-dot"></div> SHADOWBANNED';
    } else {
      statusBadge.className = 'status-badge';
      statusBadge.innerHTML = '<div class="status-dot"></div> ACTIVE';
    }
    
    const btnShadowban = document.getElementById('btn-sanction-shadowban');
    if (btnShadowban) {
      if (isBanned) {
        btnShadowban.textContent = 'RESTORE NODE';
        btnShadowban.style.color = '#065F46';
      } else {
        btnShadowban.textContent = 'SHADOWBAN NODE';
        btnShadowban.style.color = '';
      }
      
      const newBtn = btnShadowban.cloneNode(true);
      btnShadowban.parentNode.replaceChild(newBtn, btnShadowban);
      newBtn.addEventListener('click', async () => {
        try {
          await fetch(`/api/admin/users/${u.username}/status`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: isBanned ? 'ACTIVE' : 'SHADOWBANNED'})
          });
          showToast("Success", "User status updated.", false);
          loadAdminUsersMatrix();
          if (!isBanned) {
             document.getElementById('telemetry-status-badge').className = 'status-badge shadowbanned';
             document.getElementById('telemetry-status-badge').innerHTML = '<div class="status-dot"></div> SHADOWBANNED';
          } else {
             document.getElementById('telemetry-status-badge').className = 'status-badge';
             document.getElementById('telemetry-status-badge').innerHTML = '<div class="status-dot"></div> ACTIVE';
          }
          closeUserTelemetrySidebar();
        } catch(e) {
          console.error(e);
        }
      });
    }
    
    sidebar.style.display = 'flex';
  }

  window.closeUserTelemetrySidebar = function() {
    window.activeTelemetryUsername = null;
    const sidebar = document.getElementById('telemetry-sidebar');
    if (sidebar) sidebar.style.display = 'none';
    document.querySelectorAll('.user-matrix-row').forEach(row => row.classList.remove('selected'));
  }

  // --- 23B. CURATION ENGINE (COLLECTIONS PACK BUILDER) ---
  let activeCollectionId = 'new';
  let selectedWallpapers = [];
  let allWallpapers = [];
  let allCollections = [];
  let activeCoverBase64 = null;
  let inventorySearchQuery = '';
  let activeInventoryTag = 'all';
  let inventoryCurrentPage = 1;
  const inventoryItemsPerPage = 12;

  async function loadAdminCollections() {
    const invGrid = document.getElementById('inventory-grid-container');
    const builderGrid = document.getElementById('builder-assets-container');
    const selectDropdown = document.getElementById('admin-collection-select');
    
    if (!invGrid || !builderGrid || !selectDropdown) return;

    try {
      // 1. Fetch collections & wallpapers
      const [colRes, wpRes] = await Promise.all([
        fetch('/api/admin/collections'),
        fetch('/api/wallpapers')
      ]);

      if (checkAdminAuthStatus(colRes)) return;

      if (colRes.ok) allCollections = await colRes.json();
      if (wpRes.ok) allWallpapers = await wpRes.json();

      // 2. Render collections selector dropdown options
      renderCollectionsDropdown();

      // 3. Render Asset Inventory
      renderInventory();

      // 4. Render Active Builder Assets
      renderBuilderAssets();

      // 5. Setup Drag-and-Drop & general event listeners once
      setupCurationEngineEvents();
    } catch(err) {
      console.error("[CURATION ENGINE] Init failed:", err);
      showToast("Error", "Failed to initialize curation engine.", true);
    }
  }

  function renderCollectionsDropdown() {
    const selectDropdown = document.getElementById('admin-collection-select');
    if (!selectDropdown) return;
    
    // Keep first option "+ Create New"
    selectDropdown.innerHTML = '<option value="new">+ Create New Collection</option>';
    
    allCollections.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      const statusText = c.isDraft ? ' [DRAFT]' : ' [PUBLISHED]';
      opt.textContent = `&nbsp;${c.title}${statusText}`;
      selectDropdown.appendChild(opt);
    });
    
    selectDropdown.value = activeCollectionId;
    
    // Show/hide delete button
    const deleteBtn = document.getElementById('btn-delete-active-collection');
    if (deleteBtn) {
      deleteBtn.style.display = (activeCollectionId === 'new') ? 'none' : 'flex';
    }
  }

  function renderInventory() {
    const invGrid = document.getElementById('inventory-grid-container');
    const paginationInfo = document.getElementById('inventory-pagination-info');
    const paginationControls = document.getElementById('inventory-pagination-controls');
    
    if (!invGrid) return;

    // Filter wallpapers
    let filtered = [...allWallpapers];

    // Apply tag pill filter
    if (activeInventoryTag !== 'all') {
      if (activeInventoryTag === 'mobile') {
        filtered = filtered.filter(w => w.ratio === 'portrait');
      } else if (activeInventoryTag === '4K') {
        filtered = filtered.filter(w => w.quality === '4K' || w.resolution.includes('3840'));
      } else {
        // Tag starts with #
        const cleanTag = activeInventoryTag.toLowerCase();
        filtered = filtered.filter(w => 
          Array.isArray(w.tags) && w.tags.some(t => t.toLowerCase() === cleanTag)
        );
      }
    }

    // Apply search filter
    if (inventorySearchQuery.trim()) {
      const q = inventorySearchQuery.toLowerCase().trim();
      filtered = filtered.filter(w => 
        w.id.toLowerCase().includes(q) ||
        w.title.toLowerCase().includes(q) ||
        w.anime.toLowerCase().includes(q) ||
        (Array.isArray(w.tags) && w.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Pagination calculations
    const totalAssets = filtered.length;
    const totalPages = Math.ceil(totalAssets / inventoryItemsPerPage) || 1;
    
    if (inventoryCurrentPage > totalPages) inventoryCurrentPage = totalPages;
    if (inventoryCurrentPage < 1) inventoryCurrentPage = 1;

    const startIndex = (inventoryCurrentPage - 1) * inventoryItemsPerPage;
    const endIndex = Math.min(startIndex + inventoryItemsPerPage, totalAssets);

    const pageItems = filtered.slice(startIndex, endIndex);

    // Update Pagination Info
    if (paginationInfo) {
      if (totalAssets === 0) {
        paginationInfo.textContent = 'Showing 0 to 0 of 0 assets';
      } else {
        paginationInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalAssets} assets`;
      }
    }

    // Draw grid
    invGrid.innerHTML = '';
    if (pageItems.length === 0) {
      invGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#8a8a8f;font-weight:500;">No inventory assets match.</div>';
    } else {
      pageItems.forEach(w => {
        const card = document.createElement('div');
        card.className = 'inventory-item-card';
        card.draggable = true;
        card.setAttribute('data-wp-id', w.id);
        
        // Determine resolution/quality label
        let badgeText = '4K';
        if (w.ratio === 'portrait') badgeText = 'Mobile';
        else if (w.resolution.includes('2560') || w.quality === 'QHD') badgeText = 'QHD';
        else if (w.quality) badgeText = w.quality;

        card.innerHTML = `
          <img src="${w.image}" class="inventory-item-img" alt="${w.title}" loading="lazy">
          <span class="inventory-badge">${badgeText}</span>
`;

        // Bind dragstart
        card.addEventListener('dragstart', (e) => {
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', w.id);
        });
        
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
        });

        // Add on click to inject immediately
        const addFn = () => {
          if (selectedWallpapers.length >= 50) {
            showToast("Limit Reached", "Max limit is 50 assets per collection.", true);
            return;
          }
          if (selectedWallpapers.includes(w.id)) {
            showToast("Already Added", "This asset is already in the collection.", true);
            return;
          }
          selectedWallpapers.push(w.id);
          renderBuilderAssets();
        };

        card.addEventListener('click', addFn);
        invGrid.appendChild(card);
      });
    }

    // Render Pagination Controls
    if (paginationControls) {
      paginationControls.innerHTML = '';
      
      // Prev button
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.innerHTML = '&lt;';
      prevBtn.disabled = (inventoryCurrentPage === 1);
      prevBtn.addEventListener('click', () => {
        inventoryCurrentPage--;
        renderInventory();
      });
      paginationControls.appendChild(prevBtn);

      // Page numbers (smart rendering: first, current, last, with ellipses if needed)
      const maxButtons = 5;
      let startPage = Math.max(1, inventoryCurrentPage - 2);
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);
      if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }

      for (let p = startPage; p <= endPage; p++) {
        const pBtn = document.createElement('button');
        pBtn.type = 'button';
        pBtn.textContent = p;
        if (p === inventoryCurrentPage) pBtn.className = 'active';
        pBtn.addEventListener('click', () => {
          inventoryCurrentPage = p;
          renderInventory();
        });
        paginationControls.appendChild(pBtn);
      }

      // Next button
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.innerHTML = '&gt;';
      nextBtn.disabled = (inventoryCurrentPage === totalPages);
      nextBtn.addEventListener('click', () => {
        inventoryCurrentPage++;
        renderInventory();
      });
      paginationControls.appendChild(nextBtn);
    }
  }

  function renderBuilderAssets() {
    const builderGrid = document.getElementById('builder-assets-container');
    const counter = document.getElementById('pack-assets-counter');
    const mobileGrid = document.getElementById('mobile-assets-container');
    const mobileCounter = document.getElementById('mobile-assets-counter');
    
    if (!builderGrid) return;

    // Update counters
    const countText = `${selectedWallpapers.length} / 50 Assets`;
    if (counter) counter.textContent = countText;
    const shortCountText = `${selectedWallpapers.length} / 50`;
    if (mobileCounter) mobileCounter.textContent = shortCountText;

    // Clear and draw desktop grid
    builderGrid.innerHTML = '';
    if (selectedWallpapers.length === 0) {
      builderGrid.innerHTML = '<div class="grid-empty-state" id="builder-grid-empty">Drag wallpapers here or click them from the inventory to add.</div>';
    } else {
      selectedWallpapers.forEach(wpId => {
        const wp = allWallpapers.find(w => w.id === wpId);
        if (wp) {
          const card = document.createElement('div');
          card.className = 'builder-asset-card';
          card.innerHTML = `
            <img src="${wp.image}" alt="${wp.title}">
            <button class="btn-remove-asset" type="button" data-wp-id="${wpId}">&times;</button>
`;
          card.querySelector('.btn-remove-asset').addEventListener('click', (e) => {
            e.stopPropagation();
            selectedWallpapers = selectedWallpapers.filter(id => id !== wpId);
            renderBuilderAssets();
          });
          builderGrid.appendChild(card);
        }
      });
    }

    // Clear and draw mobile grid
    if (mobileGrid) {
      mobileGrid.innerHTML = '';
      if (selectedWallpapers.length === 0) {
        mobileGrid.innerHTML = '<div class="mobile-empty-state" id="mobile-grid-empty">No assets added yet. Tap "+ INJECT ASSETS" to select wallpapers.</div>';
      } else {
        selectedWallpapers.forEach(wpId => {
          const wp = allWallpapers.find(w => w.id === wpId);
          if (wp) {
            const card = document.createElement('div');
            card.className = 'mobile-asset-card';
            card.innerHTML = `
              <img src="${wp.image}" alt="${wp.title}">
              <button class="btn-remove-asset-mobile" type="button" data-wp-id="${wpId}">&minus;</button>
`;
            card.querySelector('.btn-remove-asset-mobile').addEventListener('click', (e) => {
              e.stopPropagation();
              selectedWallpapers = selectedWallpapers.filter(id => id !== wpId);
              renderBuilderAssets();
            });
            mobileGrid.appendChild(card);
          }
        });
      }
    }
  }

  function setupCurationEngineEvents() {
    if (window.curationEventsWired) return;
    window.curationEventsWired = true;

    const searchInput = document.getElementById('inventory-search-input');
    const selectDropdown = document.getElementById('admin-collection-select');
    const deleteBtn = document.getElementById('btn-delete-active-collection');
    
    // Tag Pills clicks
    document.querySelectorAll('.inv-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.inv-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeInventoryTag = pill.getAttribute('data-tag');
        inventoryCurrentPage = 1;
        renderInventory();
      });
    });

    // Search input typing
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        inventorySearchQuery = e.target.value;
        inventoryCurrentPage = 1;
        renderInventory();
      });
    }

    // Dropdown change
    if (selectDropdown) {
      selectDropdown.addEventListener('change', (e) => {
        loadActiveCollection(e.target.value);
      });
    }

    // Save Draft & Publish submissions
    const saveDraftBtn = document.getElementById('btn-collection-save-draft');
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener('click', () => {
        submitCollection(true);
      });
    }

    const publishBtn = document.getElementById('btn-collection-publish');
    if (publishBtn) {
      publishBtn.addEventListener('click', () => {
        submitCollection(false);
      });
    }

    // Delete Collection button
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        deleteActiveCollection();
      });
    }

    // Drag over and Drop on active collection builder grid
    const builderGrid = document.getElementById('builder-assets-container');
    if (builderGrid) {
      builderGrid.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });

      builderGrid.addEventListener('drop', (e) => {
        e.preventDefault();
        const wpId = e.dataTransfer.getData('text/plain');
        if (wpId) {
          if (selectedWallpapers.length >= 50) {
            showToast("Limit Reached", "Max limit is 50 assets per collection.", true);
            return;
          }
          if (selectedWallpapers.includes(wpId)) {
            showToast("Already Added", "This asset is already in the collection.", true);
            return;
          }
          selectedWallpapers.push(wpId);
          renderBuilderAssets();
        }
      });
    }

    // Cover Image Drag & Drop / Tap to Upload
    const coverZone = document.getElementById('collection-cover-zone');
    const coverFileInput = document.getElementById('collection-cover-file');
    
    if (coverZone && coverFileInput) {
      coverZone.addEventListener('click', (e) => {
        if (e.target.className !== 'btn-remove-cover') {
          coverFileInput.click();
        }
      });

      coverFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleCoverFileSelect(file);
      });

      coverZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        coverZone.classList.add('dragover');
      });

      coverZone.addEventListener('dragleave', () => {
        coverZone.classList.remove('dragover');
      });

      coverZone.addEventListener('drop', (e) => {
        e.preventDefault();
        coverZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          handleCoverFileSelect(file);
        }
      });
    }

    // --- MOBILE SPECIFIC INPUT SYNC & INTERACTIONS ---
    const mobileTitle = document.getElementById('mobile-collection-title');
    const desktopTitle = document.getElementById('collection-title-input');
    const mobileDesc = document.getElementById('mobile-collection-desc');
    const desktopDesc = document.getElementById('collection-desc-input');
    const mobileCoverZone = document.getElementById('mobile-cover-tapzone');
    
    if (mobileTitle && desktopTitle) {
      mobileTitle.addEventListener('input', (e) => {
        desktopTitle.value = e.target.value;
      });
      desktopTitle.addEventListener('input', (e) => {
        mobileTitle.value = e.target.value;
      });
    }

    if (mobileDesc && desktopDesc) {
      mobileDesc.addEventListener('input', (e) => {
        desktopDesc.value = e.target.value;
      });
      desktopDesc.addEventListener('input', (e) => {
        mobileDesc.value = e.target.value;
      });
    }

    if (mobileCoverZone) {
      mobileCoverZone.addEventListener('click', () => {
        if (coverFileInput) coverFileInput.click();
      });
    }

    // Mobile + Inject Assets click (opens injector overlay)
    const mobileInjectBtn = document.getElementById('btn-mobile-inject');
    const injectorPanel = document.getElementById('mobile-injector-panel');
    const injectorClose = document.getElementById('btn-mobile-injector-close');
    const injectorDone = document.getElementById('btn-mobile-injector-done');
    const injectorSearch = document.getElementById('mobile-injector-search');

    if (mobileInjectBtn && injectorPanel) {
      mobileInjectBtn.addEventListener('click', () => {
        renderMobileInjectorGrid();
        injectorPanel.style.display = 'flex';
      });
    }

    if (injectorClose && injectorPanel) {
      injectorClose.addEventListener('click', () => {
        injectorPanel.style.display = 'none';
      });
    }

    if (injectorDone && injectorPanel) {
      injectorDone.addEventListener('click', () => {
        injectorPanel.style.display = 'none';
      });
    }

    if (injectorSearch) {
      injectorSearch.addEventListener('input', () => {
        renderMobileInjectorGrid();
      });
    }

    // Mobile navbar back link
    const mobileBack = document.getElementById('mobile-curation-back-btn');
    if (mobileBack) {
      mobileBack.addEventListener('click', () => {
        switchAdminSubview('dashboard');
      });
    }

    // Mobile Publish submit
    const mobilePublishBtn = document.getElementById('btn-mobile-publish');
    if (mobilePublishBtn) {
      mobilePublishBtn.addEventListener('click', () => {
        submitCollection(false);
      });
    }
  }

  function handleCoverFileSelect(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      activeCoverBase64 = e.target.result;
      updateCoverPreview(activeCoverBase64);
    };
    reader.readAsDataURL(file);
  }

  function updateCoverPreview(imgSrc) {
    const placeholder = document.getElementById('collection-cover-placeholder');
    const preview = document.getElementById('collection-cover-preview');
    const mobilePlaceholder = document.getElementById('mobile-cover-placeholder');
    const mobilePreview = document.getElementById('mobile-cover-preview');

    if (preview && placeholder) {
      if (imgSrc) {
        placeholder.style.display = 'none';
        preview.style.display = 'flex';
        preview.style.backgroundImage = `url('${imgSrc}')`;
        preview.innerHTML = `<button type="button" class="btn-remove-cover">Remove Cover</button>`;
        preview.querySelector('.btn-remove-cover').addEventListener('click', (e) => {
          e.stopPropagation();
          activeCoverBase64 = null;
          updateCoverPreview(null);
        });
      } else {
        placeholder.style.display = 'flex';
        preview.style.display = 'none';
        preview.style.backgroundImage = '';
        preview.innerHTML = '';
      }
    }

    if (mobilePreview && mobilePlaceholder) {
      if (imgSrc) {
        mobilePlaceholder.style.display = 'none';
        mobilePreview.style.display = 'block';
        mobilePreview.style.backgroundImage = `url('${imgSrc}')`;
      } else {
        mobilePlaceholder.style.display = 'flex';
        mobilePreview.style.display = 'none';
        mobilePreview.style.backgroundImage = '';
      }
    }
  }

  function renderMobileInjectorGrid() {
    const grid = document.getElementById('mobile-injector-grid-container');
    const queryInput = document.getElementById('mobile-injector-search');
    if (!grid) return;

    let filtered = [...allWallpapers];
    if (queryInput && queryInput.value.trim()) {
      const q = queryInput.value.toLowerCase().trim();
      filtered = filtered.filter(w => 
        w.id.toLowerCase().includes(q) ||
        w.title.toLowerCase().includes(q) ||
        w.anime.toLowerCase().includes(q)
      );
    }

    grid.innerHTML = '';
    filtered.forEach(w => {
      const isSelected = selectedWallpapers.includes(w.id);
      const card = document.createElement('div');
      card.className = `injector-item-card${isSelected ? ' selected' : ''}`;
      
      const badgeChar = isSelected ? '&check;' : '+';
      card.innerHTML = `
        <img src="${w.image}" alt="${w.title}">
        <div class="injector-select-badge">${badgeChar}</div>
`;

      card.addEventListener('click', () => {
        if (selectedWallpapers.includes(w.id)) {
          selectedWallpapers = selectedWallpapers.filter(id => id !== w.id);
          card.classList.remove('selected');
          card.querySelector('.injector-select-badge').innerHTML = '+';
        } else {
          if (selectedWallpapers.length >= 50) {
            showToast("Limit Reached", "Max limit is 50 assets per collection.", true);
            return;
          }
          selectedWallpapers.push(w.id);
          card.classList.add('selected');
          card.querySelector('.injector-select-badge').innerHTML = '&check;';
        }
        renderBuilderAssets();
      });

      grid.appendChild(card);
    });
  }

  function loadActiveCollection(id) {
    activeCollectionId = id;
    const deleteBtn = document.getElementById('btn-delete-active-collection');
    if (deleteBtn) {
      deleteBtn.style.display = (id === 'new') ? 'none' : 'flex';
    }

    if (id === 'new') {
      // Clear form
      document.getElementById('collection-title-input').value = '';
      document.getElementById('collection-desc-input').value = '';
      if (document.getElementById('mobile-collection-title')) {
        document.getElementById('mobile-collection-title').value = '';
        document.getElementById('mobile-collection-desc').value = '';
      }
      document.getElementById('collection-carousel-toggle').checked = false;
      selectedWallpapers = [];
      activeCoverBase64 = null;
      updateCoverPreview(null);
      renderBuilderAssets();
    } else {
      const col = allCollections.find(c => c.id === id);
      if (col) {
        document.getElementById('collection-title-input').value = col.title || '';
        document.getElementById('collection-desc-input').value = col.description || '';
        if (document.getElementById('mobile-collection-title')) {
          document.getElementById('mobile-collection-title').value = col.title || '';
          document.getElementById('mobile-collection-desc').value = col.description || '';
        }
        document.getElementById('collection-carousel-toggle').checked = !!col.featured;
        selectedWallpapers = [...(col.assets || [])];
        activeCoverBase64 = col.coverImage || null;
        updateCoverPreview(activeCoverBase64);
        renderBuilderAssets();
      }
    }
  }

  async function submitCollection(isDraft) {
    const title = document.getElementById('collection-title-input').value.trim();
    const description = document.getElementById('collection-desc-input').value.trim();
    const featured = document.getElementById('collection-carousel-toggle').checked;

    if (!title) {
      showToast("Title Required", "Please assign a title to your collection pack.", true);
      return;
    }

    if (selectedWallpapers.length === 0) {
      showToast("Assets Required", "Please add at least one asset wallpaper to the collection.", true);
      return;
    }

    const payload = {
      title,
      description,
      featured,
      isDraft,
      assets: selectedWallpapers,
      coverImage: activeCoverBase64
    };

    const isNew = (activeCollectionId === 'new');
    const apiUrl = isNew ? '/api/admin/collections' : `/api/admin/collections/${activeCollectionId}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Submission failed");
      }

      const result = await res.json();
      showToast("Success", isDraft ? "Collection saved as draft." : "Collection published successfully!", false);

      // Refresh listings
      activeCollectionId = result.collection.id;
      loadAdminCollections();
    } catch(err) {
      console.error("[CURATION ENGINE] Submit failed:", err);
      showToast("Error", err.message || "Failed to save collection.", true);
    }
  }

  async function deleteActiveCollection() {
    if (activeCollectionId === 'new') return;
    
    showConfirmModal("Are you sure you want to permanently delete this collection pack?", async () => {
      try {
        const res = await fetch(`/api/admin/collections/${activeCollectionId}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          showToast("Deleted", "Collection pack successfully removed.");
          activeCollectionId = 'new';
          loadAdminCollections();
        } else {
          showToast("Error", "Failed to delete collection.", true);
        }
      } catch(err) {
        console.error(err);
        showToast("Error", "Network error occurred.", true);
      }
    });
  }

  // --- 23C. SYSTEM CONFIGURATION ENGINE ---
  async function loadAdminSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error("Failed to load settings from server.");
      const settings = await res.json();

      // Populate Site branding
      const siteNameInput = document.getElementById('sys-site-name');
      if (siteNameInput) siteNameInput.value = settings.siteName || '';

      // Toggles
      const maintenanceToggle = document.getElementById('sys-maintenance-mode');
      if (maintenanceToggle) maintenanceToggle.checked = settings.maintenanceMode === 1 || settings.maintenanceMode === true || settings.maintenanceMode === '1';

      const signupsToggle = document.getElementById('sys-public-signups');
      if (signupsToggle) signupsToggle.checked = settings.publicSignups === 1 || settings.publicSignups === true || settings.publicSignups === '1';

      const telemetryToggle = document.getElementById('sys-telemetry-logging');
      if (telemetryToggle) telemetryToggle.checked = settings.telemetryLogging === 1 || settings.telemetryLogging === true || settings.telemetryLogging === '1';

      // Ingestion configs
      const maxUploadInput = document.getElementById('sys-max-upload');
      if (maxUploadInput) maxUploadInput.value = settings.maxUploadSize || 50;

      // Allowed formats checkboxes
      const allowedFormats = settings.allowedFormats || ["jpg", "jpeg", "png", "gif", "webp", "mp4"];
      const formatCheckboxes = document.querySelectorAll('input[name="sys-allowed-formats"]');
      formatCheckboxes.forEach(cb => {
        cb.checked = allowedFormats.includes(cb.value);
      });

      // Integrations
      const cdnInput = document.getElementById('sys-cdn-endpoint');
      if (cdnInput) cdnInput.value = settings.cdnEndpoint || '';

      const webhookInput = document.getElementById('sys-discord-webhook');
      if (webhookInput) webhookInput.value = settings.discordWebhook || '';

    } catch(err) {
      console.error("[SETTINGS] Load failed:", err);
      showToast("Error", "Failed to retrieve system configuration.", true);
    }
  }

  async function saveAdminSettings() {
    try {
      const siteName = document.getElementById('sys-site-name').value.trim();
      const maintenanceMode = document.getElementById('sys-maintenance-mode').checked ? 1 : 0;
      const publicSignups = document.getElementById('sys-public-signups').checked ? 1 : 0;
      const telemetryLogging = document.getElementById('sys-telemetry-logging').checked ? 1 : 0;
      const maxUploadSize = parseInt(document.getElementById('sys-max-upload').value) || 50;
      
      const allowedFormats = [];
      document.querySelectorAll('input[name="sys-allowed-formats"]:checked').forEach(cb => {
        allowedFormats.push(cb.value);
      });

      const cdnEndpoint = document.getElementById('sys-cdn-endpoint').value.trim();
      const discordWebhook = document.getElementById('sys-discord-webhook').value.trim();

      if (!siteName) {
        showToast("Error", "Site Name is required.", true);
        return;
      }

      if (allowedFormats.length === 0) {
        showToast("Error", "At least one allowed format must be selected.", true);
        return;
      }

      const payload = {
        siteName,
        maintenanceMode,
        publicSignups,
        telemetryLogging,
        maxUploadSize,
        allowedFormats,
        cdnEndpoint,
        discordWebhook
      };

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Server rejected settings updates.");
      
      showToast("Success", "System configuration saved and synced.", false);
      
      // Live reload public site configurations
      applyPublicSystemSettings(payload, true);

    } catch(err) {
      console.error("[SETTINGS] Save failed:", err);
      showToast("Error", "Failed to persist system configuration.", true);
    }
  }

  function applyPublicSystemSettings(publicSettings, fromAdminSave) {
    if (!publicSettings) return;

    // Apply Site branding
    const siteName = publicSettings.siteName || 'RESIN';
    document.title = `${siteName} - Wallpaper Culture`;
    
    document.querySelectorAll('.logo-text, .admin-logo-row h3, .google-oauth-title, .google-oauth-subtitle span').forEach(el => {
      el.textContent = siteName;
    });

    document.querySelectorAll('.resin-highlight').forEach(el => {
      if (el.textContent.includes('RESIN')) {
        el.textContent = el.textContent.replace('RESIN', siteName);
      } else {
        el.textContent = siteName;
      }
    });

    // Apply public sign-ups state
    const signupTrigger = document.getElementById('popout-item-signup');
    const signupLink = document.getElementById('go-to-signup');
    const signupFooterText = document.querySelector('#auth-login-state .auth-form-footer span');
    
    const signupsAllowed = publicSettings.publicSignups === 1 || publicSettings.publicSignups === true || publicSettings.publicSignups === '1';

    if (!signupsAllowed) {
      if (signupTrigger) signupTrigger.style.display = 'none';
      if (signupLink) signupLink.style.display = 'none';
      if (signupFooterText) signupFooterText.innerHTML = 'Registration is currently disabled by administrator.';
    } else {
      if (signupTrigger) signupTrigger.style.display = 'flex';
      if (signupLink) signupLink.style.display = 'inline';
      if (signupFooterText) {
        signupFooterText.innerHTML = 'New to the grid? <a href="#" class="auth-toggle-link" id="go-to-signup">Create Account</a>';
        const newGoToSignup = document.getElementById('go-to-signup');
        if (newGoToSignup) {
          newGoToSignup.addEventListener('click', (e) => {
            e.preventDefault();
            const loginState = document.getElementById('auth-login-state');
            const signupState = document.getElementById('auth-signup-state');
            if (loginState) loginState.style.display = 'none';
            if (signupState) signupState.style.display = 'block';
          });
        }
      }
    }

    // Apply maintenance mode
    const maintenanceOverlay = document.getElementById('maintenance-mode-screen');
    const isMaintenance = publicSettings.maintenanceMode === 1 || publicSettings.maintenanceMode === true || publicSettings.maintenanceMode === '1';
    
    const isAdmin = window.userProfile && window.userProfile.role === 'Administrator';
    
    if (maintenanceOverlay) {
      if (isMaintenance && !isAdmin) {
        maintenanceOverlay.style.display = 'flex';
        // Hide normal views
        document.querySelectorAll('body > div:not(#maintenance-mode-screen):not(#auth-overlay):not(#toast-container)').forEach(d => {
          d.style.display = 'none';
        });
      } else {
        const wasShowing = maintenanceOverlay.style.display === 'flex';
        maintenanceOverlay.style.display = 'none';
        // Restore standard view
        if (!isMaintenance || isAdmin) {
          const hash = window.location.hash;
          if (hash.startsWith('#admin') && isAdmin) {
            const adminView = document.getElementById('admin-view');
            if (adminView) adminView.style.display = 'block';
          } else {
            // Restore regular layout
            const topHeader = document.querySelector('.top-header');
            if (topHeader) topHeader.style.display = '';
            
            const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
            if (mobileBottomNav) mobileBottomNav.style.display = '';
            
            const mainContent = document.getElementById('main-content') || document.querySelector('main');
            if (mainContent) mainContent.style.display = '';
            
            // Trigger refresh page to let layout flow normally (only if we were blocked by overlay)
            if (wasShowing && !fromAdminSave && !isAdmin) {
              window.location.reload();
            }
          }
        }
      }
    }
  }

  // Hook into public init settings
  async function fetchPublicSettingsInit() {
    try {
      const res = await fetch('/api/settings/public');
      if (res.ok) {
        const publicSettings = await res.json();
        applyPublicSystemSettings(publicSettings, false);
      }
    } catch(e) {
      console.error("[SETTINGS] Failed to retrieve public init configs:", e);
    }
  }

  // Setup settings events and listeners
  setTimeout(() => {
    const btnSaveSysSettings = document.getElementById('btn-save-system-settings');
    if (btnSaveSysSettings) {
      btnSaveSysSettings.addEventListener('click', saveAdminSettings);
    }

    const maintenanceLoginBtn = document.getElementById('maintenance-admin-login-btn');
    if (maintenanceLoginBtn) {
      maintenanceLoginBtn.addEventListener('click', () => {
        const authOverlay = document.getElementById('auth-overlay');
        const loginState = document.getElementById('auth-login-state');
        const signupState = document.getElementById('auth-signup-state');
        if (authOverlay) authOverlay.style.display = 'flex';
        if (loginState) loginState.style.display = 'block';
        if (signupState) signupState.style.display = 'none';
      });
    }

    // Media Library Events
    const mediaSearch = document.getElementById('media-search-input');
    if (mediaSearch) {
      mediaSearch.addEventListener('input', renderMediaLibrary);
    }
    const mediaMime = document.getElementById('media-filter-mime');
    if (mediaMime) {
      mediaMime.addEventListener('change', renderMediaLibrary);
    }
    const mediaFileInput = document.getElementById('media-file-input');
    if (mediaFileInput) {
      mediaFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          uploadAdminMedia(e.target.files[0]);
        }
      });
    }
    const mediaDropZone = document.getElementById('media-drop-zone');
    if (mediaDropZone) {
      mediaDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mediaDropZone.classList.add('dragover');
      });
      mediaDropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        mediaDropZone.classList.add('dragover');
      });
      ['dragleave', 'dragend', 'drop'].forEach(evtName => {
        mediaDropZone.addEventListener(evtName, () => {
          mediaDropZone.classList.remove('dragover');
        });
      });
      mediaDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          uploadAdminMedia(e.dataTransfer.files[0]);
        }
      });
      mediaDropZone.addEventListener('click', () => {
        mediaFileInput.click();
      });
    }

    // Categories Events
    const btnSaveCategory = document.getElementById('btn-save-category');
    if (btnSaveCategory) {
      btnSaveCategory.addEventListener('click', saveAdminCategory);
    }
    const btnCancelCategory = document.getElementById('btn-cancel-category');
    if (btnCancelCategory) {
      btnCancelCategory.addEventListener('click', resetCategoryForm);
    }
  }, 100);


  // ==========================================================================
  // MEDIA LIBRARY & CATEGORIES CUSTOM DASHBOARD CONTROLLERS
  // ==========================================================================

  let allMediaAssets = [];

  function loadAdminMedia() {
    fetch('/api/admin/media')
      .then(res => res.json())
      .then(data => {
        allMediaAssets = data || [];
        renderMediaLibrary();
      })
      .catch(err => {
        console.error("Error loading media:", err);
        showToast("Failed to load media assets.", "error");
      });
  }

  function renderMediaLibrary() {
    const grid = document.getElementById('media-grid-display');
    if (!grid) return;
    grid.innerHTML = '';

    const searchInput = document.getElementById('media-search-input');
    const filterSelect = document.getElementById('media-filter-mime');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const filterMime = filterSelect ? filterSelect.value : 'all';

    const filtered = allMediaAssets.filter(item => {
      const matchesSearch = item.filename.toLowerCase().includes(searchVal);
      let matchesMime = true;
      if (filterMime === 'image') {
        matchesMime = item.mimeType.startsWith('image/');
      } else if (filterMime === 'video') {
        matchesMime = item.mimeType.startsWith('video/');
      } else if (filterMime === 'other') {
        matchesMime = !item.mimeType.startsWith('image/') && !item.mimeType.startsWith('video/');
      }
      return matchesSearch && matchesMime;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 40px;">No media assets found.</div>';
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-card';

      const previewContainer = document.createElement('div');
      previewContainer.className = 'media-preview-container';

      if (item.mimeType.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'media-preview-img';
        img.src = item.url;
        img.loading = 'lazy';
        previewContainer.appendChild(img);
      } else if (item.mimeType.startsWith('video/')) {
        const video = document.createElement('video');
        video.className = 'media-preview-video';
        video.src = item.url;
        video.muted = true;
        video.playsInline = true;
        previewContainer.appendChild(video);
        
        card.addEventListener('mouseenter', () => video.play().catch(() => {}));
        card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
      } else {
        previewContainer.innerHTML = `<svg class="media-placeholder-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
      }

      // Action overlay
      const overlay = document.createElement('div');
      overlay.className = 'media-actions-overlay';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'media-btn-action';
      copyBtn.title = 'Copy Link';
      copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        const absoluteUrl = window.location.origin + item.url;
        navigator.clipboard.writeText(absoluteUrl).then(() => {
          showToast("Asset URL copied to clipboard!", "success");
        }).catch(() => {
          showToast("Failed to copy URL.", "error");
        });
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'media-btn-action media-btn-delete';
      deleteBtn.title = 'Delete Asset';
      deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to permanently delete this asset from disk?")) {
          deleteAdminMedia(item.id);
        }
      };

      overlay.appendChild(copyBtn);
      overlay.appendChild(deleteBtn);
      previewContainer.appendChild(overlay);

      const info = document.createElement('div');
      info.className = 'media-info';
      
      const name = document.createElement('div');
      name.className = 'media-name';
      name.textContent = item.filename.replace(/^media-\d+-/, ''); // Display clean filename
      name.title = item.filename;

      const meta = document.createElement('div');
      meta.className = 'media-meta';
      
      const sizeMB = (item.size / (1024 * 1024)).toFixed(2) + ' MB';
      const typeStr = item.mimeType.split('/')[1]?.toUpperCase() || 'UNKNOWN';

      meta.innerHTML = `<span>${typeStr}</span><span>${sizeMB}</span>`;

      info.appendChild(name);
      info.appendChild(meta);

      card.appendChild(previewContainer);
      card.appendChild(info);
      grid.appendChild(card);
    });
  }

  function deleteAdminMedia(id) {
    fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast("Asset successfully deleted.", "success");
          loadAdminMedia();
        } else {
          showToast(data.error || "Failed to delete asset.", "error");
        }
      })
      .catch(err => {
        console.error("Error deleting asset:", err);
        showToast("Error deleting asset.", "error");
      });
  }

  function uploadAdminMedia(file) {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      showToast("File size exceeds the 50MB limit.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Data = e.target.result;
      const payload = {
        filename: file.name,
        mimeType: file.type,
        data: base64Data,
        size: file.size
      };

      showToast("Uploading asset...", "info");

      fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast("Asset uploaded successfully!", "success");
          loadAdminMedia();
        } else {
          showToast(data.error || "Failed to upload asset.", "error");
        }
      })
      .catch(err => {
        console.error("Error uploading asset:", err);
        showToast("Error uploading asset.", "error");
      });
    };
    reader.readAsDataURL(file);
  }

  let allCategories = [];

  function loadAdminCategories() {
    fetch('/api/admin/categories')
      .then(res => res.json())
      .then(data => {
        allCategories = data || [];
        renderCategoriesTable();
      })
      .catch(err => {
        console.error("Error loading categories:", err);
        showToast("Failed to load article categories.", "error");
      });
  }

  function renderCategoriesTable() {
    const tbody = document.getElementById('categories-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (allCategories.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 20px;">No categories found.</td></tr>';
      return;
    }

    allCategories.forEach(cat => {
      const tr = document.createElement('tr');
      
      const tdName = document.createElement('td');
      tdName.style.fontWeight = '600';
      tdName.textContent = cat.name;

      const tdSlug = document.createElement('td');
      tdSlug.style.fontFamily = 'monospace';
      tdSlug.textContent = cat.slug;

      const tdDesc = document.createElement('td');
      tdDesc.style.color = '#64748b';
      tdDesc.textContent = cat.description || '-';

      const tdCount = document.createElement('td');
      tdCount.style.textAlign = 'center';
      tdCount.textContent = cat.articleCount || 0;

      const tdActions = document.createElement('td');
      tdActions.style.textAlign = 'right';

      const editBtn = document.createElement('span');
      editBtn.className = 'category-action-link category-action-edit';
      editBtn.textContent = 'Edit';
      editBtn.onclick = () => {
        // Populate edit form
        document.getElementById('category-edit-id').value = cat.id;
        document.getElementById('category-name-input').value = cat.name;
        document.getElementById('category-slug-input').value = cat.slug;
        document.getElementById('category-desc-input').value = cat.description || '';
        
        document.getElementById('category-form-title').textContent = 'EDIT CATEGORY';
        document.getElementById('btn-cancel-category').style.display = 'inline-block';
        
        // Highlight active row
        document.querySelectorAll('#categories-table-body tr').forEach(r => r.classList.remove('category-row-active'));
        tr.classList.add('category-row-active');
      };

      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'category-action-link category-action-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => {
        if (confirm(`Are you sure you want to delete the category "${cat.name}"?`)) {
          deleteAdminCategory(cat.id);
        }
      };

      tdActions.appendChild(editBtn);
      tdActions.appendChild(deleteBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdSlug);
      tr.appendChild(tdDesc);
      tr.appendChild(tdCount);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  function deleteAdminCategory(id) {
    fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast("Category deleted successfully.", "success");
          resetCategoryForm();
          loadAdminCategories();
        } else {
          showToast(data.error || "Failed to delete category.", "error");
        }
      })
      .catch(err => {
        console.error("Error deleting category:", err);
        showToast("Error deleting category.", "error");
      });
  }

  function saveAdminCategory() {
    const id = document.getElementById('category-edit-id').value;
    const name = document.getElementById('category-name-input').value.trim();
    const slug = document.getElementById('category-slug-input').value.trim();
    const description = document.getElementById('category-desc-input').value.trim();

    if (!name || !slug) {
      showToast("Name and Slug are required.", "error");
      return;
    }

    const payload = { name, slug, description };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success || data.category) {
        showToast(id ? "Category updated successfully!" : "Category created successfully!", "success");
        resetCategoryForm();
        loadAdminCategories();
      } else {
        showToast(data.error || "Failed to save category.", "error");
      }
    })
    .catch(err => {
      console.error("Error saving category:", err);
      showToast("Error saving category.", "error");
    });
  }

  function resetCategoryForm() {
    document.getElementById('category-edit-id').value = '';
    document.getElementById('category-name-input').value = '';
    document.getElementById('category-slug-input').value = '';
    document.getElementById('category-desc-input').value = '';
    document.getElementById('category-form-title').textContent = 'CREATE NEW CATEGORY';
    document.getElementById('btn-cancel-category').style.display = 'none';
    document.querySelectorAll('#categories-table-body tr').forEach(r => r.classList.remove('category-row-active'));
  }

  // --- 23.5 CUSTOM NEOMORPHIC SELECT DROPDOWNS ---
  function convertToNeoSelect(selectElement) {
    if (!selectElement || selectElement.dataset.neoSelectInitialized) return;
    selectElement.dataset.neoSelectInitialized = "true";

    // Hide native select
    selectElement.style.display = 'none';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'neo-select-wrapper';
    if (selectElement.id) {
      wrapper.id = 'neo-wrapper-' + selectElement.id;
    }
    
    // Insert wrapper before the select
    selectElement.parentNode.insertBefore(wrapper, selectElement);
    wrapper.appendChild(selectElement);

    // Create trigger
    const trigger = document.createElement('div');
    trigger.className = 'neo-select-trigger';
    trigger.tabIndex = 0; // make focusable

    if (selectElement.classList.contains('select-custom')) {
      trigger.classList.add('select-custom-trigger');
    }

    const triggerText = document.createElement('span');
    triggerText.className = 'neo-select-trigger-text';
    triggerText.textContent = selectElement.options[selectElement.selectedIndex]?.text || '';
    trigger.appendChild(triggerText);

    // Add chevron icon
    const chevronSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevronSvg.setAttribute('viewBox', '0 0 24 24');
    chevronSvg.setAttribute('fill', 'none');
    chevronSvg.setAttribute('stroke', 'currentColor');
    chevronSvg.setAttribute('stroke-width', '2');
    chevronSvg.setAttribute('class', 'neo-select-chevron');
    chevronSvg.setAttribute('width', '16');
    chevronSvg.setAttribute('height', '16');
    chevronSvg.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
    trigger.appendChild(chevronSvg);

    wrapper.appendChild(trigger);

    // Create options popup
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'neo-select-options';

    function buildOptions() {
      optionsContainer.innerHTML = '';
      Array.from(selectElement.options).forEach((opt) => {
        const item = document.createElement('div');
        item.className = 'neo-select-option';
        if (opt.value === selectElement.value) {
          item.classList.add('selected');
        }
        item.textContent = opt.text;
        item.dataset.value = opt.value;

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectElement.value = opt.value;
          triggerText.textContent = opt.text;
          
          // Dispatch change event to trigger filters/actions
          const event = new Event('change', { bubbles: true });
          selectElement.dispatchEvent(event);
          
          closeDropdown();
        });

        optionsContainer.appendChild(item);
      });
    }

    buildOptions();
    wrapper.appendChild(optionsContainer);

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = optionsContainer.classList.contains('open');
      closeAllNeoDropdowns();
      if (!isOpen) {
        buildOptions();
        optionsContainer.classList.add('open');
        trigger.classList.add('active');
      }
    });

    // Close function
    function closeDropdown() {
      optionsContainer.classList.remove('open');
      trigger.classList.remove('active');
    }

    // Bind document listener for outside clicks
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        closeDropdown();
      }
    });

    // Sync trigger text when native select value changes programmatically
    selectElement.addEventListener('change', () => {
      triggerText.textContent = selectElement.options[selectElement.selectedIndex]?.text || '';
    });
  }

  function closeAllNeoDropdowns() {
    document.querySelectorAll('.neo-select-options.open').forEach(el => {
      el.classList.remove('open');
    });
    document.querySelectorAll('.neo-select-trigger.active').forEach(el => {
      el.classList.remove('active');
    });
  }

  function initAllCustomSelects() {
    document.querySelectorAll('.select-custom, .ledger-select, .admin-select-input, .tuner-select-row select').forEach(convertToNeoSelect);
  }
  
  // Run on start
  setTimeout(initAllCustomSelects, 200);

// --- 24. URL HASH ROUTING & STATE RESTORATION ---
  function restoreStateFromHash() {
    let hash = window.location.hash.replace('#', '');
    if (!hash && window.__RESIN_INITIAL_ROUTE__ && window.__RESIN_INITIAL_ROUTE__.hash) {
      hash = window.__RESIN_INITIAL_ROUTE__.hash;
    }
    if (!hash) {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'wallpapers' || pathParts[0] === 'wallpaper') {
        hash = `wallpaper-${pathParts[1] || ''}`;
      } else if (pathParts[0]) {
        hash = pathParts[0];
      } else {
        hash = 'home';
      }
    }
    
    // Decode percent-encoded characters like %20 to space
    hash = decodeURIComponent(hash);
    
    // Normalize delimiters like spaces, underscores, and %20 to hyphen so we match 'admin-'
    let normalizedHash = hash.replace(/[\s_]+/g, '-');
    
    if (normalizedHash.startsWith('admin-')) {
      const subview = normalizedHash.replace('admin-', '');
      selectCategory('admin');
      setTimeout(() => switchAdminSubview(subview), 50);
    } else if (normalizedHash.startsWith('wallpaper-')) {
      const wallpaperId = normalizedHash.replace('wallpaper-', '');
      if (wallpaperId) {
        showWallpaperDetails(wallpaperId);
      }
    } else {
      selectCategory(normalizedHash);
    }
  }

  window.addEventListener('hashchange', restoreStateFromHash);
  setTimeout(restoreStateFromHash, 100);

});
