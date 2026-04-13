# Retirement Calculators

A suite of web-based retirement planning calculators built with React, deployed via Vercel.

## How to Get the Boilerplate Folder (if you need it)

The `baptist-health` folder serves as the template for all new calculators.
If you ever lose your local copy, here's how to get it back:

1. Open Command Prompt (`Windows Key + R` → type `cmd` → hit Enter)
2. Navigate to where you want the folder:
   `cd %USERPROFILE%\Desktop`
3. Clone the repo:
   `git clone https://github.com/Leafmoot/retirement-calculators.git`
4. A `retirement-calculators` folder will appear on your Desktop
5. Open it — the `baptist-health` folder is inside and ready to copy

> **Note:** If `retirement-calculators` already exists on your Desktop,
> skip cloning and instead open Command Prompt and run:
> `cd %USERPROFILE%\Desktop\retirement-calculators`
> then run `git pull`
> This updates your local copy with any changes made since you last used it.

## How to Add a New Calculator

1. Open Command Prompt and run `git pull` to make sure your local copy is up to date:
   - `cd %USERPROFILE%\Desktop\retirement-calculators`
   - `git pull`
2. Copy the `baptist-health` folder on your Desktop (inside `retirement-calculators`)
3. Rename it to match the new calculator (e.g. `new-calc-name`)
4. Update the three files that change for each new calculator:
   - `public/index.html` — update the `<title>` tag
   - `package.json` — update the `"name"` field
   - `src/App.jsx` — replace with the new calculator code
   - Everything else (`index.js`, `styles.css`, `.eslintrc.json`, `.gitkeep`) stays identical
5. Open Command Prompt and push to GitHub:
   - `cd %USERPROFILE%\Desktop\retirement-calculators`
   - `git add .`
   - `git commit -m "Add new-calc-name calculator folder"`
   - `git push`
6. Go to vercel.com → Add New → Project → Import `retirement-calculators`
7. Set Root Directory to the folder name (e.g. `new-calc-name`)
8. Set Framework Preset to **Create React App**
9. Set a clean Project Name
10. Click Deploy
