(function () {
  try {
    var stored = localStorage.getItem("prabhix-theme");
    var theme = stored === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#12100e" : "#8c3b2a");
  } catch (_) {}
})();
