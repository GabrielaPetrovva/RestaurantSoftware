// Smooth scrolling for navigation links
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Add click handlers to navigation links
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
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
    ctaButton.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.05)';
    });
    
    ctaButton.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });

    // Add smooth transitions
    ctaButton.style.transition = 'transform 0.3s ease';
});

// Search functionality is now handled by search.js
// This file keeps the legacy code for backward compatibility
// The new search.js will override this if loaded after script.js