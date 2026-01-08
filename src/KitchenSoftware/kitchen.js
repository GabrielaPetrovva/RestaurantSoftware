let currentLang = localStorage.getItem('kitchenLang') || 'bg';
const translations = {
    bg: {
        headerTitle: 'Кухненско Табло',
        waiterName: 'Петър Петров',
        exitBtn: 'Изход',
        tabOrders: 'Поръчки',
        tabMetrics: 'Статистики',
        metricsTitle: 'Средно време за готвене',
        avgTimeLabel: '',
        lateOrdersLabel: 'Забавени поръчки',
        totalOrdersLabel: 'Общо поръчки',
        takeawayTitle: 'За вкъщи / Доставка',
        btnStart: 'Започни готвене',
        btnReady: 'Готово',
        btnServed: 'Сервирано',
        bumpOff: 'Премахни',
        priority: 'Приоритет',
        takeaway: 'За вкъщи',
        delivery: 'Доставка',
        table: 'Маса',
        order: 'Поръчка',
        // Menu items
        'Pasta Bolognese': 'Паста Болонезе',
        'Garlic Bread': 'Чеснов хляб',
        'Caesar Salad': 'Салата Цезар',
        'Grilled Salmon': 'Печен сьомга',
        'Margherita Pizza': 'Пица Маргарита',
        'Greek Salad': 'Гръцка салата',
        'Chicken Curry': 'Пилешко карри',
        'Rice': 'Ориз',
        'Naan Bread': 'Наан хляб',
        'Beef Burger': 'Говеждо бургер',
        'French Fries': 'Пържени картофи',
        'Seafood Pasta': 'Паста с морски дарове',
        'Caprese Salad': 'Салата Капрезе',
        'Burger': 'Бургер',
        'Rice': 'Ориз',
        'Naan Bread': 'Наан хляб',
        'Greek Salad': 'Гръцка салата'
    },
    en: {
        headerTitle: 'Kitchen Dashboard',
        waiterName: 'Petar Petrov',
        exitBtn: 'Exit',
        tabOrders: 'Orders',
        tabMetrics: 'Metrics',
        metricsTitle: 'Average cooking time',
        avgTimeLabel: '',
        lateOrdersLabel: 'Late orders',
        totalOrdersLabel: 'Total orders',
        takeawayTitle: 'Takeaway / Delivery',
        btnStart: 'Start cooking',
        btnReady: 'Ready',
        btnServed: 'Served',
        bumpOff: 'Bump off',
        priority: 'Priority',
        takeaway: 'Takeaway',
        delivery: 'Delivery',
        table: 'Table',
        order: 'Order',
        // Menu items
        'Pasta Bolognese': 'Pasta Bolognese',
        'Garlic Bread': 'Garlic Bread',
        'Caesar Salad': 'Caesar Salad',
        'Grilled Salmon': 'Grilled Salmon',
        'Margherita Pizza': 'Margherita Pizza',
        'Greek Salad': 'Greek Salad',
        'Chicken Curry': 'Chicken Curry',
        'Rice': 'Rice',
        'Naan Bread': 'Naan Bread',
        'Beef Burger': 'Beef Burger',
        'French Fries': 'French Fries',
        'Seafood Pasta': 'Seafood Pasta',
        'Caprese Salad': 'Caprese Salad',
        'Burger': 'Burger',
        'Rice': 'Rice',
        'Naan Bread': 'Naan Bread',
        'Greek Salad': 'Greek Salad'
    }
};

// Sample orders data
const orders = [
    {
        id: 23,
        waiter: 'Ivan Ivanov',
        table: 2,
        time: 335,
        status: 'pending',
        items: [
            { name: 'Pasta Bolognese', notes: 'No cheese' },
            { name: 'Garlic Bread', notes: '' }
        ]
    },
    {
        id: 24,
        waiter: 'Aleksandar',
        table: 3,
        time: 80,
        status: 'cooking',
        priority: true,
        items: [
            { name: 'Caesar Salad', notes: '' },
            { name: 'Grilled Salmon', notes: 'Medium rare' }
        ]
    },
    {
        id: 25,
        waiter: 'Maria Petrova',
        table: 5,
        time: 45,
        status: 'pending',
        items: [
            { name: 'Margherita Pizza', notes: 'Extra cheese' },
            { name: 'Greek Salad', notes: 'No onions' }
        ]
    },
    {
        id: 26,
        waiter: 'Ivan Ivanov',
        table: 7,
        time: 120,
        status: 'cooking',
        items: [
            { name: 'Chicken Curry', notes: 'Spicy' },
            { name: 'Rice', notes: '' },
            { name: 'Naan Bread', notes: 'Garlic' }
        ]
    },
    {
        id: 27,
        waiter: 'Elena Dimitrova',
        table: 1,
        time: 25,
        status: 'pending',
        items: [
            { name: 'Beef Burger', notes: 'No pickles' },
            { name: 'French Fries', notes: '' }
        ]
    },
    {
        id: 28,
        waiter: 'Georgi Georgiev',
        table: 9,
        time: 380,
        status: 'cooking',
        late: true,
        items: [
            { name: 'Seafood Pasta', notes: 'Extra shrimp' },
            { name: 'Caprese Salad', notes: '' }
        ]
    }
];

const takeawayOrders = [
    {
        id: 33,
        type: 'Takeaway',
        customer: 'Kaloyan',
        items: ['Burger'],
        status: 'ready'
    }
];

