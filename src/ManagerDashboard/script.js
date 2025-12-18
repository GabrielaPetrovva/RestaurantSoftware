    // Tab switching functionality
    function switchTab(tabName) {
        // Hide all sections
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => section.classList.remove('active'));

        // Remove active class from all tabs
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => tab.classList.remove('active'));

        // Show selected section
        document.getElementById(tabName).classList.add('active');

        // Add active class to clicked tab
        event.target.classList.add('active');
    }

    // Logout functionality
    function logout() {
        if (confirm('Сигурни ли сте, че искате да излезете?')) {
            alert('Успешно излизане от системата');
            // Here you would redirect to login page
            // window.location.href = '/login';
        }
    }

    // Simulate real-time data updates
    setInterval(() => {
        // Update random stat card with animation
        const statValues = document.querySelectorAll('.stat-value');
        if (statValues.length > 0) {
            const randomIndex = Math.floor(Math.random() * Math.min(4, statValues.length));
            const element = statValues[randomIndex];
            element.style.transform = 'scale(1.05)';
            element.style.color = '#4CAF50';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
                element.style.color = '#333';
            }, 300);
        }
    }, 5000);

    // Add hover effects to heatmap cells
    document.addEventListener('DOMContentLoaded', () => {
        const heatmapCells = document.querySelectorAll('.heatmap-cell');
        heatmapCells.forEach(cell => {
            cell.addEventListener('click', function() {
                const value = this.textContent;
                alert(`Клиенти в този период: ${value}`);
            });
        });

        // Animate progress bars on load
        const progressFills = document.querySelectorAll('.progress-fill');
        progressFills.forEach(fill => {
            const width = fill.style.width;
            fill.style.width = '0';
            setTimeout(() => {
                fill.style.width = width;
            }, 100);
        });

        // Animate bars on load
        const bars = document.querySelectorAll('.bar');
        bars.forEach((bar, index) => {
            const height = bar.style.height;
            bar.style.height = '0';
            setTimeout(() => {
                bar.style.height = height;
            }, 100 + (index * 100));
        });
    });

    // Notification simulation
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Simulate periodic notifications
    setTimeout(() => {
        showNotification('Нова поръчка за доставка!', 'info');
    }, 10000);

    setTimeout(() => {
        showNotification('Ниско ниво на домати', 'warning');
    }, 20000);