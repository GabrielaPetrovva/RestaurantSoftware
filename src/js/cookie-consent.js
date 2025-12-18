// Cookie Consent Banner - GDPR Compliant
(function() {
    'use strict';

    const COOKIE_CONSENT_KEY = 'cookieConsent';
    const COOKIE_EXPIRY_DAYS = 365;

    // Cookie banner elements
    let cookieBanner = null;
    let settingsPanel = null;

    // Initialize on DOM load
    function init() {
        // Check if user has already made a choice
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
        
        if (!consent) {
            createBanner();
            showBanner();
        }
    }

    // Create the banner HTML structure
    function createBanner() {
        cookieBanner = document.createElement('div');
        cookieBanner.id = 'cookie-consent-banner';
        cookieBanner.className = 'cookie-consent-banner';
        cookieBanner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-consent-text">
                    <h3>Бисквитки и поверителност</h3>
                    <p>Използваме бисквитки, за да подобрим вашето изживяване, да анализираме трафика и да персонализираме съдържанието. Можете да изберете кои бисквитки да приемете.</p>
                    <p class="cookie-consent-links">
                        <a href="#" id="privacy-policy-link">Политика за поверителност</a>
                    </p>
                </div>
                <div class="cookie-consent-buttons">
                    <button id="accept-all-btn" class="cookie-btn cookie-btn-primary">Приеми всички</button>
                    <button id="reject-nonessential-btn" class="cookie-btn cookie-btn-secondary">Отхвърли неизползвани</button>
                    <button id="settings-btn" class="cookie-btn cookie-btn-settings">Настройки</button>
                </div>
            </div>
            <div id="cookie-settings-panel" class="cookie-settings-panel" style="display: none;">
                <h4>Настройки на бисквитките</h4>
                <div class="cookie-setting-item">
                    <label class="cookie-toggle">
                        <input type="checkbox" id="essential-cookies" checked disabled>
                        <span class="cookie-toggle-slider"></span>
                    </label>
                    <div class="cookie-setting-info">
                        <strong>Необходими бисквитки</strong>
                        <p>Тези бисквитки са необходими за основното функциониране на сайта и не могат да бъдат деактивирани.</p>
                    </div>
                </div>
                <div class="cookie-setting-item">
                    <label class="cookie-toggle">
                        <input type="checkbox" id="analytics-cookies">
                        <span class="cookie-toggle-slider"></span>
                    </label>
                    <div class="cookie-setting-info">
                        <strong>Аналитични бисквитки</strong>
                        <p>Помагат ни да разберем как посетителите използват нашия сайт чрез анонимни данни.</p>
                    </div>
                </div>
                <div class="cookie-setting-item">
                    <label class="cookie-toggle">
                        <input type="checkbox" id="marketing-cookies">
                        <span class="cookie-toggle-slider"></span>
                    </label>
                    <div class="cookie-setting-info">
                        <strong>Маркетингови бисквитки</strong>
                        <p>Използват се за показване на релевантна реклама и проследяване на ефективността на кампаниите.</p>
                    </div>
                </div>
                <div class="cookie-settings-actions">
                    <button id="save-settings-btn" class="cookie-btn cookie-btn-primary">Запази настройките</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(cookieBanner);
        settingsPanel = document.getElementById('cookie-settings-panel');
        
        // Attach event listeners
        attachEventListeners();
    }

    // Attach event listeners to buttons
    function attachEventListeners() {
        document.getElementById('accept-all-btn').addEventListener('click', acceptAll);
        document.getElementById('reject-nonessential-btn').addEventListener('click', rejectNonEssential);
        document.getElementById('settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
        
        // Privacy policy link
        const privacyLink = document.getElementById('privacy-policy-link');
        if (privacyLink) {
            // Determine the correct path based on current page location
            const isRoot = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
            privacyLink.href = isRoot ? 'html/privacy.html' : '../html/privacy.html';
        }
    }

    // Show the banner with animation
    function showBanner() {
        if (cookieBanner) {
            cookieBanner.classList.add('show');
        }
    }

    // Hide the banner
    function hideBanner() {
        if (cookieBanner) {
            cookieBanner.classList.remove('show');
            setTimeout(() => {
                if (cookieBanner && cookieBanner.parentNode) {
                    cookieBanner.parentNode.removeChild(cookieBanner);
                }
            }, 300);
        }
    }

    // Toggle settings panel
    function toggleSettings() {
        if (settingsPanel) {
            const isVisible = settingsPanel.style.display !== 'none';
            settingsPanel.style.display = isVisible ? 'none' : 'block';
            settingsPanel.classList.toggle('expanded', !isVisible);
        }
    }

    // Accept all cookies
    function acceptAll() {
        const consent = {
            essential: true,
            analytics: true,
            marketing: true,
            timestamp: new Date().toISOString()
        };
        saveConsent(consent);
        hideBanner();
    }

    // Reject non-essential cookies
    function rejectNonEssential() {
        const consent = {
            essential: true,
            analytics: false,
            marketing: false,
            timestamp: new Date().toISOString()
        };
        saveConsent(consent);
        hideBanner();
    }

    // Save custom settings
    function saveSettings() {
        const consent = {
            essential: true, // Always true
            analytics: document.getElementById('analytics-cookies').checked,
            marketing: document.getElementById('marketing-cookies').checked,
            timestamp: new Date().toISOString()
        };
        saveConsent(consent);
        hideBanner();
    }

    // Save consent to localStorage
    function saveConsent(consent) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);
        
        const consentData = {
            ...consent,
            expiry: expiryDate.toISOString()
        };
        
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
        
        // Trigger custom event for other scripts to listen to
        const event = new CustomEvent('cookieConsentUpdated', { detail: consent });
        document.dispatchEvent(event);
    }

    // Get current consent (for use by other scripts)
    function getConsent() {
        const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!stored) return null;
        
        const consent = JSON.parse(stored);
        const expiry = new Date(consent.expiry);
        
        // Check if consent has expired
        if (new Date() > expiry) {
            localStorage.removeItem(COOKIE_CONSENT_KEY);
            return null;
        }
        
        return consent;
    }

    // Public API
    window.CookieConsent = {
        getConsent: getConsent,
        reset: function() {
            localStorage.removeItem(COOKIE_CONSENT_KEY);
            if (cookieBanner && cookieBanner.parentNode) {
                cookieBanner.parentNode.removeChild(cookieBanner);
            }
            createBanner();
            showBanner();
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

