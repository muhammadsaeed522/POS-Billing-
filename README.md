# POS Billing

Offline **Windows desktop POS** (point-of-sale) app built with **Electron**, **React**, **SQLite**, and **Prisma**. Run billing, manage products and categories, view reports, and administer users — all without an internet connection.

![Windows](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-38-47848F)
![React](https://img.shields.io/badge/React-19-61DAFB)
![License](https://img.shields.io/badge/license-ISC-lightgrey)

## Features

- **POS checkout** — product search, barcode support, cart, and sales
- **Dashboard** — daily sales and revenue overview
- **Products & categories** — inventory, stock, admin category delete (cascade or unlink)
- **Reports** — sales/expenses by date range, CSV export, PDF
- **Users & roles** — admin and staff with permission-based UI
- **Activity logs** — audit trail for admin actions
- **Auth** — login, signup, password reset, session timeout, initial admin setup
- **Custom branding** — drop a logo in `logo/images/` (login, sidebar, splash, taskbar, installer icon)
- **Windows installer** — `.exe` via electron-builder (NSIS)

## Tech stack

| Layer      | Technology        |
|-----------|-------------------|
| Desktop   | Electron 38       |
| UI        | React + Vite + Tailwind |
| Database  | SQLite            |
| ORM       | Prisma 6          |
| Packaging | electron-builder  |

## Requirements

- **Windows 10/11** (64-bit) for the packaged app
- **Node.js 20+** and **npm** for development
- **Git** (for cloning and GitHub upload)

## Quick start (development)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# 2. Install dependencies
npm install
cd renderer && npm install && cd ..

# 3. Environment
copy .env.example .env

# 4. Database
npm run prisma:generate
npm run prisma:migrate

# 5. Run the app (opens Electron window — not the browser alone)
npm run dev
```

On first run, complete **initial admin setup** in the app if no users exist yet.

## Build Windows installer (.exe)

```bash
# Close any running "POS Billing" app first
npm run dist
```

Installer output:

```text
release/POS Billing Setup 1.0.7.exe
```

If the build fails because `release` is locked, close the app and File Explorer on that folder, then run `npm run clean:release` and try again.

## Custom logo

1. Place your image in **`logo/images/`** (recommended: `logo.png`).
2. Restart the app — UI and taskbar icon update automatically.
3. Rebuild the installer to update the `.exe` icon: `npm run dist`.

**Installed app (end users):**  
`%APPDATA%\POS Billing\logo\images\`

See `logo/images/PLACE_YOUR_LOGO_HERE.txt` for supported formats.

## Project structure

```text
billing-system/
├── electron/          # Main process, IPC, DB, branding
├── renderer/          # React UI (Vite)
├── prisma/            # Schema & migrations
├── logo/              # Custom + default branding
├── scripts/           # DB template, branding, clean release
├── build/             # Generated icon.ico, template DB (build only)
└── release/           # Installer output (not in git)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev mode (Vite + Electron) |
| `npm run build` | Build React UI |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Apply DB migrations |
| `npm run dist` | Full Windows installer build |
| `npm run clean:release` | Remove locked `release/` folder |
| `npm run branding:prepare` | Build `icon.ico` from logo |

