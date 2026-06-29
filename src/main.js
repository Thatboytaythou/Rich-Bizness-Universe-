(() => {
  const toast = document.getElementById("toast");
  const show = (text) => {
    if (!toast) return;
    toast.textContent = `${text} coming online`;
    toast.classList.add("show");
    clearTimeout(window.__rbToastTimer);
    window.__rbToastTimer = setTimeout(() => toast.classList.remove("show"), 1400);
  };

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const route = button.dataset.route || "home";
      document.querySelectorAll(".dock button").forEach((item) => item.classList.remove("active"));
      if (button.closest(".dock")) button.classList.add("active");
      show(route.toUpperCase());
    });
  });
})();
