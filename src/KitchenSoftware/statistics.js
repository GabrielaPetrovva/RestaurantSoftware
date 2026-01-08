let currentLang = localStorage.getItem('kitchenLang') || 'bg';
        
const translations = {
    bg: {
        headerTitle: 'Кухненска Статистика',
        waiterName: 'Петър Петров',
        backBtn: 'Назад към Таблото',
        exitBtn: 'Изход',
        filterLabel: 'Период:',
        periodToday: 'Днес',
        periodWeek: 'Тази Седмица',
        periodMonth: 'Този Месец',
        periodYear: 'Тази Година',
        totalOrdersLabel: 'Общо Поръчки',
        completedOrdersLabel: 'Завършени Поръчки',
        avgCookingTimeLabel: 'Средно Време за Готвене',
        lateOrdersLabel: 'Забавени Поръчки',
        avgCheckLabel: 'Среден Чек',
        servedGuestsLabel: 'Обслужени Гости',
        vsYesterdayLabel: 'спрямо вчера',
        vsYesterdayLabel2: 'спрямо вчера',
        successRateLabel: 'процент успеваемост',
        vsTargetLabel: 'спрямо целта',
        ofTotalLabel: 'от общо',
        vsLastWeekLabel: 'спрямо миналата седмица',
        ordersPerHourTitle: 'Поръчки на Час',
        orderTypesTitle: 'Типове Поръчки',
        dineInLabel: 'На място',
        takeawayLabel: 'За вкъщи',
        topDishesTitle: 'Топ Ястия Днес',
        dishNameHeader: 'Име на Ястието',
        ordersHeader: 'Поръчки',
        revenueHeader: 'Приходи',
        avgTimeHeader: 'Средно Време',
        statusHeader: 'Статус',
        onTimeLabel: 'Навреме',
        delayedLabel: 'Забавено',
        // Dish names
        'Grilled Salmon': 'Печен сьомга',
        'Margherita Pizza': 'Пица Маргарита',
        'Caesar Salad': 'Салата Цезар',
        'Beef Burger': 'Говеждо бургер',
        'Pasta Carbonara': 'Паста Карбонара',
        'Chicken Curry': 'Пилешко карри'
    },
    en: {
        headerTitle: 'Kitchen Statistics',
        waiterName: 'Petar Petrov',
        backBtn: 'Back to Dashboard',
        exitBtn: 'Exit',
        filterLabel: 'Period:',
        periodToday: 'Today',
        periodWeek: 'This Week',
        periodMonth: 'This Month',
        periodYear: 'This Year',
        totalOrdersLabel: 'Total Orders',
        completedOrdersLabel: 'Completed Orders',
        avgCookingTimeLabel: 'Avg Cooking Time',
        lateOrdersLabel: 'Late Orders',
        avgCheckLabel: 'Average Check',
        servedGuestsLabel: 'Served Guests',
        vsYesterdayLabel: 'vs yesterday',
        vsYesterdayLabel2: 'vs yesterday',
        successRateLabel: 'success rate',
        vsTargetLabel: 'vs target',
        ofTotalLabel: 'of total',
        vsLastWeekLabel: 'vs last week',
        ordersPerHourTitle: 'Orders per Hour',
        orderTypesTitle: 'Order Types',
        dineInLabel: 'Dine-in',
        takeawayLabel: 'Takeaway',
        topDishesTitle: 'Top Dishes Today',
        dishNameHeader: 'Dish Name',
        ordersHeader: 'Orders',
        revenueHeader: 'Revenue',
        avgTimeHeader: 'Avg Time',
        statusHeader: 'Status',
        onTimeLabel: 'On Time',
        delayedLabel: 'Delayed',
        // Dish names
        'Grilled Salmon': 'Grilled Salmon',
        'Margherita Pizza': 'Margherita Pizza',
        'Caesar Salad': 'Caesar Salad',
        'Beef Burger': 'Beef Burger',
        'Pasta Carbonara': 'Pasta Carbonara',
        'Chicken Curry': 'Chicken Curry'
    }
};

