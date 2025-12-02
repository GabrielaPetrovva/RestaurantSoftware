// Tab switching
    function switchTab(tab) {
        const tabs = document.querySelectorAll('.tab');
        const views = document.querySelectorAll('.view-container');
        
        tabs.forEach(t => t.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(`${tab}-view`).classList.add('active');
    }

    // Order actions
    function startCooking(orderId) {
        alert(`Started cooking order #${orderId}`);
    }

    function markReady(orderId) {
        if(confirm(`Mark order #${orderId} as ready for pickup?`)) {
            alert(`Order #${orderId} marked as ready`);
        }
    }

    function markServed(orderId) {
        if(confirm(`Mark order #${orderId} as served?`)) {
            alert(`Order #${orderId} marked as served`);
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
        if(confirm('Are you sure you want to exit?')) {
            alert('Logging out...');
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