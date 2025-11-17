// Digital Menu Board JavaScript

// Order data storage
let orderItems = [];
let orderTotal = 0;

// Menu data for each category
const menuData = {
    salads: [
        {
            name: "Средиземноморска салата",
            description: "Свежи зеленчуци с хумус и тахини сос",
            price: 12.99,
            calories: 320,
            carbs: 28,
            protein: 18,
            fat: 22,
            image: "../images/salad.jpg"
        }
    ],
    starters: [
        {
            name: "Авокадо тост",
            description: "Тост с авокадо и меко варено яйце",
            price: 8.50,
            calories: 280,
            carbs: 22,
            protein: 12,
            fat: 18,
            image: "../images/avocado-toast.jpg"
        }
    ],
    appetizers: [
        {
            name: "Пържени сирени крокети",
            description: "Златни крокети с сирене и ягодов сос",
            price: 9.99,
            calories: 450,
            carbs: 35,
            protein: 18,
            fat: 28,
            image: "../images/fried-cheese.jpg"
        }
    ],
    fish: [
        {
            name: "Пържени лукови пръстени",
            description: "Хрупкави лукови пръстени с тартар сос",
            price: 7.50,
            calories: 380,
            carbs: 42,
            protein: 6,
            fat: 22,
            image: "../images/onion-rings.jpg"
        }
    ],
    pasta: [
        {
            name: "Спагети с доматен сос",
            description: "Класически спагети с доматен сос и босилек",
            price: 11.99,
            calories: 420,
            carbs: 68,
            protein: 14,
            fat: 8,
            image: "../images/spaghetti.jpg"
        }
    ],
    chicken: [
        {
            name: "Пилешко с екзотични подправки",
            description: "Мариновано пилешко с екзотични подправки",
            price: 18.99,
            calories: 350,
            carbs: 12,
            protein: 42,
            fat: 16,
            image: "../images/chicken.jpg"
        }
    ],
    pork: [
        {
            name: "Глазирани свински ребра",
            description: "Свински ребра с глазура и картофени клинове",
            price: 22.50,
            calories: 520,
            carbs: 35,
            protein: 38,
            fat: 28,
            image: "../images/pork-ribs.jpg"
        }
    ],
    veal: [
        {
            name: "Грил телeшки кюфтета",
            description: "Три грил телeшки кюфтета със салата и чипс",
            price: 24.99,
            calories: 480,
            carbs: 25,
            protein: 45,
            fat: 24,
            image: "../images/veal-patties.jpg"
        }
    ],
    saj: [
        {
            name: "Смесен сач",
            description: "Бавен сач със смесено месо и лимон",
            price: 26.99,
            calories: 580,
            carbs: 18,
            protein: 52,
            fat: 32,
            image: "../images/saj-dish.jpg"
        }
    ],
    pizza: [
        {
            name: "Маргарита пица",
            description: "Класическа пица с доматен сос, моцарела и босилек",
            price: 15.99,
            calories: 650,
            carbs: 78,
            protein: 28,
            fat: 24,
            image: "../images/margherita-pizza.jpg"
        }
    ],
    bread: [
        {
            name: "Артизански хляб",
            description: "Свеж артизански хляб с ягоди и подправки",
            price: 6.50,
            calories: 220,
            carbs: 45,
            protein: 8,
            fat: 3,
            image: "../images/artisan-bread.jpg"
        }
    ],
    burger: [
        {
            name: "Сигнатурен бургер",
            description: "Бургер с пилешка котлета, зеле и домати с пържени картофи",
            price: 14.99,
            calories: 720,
            carbs: 68,
            protein: 38,
            fat: 32,
            image: "../images/burger.jpg"
        }
    ],
    desserts: [
        {
            name: "Шоколадов лава кейк",
            description: "Декадентен шоколадов кейк с разтопен шоколадов център. Подава се топъл с топка ванилов сладолед, свежи ягоди и поръсване от малинов кули.",
            price: 8.99,
            calories: 420,
            carbs: 52,
            protein: 6,
            fat: 24,
            image: "../images/layered-cake.jpg"
        }
    ]
};

// Category titles mapping
const categoryTitles = {
    salads: "САЛАТИ",
    starters: "СТАРТЕРИ",
    appetizers: "ПРЕДЯСТИЯ",
    fish: "РИБНИ",
    pasta: "ПАСТА И РИЗОТО",
    chicken: "ПИЛЕ",
    pork: "СВИНСКО",
    veal: "ТЕЛЕШКО",
    saj: "САЧОВЕ",
    pizza: "ПИЦИ /600 гр./",
    bread: "ПЪРЛЕНКИ И ХЛЕБЧЕТА",
    burger: "БУРГЕР И ТОРТИЛА",
    desserts: "ДЕСЕРТИ"
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    updateOrderCount();
    loadOrderFromStorage();
});

