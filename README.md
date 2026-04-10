# Pilates Passport

> Log every class. Discover every studio. Remember every moment.

## Deploy to Netlify

### Option A — Drag & drop (fastest)
1. Run `npm install && npm run build` locally
2. Drag the `dist/` folder into [netlify.com/drop](https://app.netlify.com/drop)

### Option B — Connect GitHub (recommended)
1. Push this folder to a GitHub repo
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
3. Select your repo
4. Build settings are auto-detected from `netlify.toml`:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy site**

### Option C — Netlify CLI
```bash
npm install -g netlify-cli
npm install
npm run build
netlify deploy --prod --dir=dist
```

## Local development
```bash
npm install
npm run dev
```
Opens at http://localhost:5173

## Project structure
```
pilates-passport/
├── public/
│   ├── favicon.svg
│   └── _redirects       ← Netlify SPA routing
├── src/
│   ├── App.jsx          ← Full app (all screens + logic)
│   └── main.jsx         ← React root
├── index.html
├── vite.config.js
├── netlify.toml         ← Build config
└── package.json
```

## Tech stack
- React 18 + Vite
- No external UI libraries (all custom components)
- Google Fonts: Playfair Display + Outfit
- Netlify for hosting
