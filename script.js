import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getDatabase, ref as dbRef, set, get, remove, update, child, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1552100479360700538/egxNycSpXHaePAWFMlffgWvzgoaDZjVu-mWh6BhNkcazBWryyhvAYhC4vj82aTGhyBiK";
const SECRET_CREATOR_CODE = "!?@";

const firebaseConfig = {
    apiKey: "AIzaSyBQpZosIqlg1lc5dT5UWgBHAMxzrcje6S4",
    authDomain: "chat-3d356.firebaseapp.com",
    databaseURL: "https://chat-3d356-default-rtdb.firebaseio.com",
    projectId: "chat-3d356",
    storageBucket: "chat-3d356.firebasestorage.app",
    messagingSenderId: "750976196666",
    appId: "1:750976196666:web:4dc9a71b8253c3cad45503",
    measurementId: "G-CW820HNMB2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const rtdb = getDatabase(app);

let allUploads = [];
let allExtensions = [];
let currentUploadMode = 'file';
let selectedFileToUpload = null;
let selectedFolderFiles = [];
let activeTagsList = [];

function withTimeout(promise, ms = 30000) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Operation timed out. Check your Realtime Database Rules.")), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

const BASE_TAGS = [
    "javascript", "firebase", "realtime-database", "threejs", "python", "react", "html", "css", "tailwind", 
    "blender", "3d-model", "ui", "ux", "game-dev", "extension", "chrome", "plugin", "database", "security", 
    "api", "node", "vue", "angular", "shader", "animation", "script", "archive", "project", "web", "dashboard", 
    "tool", "mobile", "ios", "android", "flutter", "swift", "kotlin", "java", "csharp", "cpp", "c", "php", "ruby", 
    "rust", "go", "sql", "nosql", "mongodb", "docker", "kubernetes", "aws", "gcp", "azure", "linux", "ubuntu", 
    "debian", "bash", "shell", "git", "github", "gitlab", "webpack", "vite", "babel", "typescript", "jquery", 
    "bootstrap", "sass", "less", "wordpress", "shopify", "nextjs", "nuxtjs", "svelte", "solidjs", "express", 
    "fastapi", "django", "flask", "spring-boot", "laravel", "symfony", "ruby-on-rails", "graphql", "rest-api", 
    "websocket", "jwt", "oauth", "firebase-auth", "storage", "hosting", "functions", "analytics", "ml", "ai", 
    "tensorflow", "pytorch", "opencv", "unity", "unreal-engine", "godot", "game-physics", "audio-effects", "vfx", 
    "particles", "portal", "dashboard-ui", "admin-panel", "moderation", "discord-bot", "webhook", "telegram-bot",
    "uploads", "extensions", "plugins", "tools", "utilities", "resources", "assets", "templates", "themes", "skins",
    "owner", "creator", "developer", "artist", "designer", "programmer", "engineer", "coder", "hacker", "modder"
];

document.addEventListener("DOMContentLoaded", () => {
    if (!localStorage.getItem("vault_creator_verified")) {
        localStorage.removeItem("vault_is_creator");
    }

    checkDirectUrlDownloadParam();
    setupTabs();
    setupSubTabs();
    setupThemeAndAccents();
    setupTagChipManager();
    setupUploadModeInputs();
    setupStealthCreatorInput();
    setupUploadForm();
    setupEditForm();
    setupFilters();
    checkCreatorSession();
    listenToSiteSettings();
    listenToLiveChat();
    loadUploadsFromDatabase();
    loadExtensionsFromDatabase();
    checkOptionalFavicon();
});

async function checkDirectUrlDownloadParam() {
    const params = new URLSearchParams(window.location.search);
    const downloadId = params.get("download");
    if (downloadId) {
        try {
            const snap = await get(child(dbRef(rtdb), `uploads/${downloadId}`));
            if (snap.exists()) {
                const item = snap.val();
                document.body.innerHTML = `
                    <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b0f19; color: #f3f4f6; padding: 20px; font-family: sans-serif;">
                        <div style="background: rgba(18,24,38,0.92); border: 1px solid rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; max-width: 600px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                            <i class="fa-solid fa-box-archive" style="font-size: 3rem; color: #a855f7; margin-bottom: 15px;"></i>
                            <h1 style="font-size: 1.8rem; margin-bottom: 10px;">${escapeHtml(item.fileName)}</h1>
                            <p style="color: #9ca3af; margin-bottom: 20px;">${escapeHtml(item.description)}</p>
                            <a href="${item.fileData}" download="${item.fileName}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 14px 30px; border-radius: 12px; font-weight: 700; text-decoration: none; box-shadow: 0 8px 25px rgba(99,102,241,0.5);">
                                <i class="fa-solid fa-download"></i> Download Upload
                            </a>
                            <div style="margin-top: 20px;"><a href="index.html" style="color: #38bdf8; text-decoration: none; font-size: 0.9rem;"><i class="fa-solid fa-arrow-left"></i> Return to VaultSync Hub</a></div>
                        </div>
                    </div>
                `;
            }
        } catch (err) {}
    }
}

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

function checkCreatorSession() {
    const isCreator = localStorage.getItem("vault_is_creator") === "true";
    const tab = document.getElementById("creator-panel-tab");
    const indicator = document.getElementById("live-creator-indicator");
    if (tab) tab.style.display = isCreator ? "flex" : "none";
    if (indicator) indicator.style.display = isCreator ? "flex" : "none";
}

window.removeCreatorSession = function() {
    localStorage.removeItem("vault_is_creator");
    localStorage.removeItem("vault_creator_verified");
    checkCreatorSession();
    if (document.getElementById("creator-panel-tab-content")?.classList.contains("active")) {
        document.querySelector('[data-tab="view-tab"]')?.click();
    }
    showToast("Creator session and portal tag fully revoked.");
};

async function listenToSiteSettings() {
    try {
        const snap = await get(child(dbRef(rtdb), "site_settings/config"));
        if (snap.exists()) {
            applySiteSettings(snap.val());
        } else {
            await set(dbRef(rtdb, "site_settings/config"), { isLocked: false, announcement: "", announcementExpires: 0 });
        }
    } catch (err) {}
}

function applySiteSettings(data) {
    const lockdownOverlay = document.getElementById("site-lockdown-overlay");
    const lockdownBtn = document.getElementById("lockdown-toggle-btn");
    const banner = document.getElementById("global-announcement-banner");
    const announcementText = document.getElementById("announcement-text");

    if (data.isLocked) {
        if (lockdownOverlay) lockdownOverlay.style.display = "flex";
        if (lockdownBtn) { lockdownBtn.textContent = "Disable Lockdown"; lockdownBtn.style.background = "var(--success)"; }
    } else {
        if (lockdownOverlay) lockdownOverlay.style.display = "none";
        if (lockdownBtn) { lockdownBtn.textContent = "Enable Lockdown"; lockdownBtn.style.background = "var(--danger)"; }
    }

    const now = Date.now();
    if (banner && announcementText && data.announcement && data.announcementExpires && now < data.announcementExpires) {
        announcementText.textContent = data.announcement;
        banner.style.display = "block";
    } else if (banner) {
        banner.style.display = "none";
    }
}

function listenToLiveChat() {
    const chatForm = document.getElementById("chat-form");
    if (!chatForm) return;
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("chat-username-input").value.trim();
        const message = document.getElementById("chat-message-input").value.trim();
        const isCreator = localStorage.getItem("vault_is_creator") === "true";

        if (!username || !message) return;

        if (message.startsWith("/announce ") && isCreator) {
            const announcementText = message.replace("/announce ", "");
            try {
                await withTimeout(update(dbRef(rtdb, "site_settings/config"), {
                    announcement: announcementText,
                    announcementExpires: Date.now() + 3600000
                }));
                showToast("Global announcement triggered via chat command!");
            } catch (err) {
                showToast("Announcement failed: " + err.message, true);
            }
            document.getElementById("chat-message-input").value = "";
            return;
        }

        try {
            const newMsgRef = push(dbRef(rtdb, "chat_messages"));
            await withTimeout(set(newMsgRef, {
                username,
                message,
                isCreator,
                createdAt: Date.now()
            }));
            document.getElementById("chat-message-input").value = "";
            loadLiveChatMessages();
            showToast("Message sent!");
        } catch (err) {
            showToast("Failed to send message: " + err.message, true);
        }
    });

    loadLiveChatMessages();
}