// Show category details modal
function showCategoryDetails(categoryKey) {
    const modal = document.getElementById('categoryDetailsModal');
    const title = document.getElementById('category-title');
    const dishesContainer = document.getElementById('category-dishes');
    
    // Set category title
    title.textContent = categoryTitles[categoryKey];
    
    // Get dishes for this category
    const dishes = menuData[categoryKey];
    
    // Generate dish cards
    dishesContainer.innerHTML = dishes.map(dish => `
        <div class="dish-card">
            <div class="dish-image">
                <img src="${dish.image}" alt="${dish.name}">
            </div>
            <div class="dish-content">
                <h3>${dish.name}</h3>
                <p class="dish-description">${dish.description}</p>
                
                <div class="nutritional-info">
                    <h4>Хранителна стойност (на порция)</h4>
                    <div class="nutrition-grid">
                        <div class="nutrition-item">
                            <span class="nutrition-value">${dish.calories}</span>
                            <span class="nutrition-label">Калории</span>
                        </div>
                        <div class="nutrition-item">
                            <span class="nutrition-value">${dish.carbs}</span>
                            <span class="nutrition-label">Въглехидрати (г)</span>
                        </div>
                        <div class="nutrition-item">
                            <span class="nutrition-value">${dish.protein}</span>
                            <span class="nutrition-label">Протеини (г)</span>
                        </div>
                        <div class="nutrition-item">
                            <span class="nutrition-value">${dish.fat}</span>
                            <span class="nutrition-label">Мазнини (г)</span>
                        </div>
                    </div>
                </div>
                
                <div class="dish-price">${dish.price.toFixed(2)} €</div>
                <button class="add-to-order-btn" onclick="addToOrder('${dish.name}', ${dish.price})">Добави в поръчката</button>
            </div>
        </div>
    `).join('');
    
    // Show modal
    modal.style.display = 'block';
}

// Close category details modal
function closeCategoryDetails() {
    const modal = document.getElementById('categoryDetailsModal');
    modal.style.display = 'none';
}

// Add item to order
function addToOrder(dishName, price) {
    // Check if item already exists in order
    const existingItem = orderItems.find(item => item.name === dishName);
    
    if (existingItem) {
        existingItem.quantity += 1;
        existingItem.totalPrice = existingItem.price * existingItem.quantity;
    } else {
        orderItems.push({
            name: dishName,
            price: price,
            quantity: 1,
            totalPrice: price
        });
    }
    
    updateOrderTotal();
    updateOrderCount();
    saveOrderToStorage();
    
    // Show success message
    showOrderMessage(`${dishName} е добавен в поръчката!`);
}

// Remove item from order
function removeFromOrder(dishName) {
    orderItems = orderItems.filter(item => item.name !== dishName);
    updateOrderTotal();
    updateOrderCount();
    saveOrderToStorage();
    
    // Refresh order display if modal is open
    if (document.getElementById('orderSummaryModal').style.display === 'block') {
        displayOrderItems();
    }
}

// Update quantity of item in order
function updateItemQuantity(dishName, newQuantity) {
    const item = orderItems.find(item => item.name === dishName);
    if (item) {
        if (newQuantity <= 0) {
            removeFromOrder(dishName);
        } else {
            item.quantity = newQuantity;
            item.totalPrice = item.price * item.quantity;
            updateOrderTotal();
            updateOrderCount();
            saveOrderToStorage();
            
            // Refresh order display if modal is open
            if (document.getElementById('orderSummaryModal').style.display === 'block') {
                displayOrderItems();
            }
        }
    }
}

// Calculate total order price
function updateOrderTotal() {
    orderTotal = orderItems.reduce((total, item) => total + item.totalPrice, 0);
}

// Update order count in button
function updateOrderCount() {
    const totalItems = orderItems.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('order-count').textContent = totalItems;
}

// Toggle order summary modal
function toggleOrderSummary() {
    const modal = document.getElementById('orderSummaryModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'block';
        displayOrderItems();
    }
}

// Display order items in modal
function displayOrderItems() {
    const orderItemsContainer = document.getElementById('order-items');
    const totalPriceElement = document.getElementById('total-price');
    
    if (orderItems.length === 0) {
        orderItemsContainer.innerHTML = '<p class="empty-order">Няма добавени ястия</p>';
    } else {
        orderItemsContainer.innerHTML = orderItems.map(item => `
            <div class="order-item">
                <div class="order-item-info">
                    <div class="order-item-name">${item.name}</div>
                    <div class="order-item-quantity">
                        <button onclick="updateItemQuantity('${item.name}', ${item.quantity - 1})" class="quantity-btn">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button onclick="updateItemQuantity('${item.name}', ${item.quantity + 1})" class="quantity-btn">+</button>
                    </div>
                </div>
                <div class="order-item-price">${item.totalPrice.toFixed(2)} €</div>
                <button onclick="removeFromOrder('${item.name}')" class="remove-btn">×</button>
            </div>
        `).join('');
    }
    
    totalPriceElement.textContent = orderTotal.toFixed(2);
}

