// Enhanced Search Functionality
(function() {
    'use strict';

    // Search data structure
    let searchableContent = [];
    let currentPageType = '';

    // Initialize search when DOM is ready
    function initSearch() {
        const searchModal = document.getElementById('searchModal');
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        const searchClose = document.querySelector('.search-close');
        const searchIcon = document.querySelector('.search-icon');

        if (!searchModal || !searchInput || !searchResults) return;

        // Determine page type and extract content
        extractPageContent();

        // Open search modal
        if (searchIcon) {
            searchIcon.addEventListener('click', function() {
                searchModal.style.display = 'block';
                searchInput.focus();
                // Re-extract content in case page changed
                extractPageContent();
            });
        }

        // Close search modal
        if (searchClose) {
            searchClose.addEventListener('click', function() {
                closeSearchModal();
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === searchModal) {
                closeSearchModal();
            }
        });

        // Real-time search as user types
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(this.value.trim());
            }, 150); // Debounce for better performance
        });

        // Keyboard navigation
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeSearchModal();
            }
        });
    }

    // Extract content from current page
    function extractPageContent() {
        searchableContent = [];
        const path = window.location.pathname;
        const pageName = path.split('/').pop() || 'index.html';

        // Check if we're on menu page (categories)
        if (pageName === 'menu.html' || path.includes('menu.html')) {
            currentPageType = 'menu';
            extractMenuCategories();
        }
        // Check if we're on a category page (dishes)
        else if (document.querySelector('.salad-card, .category-main')) {
            currentPageType = 'category';
            extractDishes();
        }
        // Check if we're on index page
        else if (pageName === 'index.html' || pageName === '' || path.endsWith('/')) {
            currentPageType = 'index';
            extractIndexContent();
        }
        // Other pages (contacts, privacy, terms)
        else {
            currentPageType = 'other';
            extractGeneralContent();
        }
    }

    // Extract menu categories from menu.html
    function extractMenuCategories() {
        const menuCards = document.querySelectorAll('.menu-card');
        menuCards.forEach((card, index) => {
            const label = card.querySelector('.card-label');
            
            if (label) {
                const categoryName = label.textContent.trim();
                let link = '';
                
                // Extract link from onclick attribute
                const onclick = card.getAttribute('onclick');
                if (onclick) {
                    // Match patterns like: window.location.href='salads.html' or location.href="salads.html"
                    const match = onclick.match(/(?:window\.)?location\.href\s*=\s*['"]([^'"]+)['"]/);
                    if (match) {
                        link = match[1];
                        // Make sure it's a relative path
                        if (!link.startsWith('http') && !link.startsWith('/')) {
                            link = link; // Keep relative path
                        }
                    }
                }
                
                searchableContent.push({
                    title: categoryName,
                    description: `Категория: ${categoryName}`,
                    category: 'Категория',
                    type: 'category',
                    link: link,
                    element: card
                });
            }
        });
    }

    // Extract dishes from category pages
    function extractDishes() {
        const dishCards = document.querySelectorAll('.salad-card, [class*="card"]');
        dishCards.forEach((card) => {
            const titleEl = card.querySelector('h3, .salad-header h3, [class*="header"] h3');
            const ingredientsEl = card.querySelector('.salad-ingredients, [class*="ingredients"], p');
            const priceEl = card.querySelector('.price, [class*="price"]');
            
            if (titleEl) {
                const title = titleEl.textContent.trim();
                const description = ingredientsEl ? ingredientsEl.textContent.trim() : '';
                const price = priceEl ? priceEl.textContent.trim() : '';
                
                // Get category name from page
                const categoryHeader = document.querySelector('.category-header h1, h1');
                const category = categoryHeader ? categoryHeader.textContent.trim() : 'Меню';
                
                searchableContent.push({
                    title: title,
                    description: description,
                    price: price,
                    category: category,
                    type: 'dish',
                    element: card
                });
            }
        });
    }

    // Extract content from index page
    function extractIndexContent() {
        // Add navigation links
        const navLinks = document.querySelectorAll('.nav a');
        navLinks.forEach(link => {
            const text = link.textContent.trim();
            const href = link.getAttribute('href');
            if (text && href) {
                searchableContent.push({
                    title: text,
                    description: `Навигация: ${text}`,
                    category: 'Навигация',
                    type: 'link',
                    link: href
                });
            }
        });

        // Add section content
        const aboutSection = document.querySelector('#about, .about');
        if (aboutSection) {
            const heading = aboutSection.querySelector('h2');
            const text = aboutSection.querySelector('p');
            if (heading) {
                searchableContent.push({
                    title: heading.textContent.trim(),
                    description: text ? text.textContent.trim().substring(0, 100) : '',
                    category: 'Информация',
                    type: 'section',
                    link: '#about'
                });
            }
        }
    }

    // Extract general content from other pages
    function extractGeneralContent() {
        const headings = document.querySelectorAll('h1, h2, h3');
        headings.forEach(heading => {
            const text = heading.textContent.trim();
            if (text && text.length > 2) {
                const nextP = heading.nextElementSibling;
                const description = nextP && nextP.tagName === 'P' 
                    ? nextP.textContent.trim().substring(0, 100) 
                    : '';
                
                searchableContent.push({
                    title: text,
                    description: description,
                    category: 'Съдържание',
                    type: 'content',
                    element: heading
                });
            }
        });
    }

    // Perform search
    function performSearch(query) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;

        if (query.length < 1) {
            searchResults.innerHTML = '<div class="no-results">Въведете ключова дума за търсене...</div>';
            return;
        }

        const queryLower = query.toLowerCase();
        const results = searchableContent.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(queryLower);
            const descMatch = item.description.toLowerCase().includes(queryLower);
            const categoryMatch = item.category.toLowerCase().includes(queryLower);
            return titleMatch || descMatch || categoryMatch;
        });

        displaySearchResults(results, query);
    }

    // Display search results with highlighting
    function displaySearchResults(results, query) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="no-results">Няма намерени резултати. Опитайте с други ключови думи.</div>';
            return;
        }

        searchResults.innerHTML = results.map((item, index) => {
            const highlightedTitle = highlightText(item.title, query);
            const highlightedDesc = highlightText(item.description.substring(0, 120), query);
            const category = item.category || 'Меню';
            const price = item.price ? `<span class="search-price">${item.price}</span>` : '';

            return `
                <div class="search-result-item" data-item-type="${item.type}" data-item-index="${index}">
                    <div class="search-result-header">
                        <h3>${highlightedTitle}</h3>
                        ${price}
                    </div>
                    <p>${highlightedDesc}${item.description.length > 120 ? '...' : ''}</p>
                    <small class="search-category">${category}</small>
                </div>
            `;
        }).join('');

        // Add click handlers for all result items
        const resultItems = searchResults.querySelectorAll('.search-result-item');
        resultItems.forEach((resultItem, index) => {
            const item = results[index];
            if (!item) return;

            resultItem.addEventListener('click', function(e) {
                e.preventDefault();
                closeSearchModal();

                if (item.type === 'category' && item.link) {
                    // Navigate to category page
                    window.location.href = item.link;
                } else if (item.type === 'dish' && item.element) {
                    // Scroll to dish on current page
                    item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Highlight the card briefly
                    const originalTransition = item.element.style.transition;
                    item.element.style.transition = 'box-shadow 0.3s';
                    item.element.style.boxShadow = '0 0 20px rgba(255, 140, 0, 0.6)';
                    setTimeout(() => {
                        item.element.style.boxShadow = '';
                        item.element.style.transition = originalTransition;
                    }, 2000);
                } else if (item.link) {
                    // Navigate to link
                    if (item.link.startsWith('#')) {
                        const element = document.querySelector(item.link);
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    } else {
                        window.location.href = item.link;
                    }
                } else if (item.element) {
                    // Scroll to element
                    item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });
    }

    // Highlight matching text
    function highlightText(text, query) {
        if (!query || !text) return text;
        
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    // Escape special regex characters
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Close search modal
    function closeSearchModal() {
        const searchModal = document.getElementById('searchModal');
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        
        if (searchModal) searchModal.style.display = 'none';
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSearch);
    } else {
        initSearch();
    }
})();