function toggleLanguage() {
    currentLang = currentLang === 'bg' ? 'en' : 'bg';
    localStorage.setItem('kitchenLang', currentLang);
    document.getElementById('langBtn').textContent = currentLang === 'bg' ? 'EN' : 'БГ';
    updateLanguage();
}

function updateLanguage() {
    const t = translations[currentLang];
    
    // Update header
    document.getElementById('headerTitle').textContent = t.headerTitle;
    document.getElementById('waiterName').textContent = t.waiterName;
    document.getElementById('backBtn').textContent = t.backBtn;
    document.getElementById('exitBtn').textContent = t.exitBtn;
    
    // Update filters
    document.getElementById('filterLabel').textContent = t.filterLabel;
    const periodSelect = document.getElementById('periodFilter');
    periodSelect.options[0].text = t.periodToday;
    periodSelect.options[1].text = t.periodWeek;
    periodSelect.options[2].text = t.periodMonth;
    periodSelect.options[3].text = t.periodYear;
    
    // Update stat cards
    document.getElementById('totalOrdersLabel').textContent = t.totalOrdersLabel;
    document.getElementById('completedOrdersLabel').textContent = t.completedOrdersLabel;
    document.getElementById('avgCookingTimeLabel').textContent = t.avgCookingTimeLabel;
    document.getElementById('lateOrdersLabel').textContent = t.lateOrdersLabel;
    document.getElementById('avgCheckLabel').textContent = t.avgCheckLabel;
    document.getElementById('servedGuestsLabel').textContent = t.servedGuestsLabel;
    
    // Update stat changes
    document.getElementById('vsYesterdayLabel').textContent = t.vsYesterdayLabel;
    document.getElementById('vsYesterdayLabel2').textContent = t.vsYesterdayLabel2;
    document.getElementById('successRateLabel').textContent = t.successRateLabel;
    document.getElementById('vsTargetLabel').textContent = t.vsTargetLabel;
    document.getElementById('ofTotalLabel').textContent = t.ofTotalLabel;
    document.getElementById('vsLastWeekLabel').textContent = t.vsLastWeekLabel;
    
    // Update charts
    document.getElementById('ordersPerHourTitle').textContent = t.ordersPerHourTitle;
    document.getElementById('orderTypesTitle').textContent = t.orderTypesTitle;
    document.getElementById('dineInLabel').textContent = t.dineInLabel;
    document.getElementById('takeawayLabel').textContent = t.takeawayLabel;
    
    // Update table
    document.getElementById('topDishesTitle').textContent = t.topDishesTitle;
    document.getElementById('dishNameHeader').textContent = t.dishNameHeader;
    document.getElementById('ordersHeader').textContent = t.ordersHeader;
    document.getElementById('revenueHeader').textContent = t.revenueHeader;
    document.getElementById('avgTimeHeader').textContent = t.avgTimeHeader;
    document.getElementById('statusHeader').textContent = t.statusHeader;
    
    // Update badges
    const onTimeBadges = document.querySelectorAll('[id^="onTimeLabel"]');
    onTimeBadges.forEach(badge => {
        badge.textContent = t.onTimeLabel;
    });
    
    const delayedBadges = document.querySelectorAll('[id^="delayedLabel"]');
    delayedBadges.forEach(badge => {
        badge.textContent = t.delayedLabel;
    });
    
    // Update dish names in table
    const dishRows = document.querySelectorAll('.table-section tbody tr');
    dishRows.forEach(row => {
        const dishCell = row.querySelector('td strong');
        if (dishCell) {
            const dishName = dishCell.textContent.trim();
            if (t[dishName]) {
                dishCell.textContent = t[dishName];
            }
        }
    });
}

function updateStats() {
    // Placeholder for updating statistics based on selected period
    console.log('Updating stats for period:', document.getElementById('periodFilter').value);
}

function goBack() {
        window.location.href = 'index.html';
}

function exit() {
    if (confirm(currentLang === 'bg' ? 'Сигурни ли сте, че искате да излезете?' : 'Are you sure you want to exit?')) {
        alert(currentLang === 'bg' ? 'Излизане...' : 'Exiting...');
    }
}

// Initialize language button text
document.getElementById('langBtn').textContent = currentLang === 'bg' ? 'EN' : 'БГ';

// Initialize with saved language
updateLanguage();