        // Timer functionality
        function updateTimers() {
            document.querySelectorAll('.timer').forEach(timer => {
                let text = timer.textContent.trim();
                let match = text.match(/(\d+):(\d+)/);
                if (match) {
                    let minutes = parseInt(match[1]);
                    let seconds = parseInt(match[2]);
                    
                    seconds++;
                    if (seconds >= 60) {
                        minutes++;
                        seconds = 0;
                    }
                    
                    timer.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            });
        }

        setInterval(updateTimers, 1000);

        // Order management functions
        function startOrder(btn) {
            const orderItem = btn.closest('.order-item');
            const progressOrders = document.getElementById('progressOrders');
            
            orderItem.style.animation = 'none';
            setTimeout(() => {
                orderItem.remove();
                progressOrders.insertBefore(orderItem, progressOrders.firstChild);
                
                btn.textContent = 'Готово';
                btn.className = 'btn btn-ready';
                btn.onclick = function() { markReady(this); };
                
                updateCounts();
            }, 300);
        }

        function markReady(btn) {
            const orderItem = btn.closest('.order-item');
            const readyOrders = document.getElementById('readyOrders');
            
            orderItem.remove();
            readyOrders.insertBefore(orderItem, readyOrders.firstChild);
            
            btn.textContent = 'Сервирано';
            btn.className = 'btn btn-served';
            btn.onclick = function() { markServed(this); };
            
            updateCounts();
        }

        function markServed(btn) {
            const orderItem = btn.closest('.order-item');
            orderItem.style.transform = 'translateX(100%)';
            orderItem.style.opacity = '0';
            
            setTimeout(() => {
                orderItem.remove();
                updateCounts();
            }, 300);
        }

        function updateCounts() {
            document.getElementById('pendingCount').textContent = 
                document.getElementById('pendingOrders').children.length;
            document.getElementById('progressCount').textContent = 
                document.getElementById('progressOrders').children.length;
            document.getElementById('readyCount').textContent = 
                document.getElementById('readyOrders').children.length;
        }

        function filterCategory(category) {
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');
            
            const orders = document.querySelectorAll('#pendingOrders .order-item');
            orders.forEach(order => {
                if (category === 'all' || order.dataset.category === category) {
                    order.style.display = 'block';
                } else {
                    order.style.display = 'none';
                }
            });
        }

        // Initialize counts
        updateCounts();