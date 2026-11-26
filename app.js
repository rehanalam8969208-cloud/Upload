document.title = APP_CONFIG.pageTitle || "Drive Uploader";

let selectedFiles = [];
let isUploading = false;
let elapsedTimer = null;

const photoInput = document.getElementById("drivePhotoInput");
const fileInput = document.getElementById("driveFileInput");
const photoLabelText = document.getElementById("photoLabelText");
const fileLabelText = document.getElementById("fileLabelText");
const statusBox = document.getElementById("statusBox");
const statusText = document.getElementById("statusText");
const timerLine = document.getElementById("timerLine");
const progressTrack = document.getElementById("progressTrack");
const progressFill = document.getElementById("progressFill");
const uploadTriggerBtn = document.getElementById("uploadTriggerBtn");

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

function openFullscreenGallery() {
  document.getElementById("fullscreenGallery").classList.add("open");
  loadUploadedPhotos();
}

function closeFullscreenGallery() {
  document.getElementById("fullscreenGallery").classList.remove("open");
}

function formatTotalSize(files) {
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBytes >= 1024 * 1024) {
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(totalBytes / 1024))} KB`;
}

function estimateSeconds(files) {
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const sizeBasedSec = Math.ceil(totalBytes / (300 * 1024));
  return Math.max(2, files.length + sizeBasedSec);
}

function handleFilesPicked(fileList, sourceType) {
  if (isUploading) return;
  const arr = Array.from(fileList || []);
  if (!arr.length) return;
  selectedFiles = arr;

  const summary = `${arr.length} ${sourceType === "photo" ? "photo(s)" : "file(s)"} • ${formatTotalSize(arr)}`;
  if (sourceType === "photo") {
    photoLabelText.textContent = summary;
    fileLabelText.textContent = "Choose Files (Multiple Any File)";
  } else {
    fileLabelText.textContent = summary;
    photoLabelText.textContent = "Direct Photos (Multiple)";
  }

  statusBox.classList.remove("uploading");
  timerLine.style.display = "none";
  progressTrack.style.display = "none";
  progressFill.style.width = "0%";
  statusText.textContent = `${summary} ready. Estimated time: ~${estimateSeconds(arr)}s`;
}

photoInput.addEventListener("change", (e) => {
  handleFilesPicked(e.target.files, "photo");
  e.target.value = "";
});

fileInput.addEventListener("change", (e) => {
  handleFilesPicked(e.target.files, "file");
  e.target.value = "";
});

function openUploadPasswordModal() {
  if (isUploading) return;
  if (!selectedFiles.length) {
    statusText.textContent = "पहले Direct Photos या Choose Files से फ़ाइलें चुनें।";
    return;
  }
  const inp = document.getElementById("uploadPassInput");
  inp.value = "";
  document.getElementById("uploadPassModal").classList.add("open");
  setTimeout(() => inp.focus(), 80);
}

function confirmUploadWithPassword() {
  const entered = document.getElementById("uploadPassInput").value.trim().toLowerCase();
  if (entered !== APP_CONFIG.uploadPass.toLowerCase()) {
    statusBox.classList.remove("uploading");
    statusText.textContent = "गलत पासवर्ड! अपलोड रोक दिया गया।";
    closeModal("uploadPassModal");
    return;
  }
  closeModal("uploadPassModal");
  uploadSelectedFiles();
}

function openGalleryPasswordModal() {
  const inp = document.getElementById("galleryPassInput");
  const err = document.getElementById("galleryPassError");
  inp.value = "";
  err.style.display = "none";
  document.getElementById("galleryPassModal").classList.add("open");
  setTimeout(() => inp.focus(), 80);
}

function confirmGalleryPassword() {
  const entered = document.getElementById("galleryPassInput").value.trim().toLowerCase();
  const err = document.getElementById("galleryPassError");
  if (entered !== APP_CONFIG.galleryPass.toLowerCase()) {
    err.style.display = "block";
    return;
  }
  closeModal("galleryPassModal");
  openFullscreenGallery();
}

async function loadUploadedPhotos() {
  const grid = document.getElementById("galleryGrid");
  const countText = document.getElementById("galleryCountText");
  grid.innerHTML = "";
  countText.textContent = "Drive se photos load ho rahi hain...";

  try {
    const res = await fetch(APP_CONFIG.driveWebAppUrl);
    const data = await res.json();
    if (data.status !== "ok") {
      countText.textContent = "Photos load nahi ho payin.";
      return;
    }

    const photos = data.photos || [];
    countText.textContent = `${photos.length} uploaded photo(s)`;

    if (!photos.length) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-secondary); font-size:13px; padding:32px 0;">Abhi tak koi photo upload nahi hui hai.</div>`;
      return;
    }

    photos.forEach((p) => {
      const item = document.createElement("div");
      item.className = "photo-item";
      item.onclick = () => window.open(p.viewUrl, "_blank");
      item.innerHTML = `
        <img src="${p.thumbUrl}" alt="${p.name}" loading="lazy">
        <div class="photo-caption">${p.name}</div>
      `;
      grid.appendChild(item);
    });
  } catch (err) {
    countText.textContent = "Load karne mein dikkat aayi.";
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result || "").split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadSelectedFiles() {
  if (!selectedFiles.length || isUploading) return;

  isUploading = true;
  uploadTriggerBtn.disabled = true;
  statusBox.classList.add("uploading");
  timerLine.style.display = "block";
  progressTrack.style.display = "block";
  progressFill.style.width = "8%";

  const estSec = estimateSeconds(selectedFiles);
  let secPassed = 0;
  timerLine.textContent = `0s / ~${estSec}s`;

  clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    secPassed++;
    const displayEst = Math.max(estSec, secPassed + 1);
    timerLine.textContent = `${secPassed}s / ~${displayEst}s`;
  }, 1000);

  let uploadedCount = 0;
  for (let i = 0; i < selectedFiles.length; i++) {
    const f = selectedFiles[i];
    statusText.textContent = `Uploading ${i + 1} of ${selectedFiles.length}: ${f.name}`;
    progressFill.style.width = `${Math.max(10, Math.round((i / selectedFiles.length) * 100))}%`;

    try {
      const base64Data = await fileToBase64(f);
      await fetch(APP_CONFIG.driveWebAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: f.name,
          mimeType: f.type || "application/octet-stream",
          base64: base64Data
        })
      });
      uploadedCount++;
      progressFill.style.width = `${Math.round(((i + 1) / selectedFiles.length) * 100)}%`;
    } catch (err) {
      statusText.textContent = `Error on ${f.name} (${i + 1}/${selectedFiles.length})`;
    }
  }

  clearInterval(elapsedTimer);
  isUploading = false;
  uploadTriggerBtn.disabled = false;
  progressFill.style.width = "100%";
  timerLine.textContent = `Completed in ${secPassed}s`;
  statusText.textContent = `${uploadedCount}/${selectedFiles.length} file(s) sent to Google Drive.`;
  selectedFiles = [];
  photoLabelText.textContent = "Direct Photos (Multiple)";
  fileLabelText.textContent = "Choose Files (Multiple Any File)";
}
