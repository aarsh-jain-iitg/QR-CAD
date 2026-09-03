/**
 * QRCAD  frontend/js/app.js
 * Renderer process script.
 * Uses window.electronAPI (exposed by preload.js via contextBridge).
 * No direct require("electron")  that would break with contextIsolation=true.
 */

"use strict";

import * as THREE from "../vendor/three.module.js";
import { STLLoader } from "../vendor/STLLoader.js";
import { OrbitControls } from "../vendor/OrbitControls.js";

//  DOM REFS 
const output = document.getElementById("output");
const checkCacheBtn = document.getElementById("checkCacheBtn");
const deleteCacheBtn = document.getElementById("deleteCacheBtn");
const searchBtn = document.getElementById("searchBtn");
const selectDatasetBtn = document.getElementById("selectDatasetBtn");
const buildCacheBtn = document.getElementById("buildCacheBtn");
const cacheInfo = document.getElementById("cacheInfo");
const datasetPathDisplay = document.getElementById("datasetPathDisplay");
const queryFile = document.getElementById("queryFile");
const dropZone = document.getElementById("dropZone");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const searchBtnText = document.getElementById("searchBtnText");
const searchSpinner = document.getElementById("searchSpinner");
const resultsBody = document.getElementById("resultsBody");
const backendStatus = document.getElementById("backendStatus");
const queryDownloadBar = document.getElementById("queryDownloadBar");
const queryDlLabel = document.getElementById("queryDlLabel");
const queryDownloadBtn = document.getElementById("queryDownloadBtn");
const comparisonPanel = document.getElementById("comparisonPanel");
const queryViewer = document.getElementById("queryViewer");
const matchViewer = document.getElementById("matchViewer");
const comparisonScore = document.getElementById("comparisonScore");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");

const BACKEND = "http://127.0.0.1:5000";

/** The currently loaded query File object (for local download). */
let currentQueryFile = null;
let comparisonView = null;

/** Store current search results and metadata for export */
let currentSearchResults = null;
let currentQueryFilename = null;
let currentSearchTimestamp = null;

//  HELPERS 

function getDatasetPath() {
    return datasetPathDisplay.value.trim();
}

/**
 * @param {string} html
 * @param {'ok'|'err'|'info'} type
 */
function showCacheInfo(html, type = "info") {
    cacheInfo.innerHTML = html;
    cacheInfo.className = `cache-info ${type}`;
    cacheInfo.classList.remove("hidden");
}

function showOutput(msg) {
    output.textContent = msg;
    output.classList.remove("hidden");
}

function hideOutput() {
    output.classList.add("hidden");
}

