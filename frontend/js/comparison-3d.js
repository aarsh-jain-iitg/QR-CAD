/**

 * QRCAD v2.0 - 3D Comparison Viewer

 * Three.js-based interactive 3D viewer for Query and Best Match models

 */



import * as THREE from '../vendor/three.module.js';

import { OrbitControls } from '../vendor/OrbitControls.js';

import { STLLoader } from '../vendor/STLLoader.js';

import { createViewerToolbar, syncViewerToolbarActive } from './components/ViewerToolbar.js';

import { VIEWER_THEME } from './viewer-theme.js';



function createBrushedMetalMaterial() {

    return new THREE.MeshStandardMaterial({

        color: VIEWER_THEME.material.color,

        metalness: VIEWER_THEME.material.metalness,

        roughness: VIEWER_THEME.material.roughness,

        flatShading: false,

        side: THREE.FrontSide,

    });

}



function addAccentEdges(mesh, accentColor) {

    const edges = new THREE.EdgesGeometry(mesh.geometry, 20);

    const edgeLines = new THREE.LineSegments(

        edges,

        new THREE.LineBasicMaterial({ color: accentColor, linewidth: 1 })

    );

    mesh.add(edgeLines);

    return edgeLines;

}



class ModelViewer {

    constructor(containerId, accentColor = VIEWER_THEME.accent.query) {

        this.containerId = containerId;

        this.container = null;

        this.accentColor = accentColor;



        this.scene = null;

        this.camera = null;

        this.renderer = null;

        this.controls = null;

        this.animationFrameId = null;



        this.currentMesh = null;

        this.axesHelper = null;

        this.boxHelper = null;

        this.gridHelper = null;

        this.toolbar = null;



        this.isInitialized = false;

        this.resizeObserver = null;

        this._lastBbox = null;

        this._showAxes = true;

        this._wireframe = false;

        this._defaultCameraPosition = null;

        this._defaultControlsTarget = null;

    }



    waitForSize(el, maxMs = 2000) {

        return new Promise((resolve) => {

            const start = Date.now();

            const check = () => {

                const r = el.getBoundingClientRect();

                if (r.width > 0 && r.height > 0) {

                    resolve({ width: r.width, height: r.height });

                    return;

                }

                if (Date.now() - start > maxMs) {

                    console.warn(`[3D Viewer] ${this.containerId}: timed out waiting for nonzero size`);

                    resolve(null);

                    return;

                }

                requestAnimationFrame(() => setTimeout(check, 0));

            };

            check();

        });

    }



    async init() {

        if (this.isInitialized) return true;



        this.container = document.getElementById(this.containerId);

        if (!this.container) {

            console.error(`[3D Viewer] Container #${this.containerId} not found`);

            return false;

        }



        this.container.style.position = 'relative';

        this.container.style.overflow = 'hidden';



        const size = await this.waitForSize(this.container);

        if (!size) return false;



        console.log(`[3D Viewer] Init ${this.containerId} at ${size.width}x${size.height}`);



        this.scene = new THREE.Scene();

        this.scene.background = new THREE.Color(VIEWER_THEME.background);



        this.camera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.01, 10000);

        this.camera.position.set(5, 5, 5);

        this.camera.lookAt(0, 0, 0);



        this.renderer = new THREE.WebGLRenderer({

            antialias: true,

            alpha: false,

            powerPreference: 'high-performance',

        });

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.renderer.setSize(size.width, size.height);

        this.renderer.shadowMap.enabled = true;

        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

        this.renderer.toneMappingExposure = 1.05;



        const canvas = this.renderer.domElement;

        canvas.style.position = 'absolute';

        canvas.style.top = '0';

        canvas.style.left = '0';

        canvas.style.width = '100%';

        canvas.style.height = '100%';

        canvas.style.display = 'block';



        this.container.innerHTML = '';

        this.container.appendChild(canvas);



