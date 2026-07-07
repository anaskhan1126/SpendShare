/**
 * SpendShare — Landing Page JS
 * Scroll animations, counters, navbar, menu
 */

document.addEventListener("DOMContentLoaded", () => {
    initYear();
    initNavbar();
    initMobileMenu();
    initScrollAnimations();
    initCounters();
    SpendShare.initTheme();

    // Theme toggle on landing page
    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => SpendShare.toggleTheme());
    }
});

/* ===========================
   YEAR
=========================== */
function initYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
}

/* ===========================
   NAVBAR — scroll effect
=========================== */
function initNavbar() {
    const navbar = document.getElementById("navbar");
    if (!navbar) return;

    const onScroll = () => {
        navbar.classList.toggle("scrolled", window.scrollY > 20);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
}

/* ===========================
   MOBILE MENU
=========================== */
function initMobileMenu() {
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");
    if (!menuToggle || !navLinks) return;

    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", isOpen);
        menuToggle.querySelector("i").className = isOpen
            ? "fa-solid fa-xmark"
            : "fa-solid fa-bars";
    });

    // Close on link click
    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.querySelector("i").className = "fa-solid fa-bars";
        });
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            if (menuToggle.querySelector("i")) {
                menuToggle.querySelector("i").className = "fa-solid fa-bars";
            }
        }
    });
}

/* ===========================
   SCROLL ANIMATIONS (Intersection Observer)
=========================== */
function initScrollAnimations() {
    const elements = document.querySelectorAll(".fade-up");
    if (!elements.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach(el => observer.observe(el));
}

/* ===========================
   ANIMATED COUNTERS (Stats Bar)
=========================== */
function initCounters() {
    const statNumbers = document.querySelectorAll(".stat-item-number[data-target]");
    if (!statNumbers.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateStatCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.5 }
    );

    statNumbers.forEach(el => observer.observe(el));
}

function animateStatCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const duration = 1800;
    const startTime = performance.now();

    const formatNumber = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
        if (n >= 1000) return (n / 1000).toFixed(0) + "K";
        return n.toString();
    };

    const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(target * eased);
        el.textContent = prefix + formatNumber(current) + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = prefix + formatNumber(target) + suffix;
        }
    };

    requestAnimationFrame(update);
}
