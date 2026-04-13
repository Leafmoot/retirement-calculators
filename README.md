# Retirement Calculators

A suite of web-based retirement planning calculators built with React, deployed via Vercel.

---

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

---

## How to Add a New Calculator

1. Open Command Prompt and pull the latest code first:
   - `cd %USERPROFILE%\Desktop\retirement-calculators`
   - `git pull`
2. Copy the `baptist-health` folder on your Desktop (inside `retirement-calculators`)
3. Rename it to match the new calculator (e.g. `new-calc-name`)
4. Update the three files that change for each new calculator:
   - `public/index.html` — update the `<title>` tag
   - `package.json` — update the `"name"` field
   - `src/App.jsx` — replace with the new calculator code
   - Everything else (`index.js`, `styles.css`, `.eslintrc.json`, `.gitkeep`) stays identical
5. Push to GitHub:
   - `cd %USERPROFILE%\Desktop\retirement-calculators`
   - `git add .`
   - `git commit -m "Add new-calc-name calculator folder"`
   - `git push`
6. Go to vercel.com → Add New → Project → Import `retirement-calculators`
7. Set Root Directory to the folder name (e.g. `new-calc-name`)
8. Set Framework Preset to **Create React App**
9. Set a clean Project Name
10. Click Deploy

---

## Pushing Updates to GitHub

Use these commands any time you've made changes to a calculator file on your Desktop.

### Standard push (most common)
```
cd %USERPROFILE%\Desktop\retirement-calculators
git add .
git commit -m "Brief description of what you changed"
git push
```

### If your push gets rejected
This happens when GitHub has changes your local copy doesn't have yet (e.g. you edited a file through the browser). Run:
```
git pull --rebase
git push
```

### Prevent rejections going forward
Run this once to make rebase the default behavior:
```
git config --global pull.rebase true
```

After that, `git pull` will always rebase automatically and you'll never need to remember `--rebase`.

### What the commit message is
The text in quotes after `git commit -m` is just a note describing what changed.
It shows up in your GitHub history. Keep it short — examples:
- `"Update HPH branding"`
- `"Fix Baptist Health math"`
- `"Add new client calculator"`

---

## Annual Update Checklist (every January)

Open `shared/constants.js` and update:

1. `PLAN_YEAR` — increment by 1
2. `LIMIT_402G` — check IRS announcement
3. `LIMIT_CATCHUP_50` — check IRS announcement
4. `LIMIT_CATCHUP_6063` — check IRS announcement
5. `LIMIT_415C` — check IRS announcement
6. `LIMIT_457B` — check IRS announcement
7. `FICA_CATCHUP_THRESHOLD` — check IRS announcement
8. `COMP_LIMIT` — check IRS announcement (IRC 401(a)(17))
9. `FEDERAL_BRACKETS` — update with new bracket amounts
10. `STANDARD_DEDUCTION` — update with new amounts

Then update payroll calendars in each client-specific calculator:
- `hph-403b/src/App.jsx` — `HPH_PAYDAYS` array
- `baptist-health/src/App.jsx` — `BH_PAYDAYS` array

---

## Style Updates

To change the visual design for all calculators at once, edit `shared/theme.js`.

To change the font, update both:
1. The font strings in `shared/theme.js`
2. The Google Fonts URL in `shared/components.jsx` (`GOOGLE_FONTS_URL`)

---

## Tech Stack

- React (JSX)
- GitHub (private repo)
- Vercel (static hosting, auto-deploy on push)
- No backend, no database, no PHI stored
