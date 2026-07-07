/**
 * SpendShare — Admin Profile
 */

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAdminAuth()) return;

    SpendShare.initAdminAuthUI();
    SpendShare.initAdminLogout();
    initDropdownLogout();
    loadProfile();
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

async function loadProfile() {
    const { adminId } = SpendShare.getAdminAuth();

    try {
        const [profileData, dashboardData] = await Promise.all([
            SpendShare.adminApiFetch(`/admin/profile/${adminId}`),
            SpendShare.adminApiFetch("/admin/dashboard")
        ]);

        if (!profileData.success) {
            SpendShare.showToast(profileData.message || "Failed to load profile", "error");
            return;
        }

        const admin = profileData.admin;

        revealAvatar(getInitials(admin.name));

        document.getElementById("profileDisplayName").textContent = admin.name;
        document.getElementById("profileEmail").textContent = admin.email;

        if (admin.createdAt) {
            document.getElementById("adminSince").textContent =
                `Administrator since ${new Date(admin.createdAt).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric"
                })}`;
        }

        document.getElementById("fullName").textContent = admin.name;
        document.getElementById("username").textContent =
            admin.username || localStorage.getItem("adminUsername") || admin.email?.split("@")[0] || "—";
        document.getElementById("email").textContent = admin.email || "—";
        document.getElementById("phone").textContent = admin.phone || "Not provided";
        document.getElementById("role").textContent = "Administrator";
        document.getElementById("createdAt").textContent = admin.createdAt
            ? SpendShare.formatDate(admin.createdAt)
            : "—";

        if (dashboardData.success) {
            SpendShare.animateCounter(
                document.getElementById("totalMembers"),
                dashboardData.totalMembers || 0,
                "",
                ""
            );
            SpendShare.animateCounter(
                document.getElementById("flatExpenses"),
                dashboardData.totalExpenses || 0,
                "",
                ""
            );
            SpendShare.animateCounter(
                document.getElementById("totalSpent"),
                dashboardData.totalAmount || 0
            );
        }

        localStorage.setItem("adminName", admin.name);
        if (admin.email) localStorage.setItem("adminEmail", admin.email);

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load profile", "error");
    }
}

function revealAvatar(initials) {
    const skeleton = document.getElementById("avatarSkeleton");
    const avatar = document.getElementById("profileAvatar");

    if (skeleton) skeleton.style.display = "none";
    if (avatar) {
        avatar.textContent = initials;
        avatar.style.display = "flex";
    }
}

function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
