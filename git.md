# NexusBond GitHub Repository Guidelines 🛡️📦
### What to Publish vs. What to Keep Private & Excluded

This document provides a clear, beginner-to-advanced breakdown of:
1. **What files must be public on GitHub** for anyone to run and build NexusBond.
2. **What files must NEVER be pushed** (to prevent security leaks and repository bloat).
3. **How to use Git Submodules for Private Proprietary Code** while keeping the main repository 100% public and functional.

---

## 📊 Summary Comparison

| Category | 🟢 **PUBLIC on GitHub (Push to Main Repo)** | 🔒 **PRIVATE Submodule (Separate Private Repo)** | 🔴 **EXCLUDED / IGNORED (Never Push)** |
| :--- | :--- | :--- | :--- |
| **Source Code** | Core open-source engine (`crates/`, `core_engine/`, `ui/`) | Proprietary enterprise algorithms, private cloud backends | None |
| **Build Artifacts** | None | None | `target/` (100MB+ binaries), `dist/`, `*.pyc`, `__pycache__/` |
| **Dependencies** | `Cargo.toml`, `requirements.txt`, `package.json` | Private crate manifests | `node_modules/`, `venv/`, `.venv/` |
| **Secrets & Keys** | Public sample configs only | Private relay deployment keys, API secrets | Root `.env`, private SSH/WireGuard keys |
| **Tooling & Docs** | `README.md`, `SRS.md`, `progress.md`, `git.md` | Internal business/architecture documentation | Local OS temp files, IDE states (`.vscode/`, `.idea/`) |

---

## 🔴 1. What Should NOT Be Public on GitHub (Keep Excluded)

### ❌ A. Compiled Build Artifacts & Caches (Bloat Warning)
When you build Rust, Python, or Vite projects, compilers generate hundreds of megabytes of binary files. Pushing them slows down `git clone`, wastes bandwidth, and corrupts cross-platform builds.
- **`target/`**: Rust build directory containing `.exe`, `.pdb`, `.rmeta`, and intermediate compilation units (**100MB - 1GB+**).
- **`__pycache__/` & `*.pyc`**: Python compiled bytecode cache.
- **`ui/dist/` or `dist/`**: Compiled frontend JavaScript and CSS bundles (users build this locally via `npm run build`).
- **`.pytest_cache/`**: Pytest test run cache.

### ❌ B. Dependency Folders (Massive File Bloat)
Never commit installed package directories; always let package managers install them from manifests.
- **`node_modules/` or `ui/node_modules/`**: Thousands of third-party JS packages (**200MB+**).
- **`venv/`, `.venv/`, `env/`**: Python virtual environment containing the local Python interpreter.

### ❌ C. Security Credentials, Secrets & Private Keys
Never publish credentials that give access to your servers, relays, or accounts.
- **Noise_IK / WireGuard Private Keys**: Any file containing private encryption keys (`*.key`, `*.pem`, `private_key*`).
- **Environment Files (`.env`, `.env.local`)**: Files storing secrets, passwords, or private API tokens.
- **SSH Keys (`id_rsa`, `id_ed25519`)**: Server login keys.

### ❌ D. OS & Local Editor Metadata
- **`.vscode/` & `.idea/`**: Local IDE workspace states.
- **`.DS_Store` & `Thumbs.db`**: macOS and Windows thumbnail caches.
- **`*.log`**: Run logs and debugging output files.

---

## 🟢 2. What IS Required on GitHub (For Anyone to Run the Project)

For any developer or user who clones `https://github.com/ali-zafar-awan/NexusBond` to run the project, the repository **must contain**:

### ✅ A. Complete Project Source Code
- **Rust Core Workspace (`crates/`)**:
  - `crates/nexus-proto/src/lib.rs` & `tests/`
  - `crates/nexus-crypto/src/lib.rs` & `tests/`
  - `crates/nexus-linkmon/src/lib.rs`
  - `crates/nexus-sched/src/lib.rs`
  - `crates/nexus-relay/src/`
  - `crates/nexus-client/src/`
  - `crates/nexus-tun/src/`
  - `crates/nexus-ipc/src/`
  - `crates/nexus-fetch/src/`
  - `crates/nexus-localdispatch/src/`
- **Python Engine (`core_engine/`)**:
  - `core_engine/main.py`
  - `core_engine/config.py`
  - `core_engine/api/server.py`
  - `core_engine/interfaces/*.py`
  - `core_engine/proxy/*.py`
  - `core_engine/scheduler/*.py`
  - `core_engine/relay/*.py`
  - `core_engine/wintun/*.py`
- **React Frontend UI (`ui/src/`)**:
  - `ui/src/App.tsx`
  - `ui/src/types.ts`
  - `ui/src/main.tsx`
  - `ui/src/index.css`
  - `ui/src/components/*.tsx`
  - `ui/index.html`

### ✅ B. Dependency Manifests & Package Locks
- `Cargo.toml` & `Cargo.lock` (defines all Rust crate dependencies).
- `core_engine/requirements.txt` (defines all Python packages: `fastapi`, `uvicorn`, `psutil`, `pydantic`).
- `ui/package.json` & `ui/package-lock.json` (defines all React, Vite, Lucide, Tailwind packages).

