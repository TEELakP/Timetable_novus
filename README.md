# Smart Timetable Manager

An AI-powered academic scheduling and conflict resolution system built with Next.js, Genkit, and Firebase.

## Deployment to GitHub

Follow these steps to move your project to GitHub:

1. **Initialize Git**:
   Open your terminal in the project folder and run:
   ```bash
   git init
   ```

2. **Add Files**:
   Stage your changes:
   ```bash
   git add .
   ```

3. **Commit**:
   Create your first commit:
   ```bash
   git commit -m "Initial commit"
   ```

4. **Create GitHub Repo**:
   Go to [GitHub](https://github.com/new) and create a new repository. Do **not** initialize it with a README, License, or `.gitignore` (as these already exist in your project).

5. **Link and Push**:
   Copy the remote URL from GitHub and run:
   ```bash
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git branch -M main
   git push -u origin main
   ```

## Project Directory Guide

Explore the following files to see how the system works:

### 1. Feature Pages (`src/app/dashboard/`)
- `timetable/page.tsx`: The **Weekly Grid** and List overview.
- `data/page.tsx`: The **Excel Copy-Paste** logic and database sync.
- `teachers/page.tsx`: **Faculty Directory** with schedule detail modals.
- `units/page.tsx`: **Academic Catalog** with unit-specific schedules.
- `conflicts/page.tsx`: **Conflict Monitor** detecting unassigned classes and overlaps.
- `print/page.tsx`: **Printable Weekly Grid** (landscape optimized).
- `export/page.tsx`: **Excel Reporting** and multi-filter exporting.

### 2. Database Layer (`src/firebase/`)
- `index.ts`: Central initialization for Auth and Firestore.
- `non-blocking-updates.tsx`: Optimized, non-blocking write operations.
- `firestore/`: Real-time data hooks (`useCollection`, `useDoc`).

### 3. Core Logic (`src/lib/`)
- `types.ts`: The TypeScript interfaces defining Trainers, Units, and Sessions.
- `mock-data.ts`: Institutional site hierarchy and room definitions.

## Data Architecture

The application uses **Cloud Firestore** (NoSQL) for all data storage:

### Core Collections
1.  **`/teachers`**: Faculty profiles and availability.
2.  **`/academicUnits`**: Subject definitions.
3.  **`/rooms`**: Persistent institutional classroom directory.
4.  **`/timetables/{id}/classSessions`**: Scheduled instances.

## How to Sync Data
Use the **Data Entry** tab to bulk-import your schedule from an 8-column Excel format. The system preserves the Room directory during wipes to maintain institutional hierarchy.