function toggleLanguage() {
    currentLang = currentLang === 'bg' ? 'en' : 'bg';
    localStorage.setItem('kitchenLang', currentLang);
    document.getElementById('langBtn').textContent = currentLang === 'bg' ? 'EN' : 'БГ';
    updateLanguage();
}

function updateLanguage() {
    const t = translations[currentLang];
    document.getElementById('headerTitle').textContent = t.headerTitle;
    document.getElementById('waiterName').textContent = t.waiterName;
    document.getElementById('exitBtn').textContent = t.exitBtn;
    document.getElementById('tabOrders').innerHTML = `${t.tabOrders} <span class="badge" id="ordersBadge">${orders.length}</span>`;
    document.getElementById('tabMetrics').textContent = t.tabMetrics;
    document.getElementById('metricsTitle').textContent = t.metricsTitle;
    document.getElementById('lateOrdersLabel').textContent = t.lateOrdersLabel;
    document.getElementById('totalOrdersLabel').textContent = t.totalOrdersLabel;
    document.getElementById('takeawayTitle').textContent = t.takeawayTitle;
    
    renderOrders();
    renderTakeaway();
}

// Helper function to translate menu items
function translateMenuItem(name) {
    return translations[currentLang][name] || name;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTimerClass(seconds) {
    if (seconds > 300) return 'danger';
    if (seconds > 180) return 'warning';
    return '';
}

function renderOrders() {
    const container = document.getElementById('ordersSection');
    const t = translations[currentLang];
    
    container.innerHTML = orders.map(order => `
        <div class="order-card ${order.priority ? 'priority' : ''} ${order.late ? 'late' : ''}">
            <div class="order-header">
                <div class="order-info">
                    <div class="order-number">${t.order} #${order.id}</div>
                    <div class="order-waiter">${order.waiter}</div>
                    <div class="order-table">${t.table} ${order.table}</div>
                    ${order.priority ? `<span class="priority-badge">${t.priority}</span>` : ''}
                </div>
                <div class="order-timer ${getTimerClass(order.time)}">
                    ${formatTime(order.time)}
                </div>
            </div>
            <div class="order-items">
                ${order.items.map(item => {
                    const translatedName = t[item.name] || item.name;
                    return `
                    <div class="order-item">
                        <div class="item-name">${translatedName}</div>
                        ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                    </div>
                `;
                }).join('')}
            </div>
            <div class="order-actions">
                ${order.status === 'pending' ? `
                    <button class="btn btn-start" onclick="startCooking(${order.id})">${t.btnStart}</button>
                ` : order.status === 'cooking' ? `
                    <button class="btn btn-ready" onclick="markReady(${order.id})">${t.btnReady}</button>
                ` : `
                    <button class="btn btn-served" onclick="bumpOff(${order.id})">${t.bumpOff}</button>
                `}
            </div>
        </div>
    `).join('');
}

function renderTakeaway() {
    const container = document.getElementById('takeawayOrders');
    const t = translations[currentLang];
    
    container.innerHTML = takeawayOrders.map(order => {
        const orderType = order.type === 'Takeaway' ? t.takeaway : (order.type === 'Delivery' ? t.delivery : order.type);
        const translatedItems = order.items.map(item => t[item] || item).join(', ');
        return `
        <div class="takeaway-order">
            <div class="takeaway-header">
                <span class="takeaway-number">${t.order} #${order.id}</span>
                <span class="takeaway-type">${orderType}</span>
            </div>
            <div class="takeaway-items">
                <strong>${order.customer}</strong><br>
                ${translatedItems}
            </div>
            <div class="takeaway-actions">
                ${order.status === 'ready' ? `
                    <button class="btn btn-served btn-small" onclick="markServed(${order.id})">${t.btnServed}</button>
                ` : `
                    <button class="btn btn-ready btn-small" onclick="markReady(${order.id})">${t.btnReady}</button>
                `}
            </div>
        </div>
    `;
    }).join('');
}

function startCooking(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'cooking';
        renderOrders();
    }
}

function markReady(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'ready';
        renderOrders();
    }
}

function bumpOff(orderId) {
    const index = orders.findIndex(o => o.id === orderId);
    if (index > -1) {
        orders.splice(index, 1);
        renderOrders();
        document.getElementById('ordersBadge').textContent = orders.length;
        document.getElementById('totalOrders').textContent = orders.length;
    }
}

function markServed(orderId) {
    const index = takeawayOrders.findIndex(o => o.id === orderId);
    if (index > -1) {
        takeawayOrders.splice(index, 1);
        renderTakeaway();
    }
}

function switchTab(tab) {
if (tab === 'metrics') {
window.location.href = 'statisticks.html';
return;
}

const tabs = document.querySelectorAll('.tab');
tabs.forEach(t => t.classList.remove('active'));
document.querySelector(`#tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
}

function exit() {
    if (confirm(currentLang === 'bg' ? 'Сигурни ли сте, че искате да излезете?' : 'Are you sure you want to exit?')) {
        alert(currentLang === 'bg' ? 'Излизане...' : 'Exiting...');
    }
}

// Update timers every second
setInterval(() => {
    orders.forEach(order => {
        if (order.status !== 'ready') {
            order.time++;
            if (order.time > 300) {
                order.late = true;
            }
        }
    });
    renderOrders();
}, 1000);

// Initialize language button text
document.getElementById('langBtn').textContent = currentLang === 'bg' ? 'EN' : 'БГ';

// Initial render
updateLanguage();