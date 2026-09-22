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

// File Drop Zone & Multi-File handling
function setupFileInput() {
    const fileInput = document.getElementById("file-input");
    const fileLabelText = document.getElementById("file-label-text");
    const dropZone = document.getElementById("drop-zone");

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            const count = fileInput.files.length;
            const name = count === 1 ? fileInput.files[0].name : `${count} files selected`;
            fileLabelText.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color: var(--success);"></i> Selected: <strong>${name}</strong>`;
        }
    });

    ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
}

// Upload Form Handler (Batch Multi-File Support + Tags + Discord)
function setupUploadForm() {
    const form = document.getElementById("upload-form");
    const submitBtn = document.getElementById("submit-btn");
    const btnSpinner = document.getElementById("btn-spinner");
    const btnText = submitBtn.querySelector(".btn-text");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const uploaderName = document.getElementById("uploader-name").value.trim();
        const category = document.getElementById("upload-category").value;
        const tagsInput = document.getElementById("upload-tags").value.trim();
        const uploadDesc = document.getElementById("upload-desc").value.trim();
        const fileInput = document.getElementById("file-input");

        if (fileInput.files.length === 0) {
            showToast("Please select at least one file.", true);
            return;
        }

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0) : [];

        submitBtn.disabled = true;
        btnText.style.display = "none";
        btnSpinner.style.display = "block";

        try {
            // Process each selected file in the batch
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                const fileDataUrl = await readFileAsDataURL(file);

                const uploadPayload = {
                    uploaderName,
                    category,
                    tags,
                    description: uploadDesc,
                    fileName: file.name,
                    fileSize: formatFileSize(file.size),
                    fileData: fileDataUrl,
                    likes: 0,
                    downloads: 0,
                    comments: [],
                    createdAt: serverTimestamp()
                };

                await addDoc(collection(db, "uploads"), uploadPayload);

                if (DISCORD_WEBHOOK_URL && DISCORD_WEBHOOK_URL.trim() !== "") {
                    await sendToDiscordWebhook(uploadPayload);
                }
            }

            showToast("Successfully uploaded batch to database!");
            form.reset();
            document.getElementById("file-label-text").innerHTML = `Drag & drop files here, or <span class="browse-link">browse</span>`;
            
            setTimeout(() => document.querySelector('[data-tab="view-tab"]').click(), 1000);

        } catch (error) {
            console.error("Upload error:", error);
            showToast("Upload failed. Check console.", true);
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = "inline-flex";
            btnSpinner.style.display = "none";
        }
    });
}

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
        
        let fileIcon = "fa-file";
        if (/\.(zip|rar|7z|tar|gz)$/i.test(item.fileName)) fileIcon = "fa-file-zipper";
        else if (/\.(js|html|css|py|json|txt|md)$/i.test(item.fileName)) fileIcon = "fa-file-code";
        else if (/\.(obj|fbx|gltf|stl|png|jpg|jpeg|gif)$/i.test(item.fileName)) fileIcon = "fa-cube";

        const tagsHtml = item.tags && item.tags.length > 0 ? item.tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('') : '';

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
                        <i class="fa-solid fa-download"></i> Download
                    </a>
                    <button class="action-btn btn-inspect" onclick="window.openDetailsModal('${item.id}')">
                        <i class="fa-solid fa-circle-info"></i> Inspect
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

