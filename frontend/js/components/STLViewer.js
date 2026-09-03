/**
 * STLViewer.js - Reusable 3D STL Viewer Component
 * Commercial-grade Three.js implementation with camera synchronization
 * 
 * Features:
 * - Automatic model centering and scaling
 * - Synchronized camera state via global context
 * - Professional lighting setup
 * - Memory leak prevention
 * - Responsive to viewport changes
 */

import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { STLLoader } from '../vendor/STLLoader.js';

export class STLViewer {
    constructor(containerId, title = 'Model', cameraSync = null) {
        this.containerId = containerId;
        this.title = title;
        this.cameraSync = cameraSync; // Shared camera state
        
        // Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentMesh = null;
        this.helpers = { axes: null, box: null };
        
        // State
        this.isInitialized = false;
        this.isLoading = false;
        this.currentUrl = null;
        
        // Lifecycle
        this.animationFrameId = null;
        this.resizeObserver = null;
        
        // Materials (reuse for performance)
        // Smooth CAD-like material without PBR effects
        this.meshMaterial = new THREE.MeshPhongMaterial({
            color: 0xf0f0f0, // Light gray like SolidWorks
            shininess: 80, // Professional matte finish
            side: THREE.FrontSide,
            flatShading: false
        });
    }

    /**
     * Initialize the viewer (must be called before rendering)
     */
    async init() {
        if (this.isInitialized) return true;

        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`[STLViewer] Container #${this.containerId} not found`);
            return false;
        }

        // Ensure container has dimensions
        await this._waitForContainerSize(container);

        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        console.log(`[STLViewer] Initializing ${this.title} at ${width}x${height}`);

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        // Camera
        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(width, height);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);

        // Lighting setup (professional grade)
        this._setupLighting();

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.screenSpacePanning = true;
        this.controls.autoRotate = false;
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;

        // Sync camera if context provided
        if (this.cameraSync) {
            this.controls.addEventListener('change', () => this._syncCamera());
        }

        // Resize observer
        this.resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => this._handleResize());
        });
        this.resizeObserver.observe(container);

        // Start render loop
        this._startRenderLoop();

        this.isInitialized = true;
        return true;
    }

    /**
     * Load STL model from URL
     */
    async loadModel(url) {
        if (!this.isInitialized) {
            console.error('[STLViewer] Viewer not initialized');
            return false;
        }

        if (url === this.currentUrl && this.currentMesh) {
            return true; // Already loaded
        }

        this.isLoading = true;
        this._showLoading();

        try {
            const arrayBuffer = await window.electronAPI.readSTLFile(url);
            if (!arrayBuffer) {
                throw new Error('File read returned empty');
            }

            const loader = new STLLoader();
            const geometry = loader.parse(arrayBuffer);
            geometry.computeVertexNormals();
            geometry.center();

            // Remove old mesh
            if (this.currentMesh) {
                this.scene.remove(this.currentMesh);
                this.currentMesh.geometry.dispose();
            }

            // Create new mesh
            this.currentMesh = new THREE.Mesh(geometry, this.meshMaterial);
            this.scene.add(this.currentMesh);

            // Update helpers
            this._updateHelpers();

            // Frame camera
            this._frameCamera();

            // Remove loading state
            this._hideLoading();

            this.currentUrl = url;
            this.isLoading = false;

            console.log(`[STLViewer] Loaded: ${url}`);
            return true;

        } catch (err) {
            console.error(`[STLViewer] Load error:`, err);
            this._showError(err.message);
            this.isLoading = false;
            return false;
        }
    }

    /**
     * Load from File object (for immediate preview)
     */
    async loadFromFile(file) {
        if (!this.isInitialized) {
            console.error('[STLViewer] Viewer not initialized');
            return false;
        }

        this.isLoading = true;
        this._showLoading();

        try {
            const arrayBuffer = await file.arrayBuffer();
            const loader = new STLLoader();
            const geometry = loader.parse(arrayBuffer);
            geometry.computeVertexNormals();
            geometry.center();

            if (this.currentMesh) {
                this.scene.remove(this.currentMesh);
                this.currentMesh.geometry.dispose();
            }

            this.currentMesh = new THREE.Mesh(geometry, this.meshMaterial);
            this.scene.add(this.currentMesh);

            this._updateHelpers();
            this._frameCamera();
            this._hideLoading();

            this.currentUrl = file.name;
            this.isLoading = false;

            console.log(`[STLViewer] Loaded file: ${file.name}`);
            return true;

        } catch (err) {
            console.error('[STLViewer] File load error:', err);
            this._showError(err.message);
            this.isLoading = false;
            return false;
        }
    }

    /**
     * Clear the current model
     */
    clear() {
        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            this.currentMesh.geometry.dispose();
            this.currentMesh = null;
        }
        this._removeHelpers();
        this.currentUrl = null;
        this._showPlaceholder();
    }

    /**
     * Apply synchronized camera state
     */
    applyCamera(state) {
        if (!state || !this.controls) return;

        this.camera.position.copy(state.position);
        this.camera.up.copy(state.up);
        this.controls.target.copy(state.target);
        this.controls.update();
    }

    /**
     * Dispose all resources
     */
    dispose() {
        console.log(`[STLViewer] Disposing ${this.title}`);

        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        // Stop resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        // Dispose mesh
        if (this.currentMesh) {
            this.currentMesh.geometry.dispose();
            this.currentMesh = null;
        }

        // Dispose material
        if (this.meshMaterial) {
            this.meshMaterial.dispose();
        }

        // Dispose helpers
        this._removeHelpers();

        // Dispose controls
        if (this.controls) {
            this.controls.dispose();
        }

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.remove();
            }
        }

        this.isInitialized = false;
    }

    // ========== PRIVATE METHODS ==========

    /**
     * Setup professional lighting
     */
    _setupLighting() {
        // Ambient light (fill the scene)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Main directional light (key light)
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
        keyLight.position.set(5, 8, 5);
        this.scene.add(keyLight);

        // Secondary directional light (fill light)
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 3, -5);
        this.scene.add(fillLight);
    }

    /**
     * Update axis and bounding box helpers
     */
    _updateHelpers() {
        this._removeHelpers();

        if (!this.currentMesh) return;

        const bbox = new THREE.Box3().setFromObject(this.currentMesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        // Axes helper (smaller and more subtle)
        this.helpers.axes = new THREE.AxesHelper(maxDim * 0.3);
        this.scene.add(this.helpers.axes);

        // Bounding box helper (subtle gray)
        this.helpers.box = new THREE.BoxHelper(this.currentMesh, 0xcccccc);
        this.scene.add(this.helpers.box);

        // Add edge outlines for better feature visibility
        try {
            const edges = new THREE.EdgesGeometry(this.currentMesh.geometry, 25); // 25 degree threshold
            const wireframe = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({ color: 0x999999, linewidth: 1, transparent: true, opacity: 0.4 })
            );
            this.currentMesh.add(wireframe);
        } catch (err) {
            console.warn('[STLViewer] Could not create edge geometry:', err);
        }
    }

    /**
     * Remove helpers
     */
    _removeHelpers() {
        if (this.helpers.axes) {
            this.scene.remove(this.helpers.axes);
            this.helpers.axes = null;
        }
        if (this.helpers.box) {
            this.scene.remove(this.helpers.box);
            this.helpers.box = null;
        }
    }

    /**
     * Frame camera to fit model
     */
    _frameCamera() {
        if (!this.currentMesh) return;

        const bbox = new THREE.Box3().setFromObject(this.currentMesh);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        const fovRad = (this.camera.fov * Math.PI) / 180;
        const dist = (maxDim / 2) / Math.tan(fovRad / 2) * 2.2;

        this.camera.position.set(
            center.x + dist * 0.6,
            center.y + dist * 0.5,
            center.z + dist * 0.8
        );

        this.camera.near = dist * 0.001;
        this.camera.far = dist * 100;
        this.camera.updateProjectionMatrix();
        this.camera.lookAt(center);

        this.controls.target.copy(center);
        this.controls.minDistance = dist * 0.1;
        this.controls.maxDistance = dist * 20;
        this.controls.update();
    }

    /**
     * Sync camera state to global context
     */
    _syncCamera() {
        if (!this.cameraSync) return;

        this.cameraSync.setCameraState({
            position: this.camera.position.clone(),
            target: this.controls.target.clone(),
            up: this.camera.up.clone()
        });
    }

    /**
     * Handle window resize
     */
    _handleResize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Start animation loop
     */
    _startRenderLoop() {
        const loop = () => {
            this.animationFrameId = requestAnimationFrame(loop);
            if (this.controls) this.controls.update();
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        loop();
    }

    /**
     * Wait for container to have valid dimensions
     */
    async _waitForContainerSize(el, maxMs = 2000) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    resolve();
                    return;
                }
                if (Date.now() - start > maxMs) {
                    console.warn(`[STLViewer] Timeout waiting for container size`);
                    resolve();
                    return;
                }
                requestAnimationFrame(() => setTimeout(check, 0));
            };
            check();
        });
    }

    /**
     * UI overlays
     */
    _showLoading() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        let overlay = container.querySelector('.stl-viewer-loading');
        if (overlay) overlay.remove();

        const div = document.createElement('div');
        div.className = 'stl-viewer-loading';
        div.innerHTML = `
            <div class="stl-spinner"></div>
            <div>Loading STL...</div>
        `;
        container.appendChild(div);
    }

    _hideLoading() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        const overlay = container.querySelector('.stl-viewer-loading');
        if (overlay) overlay.remove();
    }

    _showError(message) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        let overlay = container.querySelector('.stl-viewer-error');
        if (overlay) overlay.remove();

        const div = document.createElement('div');
        div.className = 'stl-viewer-error';
        div.textContent = `Error: ${message}`;
        container.appendChild(div);
    }

    _showPlaceholder() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        let placeholder = container.querySelector('.stl-viewer-placeholder');
        if (placeholder) return;

        const div = document.createElement('div');
        div.className = 'stl-viewer-placeholder';
        div.innerHTML = `
            <div class="stl-placeholder-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
                    <path d="M8 12l2 2 4-4"></path>
                </svg>
            </div>
            <div class="stl-placeholder-title">Upload STL Model</div>
            <div class="stl-placeholder-subtitle">Drag & Drop or Browse</div>
            <div class="stl-placeholder-hint">Supported Format: .STL</div>
        `;
        container.appendChild(div);
    }
}