async function loadLiveChatMessages() {
    const container = document.getElementById("chat-messages-list");
    if (!container) return;
    try {
        const snap = await get(child(dbRef(rtdb), "chat_messages"));
        let html = "";
        if (snap.exists()) {
            const messagesObj = snap.val();
            Object.keys(messagesObj).forEach(msgId => {
                const msg = messagesObj[msgId];
                const creatorTag = msg.isCreator ? `<span class="creator-badge" style="font-size:0.6rem; padding:1px 4px;">CREATOR</span>` : '';
                html += `
                    <div style="background: rgba(0,0,0,0.15); padding: 10px 14px; border-radius: 10px; border: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="font-weight: 700; color: var(--accent); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-user-circle"></i> ${escapeHtml(msg.username)} ${creatorTag}
                            </div>
                            <div style="font-size: 0.92rem; word-break: break-word;">${escapeHtml(msg.message)}</div>
                        </div>
                        <button class="action-btn btn-delete" onclick="window.deleteChatMessage('${msgId}')" style="width: auto; padding: 2px 6px; font-size: 0.75rem;" title="Delete Message"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            });
        }
        container.innerHTML = html || "<p style='color:var(--text-muted); text-align:center;'>No messages yet. Start chatting below!</p>";
        container.scrollTop = container.scrollHeight;
    } catch (err) {}
}

window.deleteChatMessage = async function(msgId) {
    try {
        await withTimeout(remove(dbRef(rtdb, `chat_messages/${msgId}`)));
        showToast("Message deleted.");
        loadLiveChatMessages();
    } catch (err) {
        showToast("Failed to delete message: " + err.message, true);
    }
};

window.toggleSiteLockdown = async function() {
    try {
        const snap = await get(child(dbRef(rtdb), "site_settings/config"));
        const currentVal = snap.exists() ? snap.val().isLocked : false;
        await withTimeout(update(dbRef(rtdb, "site_settings/config"), { isLocked: !currentVal }));
        showToast(`Site lockdown is now ${!currentVal ? 'ENABLED' : 'DISABLED'} globally!`);
        listenToSiteSettings();
    } catch (err) { showToast("Failed to toggle lockdown: " + err.message, true); }
};

window.broadcastAnnouncement = async function() {
    const msg = document.getElementById("announcement-msg-input").value.trim();
    const durationSec = parseInt(document.getElementById("announcement-duration-select").value);
    if (!msg) { showToast("Please enter an announcement message.", true); return; }
    try {
        await withTimeout(update(dbRef(rtdb, "site_settings/config"), { announcement: msg, announcementExpires: Date.now() + (durationSec * 1000) }));
        showToast("Announcement broadcasted successfully!");
        document.getElementById("announcement-msg-input").value = "";
        listenToSiteSettings();
    } catch (err) { showToast("Broadcast failed: " + err.message, true); }
};

window.modifyUserTag = async function(giveTag) {
    const username = document.getElementById("target-username-input").value.trim().toLowerCase();
    if (!username) { showToast("Please enter a username.", true); return; }
    try {
        const snap = await get(child(dbRef(rtdb), "uploads"));
        let count = 0;
        if (snap.exists()) {
            const uploads = snap.val();
            for (const id of Object.keys(uploads)) {
                if (uploads[id].uploaderName && uploads[id].uploaderName.toLowerCase() === username) {
                    await update(dbRef(rtdb, `uploads/${id}`), { isCreator: giveTag });
                    count++;
                }
            }
        }
        showToast(`Successfully ${giveTag ? 'gave' : 'removed'} creator tag for ${count} uploads!`);
        document.getElementById("target-username-input").value = "";
        loadUploadsFromDatabase();
        window.loadCreatorMasterPanel();
    } catch (err) { showToast("Failed to modify user tag: " + err.message, true); }
};

function setupTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            const targetId = btn.getAttribute("data-tab");
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.classList.add("active");
            if (targetId === "view-tab") loadUploadsFromDatabase();
            if (targetId === "extensions-tab") loadExtensionsFromDatabase();
            if (targetId === "chat-tab") loadLiveChatMessages();
            if (targetId === "creator-panel-tab-content") window.loadCreatorMasterPanel();
        });
    });
}

function setupSubTabs() {
    const subBtns = document.querySelectorAll(".sub-tab-btn");
    const subContents = document.querySelectorAll(".sub-tab-content");
    subBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            subBtns.forEach(b => b.classList.remove("active"));
            subContents.forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            const targetSub = btn.getAttribute("data-sub");
            const targetEl = document.getElementById(targetSub);
            if (targetEl) targetEl.classList.add("active");
        });
    });
}

function setupThemeAndAccents() {
    const themeBtn = document.getElementById("theme-toggle-btn");
    const accentPicker = document.getElementById("accent-picker");
    const htmlEl = document.documentElement;

    if (themeBtn) {
        const iconEl = themeBtn.querySelector("i");
        themeBtn.addEventListener("click", () => {
            const currentTheme = htmlEl.getAttribute("data-theme");
            if (currentTheme === "dark") {
                htmlEl.setAttribute("data-theme", "light");
                if (iconEl) iconEl.className = "fa-solid fa-sun";
            } else {
                htmlEl.setAttribute("data-theme", "dark");
                if (iconEl) iconEl.className = "fa-solid fa-moon";
            }
        });
    }

    if (accentPicker) {
        accentPicker.addEventListener("change", (e) => {
            htmlEl.setAttribute("data-accent", e.target.value);
        });
    }
}

function setupStealthCreatorInput() {
    const nameInput = document.getElementById("uploader-name");
    const indicator = document.getElementById("live-creator-indicator");
    if (!nameInput) return;

    nameInput.addEventListener("input", () => {
        const val = nameInput.value;
        if (val.includes(SECRET_CREATOR_CODE)) {
            nameInput.value = val.replace(SECRET_CREATOR_CODE, "").trim();
            localStorage.setItem("vault_is_creator", "true");
            localStorage.setItem("vault_creator_verified", "true");
            if (indicator) indicator.style.display = "flex";
            checkCreatorSession();
            showToast("👑 Portal Activated: Verified Creator Unlocked!");
        }
    });
}

function setupTagChipManager() {
    const container = document.getElementById("tag-chips-container");
    const input = document.getElementById("upload-tags-input");
    const dropdown = document.getElementById("tag-dropdown");
    if (!container || !input || !dropdown) return;

    container.addEventListener("click", () => input.focus());

    input.addEventListener("input", () => {
        const val = input.value.trim().toLowerCase();
        if (!val) {
            dropdown.style.display = "none";
            return;
        }
        const matches = BASE_TAGS.filter(t => t.includes(val) && !activeTagsList.includes(t));
        if (matches.length === 0) {
            dropdown.style.display = "none";
            return;
        }
        let html = "";
        matches.slice(0, 8).forEach(tag => {
            html += `<div class="tag-dropdown-item" onclick="window.addTagChip('${tag}')"><i class="fa-solid fa-hashtag"></i> ${tag}</div>`;
        });
        dropdown.innerHTML = html;
        dropdown.style.display = "block";
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = input.value.trim().replace(/^#/, '').toLowerCase();
            if (val && !activeTagsList.includes(val)) {
                activeTagsList.push(val);
                renderTagChips();
            }
            input.value = "";
            dropdown.style.display = "none";
        }
    });
}

window.addTagChip = function(tag) {
    if (!activeTagsList.includes(tag)) {
        activeTagsList.push(tag);
        renderTagChips();
    }
    const input = document.getElementById("upload-tags-input");
    const dropdown = document.getElementById("tag-dropdown");
    if (input) input.value = "";
    if (dropdown) dropdown.style.display = "none";
    if (input) input.focus();
};

window.removeTagChip = function(tag) {
    activeTagsList = activeTagsList.filter(t => t !== tag);
    renderTagChips();
};

function renderTagChips() {
    const container = document.getElementById("tag-chips-container");
    const input = document.getElementById("upload-tags-input");
    if (!container || !input) return;

    container.querySelectorAll('.tag-chip').forEach(el => el.remove());

    activeTagsList.forEach(tag => {
        const chip = document.createElement("div");
        chip.className = "tag-chip";
        chip.innerHTML = `#${tag} <i class="fa-solid fa-xmark" onclick="window.removeTagChip('${tag}')"></i>`;
        container.insertBefore(chip, input);
    });
}

window.toggleEncryptionInput = function(checkbox) {
    const passInput = document.getElementById("upload-encryption-pass");
    if (!passInput) return;
    passInput.style.display = checkbox.checked ? "block" : "none";
    if (!checkbox.checked) passInput.value = "";
};

window.setUploadMode = function(mode) {
    currentUploadMode = mode;
    const btnFile = document.getElementById("mode-btn-file");
    const btnFolder = document.getElementById("mode-btn-folder");
    const containerFile = document.getElementById("upload-mode-file-container");
    const containerFolder = document.getElementById("upload-mode-folder-container");

    if (mode === 'file') {
        if (btnFile) btnFile.classList.add("active");
        if (btnFolder) btnFolder.classList.remove("active");
        if (containerFile) containerFile.style.display = "flex";
        if (containerFolder) containerFolder.style.display = "none";
        selectedFolderFiles = [];
    } else {
        if (btnFolder) btnFolder.classList.add("active");
        if (btnFile) btnFile.classList.remove("active");
        if (containerFolder) containerFolder.style.display = "flex";
        if (containerFile) containerFile.style.display = "none";
        selectedFileToUpload = null;
    }
    updateStagingDisplay();
};

function setupUploadModeInputs() {
    const singleInput = document.getElementById("single-file-input");
    const folderInput = document.getElementById("folder-file-input");

    if (singleInput) {
        singleInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                selectedFileToUpload = e.target.files[0];
                selectedFolderFiles = [];
                updateStagingDisplay();
            }
        });
    }

    if (folderInput) {
        folderInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                selectedFolderFiles = Array.from(e.target.files);
                selectedFileToUpload = null;
                updateStagingDisplay();
            }
        });
    }
}