### ✅ C. Build & Tooling Configurations
- `ui/vite.config.ts`, `ui/tsconfig.json`, `ui/tailwind.config.js`, `ui/postcss.config.js`
- `pytest.ini`
- `.gitignore` *(The rulebook that stops junk files from being pushed)*
- `.github/workflows/ci.yml` (Automated testing on GitHub Actions)

### ✅ D. Launcher & Automation Scripts
- `scripts/start-all.bat` (Starts Engine + UI + Auto-Enables Windows Proxy)
- `scripts/stop-all.bat` (Stops Engine + UI + Auto-Disables Windows Proxy)
- `scripts/enable-windows-proxy.bat` & `scripts/disable-windows-proxy.bat`
- `scripts/speedtest_cli.py` & `scripts/install-service.ps1`

### ✅ E. Documentation & Legal
- `README.md` (Quick guide, installation guide, routing guide, UI manual)
- `SRS.md` (Software Requirements Specification v2.0)
- `progress.md` (Work Package roadmap & testing audit log)
- `docs/DECISIONS.md` (Architecture Decision Records ADR-001 through ADR-004)
- `git.md` (This repository publishing standard)
- `LICENSE` (MIT License)

---

## 🔒 3. How to Set Up a Private Git Submodule (Private Code Architecture)

If you have proprietary code, enterprise features, or private server infrastructure configs that you want to keep **strictly private** while keeping the main **NexusBond repository 100% public**, use the **Git Submodule Architecture**:

```
GitHub (Public)                               GitHub (Private)
https://github.com/ali-zafar-awan/NexusBond   https://github.com/ali-zafar-awan/NexusBond-Private
          │                                                  │
          │ (Public clone)                                   │ (Authenticated access only)
          ▼                                                  ▼
   [ NexusBond Root ] ─── points to ───► [ private_modules/ ]
```

---

### 🛠️ Step-by-Step Instructions:

#### Step 1: Create a Private Repository on GitHub
1. Go to [github.com/new](https://github.com/new).
2. Name the repository (e.g. `NexusBond-Private`).
3. Select **Private** (Crucial).
4. Click **Create repository**.

---

#### Step 2: Add the Private Repository as a Submodule in NexusBond
Open your terminal in the `d:\NexusBond` workspace:
```bash
# Add the private repository as a submodule in the private_modules folder
git submodule add git@github.com:ali-zafar-awan/NexusBond-Private.git private_modules
```
This creates a `.gitmodules` file in your root directory tracking the submodule link.

---

#### Step 3: How to Commit & Push Changes inside the Private Submodule
Whenever you make changes to files inside `private_modules/`:
```bash
# 1. Enter the private submodule folder
cd private_modules

# 2. Stage and commit your private changes
git add .
git commit -m "Update private proprietary algorithms"

# 3. Push to your PRIVATE GitHub repository
git push origin main

# 4. Return to the main project directory
cd ..
```

---

#### Step 4: How to Commit & Push the Main Public Repository
After updating the submodule, record the updated pointer in the public repo:
```bash
# 1. Stage the submodule pointer update and .gitmodules
git add .gitmodules private_modules

# 2. Commit and push to the PUBLIC GitHub repository
git commit -m "chore: update private_modules submodule pointer"
git push origin main
```

---

#### Step 5: How Public Users vs. Authorized Developers Clone the Repo

- **Public Users (Without access to the private repo):**
  ```bash
  git clone https://github.com/ali-zafar-awan/NexusBond.git
  ```
  *They receive 100% of the public open-source project and can build/run it. The `private_modules/` folder will simply remain empty and inaccessible to them.*

- **Authorized Developers / You (With private repo permissions):**
  ```bash
  git clone --recurse-submodules git@github.com:ali-zafar-awan/NexusBond.git
  ```
  *Git will automatically authenticate and clone both the public code and your private submodule files.*

---

#### Step 6: How to Pull and Update All Submodules
```bash
git submodule update --remote --merge
```

---

## 🧹 4. How to Clean Up Already-Pushed Build Files (e.g. `target/`)

If `target/` or `__pycache__/` was previously pushed to GitHub, you can remove them from Git tracking while keeping local files intact:

```powershell
# 1. Remove tracked target/ build folder from Git index
git rm -r --cached target/

# 2. Add .gitignore, git.md, and commit the cleanup
git add .gitignore git.md README.md
git commit -m "chore: remove target build artifacts and configure .gitignore"

# 3. Push the clean repository to GitHub
git push origin main
```

---

## 🔒 5. Pre-Commit Checklist (Before Every `git push`)

1. [ ] Did I run `git status` to verify no `.env` or private keys are staged?
2. [ ] Are all `target/` or `node_modules/` folders ignored by `.gitignore`?
3. [ ] If private changes were made, did I push inside `private_modules/` first?
4. [ ] Did all tests pass (`cargo test --workspace` & `python -m pytest -v`)?
5. [ ] Did the frontend compile cleanly (`cd ui && npm run build`)?
6. [ ] Is `README.md` and `progress.md` updated with recent changes?
