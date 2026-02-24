# Nexus — OS File Organizer

A desktop file explorer and disk-usage visualizer built as an **Operating Systems** course project. Every architectural decision maps to a core OS concept — process models, IPC, threading, file-system internals, memory management, security, and scheduling.

---

## 1. Why This Is an OS Project

An operating system does four things: **manage processes**, **manage memory**, **manage the file system**, and **protect resources**. Nexus demonstrates all four:

| OS Pillar | What Nexus Does |
|-----------|-----------------|
| Process management | Runs three execution contexts — main process, renderer process, worker thread — each with its own memory space and role. |
| Memory management | Renderer is sandboxed with its own V8 heap; main process holds the thumbnail cache (bounded LRU-style map); worker thread gets its own heap via `workerData` copy. |
| File system | Uses `readdir`, `stat`, `access`, `rename`, `rm`, `watch`, path resolution, recursive traversal with depth limits, and a journaled trash manifest. |
| Protection & security | Sandbox, context isolation, whitelisted IPC API, permission checks (`R_OK`), macOS Full Disk Access handling. |

---

## 2. Process Model — Main, Renderer, Worker

### 2.1 Multi-Process Architecture (like kernel + user space)

```
┌─────────────────────────────────────────────────┐
│                  Electron Shell                  │
│                                                  │
│  ┌──────────────┐     IPC      ┌──────────────┐ │
│  │ Main Process │◄────────────►│  Renderer    │ │
│  │ (Node.js)    │  invoke /    │  (Chromium)  │ │
│  │              │  handle      │  React UI    │ │
│  │  fs, path,   │              │  No fs, No   │ │
│  │  child_proc, │              │  Node access │ │
│  │  worker_thr  │              │              │ │
│  └──────┬───────┘              └──────────────┘ │
│         │ spawn                                  │
│  ┌──────▼───────┐                                │
│  │ Worker Thread │                               │
│  │ (disk scan)   │                               │
│  └───────────────┘                               │
└─────────────────────────────────────────────────┘
```

| Component | OS Analogy | What It Does |
|-----------|-----------|--------------|
| **Main process** | Kernel / privileged mode | Owns all system resources — file system, OS APIs, window management. Handles every IPC request from the renderer. Lives in `electron/main.ts`. |
| **Renderer process** | User-space application | Runs React UI inside a Chromium sandbox. Cannot touch `fs`, `path`, `child_process`, or any Node API. Communicates only via the preload bridge. Lives in `src/`. |
| **Worker thread** | Kernel thread / background worker | Spawned by main process for CPU/IO-heavy disk scanning. Has its own V8 isolate and heap. Communicates via `postMessage` (message passing). Lives in `electron/fileScanner.worker.ts`. |

**Why this matters for OS:** This is exactly how modern OSes separate kernel mode from user mode. The renderer (user mode) cannot perform privileged operations; it must request them from the main process (kernel) via IPC (system calls).

### 2.2 How a Worker Thread Is Spawned

```typescript
// electron/main.ts — spawning the worker
const worker = new Worker(path.join(__dirname, "fileScanner.worker.js"), {
  workerData: { dirPath, depth },   // data is COPIED, not shared
});
worker.once("message", (tree) => { resolve(tree); worker.terminate(); });
```

```typescript
// electron/fileScanner.worker.ts — inside the worker
const { dirPath, depth } = workerData as WorkerInput;
const tree = await buildNode(root, name, depth);
parentPort?.postMessage(tree);   // send result back to main
```

**OS concepts shown:**
- `workerData` is **copied** into the worker's heap — no shared memory, avoiding race conditions.
- `postMessage` is **message passing IPC** — the same model used by microkernels (like Mach / QNX).
- Worker is **created per scan and terminated after** — short-lived thread lifecycle, like a thread pool task.

---

## 3. Inter-Process Communication (IPC)

### 3.1 The System-Call Analogy

In a real OS, user programs invoke kernel services through **system calls** (`read()`, `write()`, `stat()`, `open()`). In Nexus, the renderer invokes main-process services through **IPC channels**:

| OS System Call | Nexus IPC Channel | What It Does |
|---------------|-------------------|--------------|
| `readdir()` | `app:listDirectory` | List entries in a directory |
| `stat()` | (used internally by `app:listDirectory`) | Get file metadata (size, mtime, type) |
| `access()` | `app:checkAccess` | Check if a path is readable (`R_OK`) |
| `open()` + `read()` | `app:readFilePreview` | Read first N bytes of a file |
| `rename()` | `app:renameFile` | Rename a file or directory |
| `unlink()` / `rmdir()` | `app:permanentlyDelete` | Permanently remove a file |
| `exec()` | `app:openPath` | Open file with default system application |

