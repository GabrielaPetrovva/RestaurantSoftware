// src/ManagerDashboard/script.js

// 🔹 Tabs (sections)
window.switchTab = function (tabName, ev) {
  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.remove("active")
  );

  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.classList.remove("active")
  );

  const target = document.getElementById(tabName);
  if (target) target.classList.add("active");

  if (ev && ev.currentTarget) {
    ev.currentTarget.classList.add("active");
  }
};

// 🔹 Logout (UI only – auth signOut е в auth-redirect или отделно)
window.logout = function () {
  if (confirm("Сигурни ли сте, че искате да излезете?")) {
    window.location.href = "../Login/login.html";
  }
};

// 🔹 Fake realtime animation (stats)
setInterval(() => {
  const stats = document.querySelectorAll(".stat-value");
  if (!stats.length) return;

  const el = stats[Math.floor(Math.random() * stats.length)];
  el.style.transform = "scale(1.05)";
  el.style.color = "#4CAF50";

  setTimeout(() => {
    el.style.transform = "scale(1)";
    el.style.color = "#333";
  }, 300);
}, 5000);

// 🔹 DOM animations
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".heatmap-cell").forEach(cell => {
    cell.addEventListener("click", () => {
      alert(`Клиенти в този период: ${cell.textContent}`);
    });
  });

  document.querySelectorAll(".progress-fill").forEach(fill => {
    const w = fill.style.width;
    fill.style.width = "0";
    setTimeout(() => fill.style.width = w, 100);
  });

  document.querySelectorAll(".bar").forEach((bar, i) => {
    const h = bar.style.height;
    bar.style.height = "0";
    setTimeout(() => bar.style.height = h, 100 + i * 100);
  });
});
