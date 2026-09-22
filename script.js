// Import Firebase SDKs and your configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, increment, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// ⚙️ CONFIGURATION SETTINGS
// ==========================================
const DISCORD_WEBHOOK_URL = ""; // <-- Paste your Discord Webhook URL here if desired

// Your Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBQpZosIqlg1lc5dT5UWgBHAMxzrcje6S4",
    authDomain: "chat-3d356.firebaseapp.com",
    projectId: "chat-3d356",
    storageBucket: "chat-3d356.firebasestorage.app",
    messagingSenderId: "750976196666",
    appId: "1:750976196666:web:4dc9a71b8253c3cad45503",
    measurementId: "G-CW820HNMB2"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Global state
let allUploads = [];
let currentPreviewText = "";

document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupFileInput();
    setupUploadForm();
    setupFilters();
    loadUploadsFromDatabase();
    checkOptionalFavicon();
});

// Auto-detect favicon
function checkOptionalFavicon() {
    ['png', 'jpg', 'ico'].forEach(ext => {
        const img = new Image();
        img.src = `icon.${ext}`;
        img.onload = () => {
            const favicon = document.getElementById('favicon');
            if (favicon) favicon.href = img.src;
        };
    });
}

// Tabs
function setupTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            const targetId = btn.getAttribute("data-tab");
            document.getElementById(targetId).classList.add("active");
            if (targetId === "view-tab") loadUploadsFromDatabase();
        });
    });
}

// File Drop Zone
function setupFileInput() {
    const fileInput = document.getElementById("file-input");
    const fileLabelText = document.getElementById("file-label-text");
    const dropZone = document.getElementById("drop-zone");

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            fileLabelText.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color: var(--success);"></i> Selected: <strong>${fileInput.files[0].name}</strong>`;
        }
    });

    ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
}

// Upload Form Handler (Instant Base64 Database Storage)
function setupUploadForm() {
    const form = document.getElementById("upload-form");
    const submitBtn = document.getElementById("submit-btn");
    const btnSpinner = document.getElementById("btn-spinner");
    const btnText = submitBtn.querySelector(".btn-text");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const uploaderName = document.getElementById("uploader-name").value.trim();
        const category = document.getElementById("upload-category").value;
        const uploadDesc = document.getElementById("upload-desc").value.trim();
        const fileInput = document.getElementById("file-input");

        if (fileInput.files.length === 0) {
            showToast("Please select a file or archive to upload.", true);
            return;
        }

        const file = fileInput.files[0];
        submitBtn.disabled = true;
        btnText.style.display = "none";
        btnSpinner.style.display = "block";

        try {
            // Read any file, archive, image, or model instantly as a Base64 string URL
            const fileDataUrl = await readFileAsDataURL(file);

            const uploadPayload = {
                uploaderName,
                category,
                description: uploadDesc,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
                fileData: fileDataUrl, // Saved directly to Firestore database
                likes: 0,
                createdAt: serverTimestamp()
            };

            // Save instantly to Firestore database
            await addDoc(collection(db, "uploads"), uploadPayload);

            // Send Discord notification if configured
            if (DISCORD_WEBHOOK_URL && DISCORD_WEBHOOK_URL.trim() !== "") {
                await sendToDiscordWebhook(uploadPayload);
            }

            showToast("Successfully uploaded to the database!");
            form.reset();
            document.getElementById("file-label-text").innerHTML = `Drag & drop your file here, or <span class="browse-link">browse</span>`;
            
            setTimeout(() => document.querySelector('[data-tab="view-tab"]').click(), 1000);

        } catch (error) {
            console.error("Upload error:", error);
            showToast("Upload failed. Check console for details.", true);
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = "inline-flex";
            btnSpinner.style.display = "none";
        }
    });
}

// Read file utility helper
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function sendToDiscordWebhook(data) {
    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `🚀 **New Vault Upload!**\n**Uploader:** ${data.uploaderName}\n**Category:** ${data.category}\n**File:** ${data.fileName} (${data.fileSize})\n**Description:** ${data.description}`
            })
        });
    } catch (err) {
        console.warn("Discord webhook error:", err);
    }
}

