// Translation data (shared with index.html)
const translations = {
    en: {
        nav: {
            home: 'Home',
            menu: 'Menu',
            about: 'About us',
            contact: 'Contact us'
        }
    },
    bg: {
        nav: {
            home: 'Начало',
            menu: 'Меню',
            about: 'За нас',
            contact: 'Контакти'
        }
    }
};

// Get saved language or default to English
let currentLang = localStorage.getItem('language') || 'en';

// Function to change language
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    updateLanguage();
    updateLanguageButtons();
}

// Function to update language buttons
function updateLanguageButtons() {
    const langEn = document.getElementById('lang-en');
    const langBg = document.getElementById('lang-bg');
    
    if (langEn) {
        langEn.classList.toggle('active', currentLang === 'en');
    }
    if (langBg) {
        langBg.classList.toggle('active', currentLang === 'bg');
    }
}

// Function to update all text content
function updateLanguage() {
    const t = translations[currentLang];
    
    if (!t) return;
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLang;
    
    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        const keys = key.split('.');
        let value = t;
        for (let k of keys) {
            value = value[k];
        }
        if (value) {
            element.textContent = value;
        }
    });
    
    // Update all elements with data-translate-placeholder attribute
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        const keys = key.split('.');
        let value = t;
        for (let k of keys) {
            value = value[k];
        }
        if (value) {
            element.placeholder = value;
        }
    });
}

// Smooth scrolling for navigation links
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Hamburger menu toggle functionality (for pages using nav ul.show structure)
// This matches the behavior from index.html
function toggleMenu() {
    const navMenu = document.querySelector('nav ul');
    const menuToggle = document.querySelector('.menu-toggle');
    const body = document.body;
    
    if (navMenu && menuToggle) {
        navMenu.classList.toggle('show');
        menuToggle.classList.toggle('active');
        body.classList.toggle('menu-open');
        
        // Prevent body scroll when menu is open
        if (navMenu.classList.contains('show')) {
            body.style.overflow = 'hidden';
        } else {
            body.style.overflow = '';
        }
    }
}

// Hamburger menu toggle functionality (for pages using mobileMenuOverlay structure)
function toggleMobileMenu() {
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    const menuToggle = document.querySelector('.menu-toggle');
    
    if (mobileMenuOverlay && menuToggle) {
        mobileMenuOverlay.classList.toggle('active');
        menuToggle.classList.toggle('active');
        
        // Prevent body scroll when menu is open
        if (mobileMenuOverlay.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

// Close mobile menu when clicking on a link
function closeMobileMenu() {
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    const menuToggle = document.querySelector('.menu-toggle');
    
    if (mobileMenuOverlay && menuToggle) {
        mobileMenuOverlay.classList.remove('active');
        menuToggle.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close menu (for nav ul.show structure)
// This matches the behavior from index.html
function closeMenu() {
    const navMenu = document.querySelector('nav ul');
    const menuToggle = document.querySelector('.menu-toggle');
    const body = document.body;
    
    if (navMenu && menuToggle) {
        navMenu.classList.remove('show');
        menuToggle.classList.remove('active');
        body.classList.remove('menu-open');
        body.style.overflow = '';
    }
}

// Add click handlers to navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Initialize language on page load
    updateLanguage();
    updateLanguageButtons();
    
    // Hamburger menu toggle - check if inline onclick is not already set
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle && !menuToggle.getAttribute('onclick')) {
        // If no onclick attribute, add event listener
        // Check which structure is being used
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        if (mobileMenuOverlay) {
            menuToggle.addEventListener('click', toggleMobileMenu);
        } else {
            menuToggle.addEventListener('click', toggleMenu);
        }
    }

    // Handle navigation links - close menu when clicked (matches index.html behavior)
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const navMenu = document.querySelector('nav ul');
            const menuToggle = document.querySelector('.menu-toggle');
            const body = document.body;
            
            if (navMenu && menuToggle) {
                navMenu.classList.remove('show');
                menuToggle.classList.remove('active');
                body.classList.remove('menu-open');
                body.style.overflow = '';
            }
            
            // Also try closing mobileMenuOverlay structure if it exists
            closeMobileMenu();
        });
    });

    // Add hover effects to buttons
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
        });
        
        ctaButton.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });

        // Add smooth transitions
        ctaButton.style.transition = 'transform 0.3s ease';
    }

    // Close menu when clicking outside (matches index.html behavior)
    const navMenu = document.querySelector('nav ul');
    if (navMenu) {
        navMenu.addEventListener('click', function(e) {
            if (e.target === this) {
                const menuToggle = document.querySelector('.menu-toggle');
                const body = document.body;
                
                if (menuToggle) {
                    this.classList.remove('show');
                    menuToggle.classList.remove('active');
                    body.classList.remove('menu-open');
                    body.style.overflow = '';
                }
            }
        });
    }
    
    // Also handle mobileMenuOverlay structure if it exists
    document.addEventListener('click', function(e) {
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        const menuToggle = document.querySelector('.menu-toggle');
        
        if (mobileMenuOverlay && menuToggle) {
            if (mobileMenuOverlay.classList.contains('active') && 
                e.target === mobileMenuOverlay) {
                closeMobileMenu();
            }
        }
    });

    // Close menu on window resize if it becomes desktop view
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileMenu();
            closeMenu();
        }
    });
});

// Search functionality is now handled by search.js
// This file keeps the legacy code for backward compatibility
// The new search.js will override this if loaded after script.js