### 3.2 How IPC Works in Code

**Renderer side** (like a user program making a syscall):
```typescript
// src/ — renderer calls the preload bridge
const entries = await window.electron.listDirectory("/Users/me/Documents");
```

**Preload bridge** (like the syscall table / trap handler):
```typescript
// electron/preload.ts — maps renderer calls to IPC invoke
listDirectory: (dirPath: string) => ipcRenderer.invoke("app:listDirectory", dirPath),
```

**Main process** (like the kernel handling the syscall):
```typescript
// electron/main.ts — handles the IPC request with actual fs operations
ipcMain.handle("app:listDirectory", async (_event, dirPath: string) => {
  const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
  // ... stat each entry, build DirEntry[], return to renderer
});
```

**Key point:** The renderer NEVER imports `fs` or `path`. Every file operation goes through IPC. This is **mandatory separation** — just like how a user process cannot directly read disk sectors; it must ask the kernel.

### 3.3 Two IPC Patterns Used

| Pattern | Node API | Usage in Nexus | OS Analogy |
|---------|---------|---------------|------------|
| **Request-response** | `ipcRenderer.invoke()` / `ipcMain.handle()` | All file operations (list, scan, delete, rename) | Synchronous system call — caller blocks until kernel returns |
| **Fire-and-forget + event** | `ipcRenderer.send()` / `ipcMain.on()` + `event.sender.send()` | File watching — renderer says "watch this dir", main sends "directory-changed" events back | Asynchronous signal / interrupt — kernel notifies user process of an event |

---

## 4. File System Concepts

### 4.1 Core FS Operations Used

| Operation | Node API | Where Used | OS Concept |
|-----------|---------|-----------|------------|
| List directory | `fs.promises.readdir(path, { withFileTypes: true })` | `app:listDirectory` handler | Reading directory entries (like `getdents` syscall) |
| File metadata | `fs.promises.stat(path)` | Every listing, thumbnail, trash | Reading inode metadata — size, mtime, isDirectory |
| Permission check | `fs.promises.access(path, fs.constants.R_OK)` | `app:checkAccess` | Checking Unix permission bits (read bit) |
| Read file | `fs.promises.readFile(path)` | File preview, text preview | `read()` syscall — read bytes from a file descriptor |
| Rename / move | `fs.promises.rename(oldPath, newPath)` | Rename files, move to trash | `rename()` syscall — atomic directory entry update |
| Delete | `fs.promises.rm(path, { recursive: true })` | Permanent delete, empty trash | `unlink()` / `rmdir()` syscall |
| Watch | `fs.watch(dirPath)` | Live directory monitoring | Kernel event notification — `kqueue` (macOS) / `inotify` (Linux) |
| Directory creation | `fs.mkdirSync(path, { recursive: true })` | Trash directory setup | `mkdir()` syscall with parent creation |

### 4.2 Recursive Directory Traversal (Tree Walking)

The disk visualizer builds a tree by recursively walking directories:

```
Home/
├── Documents/         ← readdir → recurse deeper
│   ├── report.pdf     ← stat → get size → leaf node
│   └── images/        ← readdir → recurse deeper
│       └── photo.jpg  ← stat → get size → leaf node
├── Downloads/         ← readdir → recurse deeper
│   └── setup.dmg      ← stat → get size → leaf node
└── .git/              ← IGNORED (skip known dirs)
```

**Depth limiting** prevents unbounded recursion (like how `find -maxdepth` works). Default depth is 2 for overview, 6 for deep scan of a specific folder.

**Size aggregation** rolls up child sizes to parent — exactly how `du -sh` works internally by traversing the directory tree and summing `stat.st_size`.

### 4.3 Trash / Bin — A Journaled Delete System

Instead of immediately deleting files (`unlink`), Nexus implements a **two-phase delete**:

1. **Soft delete (move to trash):**
   - Generate a UUID for the item
   - `fs.rename()` the file into `~/.nexus-trash/files/<uuid>_<name>`
   - Append an entry to `manifest.json` with original path, timestamp, size

2. **Restore:**
   - Read manifest → find entry by ID
   - `fs.rename()` back to original path
   - Remove entry from manifest

3. **Permanent delete:**
   - `fs.rm()` the stored copy
   - Remove entry from manifest

**OS concept — journaling:** The `manifest.json` acts like a **journal** (similar to ext4's journal or NTFS's `$MFT`). It records the operation metadata *before* the actual move, so we can always recover the original path. If the app crashes mid-operation, the manifest tells us the state.