// Load from Firestore
async function loadUploadsFromDatabase() {
    const loadingSpinner = document.getElementById("loading-spinner");
    const uploadsGrid = document.getElementById("uploads-grid");
    const emptyState = document.getElementById("empty-state");

    loadingSpinner.style.display = "block";
    uploadsGrid.innerHTML = "";
    emptyState.style.display = "none";

    try {
        const q = query(collection(db, "uploads"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        allUploads = [];
        querySnapshot.forEach(docSnap => allUploads.push({ id: docSnap.id, ...docSnap.data() }));

        loadingSpinner.style.display = "none";
        document.getElementById("stat-count").textContent = allUploads.length;
        filterAndRenderUploads();

    } catch (error) {
        console.error("Error loading vault:", error);
        loadingSpinner.style.display = "none";
        showToast("Failed to load vault items.", true);
    }
}

// Filters & Sorting Setup
function setupFilters() {
    document.getElementById("search-uploads").addEventListener("input", filterAndRenderUploads);
    document.getElementById("category-filter").addEventListener("change", filterAndRenderUploads);
    document.getElementById("sort-filter").addEventListener("change", filterAndRenderUploads);
}

function filterAndRenderUploads() {
    const searchTerm = document.getElementById("search-uploads").value.toLowerCase();
    const categoryFilter = document.getElementById("category-filter").value;
    const sortFilter = document.getElementById("sort-filter").value;

    let filtered = allUploads.filter(item => {
        const matchesSearch = item.fileName.toLowerCase().includes(searchTerm) || 
                              item.description.toLowerCase().includes(searchTerm) ||
                              item.uploaderName.toLowerCase().includes(searchTerm);
        const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    // Sorting logic
    if (sortFilter === "likes") {
        filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (sortFilter === "name") {
        filtered.sort((a, b) => a.fileName.localeCompare(b.fileName));
    }

    renderUploads(filtered);
}

// Render Grid
function renderUploads(items) {
    const uploadsGrid = document.getElementById("uploads-grid");
    const emptyState = document.getElementById("empty-state");
    uploadsGrid.innerHTML = "";

    if (items.length === 0) {
        emptyState.style.display = "block";
        return;
    }
    emptyState.style.display = "none";

    items.forEach(item => {
        const dateStr = item.createdAt && item.createdAt.toDate ? item.createdAt.toDate().toLocaleString() : "Just now";
        const isTextFile = /\.(js|html|css|txt|json|py|md|xml|csv)$/i.test(item.fileName);

        // Determine icon based on extension
        let fileIcon = "fa-file";
        if (/\.(zip|rar|7z|tar|gz)$/i.test(item.fileName)) fileIcon = "fa-file-zipper";
        else if (/\.(js|html|css|py|json)$/i.test(item.fileName)) fileIcon = "fa-file-code";
        else if (/\.(obj|fbx|gltf|stl|png|jpg|jpeg|gif)$/i.test(item.fileName)) fileIcon = "fa-cube";

        const card = document.createElement("div");
        card.className = "upload-card";
        card.innerHTML = `
            <div>
                <div class="card-top-row">
                    <div class="upload-author"><i class="fa-solid fa-user-circle"></i> ${escapeHtml(item.uploaderName)}</div>
                    <span class="category-badge">${escapeHtml(item.category || 'General')}</span>
                </div>
                <div class="upload-filename"><i class="fa-solid ${fileIcon}"></i> ${escapeHtml(item.fileName)}</div>
                <div class="upload-desc">${escapeHtml(item.description)}</div>
                <div class="upload-meta">
                    <i class="fa-solid fa-hard-drive"></i> ${escapeHtml(item.fileSize)} &bull; 
                    <i class="fa-solid fa-clock"></i> ${dateStr}
                </div>
            </div>
            <div>
                <div class="upload-actions">
                    <a href="${item.fileData}" download="${item.fileName}" class="action-btn btn-download">
                        <i class="fa-solid fa-download"></i> Download
                    </a>
                    ${isTextFile ? `
                    <button class="action-btn btn-preview" onclick="window.previewFileText('${item.fileData}', '${escapeHtml(item.fileName)}')">
                        <i class="fa-solid fa-code"></i> Preview
                    </button>` : ''}
                    <button class="action-btn btn-share" onclick="navigator.clipboard.writeText('${item.fileData}'); window.showToast('File data copied to clipboard!');">
                        <i class="fa-solid fa-share-nodes"></i> Copy Data
                    </button>
                    <button class="action-btn btn-like" onclick="window.likeUpload('${item.id}')">
                        <i class="fa-solid fa-heart"></i> ${item.likes || 0}
                    </button>
                </div>
                <div class="upload-actions">
                    <button class="action-btn btn-delete" onclick="window.deleteUpload('${item.id}')">
                        <i class="fa-solid fa-trash-can"></i> Delete Upload
                    </button>
                </div>
            </div>
        `;
        uploadsGrid.appendChild(card);
    });
}

// Text Preview Modal for base64 strings
window.previewFileText = function(dataUrl, fileName) {
    const modal = document.getElementById("preview-modal");
    const titleEl = document.getElementById("modal-filename");
    const codeText = document.getElementById("preview-code-text");

    titleEl.innerHTML = `<i class="fa-solid fa-file-code"></i> ${fileName}`;
    modal.style.display = "flex";

    try {
        // Decode base64 data URL back to plain text for preview
        const base64Content = dataUrl.split(',')[1];
        const decodedText = decodeURIComponent(escape(atob(base64Content)));
        currentPreviewText = decodedText;
        codeText.textContent = decodedText;
    } catch (err) {
        codeText.textContent = "Preview available for standard text/code files.";
    }
};

window.closePreviewModal = function() {
    document.getElementById("preview-modal").style.display = "none";
};

window.copyPreviewText = function() {
    navigator.clipboard.writeText(currentPreviewText);
    showToast("File text copied to clipboard!");
};

// Likes
window.likeUpload = async function(docId) {
    try {
        const docRef = doc(db, "uploads", docId);
        await updateDoc(docRef, { likes: increment(1) });
        showToast("Liked upload!");
        loadUploadsFromDatabase();
    } catch (err) {
        showToast("Failed to like item.", true);
    }
};

// Direct Delete
window.deleteUpload = async function(docId) {
    if (!confirm("Are you sure you want to delete this file from the vault?")) return;

    try {
        await deleteDoc(doc(db, "uploads", docId));
        showToast("Upload deleted successfully.");
        loadUploadsFromDatabase();
    } catch (error) {
        console.error("Error deleting:", error);
        showToast("Failed to delete upload.", true);
    }
};

// Toast helper
window.showToast = function(message, isError = false) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast show ${isError ? 'error' : ''}`;
    setTimeout(() => { toast.className = "toast"; }, 3500);
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}