function setButtonsDisabled(disabled) {
    [checkCacheBtn, deleteCacheBtn, buildCacheBtn, searchBtn].forEach((btn) => {
        btn.disabled = disabled;
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

class ComparisonView {
    constructor(leftContainer, rightContainer) {
        this.left = this.createViewer(leftContainer);
        this.right = this.createViewer(rightContainer);
        this.animationId = null;
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(leftContainer);
        this.resizeObserver.observe(rightContainer);
    }

    createViewer(container) {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x080c0f);

        const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
        camera.position.set(0, 0, 4);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.enableRotate = true;
        controls.target.set(0, 0, 0);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(3, 4, 5);
        scene.add(keyLight);
        scene.add(new THREE.HemisphereLight(0x9edcff, 0x101820, 1.8));

        const grid = new THREE.GridHelper(3.0, 12, 0x1e3040, 0x12202b);
        grid.rotation.x = Math.PI / 2;
        scene.add(grid);

        return {
            container,
            scene,
            camera,
            renderer,
            controls,
            mesh: null
        };
    }

    setModels(queryGeometry, matchGeometry) {
        const queryInfo = this.prepareGeometry(queryGeometry);
        const matchInfo = this.prepareGeometry(matchGeometry);
        const maxDimension = Math.max(
            queryInfo.maxDimension,
            matchInfo.maxDimension,
            0.0001
        );
        const scale = 2.0 / maxDimension;

        this.setMesh(this.left, queryInfo.geometry, scale, 0x00d4ff);
        this.setMesh(this.right, matchInfo.geometry, scale, 0x00ff9d);

        const cameraDistance = 4.0;
        this.syncCamera(this.left, cameraDistance);
        this.syncCamera(this.right, cameraDistance);
        this.resize();
        this.start();
    }

    prepareGeometry(geometry) {
        const prepared = geometry.clone();
        prepared.computeBoundingBox();

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        prepared.boundingBox.getCenter(center);
        prepared.boundingBox.getSize(size);
        prepared.translate(-center.x, -center.y, -center.z);
        prepared.computeVertexNormals();

        return {
            geometry: prepared,
            maxDimension: Math.max(size.x, size.y, size.z)
        };
    }

    setMesh(viewer, geometry, scale, color) {
        if (viewer.mesh) {
            viewer.scene.remove(viewer.mesh);
            viewer.mesh.geometry.dispose();
            viewer.mesh.material.dispose();
        }

        const material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.45,
            metalness: 0.08,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.setScalar(scale);
        viewer.scene.add(mesh);
        viewer.mesh = mesh;
    }

    syncCamera(viewer, distance) {
        viewer.camera.position.set(0, 0, distance);
        viewer.camera.near = 0.01;
        viewer.camera.far = 100;
        viewer.camera.updateProjectionMatrix();
        viewer.controls.target.set(0, 0, 0);
        viewer.controls.update();
    }

    resize() {
        [this.left, this.right].forEach((viewer) => {
            const rect = viewer.container.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            viewer.camera.aspect = width / height;
            viewer.camera.updateProjectionMatrix();
            viewer.renderer.setSize(width, height, false);
        });
    }

    start() {
        if (this.animationId) return;

        const render = () => {
            this.animationId = requestAnimationFrame(render);
            this.left.controls.update();
            this.right.controls.update();
            this.left.renderer.render(this.left.scene, this.left.camera);
            this.right.renderer.render(this.right.scene, this.right.camera);
        };

        render();
    }

    clear() {
        [this.left, this.right].forEach((viewer) => {
            if (viewer.mesh) {
                viewer.scene.remove(viewer.mesh);
                viewer.mesh.geometry.dispose();
                viewer.mesh.material.dispose();
                viewer.mesh = null;
            }
        });
    }
}

function getComparisonView() {
    if (!comparisonView) {
        comparisonView = new ComparisonView(queryViewer, matchViewer);
    }

    return comparisonView;
}

function clearComparison() {
    comparisonPanel.classList.add("hidden");
    comparisonScore.textContent = "Similarity Score: --";

    if (comparisonView) {
        comparisonView.clear();
    }
}

async function renderComparison(bestResult) {
    if (!bestResult || !currentQueryFile) {
        clearComparison();
        return;
    }

    try {
        // Handle both old format (array) and new format (object with metadata)
        let filename, similarity;
        if (typeof bestResult === 'object' && !Array.isArray(bestResult)) {
            // New format: {filename, similarity, metadata}
            filename = bestResult.filename;
            similarity = bestResult.similarity;
        } else {
            // Old format: [filename, similarity]
            filename = bestResult[0];
            similarity = bestResult[1];
        }

        const loader = new STLLoader();
        const queryBuffer = await currentQueryFile.arrayBuffer();
        const matchBuffer = await window.electronAPI.readStlFile(
            getDatasetPath(),
            filename
        );

        const queryGeometry = loader.parse(queryBuffer);
        const matchGeometry = loader.parse(matchBuffer);
        const score = (similarity * 100).toFixed(2);

        comparisonPanel.classList.remove("hidden");
        comparisonScore.textContent = `Similarity Score: ${score}%`;
        getComparisonView().setModels(queryGeometry, matchGeometry);
    } catch (err) {
        clearComparison();
        showOutput("3D comparison unavailable: " + err.message);
    }
}

//  BACKEND HEALTH CHECK 

async function checkBackendStatus() {
    try {
        const res = await fetch(`${BACKEND}/`);
        if (res.ok) {
            backendStatus.textContent = "Backend: Online";
            backendStatus.className = "status-dot online";
        } else {
            throw new Error("Non-OK");
        }
    } catch {
        backendStatus.textContent = "Backend: Offline";
        backendStatus.className = "status-dot error";
    }
}

checkBackendStatus();
setInterval(checkBackendStatus, 15_000);

//  FILE DROP ZONE 

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.toLowerCase().endsWith(".stl")) {
        // Assign dropped file to the hidden input via DataTransfer
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        queryFile.files = dt.files;
        currentQueryFile = files[0];
        updateFileDisplay(files[0].name);
    } else {
        showOutput("Only .stl files are accepted.");
    }
});

queryFile.addEventListener("change", () => {
    if (queryFile.files.length > 0) {
        currentQueryFile = queryFile.files[0];
        updateFileDisplay(queryFile.files[0].name);
    }
});

function updateFileDisplay(name) {
    fileNameDisplay.textContent = name;
    dropZone.classList.add("has-file");
    hideOutput();
    queryDlLabel.textContent = name;
    queryDownloadBar.classList.remove("hidden");
}

//  SELECT DATASET FOLDER 

selectDatasetBtn.addEventListener("click", async () => {
    try {
        // Uses the safe bridge exposed by preload.js
        const folder = await window.electronAPI.selectFolder();
        if (folder) {
            datasetPathDisplay.value = folder;
        }
    } catch (err) {
        showOutput("ERROR: " + err.message);
    }
});

