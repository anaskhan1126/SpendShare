/**
 * SpendShare — Member Profile
 */

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAuth()) return;

    SpendShare.initAuthUI();
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
    const { memberId } = SpendShare.getAuth();

    try {
        const data = await SpendShare.apiFetch(`/member/profile/${memberId}`);

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load profile", "error");
            return;
        }

        const member = data.member;
        const totalExpenses = data.totalExpenses || 0;
        const totalPaid = data.totalPaid || 0;
        const avg = totalExpenses > 0 ? totalPaid / totalExpenses : 0;

        revealAvatar(getInitials(member.name));

        document.getElementById("profileDisplayName").textContent = member.name;
        document.getElementById("profileEmail").textContent = member.email;

        if (member.createdAt) {
            document.getElementById("memberSince").textContent =
                `Member since ${new Date(member.createdAt).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric"
                })}`;
        }

        document.getElementById("roleBadge").textContent = member.role || "member";

        SpendShare.animateCounter(document.getElementById("totalExpenses"), totalExpenses, "", "");
        SpendShare.animateCounter(document.getElementById("totalPaid"), totalPaid);
        SpendShare.animateCounter(document.getElementById("avgExpense"), avg);

        document.getElementById("fullName").textContent = member.name;
        document.getElementById("username").textContent = member.username || "—";
        document.getElementById("email").textContent = member.email || "—";
        document.getElementById("phone").textContent = member.phone || "Not provided";
        document.getElementById("group").textContent = member.group || "Flat Members";
        document.getElementById("role").textContent = capitalize(member.role || "member");

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

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