**System trash integration:** On macOS, Nexus also reads `~/.Trash` (the OS-level trash) using the same `readdir` + `stat` approach, merging system trash items into the unified bin view.

### 4.4 File Watching — Kernel Event Notifications

```typescript
fs.watch(dirPath, (_eventType, _filename) => {
  event.sender.send("directory-changed", dirPath);
});
```

This uses the OS kernel's native file-event system:
- **macOS:** `kqueue` / `FSEvents`
- **Linux:** `inotify`
- **Windows:** `ReadDirectoryChangesW`

**OS concept:** The kernel maintains a watch list. When any process modifies a watched directory (create, delete, rename a file), the kernel sends an event to all watchers. This is **interrupt-driven** rather than polling — the app doesn't continuously re-scan; it reacts to kernel notifications.

---

## 5. Memory Management

### 5.1 Process Memory Isolation

Each execution context has its own memory:

| Context | Memory Model | What's Stored |
|---------|-------------|---------------|
| Main process | Node.js V8 heap | Thumbnail cache (`Map`, bounded at 3000 entries), trash manifest, IPC handler closures |
| Renderer | Chromium V8 heap (sandboxed) | React component tree, Zustand store (path, history, favorites), DOM |
| Worker thread | Separate V8 isolate | `workerData` copy, recursive tree being built, intermediate `stat` results |

**No shared memory** between these contexts. Data moves via:
- **IPC** (main ↔ renderer): serialized JSON over Electron's IPC channel
- **Message passing** (main ↔ worker): structured clone of `workerData` and `postMessage` data

This prevents **race conditions** and **data corruption** — the same reason why processes in an OS have separate address spaces.

### 5.2 Bounded Caching (Thumbnail Cache)

```typescript
if (thumbnailCache.size > 3000) thumbnailCache.clear();
thumbnailCache.set(cacheKey, dataUrl);
```

This is a simple **bounded cache** — when it exceeds 3000 entries, it's cleared entirely. This prevents unbounded memory growth (similar to how an OS page cache is bounded and uses eviction policies like LRU).

The cache key includes the file path, requested size, and `mtimeMs` — so if a file is modified, the old cached thumbnail is automatically invalidated (like cache coherence).

---

## 6. Scheduling & Concurrency

### 6.1 Why Worker Threads Prevent UI Freezing

Node.js is **single-threaded** for JavaScript execution. If we scan a large directory tree on the main thread:

```
Main thread: [handle IPC] [SCAN 500ms] [handle IPC] [SCAN 800ms] ...
                           ↑ UI frozen   ↑ clicks lost
```

With a worker thread:

```
Main thread:  [handle IPC] [handle IPC] [handle IPC] ...  ← always responsive
Worker thread: [SCAN 500ms ─────────────────────────] [done, postMessage]
```

The OS **schedules both threads** across CPU cores. The main thread stays free to handle IPC and UI events. This is the same reason why OS kernels use separate threads for I/O and interrupt handling.

### 6.2 Debouncing — Preventing Redundant Work

When the user navigates rapidly between folders, each navigation triggers a scan. Without debouncing, 10 rapid clicks = 10 overlapping scans:

```typescript
// App.tsx — debounced scan
useEffect(() => {
  const timer = setTimeout(() => { /* start scan */ }, 80);
  return () => clearTimeout(timer);
}, [currentPath]);
```

**OS concept:** This is similar to **I/O request coalescing** — the disk scheduler merges multiple read requests to the same region into one operation, reducing redundant I/O.

---

## 7. Security & Protection

### 7.1 Sandboxing (Protection Rings Analogy)

```
┌─────────────────────────────────────┐
│          Ring 0 (Kernel)            │ ← Main process: full fs, OS access
├─────────────────────────────────────┤
│        Ring 3 (User space)          │ ← Renderer: sandboxed, no fs
├─────────────────────────────────────┤
│         Syscall interface           │ ← Preload: contextBridge API
└─────────────────────────────────────┘
```

| Protection Mechanism | OS Equivalent | Nexus Implementation |
|---------------------|--------------|---------------------|
| Process isolation | Separate address spaces | `nodeIntegration: false`, `sandbox: true` |
| Syscall interface | Trap table | `contextBridge.exposeInMainWorld()` — only listed functions are callable |
| Least privilege | Capability-based security | Renderer gets only 20 specific functions, not raw `fs` or `child_process` |
| Context isolation | Page table separation | `contextIsolation: true` — preload and page run in separate JS contexts |

### 7.2 Permission Handling (Access Control)

```typescript
await fs.promises.access(path.resolve(targetPath), fs.constants.R_OK);
```

