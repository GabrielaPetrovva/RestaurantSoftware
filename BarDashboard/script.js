        // Timer functionality
        function updateTimers() {
            const timers = document.querySelectorAll('.order-time');
            timers.forEach(timer => {
                const time = timer.textContent.split(':');
                let minutes = parseInt(time[0]);
                let seconds = parseInt(time[1]);
                
                seconds++;
                if (seconds >= 60) {
                    seconds = 0;
                    minutes++;
                }
                
                timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            });
        }

        setInterval(updateTimers, 1000);

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                
                // Update active tab
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Show corresponding content
                document.querySelectorAll('.content-section').forEach(section => {
                    section.classList.remove('active');
                });
                document.getElementById(tabName + '-section').classList.add('active');
            });
        });

        // Button interactions
        document.querySelectorAll('.btn-start').forEach(btn => {
            btn.addEventListener('click', function() {
                const lang = localStorage.getItem('barDashboardLang') || 'en';
                const inProgressText = lang === 'bg' ? 'В процес' : 'In Progress';
                this.textContent = inProgressText;
                this.classList.remove('btn-start');
                this.classList.add('btn-ready');
                this.style.backgroundColor = '#66BB6A';
                this.style.color = 'white';
            });
        });

        document.querySelectorAll('.btn-ready').forEach(btn => {
            btn.addEventListener('click', function() {
                const lang = localStorage.getItem('barDashboardLang') || 'en';
                const alertMsg = lang === 'bg' ? 'Поръчката е маркирана като готова!' : 'Order marked as ready!';
                alert(alertMsg);
            });
        });

        document.querySelectorAll('.btn-served').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('.order-quick-card, .order-card').style.opacity = '0.5';
                setTimeout(() => {
                    this.closest('.order-quick-card, .order-card').remove();
                }, 300);
            });
        });

        document.querySelector('.exit-btn').addEventListener('click', function() {
            const lang = localStorage.getItem('barDashboardLang') || 'en';
            const confirmMsg = lang === 'bg' ? 'Сигурни ли сте, че искате да излезете?' : 'Are you sure you want to exit?';
            if (confirm(confirmMsg)) {
                window.location.href = '/';
            }
        });

        // Animate bars on page load
        window.addEventListener('load', function() {
            setTimeout(() => {
                document.querySelectorAll('.bar-fill').forEach(bar => {
                    const width = bar.style.width;
                    bar.style.width = '0%';
                    setTimeout(() => {
                        bar.style.width = width;
                    }, 100);
                });
            }, 500);
        });