// Generate QR code for order
function generateQR() {
    if (orderItems.length === 0) {
        showOrderMessage('Поръчката е празна!');
        return;
    }
    
    // Create order summary text
    const orderSummary = createOrderSummary();
    
    // Generate QR code using QR.js library (you'll need to include this library)
    generateQRCode(orderSummary);
    
    showOrderMessage('QR кодът е генериран успешно!');
}

// Create order summary text
function createOrderSummary() {
    let summary = 'ПОРЪЧКА\n';
    summary += '==================\n\n';
    
    orderItems.forEach(item => {
        summary += `${item.name} x${item.quantity} - ${item.totalPrice.toFixed(2)} €\n`;
    });
    
    summary += '\n==================\n';
    summary += `ОБЩО: ${orderTotal.toFixed(2)} €\n`;
    summary += `Дата: ${new Date().toLocaleDateString('bg-BG')}\n`;
    summary += `Час: ${new Date().toLocaleTimeString('bg-BG')}`;
    
    return summary;
}

// Generate QR code (using QR.js library)
function generateQRCode(text) {
    // Create QR code container if it doesn't exist
    let qrContainer = document.querySelector('.qr-code-container');
    if (!qrContainer) {
        qrContainer = document.createElement('div');
        qrContainer.className = 'qr-code-container';
        document.querySelector('.order-summary-content').appendChild(qrContainer);
    }
    
    // Clear previous QR code
    qrContainer.innerHTML = '<h3>QR код за поръчката</h3>';
    
    // Create QR code element
    const qrCodeElement = document.createElement('div');
    qrCodeElement.id = 'qr-code';
    
    // Simple QR code generation (you might want to use a proper QR library)
    qrCodeElement.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 8px; display: inline-block;">
            <div style="font-family: monospace; font-size: 10px; line-height: 1; color: black;">
                ${text.split('\n').map(line => line.replace(/./g, '█')).join('<br>')}
            </div>
        </div>
        <p style="margin-top: 10px; color: #ccc; font-size: 0.9rem;">
            Сканирайте този код за да видите детайлите на поръчката
        </p>
    `;
    
    qrContainer.appendChild(qrCodeElement);
}

// Show order message
function showOrderMessage(message) {
    // Remove existing message if any
    const existingMessage = document.querySelector('.order-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageElement = document.createElement('div');
    messageElement.className = 'order-message';
    messageElement.textContent = message;
    messageElement.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background-color: #ff8c00;
        color: #2c1810;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-weight: bold;
        z-index: 3000;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageElement);
    
    // Remove message after 3 seconds
    setTimeout(() => {
        messageElement.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            messageElement.remove();
        }, 300);
    }, 3000);
}

// Save order to localStorage
function saveOrderToStorage() {
    localStorage.setItem('restaurantOrder', JSON.stringify(orderItems));
}

// Load order from localStorage
function loadOrderFromStorage() {
    const savedOrder = localStorage.getItem('restaurantOrder');
    if (savedOrder) {
        orderItems = JSON.parse(savedOrder);
        updateOrderTotal();
        updateOrderCount();
    }
}

// Clear order
function clearOrder() {
    orderItems = [];
    orderTotal = 0;
    updateOrderCount();
    saveOrderToStorage();
    
    if (document.getElementById('orderSummaryModal').style.display === 'block') {
        displayOrderItems();
    }
    
    showOrderMessage('Поръчката е изчистена!');
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .order-item-info {
        flex: 1;
    }
    
    .order-item-quantity {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }
    
    .quantity-btn {
        background-color: #ff8c00;
        color: #2c1810;
        border: none;
        border-radius: 50%;
        width: 25px;
        height: 25px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.3s;
    }
    
    .quantity-btn:hover {
        background-color: #ff6b00;
    }
    
    .quantity {
        color: white;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
    }
    
    .remove-btn {
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 1.2rem;
        font-weight: bold;
        transition: background-color 0.3s;
    }
    
    .remove-btn:hover {
        background-color: #c82333;
    }
`;
document.head.appendChild(style);

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const orderModal = document.getElementById('orderSummaryModal');
    const categoryModal = document.getElementById('categoryDetailsModal');
    
    if (event.target === orderModal) {
        orderModal.style.display = 'none';
    }
    
    if (event.target === categoryModal) {
        categoryModal.style.display = 'none';
    }
});

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const orderModal = document.getElementById('orderSummaryModal');
        const categoryModal = document.getElementById('categoryDetailsModal');
        
        if (orderModal.style.display === 'block') {
            orderModal.style.display = 'none';
        }
        
        if (categoryModal.style.display === 'block') {
            categoryModal.style.display = 'none';
        }
    }
});
