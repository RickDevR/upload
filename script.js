// Import Firebase SDKs and your configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, increment, arrayUnion, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// ⚙️ CONFIGURATION SETTINGS
// ==========================================
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1552100479360700538/egxNycSpXHaePAWFMlffgWvzgoaDZjVu-mWh6BhNkcazBWryyhvAYhC4vj82aTGhyBiK";

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
let stagedFilesQueue = [];
let activeThreeScene = null;

document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupThemeToggle();
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

// Dark / Light Theme Toggle
function setupThemeToggle() {
    const themeBtn = document.getElementById("theme-toggle-btn");
    const htmlEl = document.documentElement;
    const iconEl = themeBtn.querySelector("i");

    themeBtn.addEventListener("click", () => {
        const currentTheme = htmlEl.getAttribute("data-theme");
        if (currentTheme === "dark") {
            htmlEl.setAttribute("data-theme", "light");
            iconEl.className = "fa-solid fa-sun";
        } else {
            htmlEl.setAttribute("data-theme", "dark");
            iconEl.className = "fa-solid fa-moon";
        }
    });
}

// File Drop Zone & Staging Queue ("Add More" support)
function setupFileInput() {
    const fileInput = document.getElementById("file-input");
    const dropZone = document.getElementById("drop-zone");

    fileInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            files.forEach(file => {
                stagedFilesQueue.push(file);
            });
            updateStagingUI();
            fileInput.value = ""; // reset input
        }
    });

    ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
}