//  QUERY FILE DOWNLOAD 

queryDownloadBtn.addEventListener("click", () => {
    if (!currentQueryFile) return;
    const url = URL.createObjectURL(currentQueryFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentQueryFile.name;
    a.click();
    URL.revokeObjectURL(url);
});

//  CHECK CACHE 

checkCacheBtn.addEventListener("click", async () => {
    const datasetPath = getDatasetPath();
    if (!datasetPath) {
        showCacheInfo("Please select a dataset folder first.", "err");
        return;
    }

    try {
        checkCacheBtn.disabled = true;
        showCacheInfo("Checking...", "info");

        const res = await fetch(`${BACKEND}/cache-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset_path: datasetPath }),
        });
        const data = await res.json();

        if (data.error) {
            showCacheInfo(`Error: ${escapeHtml(data.error)}`, "err");
            return;
        }

        if (data.exists) {
            showCacheInfo(
                `Cache Found &nbsp;-&nbsp; Models: <strong>${data.models}</strong>`,
                "ok"
            );
        } else {
            showCacheInfo("No cache found for this dataset.", "err");
        }
    } catch (err) {
        showCacheInfo(escapeHtml(err.message), "err");
    } finally {
        checkCacheBtn.disabled = false;
    }
});

//  BUILD CACHE 

buildCacheBtn.addEventListener("click", async () => {
    const datasetPath = getDatasetPath();
    if (!datasetPath) {
        showOutput("Please select a dataset folder first.");
        return;
    }

    try {
        setButtonsDisabled(true);
        showCacheInfo("Building cache - this may take a few minutes...", "info");
        hideOutput();

        const res = await fetch(`${BACKEND}/build-cache`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset_path: datasetPath }),
        });
        const data = await res.json();

        if (data.error) {
            showCacheInfo(`Build failed: ${escapeHtml(data.error)}`, "err");
            showOutput(JSON.stringify(data, null, 2));
            return;
        }

        const count = data.valid_files ?? data.models ?? "?";
        showCacheInfo(
            `Cache Built &nbsp;-&nbsp; Models indexed: <strong>${count}</strong>`,
            "ok"
        );
    } catch (err) {
        showCacheInfo(escapeHtml(err.message), "err");
        showOutput("ERROR: " + err.message);
    } finally {
        setButtonsDisabled(false);
    }
});

//  DELETE CACHE 

deleteCacheBtn.addEventListener("click", async () => {
    const datasetPath = getDatasetPath();
    if (!datasetPath) {
        showOutput("Please select a dataset folder first.");
        return;
    }

    try {
        setButtonsDisabled(true);
        showCacheInfo("Deleting cache...", "info");

        const res = await fetch(`${BACKEND}/delete-cache`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset_path: datasetPath }),
        });
        const data = await res.json();

        if (data.error) {
            showCacheInfo(`Delete failed: ${escapeHtml(data.error)}`, "err");
            return;
        }

        showCacheInfo(
            data.success
                ? "Cache Deleted"
                : "Cache not found / already deleted",
            "err"
        );
    } catch (err) {
        showCacheInfo(escapeHtml(err.message), "err");
        showOutput("ERROR: " + err.message);
    } finally {
        setButtonsDisabled(false);
    }
});

//  SEARCH 

searchBtn.addEventListener("click", async () => {
    const file = queryFile.files[0];
    if (!file) {
        showOutput("Please select an STL file.");
        return;
    }

    const datasetPath = getDatasetPath();
    if (!datasetPath) {
        showOutput("Please select a dataset folder.");
        return;
    }

    try {
        setButtonsDisabled(true);
        searchBtnText.textContent = "Searching...";
        searchSpinner.classList.remove("hidden");
        hideOutput();
        clearResults();
        clearComparison();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("dataset_path", datasetPath);

        const res = await fetch(`${BACKEND}/search`, {
            method: "POST",
            body: formData,
        });
        const data = await res.json();

        if (data.error) {
            showOutput("Error: " + data.error);
            return;
        }

        // Store results for export
        currentSearchResults = data.results;
        currentQueryFilename = data.query_file || (file ? file.name : 'query.stl');
        currentSearchTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

        renderResults(data.results);
        await renderComparison(data.results && data.results[0]);
    } catch (err) {
        showOutput("ERROR: " + err.message);
    } finally {
        setButtonsDisabled(false);
        searchBtnText.textContent = "Run Similarity Search";
        searchSpinner.classList.add("hidden");
    }
});

//  RESULTS 

function clearResults() {
    resultsBody.innerHTML = `
        <tr class="empty-row">
            <td colspan="5"><span class="empty-msg">searching</span></td>
        </tr>`;
    
    // Clear export data and disable buttons
    currentSearchResults = null;
    currentQueryFilename = null;
    currentSearchTimestamp = null;
    updateExportButtons();
}

function updateExportButtons() {
    const hasResults = currentSearchResults && currentSearchResults.length > 0;
    exportCsvBtn.disabled = !hasResults;
    exportPdfBtn.disabled = !hasResults;
    
    if (hasResults) {
        exportCsvBtn.title = "Export results as CSV";
        exportPdfBtn.title = "Export results as PDF";
    } else {
        exportCsvBtn.title = "No results to export";
        exportPdfBtn.title = "No results to export";
    }
}

function renderResults(results) {
    if (!results || results.length === 0) {
        resultsBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5"><span class="empty-msg">no results found</span></td>
            </tr>`;
        
        // Clear export data
        currentSearchResults = null;
        updateExportButtons();
        return;
    }

    resultsBody.innerHTML = "";

    results.forEach((result, index) => {
        const rank = index + 1;
        
        // Handle both old format (array) and new format (object with metadata)
        let name, score, metadata;
        if (typeof result === 'object' && !Array.isArray(result)) {
            // New format: {filename, similarity, metadata}
            name = result.filename || 'N/A';
            score = result.similarity || 0;
            metadata = result.metadata || {};
        } else {
            // Old format: [filename, similarity]
            name = result[0];
            score = result[1];
            metadata = {};
        }
        
        const pct = (score * 100).toFixed(2);
        const barWidth = Math.min(100, Math.max(0, parseFloat(pct)));
        const rankClass = rank <= 3 ? `rank-${rank}` : "";

        // Build metadata tooltip
        let tooltipText = `${name}\n`;
        if (metadata.vertex_count) tooltipText += `Vertices: ${metadata.vertex_count.toLocaleString()}\n`;
        if (metadata.face_count) tooltipText += `Faces: ${metadata.face_count.toLocaleString()}\n`;
        if (metadata.file_size_bytes) {
            const sizeMB = (metadata.file_size_bytes / (1024 * 1024)).toFixed(2);
            tooltipText += `Size: ${sizeMB} MB\n`;
        }
        if (metadata.watertight !== undefined) tooltipText += `Watertight: ${metadata.watertight ? 'Yes' : 'No'}`;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td style="text-align:center;">
                <span class="rank-badge ${rankClass}">${rank}</span>
            </td>
            <td>
                <span class="model-name" title="${escapeHtml(tooltipText)}">${escapeHtml(name)}</span>
                ${metadata.vertex_count ? `<br><small class="metadata-hint">${metadata.vertex_count.toLocaleString()} vertices</small>` : ''}
            </td>
            <td><span class="sim-value">${pct}%</span></td>
            <td>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${barWidth}%"></div>
                </div>
            </td>
            <td style="text-align:center;">
                <button class="btn-dl" title="Save ${escapeHtml(name)}" data-name="${escapeHtml(name)}">DL</button>
            </td>
        `;

        row.querySelector(".btn-dl").addEventListener("click", () => {
            downloadResultFile(name);
        });

        resultsBody.appendChild(row);
    });
    
    // Enable export buttons now that we have results
    updateExportButtons();
}

/**
 * Trigger a native save dialog to copy the result STL out of the dataset folder.
 */
async function downloadResultFile(filename) {

    const datasetPath = getDatasetPath();

    const fullPath = [datasetPath, filename]
        .join("/")
        .replace(/\\/g, "/");

    try {

        const savedPath =
            await window.electronAPI.saveFile(
                fullPath,
                filename
            );

        if (!savedPath) {
            return;
        }

        showOutput(
            `File saved successfully:\n${savedPath}`
        );

    } catch (err) {

        showOutput(
            `Download failed:\n${err.message}`
        );
    }
}

//  EXPORT HANDLERS 

async function exportReport(format) {
    if (!currentSearchResults || currentSearchResults.length === 0) {
        showOutput("No results to export");
        return;
    }

    try {
        // Disable export buttons during export
        exportCsvBtn.disabled = true;
        exportPdfBtn.disabled = true;

        const payload = {
            query_filename: currentQueryFilename,
            results: currentSearchResults,
            format: format,
            timestamp: currentSearchTimestamp,
            batch: false
        };

        const res = await fetch(`${BACKEND}/export-report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Export failed");
        }

        // Download the file
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        
        // Extract filename from Content-Disposition header or generate one
        const contentDisposition = res.headers.get("Content-Disposition");
        let filename = `qrcad_report_${currentQueryFilename.replace('.stl', '')}.${format}`;
        
        if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showOutput(`Report exported successfully: ${filename}`);
    } catch (err) {
        showOutput(`Export failed: ${err.message}`);
    } finally {
        // Re-enable export buttons
        updateExportButtons();
    }
}

exportCsvBtn.addEventListener("click", () => exportReport("csv"));
exportPdfBtn.addEventListener("click", () => exportReport("pdf"));

