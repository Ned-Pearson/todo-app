# Setup Walkthrough

## 1. Install prerequisites

**Node.js** — LTS from https://nodejs.org, then verify with `node -v`.

**Rust** — via rustup:
- Mac/Linux: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Windows: https://win.rustup.rs

Verify with `rustc --version`.

**Platform system dependencies:**
- **Windows**: "Desktop development with C++" workload via the Visual Studio Installer. WebView2 is already on Win 10/11.
- **macOS**: `xcode-select --install`
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

## 2. Install dependencies

```bash
npm install
```

## 3. Generate icons

```bash
npx tauri icon path/to/any-square-image.png
```

## 4. Run it

```bash
npm run tauri dev
```

## 5. Build a distributable

```bash
npm run tauri build
```

## Notes

- The SQL plugin's permissions are already wired up in `src-tauri/capabilities/default.json` — if a future migration adds new plugins, remember they each need their own permission lines here, or calls will fail silently.
- If PowerShell blocks `npm` with a script-execution error, run once: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.
