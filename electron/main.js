const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    shell,
    Menu
} = require("electron");

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

let backendProcess = null;
let backendStartedByElectron = false;

// Centralized version from package.json
const APP_VERSION = app.getVersion();

// Detect production vs development
const IS_PRODUCTION = app.isPackaged;
const IS_DEVELOPMENT = !IS_PRODUCTION;

// AppData paths for user data
const APPDATA_DIR = path.join(app.getPath('appData'), 'QRCAD');
const CACHE_DIR = path.join(APPDATA_DIR, 'Cache');
const QUERIES_DIR = path.join(APPDATA_DIR, 'Queries');
const REPORTS_DIR = path.join(APPDATA_DIR, 'Reports');
const LOGS_DIR = path.join(APPDATA_DIR, 'Logs');
const CONFIG_DIR = path.join(APPDATA_DIR, 'Configuration');
const DATABASES_DIR = path.join(APPDATA_DIR, 'Databases');

/**
 * Ensure all AppData directories exist
 */
function ensureAppDataDirectories() {
    const dirs = [APPDATA_DIR, CACHE_DIR, QUERIES_DIR, REPORTS_DIR, LOGS_DIR, CONFIG_DIR, DATABASES_DIR];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`[QRCAD] Created directory: ${dir}`);
        }
    });
}

/**
 * Write log entry to electron.log
 */
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logPath = path.join(LOGS_DIR, 'electron.log');
    const logLine = `${timestamp} - ${message}\n`;
    
    try {
        fs.appendFileSync(logPath, logLine);
    } catch (err) {
        // Only log to console in development
        if (IS_DEVELOPMENT) {
            console.error('[QRCAD] Failed to write log:', err);
        }
    }
}

/**
 * Console log wrapper - only logs in development
 */
function devLog(message) {
    if (IS_DEVELOPMENT) {
        console.log(`[QRCAD] ${message}`);
    }
    logToFile(message);
}

/**
 * Console error wrapper - only logs in development
 */
function devError(message) {
    if (IS_DEVELOPMENT) {
        console.error(`[QRCAD] ${message}`);
    }
    logToFile(`ERROR: ${message}`);
}

/**
 * Check if backend is already running by pinging /health
 */
function checkBackendHealth() {
    return new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:5000/health', (res) => {
            resolve(res.statusCode === 200);
        });
        
        req.on('error', () => {
            resolve(false);
        });
        
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Poll backend /health endpoint until it responds or timeout
 */