        this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));



        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8ebf0, 0.35);

        hemiLight.position.set(0, 20, 0);

        this.scene.add(hemiLight);



        const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);

        keyLight.position.set(8, 12, 6);

        keyLight.castShadow = true;

        keyLight.shadow.mapSize.set(1024, 1024);

        this.scene.add(keyLight);



        const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);

        fillLight.position.set(-6, 4, -4);

        this.scene.add(fillLight);



        const rimLight = new THREE.DirectionalLight(0xffffff, 0.25);

        rimLight.position.set(0, 6, -10);

        this.scene.add(rimLight);



        this.gridHelper = new THREE.GridHelper(40, 40, VIEWER_THEME.gridCenter, VIEWER_THEME.gridLine);

        this.gridHelper.position.y = 0;

        this.scene.add(this.gridHelper);



        this.controls = new OrbitControls(this.camera, canvas);

        this.controls.enableDamping = true;

        this.controls.dampingFactor = 0.08;

        this.controls.screenSpacePanning = true;

        this.controls.autoRotate = false;

        this.controls.rotateSpeed = 1.0;

        this.controls.zoomSpeed = 1.2;

        this.controls.panSpeed = 0.8;

        this.controls.minPolarAngle = 0;

        this.controls.maxPolarAngle = Math.PI;



        this.resizeObserver = new ResizeObserver(() => {

            requestAnimationFrame(() => this._onResize());

        });

        this.resizeObserver.observe(this.container);



        this._startLoop();

        this.isInitialized = true;

        this._createToolbar();

        return true;

    }



    _createToolbar() {

        this.toolbar = createViewerToolbar(this.container, {

            onAction: (action) => this._handleToolbarAction(action),

            isActive: (action) => action === 'wireframe' && this._wireframe,

        });

    }



    _handleToolbarAction(action) {

        if (action === 'reset') this.resetCamera();

        else if (action === 'fit') this.fitView();

        else if (action === 'zoom-in') this._zoom(0.8);

        else if (action === 'zoom-out') this._zoom(1.25);

        else if (action === 'wireframe') this.toggleWireframe();

    }



    _zoom(factor) {

        const offset = this.camera.position.clone().sub(this.controls.target);

        offset.multiplyScalar(factor);

        this.camera.position.copy(this.controls.target).add(offset);

        this.controls.update();

    }



    resetCamera() {

        if (this._defaultCameraPosition && this._defaultControlsTarget) {

            this.camera.position.copy(this._defaultCameraPosition);

            this.controls.target.copy(this._defaultControlsTarget);

            this.controls.update();

        } else if (this._lastBbox) {

            this._frameCamera(this._lastBbox);

        } else {

            this.camera.position.set(5, 5, 5);

            this.controls.target.set(0, 0, 0);

            this.controls.update();

        }

    }



    fitView() {

        if (this._lastBbox) this._frameCamera(this._lastBbox);

    }



    toggleWireframe() {

        this._wireframe = !this._wireframe;

        if (this.currentMesh?.material) {

            this.currentMesh.material.wireframe = this._wireframe;

        }

        if (this.boxHelper) {

            this.boxHelper.visible = this._wireframe;

        }

        syncViewerToolbarActive(this.toolbar, (action) => action === 'wireframe' && this._wireframe);

    }



    _startLoop() {

        const loop = () => {

            this.animationFrameId = requestAnimationFrame(loop);

            if (this.controls) this.controls.update();

            if (this.renderer && this.scene && this.camera) {

                this.renderer.render(this.scene, this.camera);

            }

        };

        loop();

    }



    _onResize() {

        if (!this.isInitialized || !this.container) return;

        const r = this.container.getBoundingClientRect();

        if (r.width === 0 || r.height === 0) return;

        this.camera.aspect = r.width / r.height;

        this.camera.updateProjectionMatrix();

        this.renderer.setSize(r.width, r.height);

    }



    clearModel() {

        if (this.currentMesh) {

            this.scene.remove(this.currentMesh);

            this.currentMesh.geometry.dispose();

            if (this.currentMesh.material) this.currentMesh.material.dispose();

            this.currentMesh.traverse((child) => {

                if (child.geometry) child.geometry.dispose();

                if (child.material) child.material.dispose();

            });

            this.currentMesh = null;

        }

        if (this.axesHelper) {

            this.scene.remove(this.axesHelper);

            this.axesHelper.dispose?.();

            this.axesHelper = null;

        }

        if (this.boxHelper) {

            this.scene.remove(this.boxHelper);

            this.boxHelper = null;

        }

        this._wireframe = false;

        syncViewerToolbarActive(this.toolbar, () => false);

    }



    _applyLoadedMesh(geometry) {
        const material = createBrushedMetalMaterial();
        material.wireframe = this._wireframe;

        this.currentMesh = new THREE.Mesh(geometry, material);
        this.currentMesh.castShadow = true;
        this.currentMesh.receiveShadow = true;
        addAccentEdges(this.currentMesh, this.accentColor);
        this.scene.add(this.currentMesh);

        const bbox = new THREE.Box3().setFromObject(this.currentMesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;



        this.axesHelper = new THREE.AxesHelper(maxDim * 0.7);

        this.scene.add(this.axesHelper);



        this.boxHelper = new THREE.BoxHelper(this.currentMesh, this.accentColor);

        this.boxHelper.visible = this._wireframe;

        this.scene.add(this.boxHelper);



        if (this.gridHelper) {

            const gridSize = Math.max(maxDim * 3, 20);

            this.scene.remove(this.gridHelper);
            this.gridHelper.geometry?.dispose();
            this.gridHelper.material?.dispose();

            this.gridHelper = new THREE.GridHelper(

                gridSize,

                Math.min(40, Math.max(10, Math.round(gridSize / 2))),

                VIEWER_THEME.gridCenter,

                VIEWER_THEME.gridLine

            );

            this.gridHelper.position.y = bbox.min.y;

            this.scene.add(this.gridHelper);

        }



        this._lastBbox = bbox;

        this._frameCamera(bbox);

        this._defaultCameraPosition = this.camera.position.clone();

        this._defaultControlsTarget = this.controls.target.clone();

    }



    async loadModelFromBuffer(arrayBuffer, filename = 'model.stl') {

        if (!this.isInitialized) {

            console.error(`[3D Viewer] ${this.containerId}: not initialized`);

            return false;

        }



        this.clearModel();

        this._showLoading();



        console.log(`[3D Viewer] Loading from buffer: ${filename}`);



        try {

            const loader = new STLLoader();

            const geometry = loader.parse(arrayBuffer);

            geometry.computeVertexNormals();
            this._applyLoadedMesh(geometry);
            this.container.querySelector('.viewer-loading')?.remove();
            return true;
        } catch (err) {
            console.error('[3D Viewer] Load from buffer failed:', err);

            this._showError(`Load failed: ${err.message}`);

            return false;

        }

    }



    async loadModel(filepath, datasetPath, isFullPath = false) {

        if (!this.isInitialized) {

            console.error(`[3D Viewer] ${this.containerId}: not initialized`);

            return false;

        }



        this.clearModel();

        this._showLoading();



        const fullPath = isFullPath

            ? filepath

            : `${datasetPath}/${filepath}`.replace(/\\/g, '/');



        console.log(`[3D Viewer] Loading: ${fullPath}`);



        try {

            const arrayBuffer = await window.electronAPI.readSTLFile(fullPath);

            if (!arrayBuffer) {

                throw new Error('File not found or could not be read');

            }



            const loader = new STLLoader();

            const geometry = loader.parse(arrayBuffer);

            geometry.computeVertexNormals();
            this._applyLoadedMesh(geometry);
            this.container.querySelector('.viewer-loading')?.remove();
            return true;
        } catch (err) {
            console.error('[3D Viewer] Load failed:', err);
            console.error('[3D Viewer] Attempted path:', fullPath);
            console.error('[3D Viewer] Dataset path:', datasetPath);
            console.error('[3D Viewer] Relative filename:', filepath);
            this._showError(`Model file not found: ${filepath}\n(Full path: ${fullPath})`);
            return false;
        }

    }



    _frameCamera(bbox) {

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



    _showLoading() {

        this.container.querySelector('.viewer-loading')?.remove();



        const div = document.createElement('div');

        div.className = 'viewer-loading';

        div.textContent = 'Loading model...';

        this.container.appendChild(div);

    }



    _showError(msg) {

        this.container.querySelector('.viewer-loading')?.remove();



        const div = document.createElement('div');

        div.className = 'viewer-error';

        div.innerHTML = `<div class="viewer-error-icon">⚠</div>

                         <strong>Model Load Error</strong>

                         <div class="viewer-error-detail">${msg}</div>`;

        this.container.appendChild(div);

    }



    _showPlaceholder() {

        this.container.querySelector('.viewer-loading')?.remove();



        const div = document.createElement('div');

        div.className = 'viewer-placeholder';

        div.innerHTML = `<div class="viewer-placeholder-icon">◇</div>

                         <div>No query file loaded</div>

                         <div class="viewer-placeholder-hint">Please upload an STL file</div>`;

        this.container.appendChild(div);

    }



    dispose() {

        console.log(`[3D Viewer] Disposing ${this.containerId}`);



        if (this.animationFrameId) {

            cancelAnimationFrame(this.animationFrameId);

            this.animationFrameId = null;

        }

        if (this.resizeObserver) {

            this.resizeObserver.disconnect();

            this.resizeObserver = null;

        }



        this.clearModel();



        if (this.gridHelper) {

            this.scene?.remove(this.gridHelper);

            this.gridHelper.geometry?.dispose();

            this.gridHelper.material?.dispose();

            this.gridHelper = null;

        }



        if (this.controls) { this.controls.dispose(); this.controls = null; }

        if (this.renderer) {

            this.renderer.dispose();

            this.renderer.domElement.remove();

            this.renderer = null;

        }



        this.scene = null;

        this.camera = null;

        this.isInitialized = false;

    }

}





export class ComparisonViewer {

    constructor() {

        this.queryViewer = null;

        this.bestMatchViewer = null;

        this.datasetPath = null;

        this.currentQueryBuffer = null;

        this.currentQueryFilename = null;

    }



    async init(datasetPath) {

        this.datasetPath = datasetPath;



        this.queryViewer = new ModelViewer('viewer-query', VIEWER_THEME.accent.query);

        this.bestMatchViewer = new ModelViewer('viewer-match', VIEWER_THEME.accent.match);



        const [q, m] = await Promise.all([

            this.queryViewer.init(),

            this.bestMatchViewer.init(),

        ]);



        if (!q || !m) {

            console.error('[ComparisonViewer] One or both panels failed to init');

            return false;

        }



        console.log('[ComparisonViewer] Both viewers initialized independently');

        return true;

    }



    async loadQueryFromFile(file) {

        if (!this.queryViewer || !file) return false;



        console.log(`[ComparisonViewer] Loading query from file: ${file.name} (in-memory)`);



        try {

            const arrayBuffer = await file.arrayBuffer();

            this.currentQueryBuffer = arrayBuffer;

            this.currentQueryFilename = file.name;



            const success = await this.queryViewer.loadModelFromBuffer(arrayBuffer, file.name);

            if (success) {

                console.log('[ComparisonViewer] Query loaded successfully (in-memory)');

            }

            return success;

        } catch (err) {

            console.error('[ComparisonViewer] Failed to load query from file:', err);

            this.queryViewer._showError(`Failed to load: ${err.message}`);

            return false;

        }

    }



    async loadBestMatch(filepath) {

        if (!this.bestMatchViewer) return false;

        return this.bestMatchViewer.loadModel(filepath, this.datasetPath, false);

    }



    clearQuery() {

        if (this.queryViewer) {

            this.queryViewer.clearModel();

            this.currentQueryBuffer = null;

            this.currentQueryFilename = null;

            console.log('[ComparisonViewer] Query cleared');

        }

    }



    dispose() {

        if (this.queryViewer) {

            this.queryViewer.dispose();

            this.queryViewer = null;

        }

        if (this.bestMatchViewer) {

            this.bestMatchViewer.dispose();

            this.bestMatchViewer = null;

        }



        this.datasetPath = null;

        this.currentQueryBuffer = null;

        this.currentQueryFilename = null;



        console.log('[ComparisonViewer] Disposed both viewers');

    }

}

