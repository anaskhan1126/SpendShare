/**
 * SpendShare — Add Expense
 */

let selectedFile = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAuth()) return;

    SpendShare.initAuthUI();
    initDropdownLogout();
    setDefaultDate();
    setDefaultPaymentMethod();
    loadMembers();
    initDropzone();
    initForm();
    initReset();
});

function initDropdownLogout() {
    const btn = document.getElementById("dropdownLogout");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

function setDefaultPaymentMethod() {
    const select = document.getElementById("paymentMethod");
    if (select) select.value = "Cash";
}

function setDefaultDate() {
    const dateInput = document.getElementById("date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
        dateInput.max = dateInput.value;
    }
}

/* ===========================
   LOAD MEMBERS
=========================== */

async function loadMembers() {
    const select = document.getElementById("paidBy");
    const { memberId } = SpendShare.getAuth();
    if (!select) return;

    try {
        const data = await SpendShare.apiFetch("/member/members");

        if (!data.success) return;

        select.innerHTML = '<option value="" disabled selected hidden></option>';

        data.members.forEach(member => {
            const isSelf = member._id === memberId;
            select.innerHTML += `
                <option value="${member._id}"${isSelf ? " selected" : ""}>
                    ${escapeHtml(member.name)}
                </option>
            `;
        });

    } catch (error) {
        console.error(error);
        select.innerHTML += `<option value="${memberId}" selected>You</option>`;
    }
}

/* ===========================
   DROPZONE
=========================== */

function initDropzone() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("receipt");
    const browseBtn = document.getElementById("browseBtn");
    const removeBtn = document.getElementById("removeFileBtn");

    if (!dropzone || !fileInput) return;

    browseBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    dropzone.addEventListener("click", (e) => {
        if (e.target.closest(".btn-remove-file")) return;
        if (!selectedFile) fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files[0]) handleFile(fileInput.files[0]);
    });

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("drag-over");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("drag-over");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    removeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        clearFile();
    });
}

function handleFile(file) {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

    if (!allowed.includes(file.type)) {
        SpendShare.showToast("Only images and PDF files are allowed", "error");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        SpendShare.showToast("File size must be under 5MB", "error");
        return;
    }

    selectedFile = file;
    showPreview(file);
    SpendShare.showToast("Receipt attached", "success", 2000);
}

function showPreview(file) {
    const dropzoneContent = document.getElementById("dropzoneContent");
    const previewArea = document.getElementById("previewArea");
    const previewImage = document.getElementById("previewImage");
    const pdfPreview = document.getElementById("pdfPreview");
    const pdfName = document.getElementById("pdfName");

    dropzoneContent.style.display = "none";
    previewArea.style.display = "block";

    if (file.type === "application/pdf") {
        previewImage.style.display = "none";
        pdfPreview.style.display = "flex";
        pdfName.textContent = file.name;
    } else {
        pdfPreview.style.display = "none";
        previewImage.style.display = "block";
        previewImage.src = URL.createObjectURL(file);
    }
}

function clearFile() {
    selectedFile = null;
    const fileInput = document.getElementById("receipt");
    if (fileInput) fileInput.value = "";

    const previewImage = document.getElementById("previewImage");
    if (previewImage?.src) URL.revokeObjectURL(previewImage.src);

    document.getElementById("dropzoneContent").style.display = "block";
    document.getElementById("previewArea").style.display = "none";
    document.getElementById("previewImage").style.display = "none";
    document.getElementById("pdfPreview").style.display = "none";
}

/* ===========================
   FORM VALIDATION
=========================== */

const rules = {
    title: {
        validate: (v) => v.trim().length >= 2,
        message: "Title must be at least 2 characters"
    },
    amount: {
        validate: (v) => Number(v) > 0,
        message: "Enter a valid amount greater than 0"
    },
    category: {
        validate: (v) => v !== "",
        message: "Please select a category"
    },
    paidBy: {
        validate: (v) => v !== "",
        message: "Please select who paid"
    },
    date: {
        validate: (v) => v !== "",
        message: "Please select a date"
    },
    paymentMethod: {
        validate: (v) => v !== "",
        message: "Please select a payment method"
    }
};

