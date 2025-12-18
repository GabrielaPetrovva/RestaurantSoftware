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
});

// Search functionality is now handled by search.js
// This file keeps the legacy code for backward compatibility
// The new search.js will override this if loaded after script.js