function updateStagingUI() {
    const container = document.getElementById("staging-container");
    const listEl = document.getElementById("staging-list");
    const countEl = document.getElementById("staging-count");

    if (stagedFilesQueue.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "block";
    countEl.textContent = stagedFilesQueue.length;
    
    let html = "";
    stagedFilesQueue.forEach((file, index) => {
        const path = file.webkitRelativePath || file.name;
        html += `
            <div class="staging-item">
                <span><i class="fa-solid fa-file"></i> ${escapeHtml(path)}</span>
                <button type="button" class="action-btn btn-delete" onclick="window.removeStagedItem(${index})" style="width: auto; padding: 2px 6px; font-size: 0.75rem;">Remove</button>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

window.removeStagedItem = function(index) {
    stagedFilesQueue.splice(index, 1);
    updateStagingUI();
};

window.clearStaging = function() {
    stagedFilesQueue = [];
    updateStagingUI();
};

// Upload Form Handler: Zipping all staged files/folders into 1 Bundle
function setupUploadForm() {
    const form = document.getElementById("upload-form");
    const submitBtn = document.getElementById("submit-btn");
    const btnSpinner = document.getElementById("btn-spinner");
    const btnText = submitBtn.querySelector(".btn-text");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (stagedFilesQueue.length === 0) {
            showToast("Please select and add files or folders to the bundle queue first.", true);
            return;
        }

        const uploaderName = document.getElementById("uploader-name").value.trim();
        const bundleName = document.getElementById("upload-bundle-name").value.trim() || "ProjectFolder";
        const category = document.getElementById("upload-category").value;
        const tagsInput = document.getElementById("upload-tags").value.trim();
        const uploadDesc = document.getElementById("upload-desc").value.trim();

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0) : [];

        submitBtn.disabled = true;
        btnText.style.display = "none";
        btnSpinner.style.display = "block";

        try {
            // Create a single unified ZIP bundle using JSZip
            const zip = new JSZip();
            let totalBytes = 0;

            for (const file of stagedFilesQueue) {
                const relativePath = file.webkitRelativePath || file.name;
                const arrayBuffer = await file.arrayBuffer();
                zip.file(relativePath, arrayBuffer);
                totalBytes += file.size;
            }

            // Generate zip file data URL
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const zipBase64 = await blobToDataURL(zipBlob);
            const finalArchiveName = bundleName.endsWith('.zip') ? bundleName : `${bundleName}.zip`;

            const uploadPayload = {
                uploaderName,
                category,
                tags,
                description: uploadDesc,
                fileName: finalArchiveName,
                fileSize: formatFileSize(totalBytes),
                fileData: zipBase64,
                itemCount: stagedFilesQueue.length,
                likes: 0,
                downloads: 0,
                comments: [],
                createdAt: serverTimestamp()
            };

            // Save single bundle item to Firestore
            await addDoc(collection(db, "uploads"), uploadPayload);

            // Send Discord notification with manifest
            if (DISCORD_WEBHOOK_URL && DISCORD_WEBHOOK_URL.trim() !== "") {
                await sendToDiscordWebhook(uploadPayload, stagedFilesQueue.map(f => f.webkitRelativePath || f.name));
            }

            showToast("Successfully bundled and uploaded folder to vault!");
            form.reset();
            stagedFilesQueue = [];
            updateStagingUI();
            
            setTimeout(() => document.querySelector('[data-tab="view-tab"]').click(), 1000);

        } catch (error) {
            console.error("Bundle upload error:", error);
            showToast("Failed to create folder bundle. Check console.", true);
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = "inline-flex";
            btnSpinner.style.display = "none";
        }
    });
}

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(blob);
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function sendToDiscordWebhook(data, fileList) {
    try {
        const fileManifest = fileList.length > 10 ? fileList.slice(0, 10).join('\n') + `\n...and ${fileList.length - 10} more files` : fileList.join('\n');
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `📦 **New Folder/Project Bundle Uploaded!**\n**Uploader:** ${data.uploaderName}\n**Bundle Name:** ${data.fileName} (${data.fileSize})\n**Description:** ${data.description}\n**Files Contained (${fileList.length}):**\n\`\`\`text\n${fileManifest}\n\`\`\``
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
                              item.uploaderName.toLowerCase().includes(searchTerm) ||
                              (item.tags && item.tags.some(t => t.includes(searchTerm)));
        const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    if (sortFilter === "likes") {
        filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (sortFilter === "downloads") {
        filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
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
        
        let fileIcon = "fa-folder-closed";
        if (item.category === "Script") fileIcon = "fa-file-code";
        else if (item.category === "3D Model") fileIcon = "fa-cube";
        else if (item.category === "Plugin") fileIcon = "fa-puzzle-piece";
        else if (/\.zip$/i.test(item.fileName)) fileIcon = "fa-file-zipper";

        const tagsHtml = item.tags && item.tags.length > 0 ? item.tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('') : '';

        const card = document.createElement("div");
        card.className = "upload-card";
        card.innerHTML = `
            <div>
                <div class="card-top-row">
                    <div class="upload-author"><i class="fa-solid fa-user-circle"></i> ${escapeHtml(item.uploaderName)}</div>
                    <span class="category-badge">${escapeHtml(item.category || 'Folder')}</span>
                </div>
                <div class="upload-filename"><i class="fa-solid ${fileIcon}"></i> ${escapeHtml(item.fileName)}</div>
                <div class="upload-desc">${escapeHtml(item.description)}</div>
                <div class="tags-row">${tagsHtml}</div>
                <div class="upload-meta">
                    <i class="fa-solid fa-hard-drive"></i> ${escapeHtml(item.fileSize)} &bull; 
                    <i class="fa-solid fa-download"></i> ${item.downloads || 0} dl &bull; 
                    <i class="fa-solid fa-clock"></i> ${dateStr}
                </div>
            </div>
            <div>
                <div class="upload-actions">
                    <a href="${item.fileData}" download="${item.fileName}" onclick="window.incrementDownload('${item.id}')" class="action-btn btn-download">
                        <i class="fa-solid fa-download"></i> Download Bundle
                    </a>
                    <button class="action-btn btn-inspect" onclick="window.openDetailsModal('${item.id}')">
                        <i class="fa-solid fa-folder-open"></i> Open & Inspect
                    </button>
                    <button class="action-btn btn-like" onclick="window.likeUpload('${item.id}')">
                        <i class="fa-solid fa-heart"></i> ${item.likes || 0}
                    </button>
                </div>
                <div class="upload-actions">
                    <button class="action-btn btn-delete" onclick="window.deleteUpload('${item.id}')">
                        <i class="fa-solid fa-trash-can"></i> Delete Bundle
                    </button>
                </div>
            </div>
        `;
        uploadsGrid.appendChild(card);
    });
}

// FEATURE: Folder & Bundle Inspector Modal (Browse all files inside folder, view code, extract individual files)
window.openDetailsModal = async function(docId) {
    const item = allUploads.find(u => u.id === docId);
    if (!item) return;

    const modal = document.getElementById("details-modal");
    const titleEl = document.getElementById("details-modal-title");
    const bodyEl = document.getElementById("details-modal-body");
    const footerEl = document.getElementById("details-modal-footer");

    titleEl.innerHTML = `<i class="fa-solid fa-folder-open"></i> Inspecting: ${escapeHtml(item.fileName)}`;
    bodyEl.innerHTML = `<div style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Unzipping and scanning folder contents...</p></div>`;
    modal.style.display = "flex";

    let contentHtml = `
        <div class="inspector-section">
            <h4><i class="fa-solid fa-circle-info"></i> Bundle Overview</h4>
            <p><strong>Uploader:</strong> ${escapeHtml(item.uploaderName)}</p>
            <p><strong>Category:</strong> ${escapeHtml(item.category)}</p>
            <p><strong>Description:</strong> ${escapeHtml(item.description)}</p>
            <p><strong>Total Size:</strong> ${escapeHtml(item.fileSize)}</p>
        </div>
        <div class="inspector-section">
            <h4><i class="fa-solid fa-folder-tree"></i> Files & Folders Inside</h4>
            <div id="archive-files-list">Reading contents...</div>
        </div>
    `;

    // Comments Section
    const commentsListHtml = item.comments && item.comments.length > 0 
        ? item.comments.map(c => `<div class="comment-item"><div class="comment-author">${escapeHtml(c.author)}</div><div>${escapeHtml(c.text)}</div></div>`).join('')
        : `<p style="color: var(--text-muted); font-size: 0.85rem;">No comments yet. Leave feedback below!</p>`;

    contentHtml += `
        <div class="inspector-section">
            <h4><i class="fa-solid fa-comments"></i> Community Discussion</h4>
            <div class="comments-list">${commentsListHtml}</div>
            <div class="comment-form">
                <input type="text" id="comment-author-input" placeholder="Your name..." style="width: 130px;">
                <input type="text" id="comment-text-input" placeholder="Ask a question or leave feedback...">
                <button class="action-btn btn-download" onclick="window.addComment('${item.id}')" style="width: auto; padding: 0 15px;">Send</button>
            </div>
        </div>
    `;

    bodyEl.innerHTML = contentHtml;
    footerEl.innerHTML = `
        <a href="${item.fileData}" download="${item.fileName}" onclick="window.incrementDownload('${item.id}')" class="action-btn btn-download" style="max-width: 220px;">
            <i class="fa-solid fa-download"></i> Download Entire Folder
        </a>
    `;

    // Parse ZIP Bundle contents using JSZip
    try {
        const zip = new JSZip();
        const base64Data = item.fileData.split(',')[1];
        const zipContent = await zip.loadAsync(base64Data, { base64: true });
        let fileListHtml = "";

        const fileNames = Object.keys(zipContent.files);
        fileNames.forEach(filename => {
            const zipEntry = zipContent.files[filename];
            const isText = /\.(js|html|css|txt|json|py|md|xml|csv)$/i.test(filename);

            fileListHtml += `
                <div class="archive-tree-item">
                    <span><i class="fa-solid ${zipEntry.dir ? 'fa-folder' : 'fa-file'}"></i> ${escapeHtml(filename)}</span>
                    <div class="archive-file-actions">
                        ${!zipEntry.dir && isText ? `<button class="action-btn btn-inspect" style="width:auto; padding:4px 8px;" onclick="window.previewArchivedFile('${item.id}', '${filename}')">Preview</button>` : ''}
                        ${!zipEntry.dir ? `<button class="action-btn btn-download" style="width:auto; padding:4px 8px;" onclick="window.downloadArchivedFile('${item.id}', '${filename}')">Download</button>` : ''}
                    </div>
                </div>
            `;
        });
        document.getElementById("archive-files-list").innerHTML = fileListHtml || "Folder is empty.";
    } catch (err) {
        document.getElementById("archive-files-list").innerHTML = "Could not parse archive contents.";
    }
};

window.closeDetailsModal = function() {
    document.getElementById("details-modal").style.display = "none";
};

// Preview individual file inside a folder bundle
window.previewArchivedFile = async function(docId, filename) {
    const item = allUploads.find(u => u.id === docId);
    if (!item) return;

    try {
        const zip = new JSZip();
        const base64Data = item.fileData.split(',')[1];
        const zipContent = await zip.loadAsync(base64Data, { base64: true });
        const file = zipContent.files[filename];
        if (file) {
            const textContent = await file.async("text");
            const modalBody = document.getElementById("details-modal-body");
            modalBody.innerHTML = `
                <div class="inspector-section">
                    <button class="action-btn btn-inspect" onclick="window.openDetailsModal('${item.id}')" style="width: auto; margin-bottom: 15px;"><i class="fa-solid fa-arrow-left"></i> Back to Folder Tree</button>
                    <h4><i class="fa-solid fa-code"></i> Live Preview: ${escapeHtml(filename)}</h4>
                    <pre><code>${escapeHtml(textContent)}</code></pre>
                </div>
            `;
        }
    } catch (err) {
        showToast("Failed to preview file.", true);
    }
};

// Download individual file from inside folder bundle
window.downloadArchivedFile = async function(docId, filename) {
    const item = allUploads.find(u => u.id === docId);
    if (!item) return;
    try {
        const zip = new JSZip();
        const base64Data = item.fileData.split(',')[1];
        const zipContent = await zip.loadAsync(base64Data, { base64: true });
        const file = zipContent.files[filename];
        if (file) {
            const content = await file.async("blob");
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast(`Downloaded ${filename.split('/').pop()}`);
        }
    } catch (err) {
        showToast("Failed to extract file.", true);
    }
};

// Add comment
window.addComment = async function(docId) {
    const authorInput = document.getElementById("comment-author-input").value.trim() || "Anonymous";
    const textInput = document.getElementById("comment-text-input").value.trim();
    if (!textInput) {
        showToast("Please enter comment text.", true);
        return;
    }

    try {
        const docRef = doc(db, "uploads", docId);
        await updateDoc(docRef, {
            comments: arrayUnion({ author: authorInput, text: textInput, time: new Date().toISOString() })
        });
        showToast("Comment posted!");
        loadUploadsFromDatabase().then(() => window.openDetailsModal(docId));
    } catch (err) {
        showToast("Failed to post comment.", true);
    }
};

// Increment download counter
window.incrementDownload = async function(docId) {
    try {
        const docRef = doc(db, "uploads", docId);
        await updateDoc(docRef, { downloads: increment(1) });
    } catch (err) {
        console.warn("Failed to increment download count", err);
    }
};

// Likes
window.likeUpload = async function(docId) {
    try {
        const docRef = doc(db, "uploads", docId);
        await updateDoc(docRef, { likes: increment(1) });
        showToast("Liked bundle!");
        loadUploadsFromDatabase();
    } catch (err) {
        showToast("Failed to like item.", true);
    }
};

// Direct Delete
window.deleteUpload = async function(docId) {
    if (!confirm("Are you sure you want to delete this bundle from the vault?")) return;

    try {
        await deleteDoc(doc(db, "uploads", docId));
        showToast("Bundle deleted successfully.");
        loadUploadsFromDatabase();
    } catch (error) {
        console.error("Error deleting:", error);
        showToast("Failed to delete bundle.", true);
    }
};

// Export Vault Backup JSON
window.exportVaultBackup = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allUploads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `vault_bundles_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Vault backup downloaded successfully!");
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