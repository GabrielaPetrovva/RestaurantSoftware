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

        let currentLang = localStorage.getItem('barDashboardLang') || 'en';
        
        const translations = {
            bg: {
                // Header
                'Bar Dashboard': 'Бар Табло',
                'Petar Petrov': 'Петър Петров',
                'Exit': 'Изход',
                // Tabs
                'Orders': 'Поръчки',
                'Metrics': 'Метрики',
                // Orders
                'Order #': 'Поръчка #',
                'Table': 'Маса',
                'Start preparing': 'Започни подготовка',
                'Ready': 'Готово',
                'Priority': 'Приоритет',
                'No mint': 'Без мента',
                'Salt rim': 'Солен ръб',
                'Mojito': 'Мохито',
                'Espresso': 'Еспресо',
                'Margarita': 'Маргарита',
                'Aperol Spritz': 'Аперол Шприц',
                'Cappuccino': 'Капучино',
                // Metrics
                'Total Revenue (Today)': 'Общ приход (Днес)',
                '+18% from yesterday': '+18% от вчера',
                'Total Drinks Served': 'Общо сервирани напитки',
                '14 in progress': '14 в процес',
                'Average Prep Time': 'Средно време за подготовка',
                'Target: 01:00': 'Цел: 01:00',
                'Customer Satisfaction': 'Удовлетвореност на клиентите',
                'Based on 34 reviews': 'Въз основа на 34 отзива',
                'Revenue by Drink Type': 'Приход по тип напитка',
                'Cocktails': 'Коктейли',
                'Coffee': 'Кафе',
                'Beer/Wine': 'Бира/Вино',
                'Soft Drinks': 'Безалкохолни напитки',
                'Top Selling Drinks': 'Най-продавани напитки',
                'Preparation Time Statistics': 'Статистика за време на подготовка',
                'Fastest': 'Най-бързо',
                'Average': 'Средно',
                'Slowest': 'Най-бавно',
                // Stats
                'Average preparation time': 'Средно време за подготовка',
                'Late orders': 'Закъснели поръчки',
                'Total orders': 'Общо поръчки',
                'Takeaway': 'За вкъщи',
                'Bump off': 'Премахни',
                'Served': 'Сервирано',
                'In Progress': 'В процес'
            },
            en: {
                // Header
                'Bar Dashboard': 'Bar Dashboard',
                'Petar Petrov': 'Petar Petrov',
                'Exit': 'Exit',
                // Tabs
                'Orders': 'Orders',
                'Metrics': 'Metrics',
                // Orders
                'Order #': 'Order #',
                'Table': 'Table',
                'Start preparing': 'Start preparing',
                'Ready': 'Ready',
                'Priority': 'Priority',
                'No mint': 'No mint',
                'Salt rim': 'Salt rim',
                'Mojito': 'Mojito',
                'Espresso': 'Espresso',
                'Margarita': 'Margarita',
                'Aperol Spritz': 'Aperol Spritz',
                'Cappuccino': 'Cappuccino',
                // Metrics
                'Total Revenue (Today)': 'Total Revenue (Today)',
                '+18% from yesterday': '+18% from yesterday',
                'Total Drinks Served': 'Total Drinks Served',
                '14 in progress': '14 in progress',
                'Average Prep Time': 'Average Prep Time',
                'Target: 01:00': 'Target: 01:00',
                'Customer Satisfaction': 'Customer Satisfaction',
                'Based on 34 reviews': 'Based on 34 reviews',
                'Revenue by Drink Type': 'Revenue by Drink Type',
                'Cocktails': 'Cocktails',
                'Coffee': 'Coffee',
                'Beer/Wine': 'Beer/Wine',
                'Soft Drinks': 'Soft Drinks',
                'Top Selling Drinks': 'Top Selling Drinks',
                'Preparation Time Statistics': 'Preparation Time Statistics',
                'Fastest': 'Fastest',
                'Average': 'Average',
                'Slowest': 'Slowest',
                // Stats
                'Average preparation time': 'Average preparation time',
                'Late orders': 'Late orders',
                'Total orders': 'Total orders',
                'Takeaway': 'Takeaway',
                'Bump off': 'Bump off',
                'Served': 'Served',
                'In Progress': 'In Progress'
            }
        };
        
        function t(key) {
            return translations[currentLang][key] || key;
        }
        
        function toggleLanguage() {
            currentLang = currentLang === 'bg' ? 'en' : 'bg';
            localStorage.setItem('barDashboardLang', currentLang);
            document.getElementById('langBtn').textContent = currentLang === 'bg' ? 'EN' : 'БГ';
            updateAllTranslations();
        }
        
        function updateAllTranslations() {
            // Update header
            document.getElementById('headerTitle').textContent = t('Bar Dashboard');
            document.getElementById('userName').textContent = t('Petar Petrov');
            document.getElementById('exitBtn').textContent = t('Exit');
            
            // Update tabs
            const ordersTab = document.getElementById('tabOrders');
            if (ordersTab) {
                ordersTab.childNodes[0].textContent = t('Orders');
            }
            const metricsTab = document.getElementById('tabMetrics');
            if (metricsTab) {
                // Metrics tab has a badge, so we need to update the first text node
                const textNodes = Array.from(metricsTab.childNodes).filter(n => n.nodeType === 3);
                if (textNodes.length > 0) {
                    textNodes[0].textContent = t('Metrics') + ' ';
                }
            }
            
            // Update all text elements with data-i18n attribute
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                const translated = t(key);
                
                // For elements that are just text (no child elements)
                if (el.children.length === 0) {
                    el.textContent = translated;
                } else {
                    // For elements with children, update only the text nodes that match the key
                    const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === 3);
                    textNodes.forEach(node => {
                        const nodeText = node.textContent.trim();
                        if (nodeText === key || nodeText.startsWith(key)) {
                            node.textContent = translated + (nodeText.length > key.length ? nodeText.substring(key.length) : '');
                        }
                    });
                }
            });
            
            // Update buttons that may have been changed to "In Progress"
            document.querySelectorAll('.btn-ready').forEach(btn => {
                if (btn.textContent.includes('Progress') || btn.textContent.includes('процес')) {
                    btn.textContent = t('In Progress');
                }
            });
        }
        
        // Initialize on load
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('langBtn').textContent = currentLang === 'bg' ? 'EN' : 'БГ';
            updateAllTranslations();
        });