/**
 * CameraSync.js - Synchronized Camera State Manager
 * Ensures both viewers (Query and Best Match) have identical camera views
 */

export class CameraSync {
    constructor() {
        this.cameraState = {
            position: { x: 5, y: 5, z: 5 },
            target: { x: 0, y: 0, z: 0 },
            up: { x: 0, y: 1, z: 0 }
        };
        this.listeners = [];
    }

    /**
     * Update camera state and notify all listeners
     */
    setCameraState(state) {
        this.cameraState = {
            position: {
                x: state.position.x,
                y: state.position.y,
                z: state.position.z
            },
            target: {
                x: state.target.x,
                y: state.target.y,
                z: state.target.z
            },
            up: {
                x: state.up.x,
                y: state.up.y,
                z: state.up.z
            }
        };

        this.listeners.forEach(listener => listener(this.cameraState));
    }

    /**
     * Subscribe to camera state changes
     */
    onStateChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Get current camera state
     */
    getState() {
        return this.cameraState;
    }

    /**
     * Reset to default state
     */
    reset() {
        this.setCameraState({
            position: { x: 5, y: 5, z: 5 },
            target: { x: 0, y: 0, z: 0 },
            up: { x: 0, y: 1, z: 0 }
        });
    }
}

// Global instance
let cameraSync = null;

export function getCameraSync() {
    if (!cameraSync) {
        cameraSync = new CameraSync();
    }
    return cameraSync;
}