// FEATURE: Detailed Inspector Modal (Archive Explorer, Script Code Viewer, 3D Previewer & Comments)
window.openDetailsModal = async function(docId) {
    const item = allUploads.find(u => u.id === docId);
    if (!item) return;

    const modal = document.getElementById("details-modal");
    const titleEl = document.getElementById("details-modal-title");
    const bodyEl = document.getElementById("details-modal-body");
    const footerEl = document.getElementById("details-modal-footer");

    titleEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> Inspector: ${escapeHtml(item.fileName)}`;
    bodyEl.innerHTML = `<div style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Analyzing file content...</p></div>`;
    modal.style.display = "flex";

    let contentHtml = `
        <div class="inspector-section">
            <h4><i class="fa-solid fa-user"></i> Uploader Details</h4>
            <p><strong>Name:</strong> ${escapeHtml(item.uploaderName)}</p>
            <p><strong>Category:</strong> ${escapeHtml(item.category)}</p>
            <p><strong>Description:</strong> ${escapeHtml(item.description)}</p>
            <p><strong>Size:</strong> ${escapeHtml(item.fileSize)}</p>
        </div>
    `;

    const isZip = /\.zip$/i.test(item.fileName);
    const isTextFile = /\.(js|html|css|txt|json|py|md|xml|csv)$/i.test(item.fileName);
    const is3DModel = /\.(obj|stl)$/i.test(item.fileName);

    if (isZip) {
        contentHtml += `<div class="inspector-section"><h4><i class="fa-solid fa-folder-tree"></i> Archive / Folder Contents</h4><div id="archive-files-list">Scanning folder contents...</div></div>`;
    } else if (isTextFile) {
        contentHtml += `<div class="inspector-section"><h4><i class="fa-solid fa-code"></i> Script / Code Viewer</h4><pre><code id="inspector-code-preview">Loading text...</code></pre></div>`;
    } else if (is3DModel) {
        contentHtml += `<div class="inspector-section"><h4><i class="fa-solid fa-cube"></i> 3D Model WebGL Viewer</h4><div id="model-canvas-container"></div></div>`;
    }

    // Comments Section
    const commentsListHtml = item.comments && item.comments.length > 0 
        ? item.comments.map(c => `<div class="comment-item"><div class="comment-author">${escapeHtml(c.author)}</div><div>${escapeHtml(c.text)}</div></div>`).join('')
        : `<p style="color: var(--text-muted); font-size: 0.85rem;">No comments yet. Be the first to leave feedback!</p>`;

    contentHtml += `
        <div class="inspector-section">
            <h4><i class="fa-solid fa-comments"></i> Community Discussion & Feedback</h4>
            <div class="comments-list">${commentsListHtml}</div>
            <div class="comment-form">
                <input type="text" id="comment-author-input" placeholder="Your name..." style="width: 130px;">
                <input type="text" id="comment-text-input" placeholder="Write a comment or question...">
                <button class="action-btn btn-download" onclick="window.addComment('${item.id}')" style="width: auto; padding: 0 15px;">Send</button>
            </div>
        </div>
    `;

    bodyEl.innerHTML = contentHtml;
    footerEl.innerHTML = `
        <a href="${item.fileData}" download="${item.fileName}" onclick="window.incrementDownload('${item.id}')" class="action-btn btn-download" style="max-width: 200px;">
            <i class="fa-solid fa-download"></i> Download File
        </a>
    `;

    // Process specialized viewers after render
    if (isZip) {
        try {
            const zip = new JSZip();
            const base64Data = item.fileData.split(',')[1];
            const zipContent = await zip.loadAsync(base64Data, { base64: true });
            let fileListHtml = "";

            let fileNames = Object.keys(zipContent.files);
            fileNames.forEach(filename => {
                const zipEntry = zipContent.files[filename];
                fileListHtml += `
                    <div class="archive-tree-item">
                        <span><i class="fa-solid ${zipEntry.dir ? 'fa-folder' : 'fa-file'}"></i> ${escapeHtml(filename)}</span>
                        ${!zipEntry.dir ? `<button class="action-btn btn-download" style="width:auto; padding:4px 8px;" onclick="window.downloadZipFile('${item.id}', '${filename}')">Extract</button>` : ''}
                    </div>
                `;
            });
            document.getElementById("archive-files-list").innerHTML = fileListHtml || "Folder is empty.";
        } catch (err) {
            document.getElementById("archive-files-list").innerHTML = "Could not parse archive structure.";
        }
    } else if (isTextFile) {
        try {
            const base64Content = item.fileData.split(',')[1];
            const decodedText = decodeURIComponent(escape(atob(base64Content)));
            document.getElementById("inspector-code-preview").textContent = decodedText;
        } catch (err) {
            document.getElementById("inspector-code-preview").textContent = "Error decoding text.";
        }
    } else if (is3DModel) {
        initThreeViewer(item.fileData);
    }
};

window.closeDetailsModal = function() {
    document.getElementById("details-modal").style.display = "none";
    if (activeThreeScene) {
        cancelAnimationFrame(activeThreeScene.animId);
        activeThreeScene = null;
    }
};

// Three.js 3D Model Preview Helper
function initThreeViewer(dataUrl) {
    const container = document.getElementById("model-canvas-container");
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Placeholder geometric mesh representing the uploaded asset
    const geometry = new THREE.BoxGeometry(3, 3, 3);
    const material = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.3, metalness: 0.8 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    let animId;
    function animate() {
        animId = requestAnimationFrame(animate);
        cube.rotation.x += 0.008;
        cube.rotation.y += 0.012;
        renderer.render(scene, camera);
    }
    animate();
    activeThreeScene = { animId };
}

// Extract individual file from zip archive
window.downloadZipFile = async function(docId, filename) {
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
            showToast(`Extracted ${filename}`);
        }
    } catch (err) {
        showToast("Failed to extract file.", true);
    }
};

// Add comment to upload
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

// FEATURE: Export Vault Backup JSON
window.exportVaultBackup = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allUploads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `vault_backup_${Date.now()}.json`);
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