function updateStagingDisplay() {
    const stagingContainer = document.getElementById("staging-container");
    const stagedName = document.getElementById("staged-file-name");
    if (!stagingContainer || !stagedName) return;

    if (currentUploadMode === 'file' && selectedFileToUpload) {
        stagingContainer.style.display = "block";
        stagedName.textContent = `${selectedFileToUpload.name} (${formatFileSize(selectedFileToUpload.size)})`;
    } else if (currentUploadMode === 'folder' && selectedFolderFiles.length > 0) {
        stagingContainer.style.display = "block";
        stagedName.textContent = `Folder Package (${selectedFolderFiles.length} files)`;
    } else {
        stagingContainer.style.display = "none";
    }
}

window.clearStaging = function() {
    selectedFileToUpload = null;
    selectedFolderFiles = [];
    const single = document.getElementById("single-file-input");
    const folder = document.getElementById("folder-file-input");
    if (single) single.value = "";
    if (folder) folder.value = "";
    updateStagingDisplay();
};

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function setupUploadForm() {
    const form = document.getElementById("upload-form");
    const submitBtn = document.getElementById("submit-btn");
    if (!form || !submitBtn) return;
    const btnSpinner = document.getElementById("btn-spinner");
    const btnText = submitBtn.querySelector(".btn-text");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (currentUploadMode === 'file' && !selectedFileToUpload) {
            showToast("Please select a file or 3D model to upload.", true);
            return;
        }
        if (currentUploadMode === 'folder' && selectedFolderFiles.length === 0) {
            showToast("Please select an entire folder to upload.", true);
            return;
        }

        const uploaderName = document.getElementById("uploader-name").value.trim();
        const bundleName = document.getElementById("upload-bundle-name").value.trim() || "UploadItem";
        const category = document.getElementById("upload-category").value;
        const version = document.getElementById("upload-version").value.trim() || "v1.0";
        const uploadDesc = document.getElementById("upload-desc").value.trim();
        const encryptionPass = document.getElementById("upload-encryption-pass").value.trim();
        const isCreator = localStorage.getItem("vault_is_creator") === "true";

        submitBtn.disabled = true;
        if (btnText) btnText.style.display = "none";
        if (btnSpinner) btnSpinner.style.display = "block";

        try {
            let dataUrl;
            let finalFileName;
            let totalBytes = 0;

            if (currentUploadMode === 'file') {
                finalFileName = selectedFileToUpload.name;
                totalBytes = selectedFileToUpload.size;
                dataUrl = await fileToBase64(selectedFileToUpload);
            } else {
                const zip = new JSZip();
                for (const file of selectedFolderFiles) {
                    const relativePath = file.webkitRelativePath && file.webkitRelativePath !== "" ? file.webkitRelativePath : file.name;
                    const arrayBuffer = await file.arrayBuffer();
                    zip.file(relativePath, arrayBuffer);
                    totalBytes += file.size;
                }
                const zipBlob = await zip.generateAsync({ type: "blob" });
                finalFileName = bundleName.endsWith('.zip') ? bundleName : `${bundleName}.zip`;
                dataUrl = await fileToBase64(zipBlob);
            }

            const newUploadRef = push(dbRef(rtdb, "uploads"));
            const uploadPayload = {
                id: newUploadRef.key,
                uploaderName,
                isCreator,
                category,
                tags: activeTagsList,
                description: uploadDesc,
                fileName: finalFileName,
                fileSize: formatFileSize(totalBytes),
                fileData: dataUrl,
                isEncrypted: encryptionPass !== "",
                encryptionPass: encryptionPass,
                version,
                isPrivate: false,
                likes: 0,
                downloads: 0,
                totalStars: 0,
                ratingCount: 0,
                createdAt: Date.now()
            };

            await withTimeout(set(newUploadRef, uploadPayload));
            if (DISCORD_WEBHOOK_URL) {
                try { await sendToDiscordWebhook(uploadPayload, finalFileName); } catch (e) {}
            }

            showToast("Successfully uploaded to Realtime Database!");
            form.reset();
            activeTagsList = [];
            renderTagChips();
            window.clearStaging();
            const passInput = document.getElementById("upload-encryption-pass");
            if (passInput) passInput.style.display = "none";
            setTimeout(() => document.querySelector('[data-tab="view-tab"]')?.click(), 1000);
        } catch (error) {
            console.error("Upload Error:", error);
            showToast("Upload failed: " + (error.message || "Check Realtime Database Rules"), true);
        } finally {
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = "inline-flex";
            if (btnSpinner) btnSpinner.style.display = "none";
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function sendToDiscordWebhook(data, fileName) {
    await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: `🚀 **New Vault Uploaded!**\n**Uploader:** ${data.uploaderName} ${data.isCreator ? '👑 [CREATOR]' : ''}\n**Item:** ${fileName} (${data.fileSize})\n**Description:** ${data.description}`
        })
    });
}