function validateField(name) {
    const input = document.getElementById(name);
    const group = document.querySelector(`[data-field="${name}"]`);
    if (!input || !group || !rules[name]) return true;

    const isValid = rules[name].validate(input.value);
    const errorEl = group.querySelector(".field-error");

    group.classList.toggle("has-error", !isValid);
    group.classList.toggle("has-success", isValid && input.value !== "");

    if (errorEl) errorEl.textContent = isValid ? "" : rules[name].message;

    return isValid;
}

function validateForm() {
    return Object.keys(rules).every(validateField);
}

function initForm() {
    const form = document.getElementById("expenseForm");

    Object.keys(rules).forEach(name => {
        const input = document.getElementById(name);
        if (!input) return;
        input.addEventListener("blur", () => validateField(name));
        input.addEventListener("input", () => {
            const group = document.querySelector(`[data-field="${name}"]`);
            if (group?.classList.contains("has-error")) validateField(name);
        });
    });

    form.addEventListener("submit", handleSubmit);
}

function initReset() {
    document.getElementById("resetBtn")?.addEventListener("click", (e) => {
        const titleVal = document.getElementById("title")?.value.trim();
        const amountVal = document.getElementById("amount")?.value.trim();
        if (titleVal || amountVal || selectedFile) {
            if (!confirm("Are you sure you want to discard this expense?")) {
                e.preventDefault();
                return;
            }
        }
        clearFile();
        setDefaultDate();
        document.querySelectorAll(".float-group").forEach(g => {
            g.classList.remove("has-error", "has-success");
        });
        document.querySelectorAll(".field-error").forEach(e => e.textContent = "");
        const { memberId } = SpendShare.getAuth();
        const paidBy = document.getElementById("paidBy");
        if (paidBy && memberId) paidBy.value = memberId;
        SpendShare.showToast("Form reset", "info", 2000);
    });
}

/* ===========================
   SUBMIT
=========================== */

async function handleSubmit(e) {
    e.preventDefault();

    if (!validateForm()) {
        SpendShare.showToast("Please fix the errors in the form", "error");
        return;
    }

    const { token, memberId } = SpendShare.getAuth();
    const submitBtn = document.getElementById("submitBtn");
    const btnText = submitBtn.querySelector("span");
    const btnLoader = submitBtn.querySelector(".btn-loader");

    const expenseFor = document.getElementById("expenseFor").value.trim();
    let notes = document.getElementById("notes").value.trim();
    if (expenseFor) {
        notes = notes ? `Purpose: ${expenseFor}\n${notes}` : `Purpose: ${expenseFor}`;
    }

    const paidByValue = document.getElementById("paidBy").value || memberId;

    submitBtn.disabled = true;
    btnText.style.display = "none";
    btnLoader.style.display = "flex";

    try {
        let response;

        if (selectedFile) {
            const formData = new FormData();
            formData.append("title", document.getElementById("title").value.trim());
            formData.append("amount", document.getElementById("amount").value);
            formData.append("category", document.getElementById("category").value);
            formData.append("paidBy", paidByValue);
            formData.append("paymentMethod", document.getElementById("paymentMethod").value);
            formData.append("notes", notes);
            formData.append("expenseDate", document.getElementById("date").value);
            formData.append("receipt", selectedFile);

            response = await fetch(`${SpendShare.API_BASE}/expense/add`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
        } else {
            response = await fetch(`${SpendShare.API_BASE}/expense/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: document.getElementById("title").value.trim(),
                    amount: Number(document.getElementById("amount").value),
                    category: document.getElementById("category").value,
                    paidBy: paidByValue,
                    paymentMethod: document.getElementById("paymentMethod").value,
                    notes,
                    expenseDate: document.getElementById("date").value
                })
            });
        }

        const data = await response.json();

        if (!response.ok) {
            SpendShare.showToast(data.message || "Failed to add expense", "error");
            return;
        }

        SpendShare.showToast("Expense added successfully!", "success");

        setTimeout(() => {
            const { role } = SpendShare.getAuth();
            if (role === "admin") {
                window.location.href = "../admin/admin-dashboard.html";
            } else {
                window.location.href = "dashboard.html";
            }
        }, 1200);

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to connect to server", "error");
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = "inline";
        btnLoader.style.display = "none";
    }
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
