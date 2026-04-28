// Translation data (shared with index.html)
const translations = {
    en: {
        nav: {
            home: 'Home',
            menu: 'Menu',
            about: 'About us',
            contact: 'Contact Us'
        },
        hero: {
            title: 'Taste The Difference',
            button: 'View Menu'
        },
        about: {
            title: 'About Us',
            subtitle: 'Our Story',
            text: 'The restaurant opened its doors in 2015 with one simple idea – to offer genuine taste and comfort in the heart of the city. Since then, we have been combining traditional recipes with modern culinary techniques to create experiences that are truly unforgettable.'
        },
        testimonials: {
            label: 'What Guests Say',
            title: 'Voice of Our Guests',
            quote1: 'One of the best dining experiences in town. The food was excellent and the service was warm and professional.',
            quote2: 'The atmosphere is elegant and cozy at the same time. Every dish looked beautiful and tasted even better.',
            quote3: 'Perfect place for special occasions. We came for an anniversary and everything was memorable.'
        },
        faq: {
            label: 'Questions',
            title: 'Frequently Asked Questions',
            subtitle: 'Quick answers to the most common questions about reservations and visits.',
            q1: 'Do you have parking?',
            a1: 'Yes, we have free parking in front of the restaurant. During weekends we recommend arriving a bit earlier.',
            q2: 'How can I make a reservation?',
            a2: 'You can reserve by phone, through our contact form, or directly on-site. Weekend reservations are best made in advance.',
            q3: 'Do you offer vegetarian options?',
            a3: 'Yes, our menu includes vegetarian options and several dishes can be adapted on request.',
            q4: 'Can I organize a private event?',
            a4: 'Yes, we host private and corporate events. Contact us and we will prepare a personalized offer.'
        },
        contact: {
            title: 'Leave a Review',
            subtitle: 'We’d love to hear your thoughts.',
            name: 'Your Name',
            email: 'Email Address',
            message: 'Your Message',
            button: 'Send Message'
        },
        footer: {
            privacy: 'Privacy',
            services: 'Services',
            about: 'About Us',
            quickLinks: 'Quick Links',
            menu: 'Menu',
            story: 'Our Story',
            reservations: 'Reservations',
            social: 'Social Media'
        }
    },
    bg: {
        nav: {
            home: 'Начало',
            menu: 'Меню',
            about: 'За нас',
            contact: 'Контакти'
        },
        hero: {
            title: 'Опитайте разликата',
            button: 'Виж менюто'
        },
        about: {
            title: 'За нас',
            subtitle: 'Нашата история',
            text: 'Ресторантът отвори врати през 2015 г. с една проста идея – да предложи автентичен вкус и комфорт в сърцето на града. Оттогава комбинираме традиционни рецепти с модерни кулинарни техники, за да създадем преживявания, които са наистина незабравими.'
        },
        testimonials: {
            label: 'Гласът на гостите',
            title: 'Какво казват нашите гости',
            quote1: 'Едно от най-добрите кулинарни изживявания в града. Храната беше отлична, а обслужването - топло и професионално.',
            quote2: 'Атмосферата е елегантна и уютна едновременно. Всяко ястие изглеждаше красиво и имаше още по-добър вкус.',
            quote3: 'Перфектно място за специални поводи. Дойдохме за годишнина и всичко беше запомнящо се.'
        },
        faq: {
            label: 'Въпроси',
            title: 'Често задавани въпроси',
            subtitle: 'Бързи отговори на най-често задаваните въпроси за резервации и посещения.',
            q1: 'Имате ли паркинг?',
            a1: 'Да, разполагаме с безплатен паркинг пред ресторанта. През уикенда препоръчваме да дойдете малко по-рано.',
            q2: 'Как мога да направя резервация?',
            a2: 'Можете да резервирате по телефона, чрез контактната форма или на място. За уикенд е най-добре да резервирате предварително.',
            q3: 'Предлагате ли вегетариански опции?',
            a3: 'Да, менюто ни включва вегетариански предложения, а някои ястия могат да бъдат адаптирани по желание.',
            q4: 'Мога ли да организирам частно събитие?',
            a4: 'Да, организираме частни и корпоративни събития. Свържете се с нас и ще подготвим персонализирана оферта.'
        },
        contact: {
            title: 'Оставете отзив',
            subtitle: 'Вашето мнение е важно за нас.',
            name: 'Вашето име',
            email: 'Имейл адрес',
            message: 'Вашето съобщение',
            button: 'Изпрати съобщение'
        },
        footer: {
            privacy: 'Поверителност',
            services: 'Услуги',
            about: 'За нас',
            quickLinks: 'Бързи връзки',
            menu: 'Меню',
            story: 'Нашата история',
            reservations: 'Резервации',
            social: 'Социални мрежи'
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
        menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('show') ? 'true' : 'false');
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
        menuToggle.setAttribute('aria-expanded', 'false');
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
        // index.html has its own dedicated menu controller in inline script.
        if (menuToggle.id === 'menuToggle' && document.getElementById('navMenu')) {
            // Avoid double-toggling that immediately closes mobile menu.
        } else {
        // If no onclick attribute, add event listener
        // Check which structure is being used
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        if (mobileMenuOverlay) {
            menuToggle.addEventListener('click', toggleMobileMenu);
        } else {
            menuToggle.addEventListener('click', toggleMenu);
        }
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