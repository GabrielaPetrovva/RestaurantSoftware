function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    
    if (body.classList.contains('light')) {
        body.classList.remove('light');
        body.classList.add('dark');
        themeIcon.textContent = '☀️';
        window.currentTheme = 'dark';
    } else {
        body.classList.remove('dark');
        body.classList.add('light');
        themeIcon.textContent = '🌙';
        window.currentTheme = 'light';
    }
}

function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const tabs = document.querySelectorAll('.tab-button');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        tabs[0].classList.add('active');
    } else {
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
        tabs[1].classList.add('active');
    }
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember').checked;
    
    console.log('Login attempt:', { username, password, remember });
    alert(`Welcome back, ${username}! (This is a demo - no actual authentication)`);
}

function handleSignup(event) {
    event.preventDefault();
    const firstName = document.getElementById('signup-firstname').value;
    const lastName = document.getElementById('signup-lastname').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    console.log('Signup attempt:', { firstName, lastName, email, password });
    alert(`Account created for ${firstName} ${lastName}! (This is a demo - no actual registration)`);
}

// Initialize theme on page load
window.addEventListener('DOMContentLoaded', () => {
    window.currentTheme = 'light';
});