async function waitForBackend(maxAttempts = 60, intervalMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        const isHealthy = await checkBackendHealth();
        if (isHealthy) {
            devLog(`Backend ready after ${i + 1} attempts`);
            logToFile(`Backend ready after ${(i + 1) * intervalMs}ms`);
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
}

/**
 * Start backend process
 */
function startBackend() {
    let backendPath;

    if (IS_PRODUCTION) {
        backendPath = path.join(
            process.resourcesPath,
            "backend",
            "qrcad_backend.exe"
        );
    } else {
        backendPath = path.join(
            __dirname,
            "..",
            "dist_backend",
            "qrcad_backend.exe"
        );
    }

    devLog(`Backend path: ${backendPath}`);

    // Validate backend exists
    if (!fs.existsSync(backendPath)) {
        const errorMsg = `Backend executable not found at: ${backendPath}`;
        devError(errorMsg);
        dialog.showErrorBox(
            'QRCAD - Backend Missing',
            `The backend executable was not found.\n\nExpected location:\n${backendPath}\n\nPlease reinstall the application.`
        );
        app.quit();
        return false;
    }

    // Spawn backend with hidden console and env vars
    backendProcess = spawn(
        backendPath,
        [],
        {
            detached: false,
            stdio: 'ignore',
            windowsHide: true,
            env: {
                ...process.env,
                QRCAD_CACHE_DIR: CACHE_DIR,
                QRCAD_QUERIES_DIR: QUERIES_DIR,
                QRCAD_REPORTS_DIR: REPORTS_DIR,
                QRCAD_LOGS_DIR: LOGS_DIR
            }
        }
    );

    backendStartedByElectron = true;

    backendProcess.on(
        "error",
        (err) => {
            devError(`Backend spawn error: ${err.message}`);
        }
    );

    backendProcess.on(
        "exit",
        (code) => {
            devLog(`Backend exited: ${code}`);
        }
    );
    
    devLog("Backend process started (hidden console)");
    return true;
}

/**
 * Create splash screen window
 */
function createSplashWindow() {
    const splash = new BrowserWindow({
        width: 400,
        height: 250,
        frame: false,
        transparent: false,
        resizable: false,
        skipTaskbar: true,
        center: true,
        backgroundColor: '#E50914',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: false
        }
    });
    
    // Inline data URI for splash screen
    const splashHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
            background: linear-gradient(135deg, #E50914 0%, #C90812 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: white;
        }
        .container {
            text-align: center;
            padding: 30px;
        }
        .logo {
            font-size: 48px;
            font-weight: 800;
            margin-bottom: 10px;
            letter-spacing: 2px;
        }
        .tagline {
            font-size: 13px;
            opacity: 0.9;
            margin-bottom: 10px;
            font-weight: 500;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        .version {
            font-size: 12px;
            opacity: 0.7;
            margin-bottom: 30px;
        }
        .status {
            font-size: 14px;
            opacity: 0.9;
            min-height: 20px;
        }
        .spinner {
            margin: 20px auto;
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">QRCAD</div>
        <div class="tagline">CAD Retrieval Platform</div>
        <div class="version">v${APP_VERSION}</div>
        <div class="spinner"></div>
        <div class="status" id="status">Initializing...</div>
    </div>
</body>
</html>
    `.trim();
    
    splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
    
    return splash;
}

/**
 * Create main application window
 */
function createWindow() {
    const iconPath = path.join(app.getAppPath(), "assets", "icon.ico");
    
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        show: false, // Don't show until ready
        center: true,
        backgroundColor: '#F6F7FB', // Match app background
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        title: 'QRCAD - CAD Retrieval Platform',
        webPreferences: {
            preload: path.join(
                app.getAppPath(),
                "electron",
                "preload.js"
            ),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: IS_DEVELOPMENT // Only allow DevTools in development
        }
    });

    // Remove menu bar completely
    Menu.setApplicationMenu(null);
    
    win.loadFile(
        path.join(
            app.getAppPath(),
            "frontend",
            "index.html"
        )
    );
    
    // Show window when ready with smooth fade-in
    win.once('ready-to-show', () => {
        win.show();
        win.focus();
    });
    
    // Development shortcuts (only in dev mode)
    if (IS_DEVELOPMENT) {
        // F12 to toggle DevTools
        win.webContents.on('before-input-event', (event, input) => {
            if (input.type === 'keyDown' && input.key === 'F12') {
                win.webContents.toggleDevTools();
            }
        });
        
        devLog('Development mode: F12 to toggle DevTools');
    }
    
    return win;
}

/**
 * Main startup sequence
 */
async function initializeApp() {
    devLog('Starting application...');
    logToFile('=== Application Starting ===');
    logToFile(`Version: ${APP_VERSION}`);
    logToFile(`Mode: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    logToFile(`Platform: ${process.platform} ${process.arch}`);
    
    // STEP 1: Ensure AppData directories exist
    try {
        ensureAppDataDirectories();
        logToFile('AppData directories verified');
    } catch (err) {
        devError(`Failed to create directories: ${err.message}`);
        dialog.showErrorBox(
            'QRCAD - Initialization Error',
            `Failed to create application directories:\n\n${err.message}`
        );
        app.quit();
        return;
    }
    
    // STEP 2: Create splash screen
    const splash = createSplashWindow();
    
    // STEP 3: Check if backend is already running
    devLog('Checking for existing backend...');
    logToFile('Checking for existing backend instance');
    
    const backendAlreadyRunning = await checkBackendHealth();
    
    if (backendAlreadyRunning) {
        devLog('Backend already running, reusing it');
        logToFile('Backend already running, reusing existing instance');
    } else {
        // STEP 4: Start backend
        devLog('Starting backend...');
        logToFile('Starting backend process');
        
        const backendStarted = startBackend();
        if (!backendStarted) {
            splash.close();
            return; // Error already shown
        }
        
        // STEP 5: Wait for backend to be healthy
        devLog('Waiting for backend...');
        logToFile('Waiting for backend to respond');
        
        const backendReady = await waitForBackend();
        
        if (!backendReady) {
            const errorMsg = 'Backend failed to start within 30 seconds.';
            devError(errorMsg);
            
            splash.close();
            
            dialog.showErrorBox(
                'QRCAD - Backend Timeout',
                `${errorMsg}\n\nPlease check the logs at:\n${LOGS_DIR}\n\nThen restart the application.`
            );
            
            app.quit();
            return;
        }
    }
    
    // STEP 6: Create main window
    devLog('Creating main window...');
    logToFile('Creating main window');
    
    const mainWindow = createWindow();
    
    // Close splash once main window is ready
    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            splash.close();
            logToFile('Application initialization complete');
        }, 500);
    });
}

// IPC Handlers

ipcMain.handle(
    "select-folder",
    async () => {
        const result =
            await dialog.showOpenDialog({
                properties: [
                    "openDirectory"
                ]
            });

        if (result.canceled) {
            return null;
        }

        return result.filePaths[0];
    }
);

ipcMain.handle(
    "save-file",
    async (_event, sourcePath, filename) => {
        const result =
            await dialog.showSaveDialog({
                defaultPath: filename
            });

        if (result.canceled) {
            return null;
        }

        fs.copyFileSync(
            sourcePath,
            result.filePath
        );

        return result.filePath;
    }
);

ipcMain.handle(
    "read-stl-file",
    async (_event, filepath) => {
        try {
            // Read file as buffer and return as ArrayBuffer
            const buffer = fs.readFileSync(filepath);
            return buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
            );
        } catch (err) {
            devError(`STL read error: ${err.message}`);
            throw err;
        }
    }
);

ipcMain.handle(
    "get-queries-path",
    async () => {
        // Return the path to the backend queries folder
        // In production, this is now in AppData
        return QUERIES_DIR;
    }
);

ipcMain.handle(
    "get-app-version",
    async () => {
        return APP_VERSION;
    }
);

ipcMain.handle(
    "open-logs-folder",
    async () => {
        shell.openPath(LOGS_DIR);
    }
);

// App lifecycle

app.whenReady().then(() => {
    initializeApp();
});

app.on(
    "window-all-closed",
    () => {
        // Kill backend only if we started it
        if (backendProcess && backendStartedByElectron) {
            devLog("Killing backend process");
            backendProcess.kill();
        } else {
            devLog("Leaving backend running (not started by us)");
        }

        app.quit();
    }
);

app.on(
    "before-quit",
    () => {
        // Ensure backend is killed on quit
        if (backendProcess && backendStartedByElectron) {
            backendProcess.kill();
        }
    }
);

// AUTO-UPDATE INSERTION POINT
// Future auto-update check would go here in app.whenReady():
// 1. Check for updates from a release server
// 2. Download new installer to temp directory  
// 3. Notify user and offer to install
// 4. User data in %APPDATA%/QRCAD/ is preserved automatically
// 5. New installer replaces files in Program Files without touching user data
