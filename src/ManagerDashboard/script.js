// src/ManagerDashboard/script.js

// 🔹 Tabs (sections) – syncs top/bottom nav and header Настройки via data-view
window.switchTab = function (tabName, ev) {
  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.remove("active")
  );

  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.classList.remove("active")
  );

  const target = document.getElementById(tabName);
  if (target) target.classList.add("active");

  document.querySelectorAll(".tab-btn[data-view=\"" + tabName + "\"]").forEach(btn =>
    btn.classList.add("active")
  );
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

// 🔹 Manager profile modal (profile icon opens this)
function openProfileModal() {
  const modal = document.getElementById("managerProfileModal");
  const nameEl = document.getElementById("userFullName");
  const profileNameEl = document.getElementById("profileFullName");
  const profileEmailEl = document.getElementById("profileEmail");
  if (modal) {
    if (profileNameEl && nameEl) profileNameEl.textContent = nameEl.textContent || "—";
    if (profileEmailEl) profileEmailEl.textContent = (typeof window !== "undefined" && window.__managerEmail) ? window.__managerEmail : "—";
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
}
function closeProfileModal() {
  const modal = document.getElementById("managerProfileModal");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const openProfileBtn = document.getElementById("openProfileBtn");
  if (openProfileBtn) openProfileBtn.addEventListener("click", openProfileModal);
  document.querySelectorAll("[data-close-profile-modal]").forEach(el => {
    el.addEventListener("click", closeProfileModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const m = document.getElementById("managerProfileModal");
      if (m && m.getAttribute("aria-hidden") === "false") closeProfileModal();
    }
  });

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
