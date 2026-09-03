const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
    "electronAPI",
    {
        selectFolder: () =>
            ipcRenderer.invoke("select-folder"),

        saveFile: (sourcePath, filename) =>
            ipcRenderer.invoke(
                "save-file",
                sourcePath,
                filename
            ),
        
        readSTLFile: (filepath) =>
            ipcRenderer.invoke("read-stl-file", filepath),
        
        getQueriesPath: () =>
            ipcRenderer.invoke("get-queries-path"),
        
        getAppVersion: () =>
            ipcRenderer.invoke("get-app-version"),
        
        openLogsFolder: () =>
            ipcRenderer.invoke("open-logs-folder")
    }
);
