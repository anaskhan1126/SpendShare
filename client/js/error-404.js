/**
 * SpendShare — 404 Page
 */

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("year").textContent = new Date().getFullYear();

    const homeUrl = getHomeUrl();
    const homeBtn = document.getElementById("homeBtn");
    const brandLink = document.querySelector(".brand");

    if (homeBtn) homeBtn.href = homeUrl;
    if (brandLink) brandLink.href = homeUrl;

    document.getElementById("backBtn")?.addEventListener("click", () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = homeUrl;
        }
    });
});

function getHomeUrl() {
    if (localStorage.getItem("adminToken")) {
        return "pages/admin/admin-dashboard.html";
    }
    if (localStorage.getItem("memberToken")) {
        return "pages/member/dashboard.html";
    }
    return "../index.html";
}