This checks the **Unix permission bits** for the current process:
- `R_OK` (4) — read permission
- `W_OK` (2) — write permission
- `X_OK` (1) — execute permission

If the check fails with `EACCES`, the app shows a permission screen and guides the user to grant Full Disk Access in macOS System Settings.

**OS concept:** This is the **access control list (ACL) / DAC model** — the kernel checks if the calling process's UID/GID has the required permission bits on the file's inode before allowing the operation.

### 7.3 Error Handling — Graceful Degradation

Every `fs` call is wrapped in try/catch:

```typescript
try {
  entries = await fs.promises.readdir(resolved, { withFileTypes: true });
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "EACCES") return [];  // skip inaccessible directories
  return [];
}
```

Common error codes handled:
| Error Code | Meaning | How Nexus Handles It |
|-----------|---------|---------------------|
| `EACCES` | Permission denied | Skip directory, show permission prompt |
| `ENOENT` | File/directory not found | Return empty, don't crash |
| `ENOTDIR` | Path is not a directory | Treat as file |
| `EMFILE` | Too many open file descriptors | Caught by try/catch, retry later |

---

## 8. System Integration

### 8.1 Platform-Specific Paths

```typescript
app.getPath("home")      // /Users/shivansh
app.getPath("desktop")   // /Users/shivansh/Desktop
app.getPath("downloads") // /Users/shivansh/Downloads
```

The OS stores these in environment variables and system APIs. Electron abstracts across platforms (macOS, Windows, Linux) — just like how POSIX provides `getenv("HOME")`.

### 8.2 Custom Protocol — Safe Media Serving

```typescript
protocol.handle("media", (request) => {
  const decodedPath = decodeURIComponent(parsed.pathname.slice(1));
  return net.fetch(pathToFileURL(decodedPath).toString());
});
```

The renderer loads images as `<img src="media://file/path">` instead of exposing raw `file://` paths. The main process intercepts the custom protocol, resolves the real path, and serves the file.

**OS concept:** This is like a **virtual file system (VFS)** layer — the renderer sees a `media://` namespace, but the main process translates it to real file paths. Similar to how `/proc` in Linux is a virtual filesystem that maps to kernel data structures.

### 8.3 Opening Files with Default Application

```typescript
shell.openPath(filePath);
```

This tells the OS to open the file with its registered default handler — the same as `xdg-open` on Linux or `open` on macOS. The OS maintains a **file association table** mapping MIME types / extensions to applications.

---

## 9. Data Flow (End to End)

```
User clicks folder "Documents" in sidebar
        │
        ▼
Renderer: useFileStore.navigateTo("/Users/me/Documents")
        │
        ▼
Renderer: window.electron.listDirectory("/Users/me/Documents")
        │  (IPC invoke — like a system call)
        ▼
Preload: ipcRenderer.invoke("app:listDirectory", path)
        │  (crosses process boundary)
        ▼
Main process: ipcMain.handle("app:listDirectory", ...)
        │
        ├─► fs.promises.readdir(path, { withFileTypes: true })  ← OS readdir
        ├─► fs.promises.stat(each entry)                         ← OS stat
        │
        ▼
Main process: returns DirEntry[] to renderer via IPC
        │
        ▼
Renderer: ExplorerView renders file grid/list
        │
        ▼ (parallel)
Renderer: window.electron.scanDirectoryForViz(path, 2)
        │
        ▼
Main process: spawns Worker thread with { dirPath, depth }
        │
Worker thread: recursive buildNode() → readdir + stat at each level
        │
Worker thread: parentPort.postMessage(tree)  ← message-passing IPC
        │
        ▼
Main process: forwards tree to renderer via IPC
        │
        ▼
Renderer: DiskVisualizer renders sunburst chart
```

---

## 10. Potential Viva Questions & Answers

**Q: Why not just use `fs` directly in the frontend?**
A: That would violate process isolation. In a real OS, user-space programs can't access hardware directly — they go through system calls. Our IPC layer enforces the same boundary. It also prevents malicious code in the renderer from accessing the full file system.

**Q: Why use a worker thread instead of just async functions?**
A: Node.js async I/O is non-blocking for I/O waits, but the JavaScript callbacks still run on the main thread. With 10,000+ files, the CPU time spent processing results blocks the event loop. A worker thread runs on a separate OS thread, so the main thread stays free for IPC and UI updates.

**Q: How is your trash different from the OS trash?**
A: Our trash uses a `manifest.json` journal — before moving a file, we record its original path and metadata. This is the same idea as file system journaling (ext4, NTFS). It lets us restore files to their exact original location. We also read the macOS system trash (`~/.Trash`) to show a unified view.

