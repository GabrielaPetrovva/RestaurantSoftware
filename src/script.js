 // Translation data
 const translations = {
    en: {
      nav: {
        home: 'Home',
        menu: 'Menu',
        about: 'About us',
        contact: 'Contact us'
      },
      hero: {
        title: 'Taste The Difference',
        button: 'View Menu'
      },
      about: {
        title: 'About Us',
        subtitle: 'Our Story',
        text: 'The restaurant opened its doors in 2015 with one simple idea – to offer genuine taste and comfort in the heart of the city. Since then, we have been combining traditional recipes with modern culinary techniques to create experiences that are truly unforgettable.'
      },
      contact: {
        title: 'Contact Us',
        subtitle: 'Get In Touch',
        name: 'Your Name',
        email: 'Email Address',
        message: 'Your Message',
        button: 'Send Message'
      },
      footer: {
        privacy: 'Privacy',
        services: 'Services',
        about: 'About Us',
        quickLinks: 'Quick Links',
        menu: 'Menu',
        story: 'Our Story',
        reservations: 'Reservations',
        social: 'Social Media'
      }
    },
    bg: {
      nav: {
        home: 'Начало',
        menu: 'Меню',
        about: 'За нас',
        contact: 'Контакти',
        gallery: 'Галерия'
      },
      hero: {
        title: 'Опитайте разликата',
        button: 'Виж менюто'
      },
      about: {
        title: 'За нас',
        subtitle: 'Нашата история',
        text: 'Ресторантът отвори врати през 2015 г. с една проста идея – да предложи автентичен вкус и комфорт в сърцето на града. Оттогава комбинираме традиционни рецепти с модерни кулинарни техники, за да създадем преживявания, които са наистина незабравими.'
      },
      contact: {
        title: 'Свържете се с нас',
        subtitle: 'Оставете съобщение',
        name: 'Вашето име',
        email: 'Имейл адрес',
        message: 'Вашето съобщение',
        button: 'Изпрати съобщение'
      },
      footer: {
        privacy: 'Поверителност',
        services: 'Услуги',
        about: 'За нас',
        quickLinks: 'Бързи връзки',
        menu: 'Меню',
        story: 'Нашата история',
        reservations: 'Резервации',
        social: 'Социални мрежи'
      }
    }
  };

  // Get saved language or default to English
  let currentLang = localStorage.getItem('language') || 'en';

  // Function to change language
  function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    updateLanguage();
    updateLanguageButtons();
  }

  // Function to update language buttons
  function updateLanguageButtons() {
    document.getElementById('lang-en').classList.toggle('active', currentLang === 'en');
    document.getElementById('lang-bg').classList.toggle('active', currentLang === 'bg');
  }

  // Function to update all text content
  function updateLanguage() {
    const t = translations[currentLang];
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLang;

    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      const keys = key.split('.');
      let value = t;
      for (let k of keys) {
        value = value[k];
      }
      if (value) {
        element.textContent = value;
      }
    });

    // Update all elements with data-translate-placeholder attribute
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
      const key = element.getAttribute('data-translate-placeholder');
      const keys = key.split('.');
      let value = t;
      for (let k of keys) {
        value = value[k];
      }
      if (value) {
        element.placeholder = value;
      }
    });
  }

  // Initialize language on page load
  document.addEventListener('DOMContentLoaded', function() {
    updateLanguage();
    updateLanguageButtons();
  });

  function toggleMenu() {
    const navMenu = document.querySelector('nav ul');
    const menuToggle = document.querySelector('.menu-toggle');
    const body = document.body;
    
    navMenu.classList.toggle('show');
    menuToggle.classList.toggle('active');
    body.classList.toggle('menu-open');
    
    // Prevent body scroll when menu is open
    if (navMenu.classList.contains('show')) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
  }
  
  // Close menu when clicking on a link
  document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', function() {
      const navMenu = document.querySelector('nav ul');
      const menuToggle = document.querySelector('.menu-toggle');
      const body = document.body;
      
      navMenu.classList.remove('show');
      menuToggle.classList.remove('active');
      body.classList.remove('menu-open');
      body.style.overflow = '';
    });
  });
  
  // Close menu when clicking outside (on the background overlay)
  document.querySelector('nav ul').addEventListener('click', function(e) {
    if (e.target === this) {
      const menuToggle = document.querySelector('.menu-toggle');
      const body = document.body;
      
      this.classList.remove('show');
      menuToggle.classList.remove('active');
      body.classList.remove('menu-open');
      body.style.overflow = '';
    }
  });

  //Contact form
  document.addEventListener("DOMContentLoaded", () => {
    emailjs.init("kGsBidM1aclQjY3y3"); 

    const form = document.getElementById("contact-form");

    form.addEventListener("submit", function(e) {
      e.preventDefault();

      emailjs.sendForm(
        "service_3d3a8yj",
        "template_u7f8rnm",  
        this
      )
      .then(() => {
        showToast("Message sent successfully!", true);
        form.reset();
      })
      .catch((error) => {
        console.error(error);
        showToast("Failed to send message.", false);
      });
    });

    function showToast(message, success = true) {
      toast.textContent = message;
      toast.style.backgroundColor = success ? "#4caf50" : "#f44336"; // green or red
      toast.classList.add("show");

      setTimeout(() => {
        toast.classList.remove("show");
      }, 3000); // disappears after 3 seconds
    }
  });