// Tab switching
    function switchTab(tab) {
        const tabs = document.querySelectorAll('.tab');
        const views = document.querySelectorAll('.view-container');
        
        tabs.forEach(t => t.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        
        // Find the correct tab button, even if click was on a child element
        let targetTab = null;
        if (event && event.target) {
            // If clicked on a child element (span, badge, etc.), find the parent button
            targetTab = event.target.closest('.tab');
            if (!targetTab) {
                // Fallback: find by tab id
                targetTab = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
            }
        } else {
            // Fallback if event is not available
            targetTab = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`) || 
                       document.querySelector(`[onclick*="switchTab('${tab}')"]`);
        }
        
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        document.getElementById(`${tab}-view`).classList.add('active');
    }

    // Order actions
    function startCooking(orderId) {
        const lang = localStorage.getItem('mainDashboardLang') || 'bg';
        const msg = lang === 'bg' ? `Започна готвене на поръчка #${orderId}` : `Started cooking order #${orderId}`;
        alert(msg);
    }

    function markReady(orderId) {
        const lang = localStorage.getItem('mainDashboardLang') || 'bg';
        const confirmMsg = lang === 'bg' ? `Маркирай поръчка #${orderId} като готова за вземане?` : `Mark order #${orderId} as ready for pickup?`;
        const alertMsg = lang === 'bg' ? `Поръчка #${orderId} маркирана като готова` : `Order #${orderId} marked as ready`;
        if(confirm(confirmMsg)) {
            alert(alertMsg);
        }
    }

    function markServed(orderId) {
        const lang = localStorage.getItem('mainDashboardLang') || 'bg';
        const confirmMsg = lang === 'bg' ? `Маркирай поръчка #${orderId} като сервирана?` : `Mark order #${orderId} as served?`;
        const alertMsg = lang === 'bg' ? `Поръчка #${orderId} маркирана като сервирана` : `Order #${orderId} marked as served`;
        if(confirm(confirmMsg)) {
            alert(alertMsg);
        }
    }

    // Filter orders
    function filterOrders(filter) {
        const filterBtns = document.querySelectorAll('.filters .filter-btn');
        filterBtns.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        console.log(`Filtering by: ${filter}`);
    }

    // Filter inventory
    function filterInventory(filter) {
        const filterBtns = document.querySelectorAll('.filters .filter-btn');
        filterBtns.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        console.log(`Filtering inventory by: ${filter}`);
    }

    // Inventory actions
    function viewRecipeUsage(item) {
        document.getElementById('recipeModal').classList.add('active');
    }

    function orderSupplies(item) {
        alert(`Ordering ${item} from supplier...`);
    }

    function closeModal() {
        document.getElementById('recipeModal').classList.remove('active');
    }

    // Waste logging
    function logWaste(event) {
        event.preventDefault();
        alert('Waste logged successfully!');
        event.target.reset();
    }

    // Download report
    function downloadReport() {
        alert('Downloading report as PDF...');
    }

    // Logout
    function logout() {
        const lang = localStorage.getItem('mainDashboardLang') || 'bg';
        const confirmMsg = lang === 'bg' ? 'Сигурни ли сте, че искате да излезете?' : 'Are you sure you want to exit?';
        const alertMsg = lang === 'bg' ? 'Излизане...' : 'Logging out...';
        if(confirm(confirmMsg)) {
            alert(alertMsg);
        }
    }

    // Update timers every second
    setInterval(() => {
        const timers = document.querySelectorAll('.timer');
        timers.forEach(timer => {
            const parts = timer.textContent.split(':');
            let minutes = parseInt(parts[0]);
            let seconds = parseInt(parts[1]);
            
            seconds++;
            if (seconds >= 60) {
                minutes++;
                seconds = 0;
            }
            
            timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Update color based on time
            timer.classList.remove('warning', 'danger');
            if (minutes >= 12) {
                timer.classList.add('danger');
            } else if (minutes >= 5) {
                timer.classList.add('warning');
            }
        });
    }, 1000);