**Q: What happens if the app crashes during a delete?**
A: The manifest is written *before* the `fs.rename()` call. If the app crashes after writing the manifest but before moving the file, the manifest entry exists but the file is still in place — no data loss. If it crashes after the move, the manifest correctly records where the file went. This is crash consistency through journaling.

**Q: How does file watching work at the kernel level?**
A: On macOS, `fs.watch()` uses `kqueue` — a kernel event queue. We register a file descriptor for the directory. When any process modifies that directory (create, delete, rename), the kernel places an event in our queue. Our callback fires and we re-scan. This is interrupt-driven, not polling — zero CPU usage while waiting.

**Q: What is context isolation?**
A: The preload script runs in a special context that can access both Node.js APIs and the web page. But with `contextIsolation: true`, the page JavaScript cannot access the preload's variables directly. `contextBridge` creates a controlled bridge — like a system call table that exposes only specific functions. Even if someone injects malicious JS into the page, they can only call the whitelisted functions.

**Q: How do you handle permission errors?**
A: Every `fs` operation is wrapped in try/catch. If `EACCES` (permission denied) is returned, we skip that directory and continue. On macOS, if the Home directory itself is inaccessible, we show a permission screen that links to System Settings > Full Disk Access. This is the OS's discretionary access control (DAC) model in action.

**Q: What's the difference between a process and a thread in your app?**
A: Main process and renderer are separate **processes** — different PIDs, separate memory, communicate via IPC (serialized messages). The worker is a **thread** within the main process — same PID, but separate V8 heap (no shared JS objects), communicates via `postMessage`. The OS schedules both processes and the thread independently across CPU cores.

**Q: How is your custom protocol like a virtual file system?**
A: The `media://` protocol intercepts URL requests from the renderer, translates them to real file paths, and serves the content. The renderer thinks it's loading from a `media://` namespace — it never sees the real path. This is analogous to Linux's `/proc` or `/sys` — virtual filesystems where the kernel translates path lookups into internal data.

**Q: What would happen without debouncing?**
A: If the user clicks 10 folders in 1 second, we'd launch 10 parallel scans. Each scan opens hundreds of file descriptors (`readdir` + `stat`). This could hit the OS's per-process file descriptor limit (`ulimit -n`, typically 256-1024). Debouncing ensures only the last navigation triggers a scan — like how disk I/O schedulers merge redundant requests.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 33 (Chromium + Node.js) |
| Build | Vite, TypeScript |
| UI | React 18, Tailwind CSS, Framer Motion |
| Charts | @nivo/sunburst |
| State | Zustand (with localStorage persistence) |
| Icons | Lucide React |
| Code preview | react-syntax-highlighter |

---

## How to Run

```bash
# Install dependencies
npm install

# Development (hot-reload)
npm run electron:dev

# Production build (DMG + ZIP)
npm run electron:build
# Output: release/Nexus-0.1.0-arm64.dmg
```

---

## Project Structure

```
├── electron/
│   ├── main.ts                # Main process — IPC handlers, window, protocol, worker spawn
│   ├── preload.ts             # Syscall table — contextBridge API for renderer
│   ├── fileScanner.ts         # Depth-limited directory scan with categorization
│   ├── diskVizScanner.ts      # Tree builder for disk visualization
│   └── fileScanner.worker.ts  # Worker thread — runs disk scan off main thread
├── src/
│   ├── App.tsx                # Root component — routing, permission gate, guided tour
│   ├── components/
│   │   ├── Layout.tsx         # Sidebar + main area with glass theme
│   │   ├── Sidebar.tsx        # Favorites (drag-reorder) + system locations + bin
│   │   ├── ControlBar.tsx     # Navigation (back/forward/up), search, view toggle
│   │   ├── ExplorerView.tsx   # File grid/list with thumbnails and context menu
│   │   ├── DiskVisualizer.tsx # Sunburst chart with drill-down
│   │   ├── Dashboard.tsx      # Auto-organize summary by file category
│   │   ├── BinView.tsx        # Trash view — app + system trash unified
│   │   ├── QuickLook.tsx      # File preview modal (image, video, code, PDF)
│   │   └── SetupScreen.tsx    # Permission prompt (Full Disk Access)
│   ├── stores/
│   │   └── useFileStore.ts    # Zustand store — path, history, favorites, settings
│   └── types/                 # TypeScript interfaces for DirEntry, DiskVizNode, etc.
├── scripts/
│   └── afterPack.js           # Ad-hoc code signing hook for electron-builder
├── package.json               # Dependencies + electron-builder config
└── vite.config.ts             # Vite build config with base "./" for file:// loading
```
