// Smooth scrolling for navigation links
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Hamburger menu toggle functionality
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

// Add click handlers to navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Hamburger menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }

    // Handle both desktop nav and mobile nav links
    const navLinks = document.querySelectorAll('.nav a, .mobile-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Close mobile menu when a link is clicked
            closeMobileMenu();
            
            // Only prevent default and scroll for anchor links (starting with #)
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                scrollToSection(targetId);
            }
            // Otherwise, let the link navigate normally (for page links like html/menu.html)
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

    // Close mobile menu when clicking outside or on overlay
    document.addEventListener('click', function(e) {
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        const menuToggle = document.querySelector('.menu-toggle');
        const header = document.querySelector('.header');
        
        if (mobileMenuOverlay && menuToggle && header) {
            // Close if clicking on overlay background (not on nav links)
            if (mobileMenuOverlay.classList.contains('active') && 
                e.target === mobileMenuOverlay) {
                closeMobileMenu();
            }
        }
    });

    // Close mobile menu on window resize if it becomes desktop view
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });

    // Contact form submit handling (index page)
    const form = document.getElementById('contact-form');
    const toast = document.getElementById('toast');
    if (form && toast) {
        const lang = localStorage.getItem('language') || 'en';
        const msg = {
            en: {
                sending: 'Sending message...',
                success: 'Message sent successfully!',
                failed: 'Failed to send message.',
                serviceDown: 'Message service is unavailable.'
            },
            bg: {
                sending: 'Изпращане на съобщение...',
                success: 'Съобщението е изпратено успешно!',
                failed: 'Грешка при изпращане на съобщението.',
                serviceDown: 'Услугата за изпращане не е налична.'
            }
        };
        const t = msg[lang] || msg.en;

        function showToast(message, success) {
            toast.textContent = message;
            toast.style.backgroundColor = success ? '#4caf50' : '#f44336';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            showToast(t.sending, true);

            if (!window.emailjs) {
                showToast(t.serviceDown, false);
                return;
            }

            try {
                emailjs.init('kGsBidM1aclQjY3y3');
                await emailjs.sendForm('service_3d3a8yj', 'template_u7f8rnm', this);
                showToast(t.success, true);
                form.reset();
            } catch (err) {
                console.error(err);
                showToast(t.failed, false);
            }
        });
    }

    // Testimonials slider (index page)
    const testiSlidesEl = document.getElementById('testiSlides');
    const testiDotsEl = document.getElementById('testiDots');
    const testiPrev = document.getElementById('testiPrev');
    const testiNext = document.getElementById('testiNext');
    if (testiSlidesEl && testiDotsEl && testiPrev && testiNext) {
        const slides = Array.from(testiSlidesEl.querySelectorAll('.testimonial-slide'));
        let current = 0;
        let autoTimer;

        const dots = slides.map((_, idx) => {
            const dot = document.createElement('button');
            dot.className = 'testi-dot' + (idx === 0 ? ' active' : '');
            dot.type = 'button';
            dot.addEventListener('click', () => goTo(idx));
            testiDotsEl.appendChild(dot);
            return dot;
        });

        function goTo(index) {
            current = (index + slides.length) % slides.length;
            testiSlidesEl.style.transform = `translateX(-${current * 100}%)`;
            dots.forEach((d, i) => d.classList.toggle('active', i === current));
            resetAuto();
        }

        function resetAuto() {
            clearInterval(autoTimer);
            autoTimer = setInterval(() => goTo(current + 1), 5000);
        }

        testiPrev.addEventListener('click', () => goTo(current - 1));
        testiNext.addEventListener('click', () => goTo(current + 1));
        resetAuto();
    }

    // FAQ accordion (index page)
    const faqButtons = document.querySelectorAll('.faq-question');
    faqButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            if (!item) return;
            const isOpen = item.classList.contains('open');
            document.querySelectorAll('.faq-item.open').forEach((openItem) => openItem.classList.remove('open'));
            if (!isOpen) item.classList.add('open');
        });
    });
});

// Search functionality is now handled by search.js
// This file keeps the legacy code for backward compatibility
// The new search.js will override this if loaded after script.js