async function loadUploadsFromDatabase() {
    const loadingSpinner = document.getElementById("loading-spinner");
    const uploadsGrid = document.getElementById("uploads-grid");
    const emptyState = document.getElementById("empty-state");

    if (loadingSpinner) loadingSpinner.style.display = "block";
    if (uploadsGrid) uploadsGrid.innerHTML = "";
    if (emptyState) emptyState.style.display = "none";

    try {
        const snap = await withTimeout(get(child(dbRef(rtdb), "uploads")));
        allUploads = [];
        if (snap.exists()) {
            const data = snap.val();
            Object.keys(data).forEach(id => {
                allUploads.push({ id, ...data[id] });
            });
            allUploads.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        if (loadingSpinner) loadingSpinner.style.display = "none";
        const statCount = document.getElementById("stat-count");
        if (statCount) statCount.textContent = allUploads.filter(u => !u.isPrivate).length;
        const ticker = document.getElementById("live-ticker-text");
        if (ticker) ticker.textContent = allUploads.length > 0 ? `Latest: ${allUploads[0].fileName}` : "Active";
        updateGodModeAnalytics();
        filterAndRenderUploads();
    } catch (error) {
        if (loadingSpinner) loadingSpinner.style.display = "none";
        showToast("Failed to load vault items: " + error.message, true);
    }
}

function updateGodModeAnalytics() {
    let totalDl = 0;
    let totalRatings = 0;
    allUploads.forEach(u => {
        totalDl += (u.downloads || 0);
        totalRatings += (u.ratingCount || 0);
    });
    const dlEl = document.getElementById("analytics-total-downloads");
    const bEl = document.getElementById("analytics-total-bundles");
    const rEl = document.getElementById("analytics-total-ratings");
    if (dlEl) dlEl.textContent = totalDl;
    if (bEl) bEl.textContent = allUploads.length;
    if (rEl) rEl.textContent = totalRatings;
}

async function loadExtensionsFromDatabase() {
    try {
        const snap = await withTimeout(get(child(dbRef(rtdb), "chrome_extensions")));
        allExtensions = [];
        if (snap.exists()) {
            const data = snap.val();
            Object.keys(data).forEach(id => {
                allExtensions.push({ id, ...data[id] });
            });
            allExtensions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }
        const extCount = document.getElementById("ext-count");
        if (extCount) extCount.textContent = allExtensions.length;
        if (typeof window.renderExtensions === 'function') window.renderExtensions(allExtensions);
    } catch (err) {}
}

window.renderExtensions = function(extensions) {
    const grid = document.getElementById("extensions-grid");
    const empty = document.getElementById("ext-empty-state");
    const spinner = document.getElementById("ext-loading-spinner");
    if (spinner) spinner.style.display = "none";
    if (!grid) return;
    grid.innerHTML = "";

    if (extensions.length === 0) {
        if (empty) empty.style.display = "block";
        return;
    }
    if (empty) empty.style.display = "none";

    extensions.forEach(ext => {
        const card = document.createElement("div");
        card.className = "upload-card";
        card.innerHTML = `
            <div>
                <div class="card-top-row">
                    <div class="upload-author"><i class="fa-solid fa-user-circle"></i> ${escapeHtml(ext.uploaderName)}</div>
                    <span class="category-badge">Extension</span>
                </div>
                <div class="upload-filename">${escapeHtml(ext.fileName || 'Extension')}</div>
                <div class="upload-desc">${escapeHtml(ext.description)}</div>
            </div>
            <div>
                <div class="upload-actions">
                    <a href="${ext.fileData}" class="action-btn btn-download" download style="text-decoration:none; text-align:center;">
                        <i class="fa-solid fa-download"></i> Download Ext
                    </a>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
};

function setupFilters() {
    const search = document.getElementById("search-uploads");
    const cat = document.getElementById("category-filter");
    const sort = document.getElementById("sort-filter");
    if (search) search.addEventListener("input", filterAndRenderUploads);
    if (cat) cat.addEventListener("change", filterAndRenderUploads);
    if (sort) sort.addEventListener("change", filterAndRenderUploads);
}

window.setLayoutMode = function(mode) {
    const gridBtn = document.getElementById("layout-grid-btn");
    const listBtn = document.getElementById("layout-list-btn");
    if (gridBtn) gridBtn.className = `action-btn view-layout-btn ${mode === 'grid' ? 'active' : ''}`;
    if (listBtn) listBtn.className = `action-btn view-layout-btn ${mode === 'list' ? 'active' : ''}`;
    const grid = document.getElementById("uploads-grid");
    if (grid) {
        if (mode === 'list') grid.classList.add('list-view');
        else grid.classList.remove('list-view');
    }
};

function filterAndRenderUploads() {
    const searchEl = document.getElementById("search-uploads");
    const catEl = document.getElementById("category-filter");
    const sortEl = document.getElementById("sort-filter");

    const searchTerm = searchEl ? searchEl.value.toLowerCase() : "";
    const categoryFilter = catEl ? catEl.value : "ALL";
    const sortFilter = sortEl ? sortEl.value : "newest";

    let filtered = allUploads.filter(item => {
        if (item.isPrivate) return false;
        const matchesSearch = item.fileName.toLowerCase().includes(searchTerm) || 
                              item.description.toLowerCase().includes(searchTerm) || 
                              item.uploaderName.toLowerCase().includes(searchTerm) ||
                              (item.tags && item.tags.some(t => t.includes(searchTerm)));
        const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    if (sortFilter === "likes") filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    else if (sortFilter === "downloads") filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    else if (sortFilter === "rating") filtered.sort((a, b) => ((b.totalStars || 0) / (b.ratingCount || 1)) - ((a.totalStars || 0) / (a.ratingCount || 1)));
    else if (sortFilter === "name") filtered.sort((a, b) => a.fileName.localeCompare(b.fileName));

    renderUploadsCards(filtered, "uploads-grid", "empty-state");
}

function renderUploadsCards(items, gridId, emptyId) {
    const uploadsGrid = document.getElementById(gridId);
    const emptyState = document.getElementById(emptyId);
    if (!uploadsGrid) return;
    uploadsGrid.innerHTML = "";

    if (items.length === 0) {
        if (emptyState) emptyState.style.display = "block";
        return;
    }
    if (emptyState) emptyState.style.display = "none";

    items.forEach(item => {
        const creatorBadge = item.isCreator ? `<span class="creator-badge"><i class="fa-solid fa-crown"></i> CREATOR</span>` : '';
        const lockIcon = item.isEncrypted ? `<i class="fa-solid fa-lock" style="color:var(--danger);" title="Password Protected"></i>` : '';

        const card = document.createElement("div");
        card.className = "upload-card";
        card.innerHTML = `
            <div>
                <div class="card-top-row">
                    <div class="upload-author"><i class="fa-solid fa-user-circle"></i> ${escapeHtml(item.uploaderName)} ${creatorBadge}</div>
                    <span class="category-badge">${escapeHtml(item.version || 'v1.0')}</span>
                </div>
                <div class="upload-filename">${lockIcon} ${escapeHtml(item.fileName)}</div>
                <div class="upload-desc">${escapeHtml(item.description)}</div>
                <div class="upload-meta">
                    <i class="fa-solid fa-hard-drive"></i> ${escapeHtml(item.fileSize)} &bull; 
                    <i class="fa-solid fa-download"></i> ${item.downloads || 0} dl
                </div>
            </div>
            <div>
                <div class="upload-actions">
                    <button class="action-btn btn-download" onclick="window.handleDownloadClick('${item.id}')">
                        <i class="fa-solid fa-download"></i> Download
                    </button>
                    <button class="action-btn btn-inspect" onclick="window.openDetailsModal('${item.id}')">
                        <i class="fa-solid fa-folder-open"></i> Inspect
                    </button>
                    <button class="action-btn btn-edit" onclick="window.openEditModal('${item.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                </div>
                <div class="upload-actions">
                    <button class="action-btn btn-inspect" onclick="window.generateBundleQRCode('${item.id}')" style="background: rgba(56,189,248,0.15); color: #38bdf8;">
                        <i class="fa-solid fa-qrcode"></i> QR Code
                    </button>
                    <button class="action-btn btn-delete" onclick="window.deleteUpload('${item.id}')">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </div>
            </div>
        `;
        uploadsGrid.appendChild(card);
    });
}

window.handleDownloadClick = async function(docId) {
    const item = allUploads.find(u => u.id === docId);
    if (!item) return;

    if (item.isEncrypted) {
        const pass = prompt("This upload is password protected. Enter password:");
        if (pass !== item.encryptionPass) {
            showToast("Incorrect password!", true);
            return;
        }
    }

    try {
        await withTimeout(update(dbRef(rtdb, `uploads/${docId}`), { downloads: (item.downloads || 0) + 1 }));
    } catch (err) {}

    showToast("Downloading...");
    try {
        const a = document.createElement('a');
        a.href = item.fileData;
        a.download = item.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Download completed!");
    } catch (err) {
        showToast("Download failed", true);
    }
    loadUploadsFromDatabase();
};

window.generateBundleQRCode = function(docId) {
    const webUrl = `${window.location.origin}${window.location.pathname}?download=${docId}`;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(webUrl)}`;
    
    const modal = document.getElementById("details-modal");
    const modalTitle = document.getElementById("details-modal-title");
    const modalBody = document.getElementById("details-modal-body");
    const modalFooter = document.getElementById("details-modal-footer");
    if (!modal) return;

    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-qrcode"></i> Mobile QR Code`;
    if (modalBody) {
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="margin-bottom: 15px; color: var(--text-muted);">Scan this QR code with any smartphone camera to download instantly:</p>
                <img src="${qrApi}" alt="QR Code" style="border-radius: 12px; border: 4px solid #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <p style="margin-top: 15px; font-size: 0.85rem; word-break: break-all; color: var(--accent);">${webUrl}</p>
            </div>
        `;
    }
    if (modalFooter) modalFooter.innerHTML = `<button class="action-btn btn-download" onclick="window.closeDetailsModal()" style="max-width: 150px;">Close</button>`;
    modal.style.display = "flex";
};

window.loadCreatorMasterPanel = function() {
    renderUploadsCards(allUploads, "creator-master-grid", null);
};

window.loadMyUploads = function() {
    const handleEl = document.getElementById("dashboard-handle-input");
    const grid = document.getElementById("my-uploads-grid");
    const empty = document.getElementById("my-uploads-empty");
    const karmaDisplay = document.getElementById("my-karma-display");

    if (!handleEl) return;
    const handle = handleEl.value.trim().toLowerCase();
    if (!handle) { showToast("Please enter your creator handle.", true); return; }

    const myItems = allUploads.filter(u => u.uploaderName.toLowerCase() === handle);
    if (grid) grid.innerHTML = "";

    let totalDl = 0;
    let totalStars = 0;
    myItems.forEach(i => { totalDl += (i.downloads || 0); totalStars += (i.totalStars || 0); });
    const xp = (myItems.length * 50) + (totalDl * 5) + (totalStars * 10);
    const level = Math.floor(xp / 200) + 1;

    if (karmaDisplay) {
        karmaDisplay.innerHTML = `
            <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 20px;">
                <div>
                    <h3><i class="fa-solid fa-medal" style="color: #fbbf24;"></i> Creator Karma & Level</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">Level ${level} Coder &bull; ${xp} XP Earned</p>
                </div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent);">LVL ${level}</div>
            </div>
        `;
    }

    if (myItems.length === 0) { if (empty) empty.style.display = "block"; return; }
    if (empty) empty.style.display = "none";
    renderUploadsCards(myItems, "my-uploads-grid", "my-uploads-empty");
    showToast(`Loaded ${myItems.length} items for ${handle}`);
};

window.openEditModal = function(docId) {
    const item = allUploads.find(u => u.id === docId);
    if (!item) return;
    const docIdEl = document.getElementById("edit-doc-id");
    const nameEl = document.getElementById("edit-name");
    const verEl = document.getElementById("edit-version");
    const descEl = document.getElementById("edit-desc");
    const modalEl = document.getElementById("edit-modal");

    if (docIdEl) docIdEl.value = item.id;
    if (nameEl) nameEl.value = item.fileName;
    if (verEl) verEl.value = item.version || "v1.0";
    if (descEl) descEl.value = item.description;
    if (modalEl) modalEl.style.display = "flex";
};

window.closeEditModal = function() {
    const modalEl = document.getElementById("edit-modal");
    if (modalEl) modalEl.style.display = "none";
};

function setupEditForm() {
    const form = document.getElementById("edit-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const docId = document.getElementById("edit-doc-id")?.value;
        const newName = document.getElementById("edit-name")?.value.trim();
        const newVersion = document.getElementById("edit-version")?.value.trim();
        const newDesc = document.getElementById("edit-desc")?.value.trim();
        if (!docId) return;

        try {
            const updatePayload = {
                fileName: newName.endsWith('.zip') ? newName : `${newName}.zip`,
                version: newVersion,
                description: newDesc
            };
            await withTimeout(update(dbRef(rtdb, `uploads/${docId}`), updatePayload));
            showToast("Upload successfully updated!");
            window.closeEditModal();
            loadUploadsFromDatabase();
        } catch (err) {
            showToast("Failed to update item: " + err.message, true);
        }
    });
}

window.deleteUpload = async function(docId) {
    if (!confirm("Delete this upload?")) return;
    try {
        await withTimeout(remove(dbRef(rtdb, `uploads/${docId}`)));
        showToast("Upload deleted.");
        loadUploadsFromDatabase();
    } catch (error) { showToast("Failed to delete item: " + error.message, true); }
};

window.openDetailsModal = async function(docId) {
    const item = allUploads.find(u => u.id === docId);
    if (!item) return;

    const modal = document.getElementById("details-modal");
    const modalTitle = document.getElementById("details-modal-title");
    const modalBody = document.getElementById("details-modal-body");
    const modalFooter = document.getElementById("details-modal-footer");
    if (!modal) return;

    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-folder-open"></i> Inspecting: ${escapeHtml(item.fileName)}`;
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="inspector-section">
                <h4><i class="fa-solid fa-circle-info"></i> Upload Overview</h4>
                <p><strong>Uploader:</strong> ${escapeHtml(item.uploaderName)} ${item.isCreator ? '👑 [CREATOR]' : ''}</p>
                <p><strong>Description:</strong> ${escapeHtml(item.description)}</p>
                <p><strong>File Size:</strong> ${escapeHtml(item.fileSize)}</p>
            </div>
            <div class="inspector-section" style="margin-top: 15px;">
                <h4><i class="fa-solid fa-star"></i> Rate This Upload</h4>
                <div class="star-rating" style="display:flex; gap: 8px; font-size: 1.4rem; color: #fbbf24; cursor: pointer; margin-top: 8px;">
                    <i class="fa-solid fa-star" onclick="window.rateUpload('${item.id}', 1)"></i>
                    <i class="fa-solid fa-star" onclick="window.rateUpload('${item.id}', 2)"></i>
                    <i class="fa-solid fa-star" onclick="window.rateUpload('${item.id}', 3)"></i>
                    <i class="fa-solid fa-star" onclick="window.rateUpload('${item.id}', 4)"></i>
                    <i class="fa-solid fa-star" onclick="window.rateUpload('${item.id}', 5)"></i>
                </div>
            </div>
        `;
    }
    if (modalFooter) modalFooter.innerHTML = `<button class="action-btn btn-download" onclick="window.handleDownloadClick('${item.id}')" style="max-width: 220px;"><i class="fa-solid fa-download"></i> Download File</button>`;
    modal.style.display = "flex";
};

window.closeDetailsModal = function() {
    const modal = document.getElementById("details-modal");
    if (modal) modal.style.display = "none";
};

window.rateUpload = async function(docId, stars) {
    try {
        const item = allUploads.find(u => u.id === docId);
        if (!item) return;
        await withTimeout(update(dbRef(rtdb, `uploads/${docId}`), {
            totalStars: (item.totalStars || 0) + stars,
            ratingCount: (item.ratingCount || 0) + 1
        }));
        showToast(`Rated ${stars} stars!`);
        loadUploadsFromDatabase();
    } catch (err) {
        showToast("Rating failed: " + err.message, true);
    }
};

window.exportVaultBackup = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allUploads, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `vault_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("Vault backup downloaded successfully!");
};

window.showToast = function(message, isError = false) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${isError ? 'error' : ''}`;
    setTimeout(() => { toast.className = "toast"; }, 3500);
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}