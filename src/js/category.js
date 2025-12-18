// Category Page JavaScript

// Order data storage
let orderItems = [];
let orderTotal = 0;

// Show nutrition information modal
function showNutritionInfo(name, description, calories, carbs, protein, fat, weight, price, priceValue) {
    const modal = document.getElementById('nutritionModal');
    const title = document.getElementById('nutrition-title');
    const desc = document.getElementById('nutrition-description');
    const caloriesEl = document.getElementById('nutrition-calories');
    const carbsEl = document.getElementById('nutrition-carbs');
    const proteinEl = document.getElementById('nutrition-protein');
    const fatEl = document.getElementById('nutrition-fat');
    const weightEl = document.getElementById('nutrition-weight');
    const priceEl = document.getElementById('nutrition-price');
    const addBtn = document.getElementById('nutrition-add-btn');
    
    // Set content
    title.textContent = name;
    desc.textContent = description;
    caloriesEl.textContent = calories;
    carbsEl.textContent = carbs;
    proteinEl.textContent = protein;
    fatEl.textContent = fat;
    weightEl.textContent = weight;
    priceEl.textContent = price;
    
    // Update add button
    addBtn.onclick = function() {
        addToOrder(name, priceValue);
        closeNutritionModal();
    };
    
    // Show modal
    modal.style.display = 'block';
}

// Close nutrition modal
function closeNutritionModal() {
    const modal = document.getElementById('nutritionModal');
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
    const orderCountElements = document.getElementsByClassName('order-badge');
    Array.from(orderCountElements).forEach(el => {
        el.textContent = totalItems;
        // Hide badge when count is 0
        if (totalItems === 0) {
            el.style.display = 'none';
        } else {
            el.style.display = 'flex';
        }
    });
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

// Load order when page loads
window.addEventListener('DOMContentLoaded', function() {
    loadOrderFromStorage();
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const orderModal = document.getElementById('orderSummaryModal');
    const nutritionModal = document.getElementById('nutritionModal');
    
    if (event.target === orderModal) {
        orderModal.style.display = 'none';
    }
    
    if (event.target === nutritionModal) {
        nutritionModal.style.display = 'none';
    }
});

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const orderModal = document.getElementById('orderSummaryModal');
        const nutritionModal = document.getElementById('nutritionModal');
        
        if (orderModal.style.display === 'block') {
            orderModal.style.display = 'none';
        }
        
        if (nutritionModal.style.display === 'block') {
            nutritionModal.style.display = 'none';
        }
    }
});
