# Enright Design Foundry

Portfolio site for enrightdesignfoundry.com, rebuilt from Webflow in Vite + React + TypeScript + Tailwind CSS v4.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve dist/ locally
```

## Adding or changing a project

1. Put the original images in `media-src/design/thumbs`, `media-src/design/full` (or `media-src/video/thumbs`).
2. Run `npm run media`. It writes optimized AVIF + WebP files to `public/media/` and records sizes in `src/content/media.json`.
3. Add or edit the project in `src/content/projects.json`. The key under `asset` is the image's path inside `media-src/`.

Without the whole `media-src/` folder (`npm run media` rebuilds everything from it), add images one at a time instead: `npm run add-media -- <image> <key>`, e.g. `npm run add-media -- ~/Desktop/candescent.png design/thumbs/candescent.png`. It makes the same AVIF + WebP sizes and adds or replaces just that image in `media.json`. Keep the originals in `_for-media-src/` (same folder layout; not committed).

Everything else (strip length, panels, viewer, deep links) follows from the data. A side can have any number of projects.

`media-src/` holds the full-resolution originals and is not committed (it's in `.gitignore`); keep a backup of it somewhere. If it's missing, `download-webflow-assets.sh` from the rebuild plan pulls everything from Webflow while that site is still up.

### Project fields

| Field | Used for |
|---|---|
| `id` | Deep link: `#design/tempest` opens that project |
| `category` | `design` or `video` |
| `order` | Position in its row |
| `title`, `discipline` | Design projects |
| `title`, `duties`, `crewSize`, `timeline` | Video projects |
| `description` | Text behind the DESCRIPTION button |
| `thumb` | `{ "type": "image", "asset": ... }` or `{ "type": "lottie", "src": "/lottie/....json" }` |
| `media` | Images (`asset`) or YouTube (`youtubeId`, `title`, `poster`) shown in the viewer. Add `"split": true` to an image made of two halves side by side: on phones and portrait tablets the viewer stacks the left half above the right half (only when that shows it larger). `"split": "right-first"` puts the right half on top. Add `"portrait": "<key>"` for a separate tall layout of the same board (Candescent): the viewer shows whichever layout comes out larger, so phones and upright tablets get the tall one |
| `link` (optional) | Extra viewer button: `{ "label": "Visit site", "href": "/nsyte/" }` opens in a new tab (any URL, e.g. a YouTube channel). Add `"download": "Miami.ttf"` and `"downloadTitle": "Download the Miami Typeface"` to make it open a small download popup instead (files live in `public/downloads/`) |
| `alternate` (optional) | Second view swapped in with its own button: `{ "label": "Watch video", "backLabel": "See design", "media": ... }`. The artwork slides up and away and the new view slides up into its place; the button then reads the back label. `media` can be YouTube media, an image (`{ "type": "image", "asset", "alt" }`), or a document: `{ "type": "document", "alt", "pages": [page image keys] }`, shown as a scrolling column of pages (landscape pages fit the screen, portrait pages run at a 1000px reading width). For a PDF, render its pages into `media-src/` (e.g. `pdftoppm -r 240 -png deck.pdf media-src/design/full/deck/page`) and run `npm run media`. Scrolling swaps too: scroll (or swipe, or press Down) on the main view and the card gives a little, then the alternate snaps up; scroll up on the alternate (at the top of a document) to go back. A document also shows a "scroll down" cue, the hero's scroll hint in a gray circle, until its pages are scrolled |

`poster` is the YouTube preview frame size that exists for that video: `maxresdefault`, or `sddefault` for older uploads without an HD frame.

## Nav button art

The DESIGN, VIDEO and RESUME buttons are Jim's Illustrator frames, played as a flipbook.

1. Export each frame's artboard as SVG (Export for Screens) into `button-art/<button>/SVGs/` (or a subfolder named by `dir` in `frames.json`, like `SVGs/BotLeft`) (`design-wide`, `video-wide`, `resume-wide`, `design-square`, ...). Every frame of a button shares one artboard size. Square art is shown at the same height as the wide art, so a square artboard as tall as the wide one (407) keeps line weights identical.
2. `button-art/frames.json` says which artboard numbers play when: `frames` in hover order (first = resting, last = held end frame; list a number twice to hold it longer), `active` for the selected category, `fps`, and `color` (the shapes are exported unfilled and draw in this color; `#1d262c` is the logo's ink).
3. Run `npm run buttons`. It writes `src/assets/buttons/` (one SVG per hover frame, `<button>-frame-0.svg` onward, plus `<button>-active.svg`) and `src/content/buttonArt.ts`.

The artwork is never altered: each frame's markup is copied verbatim into its own wrapper, which only sets the color, and the script checks that. Only the exported SVGs and `frames.json` are committed; the `.ai` files and PNG renders in `button-art/` are ignored.

## How it's built

- `src/components/DesktopGallery.tsx`: 992px and wider on landscape screens (at least 5:4). Vertical scroll moves one long strip sideways (hero, nav column, panels), using the same linear mapping as the Webflow interaction. Sideways input works too: trackpad swipes and Shift + mouse wheel (down or right goes forward, up or left goes back). The left / right arrow keys step one stop at a time (hero, nav column, then each panel). Keyboard focus (Tab) slides the strip to whatever it lands on; the strip container uses `overflow: clip` so the browser can't scroll it sideways on its own. Switching DESIGN / VIDEO starts the new side at its beginning, the same spot as scrolling away from the hero (full nav column at the left edge, first panel just to its right, so scrolling on plays the same hold-then-collapse): in the same frame as the switch the page scroll goes back to that start and the side being left is nudged sideways by the same amount, so nothing on screen jumps; then the usual slide runs while the rail opens back to full width.
- The desktop nav column (`NavColumn` in `src/components/Nav.tsx`, `.rail` in `index.css`) rides in the strip until its left edge reaches the screen edge, then pins there; the first panel slides under it, and when that panel reaches the docked rail's edge the column collapses to a slim docked rail (0.3 s, the same motion as the hover open), opening again when scrolled back past that point. The buttons keep their height and only get narrower, ending as squares; sizes come from the button art (`src/lib/rail.ts`). Moving the mouse onto the docked rail, tabbing into it, or clicking / tapping it opens it back up over the work; it closes 0.25 s after the pointer leaves. The logo's size follows docking only, so opening the docked rail never moves the buttons under the pointer; opening it turns the logo into the logotype lockup (`src/assets/brand/edf-logotype-lockup.svg`) at the buttons' width, centered between the top of the rail and the rule: the anvil fades out and the wording grows upward, its "design foundry" crossfading into the lockup's bar while ENRIGHT (the same in both files) stays solid (`.logo-mark`, `.logo-words` in `index.css`). The buttons can only be clicked in their wide form. Clicking the logo glides back to the hero, docked or not. The wide and square art crossfade. Below the bottom rule, CONTACT shrinks to fit the docked rail, grows slightly on hover, and opens the contact popup. Every button has square art (`design-square`, `video-square`, `resume-square`). RESUME sits at the bottom, above the rule over CONTACT, and opens the resume in the project viewer (see Resume below). It has selected art too (wide and square): once a resume page or section exists, give it an `href` again and pass `resumeActive` to `NavColumn`, and it behaves like DESIGN / VIDEO (selected art, playing back down when deselected).
- `src/components/MobileGallery.tsx`: under 992px, and portrait screens of any width (portrait iPads, portrait monitors). Normal vertical page; DESIGN / VIDEO slides the columns sideways. The bar across the top has CONTACT (the contact popup) and RESUME (the resume in the viewer), like the bottom of the desktop rail.
- `src/components/ProjectViewer.tsx`: one native `<dialog>` for every project. Opening is three CSS animations on one clock (`.viewer-backdrop`, `.viewer-slide`, `.viewer-controls` in `index.css`): the backdrop dims, the artwork slides up, the buttons slide in from the right. Duration and curves are the `--viewer-*` variables on `.viewer`. Clicking the artwork closes it (drags and text selection don't). Esc, focus, the DESCRIPTION overlay (D key toggles it), and the back button closing it. The extra buttons (`link`, `alternate`) flash their hover colors three times and swell a little right after the viewer arrives (`.viewer-attention`); it plays once per opening and stops early if hovered or pressed. On phones they sit on their own row under DESCRIPTION and close, so long labels fit. On touch screens two fingers pinch-zoom the artwork or the resume pages.
- `src/components/ButtonArt.tsx`: the nav buttons (see Nav button art). Each button's frames are stacked in one box, drawn exactly like the selected frame, and only the current one shows (so the end of the hover and the selected frame line up to the pixel); hovering with a mouse, trackpad or pen (not touch) or keyboard focus runs `--art-frame` (a whole-number CSS property) from the first frame to the last at the art's frame rate, and leaving runs it back from wherever it got to. The selected category shows its active frame. With reduced motion it cuts straight to the end frame. (`LottieButton.tsx` and `public/lottie/design-btn.json` / `video-btn.json` are no longer used.)
- Popups (`src/components/Popup.tsx`): a box with a sand outline on ink over a dimmed page, like the viewer's download popup. A native `<dialog>`, drawn by `App.tsx` outside the gallery and opened from anywhere (`openContact()` in `src/lib/contact.ts`). Esc, the close button or a click outside closes it; the backdrop fades and the box rises in (`.popup-*` in `index.css`), and with reduced motion it just fades. While one is open the page behind doesn't scroll.
  - `ContactDialog.tsx` (CONTACT): "How can I work with you?", `email` from `src/content/site.json` as a mail link, with COPY (copies the address; the label reads COPIED for 2 seconds) and EMAIL (opens the visitor's mail app).
- Resume: RESUME opens the resume in the project viewer, its pages scrolling like the AFC presentation, with DOWNLOAD (the same "Download my resume" popup as the Miami font) and close. Its link is `#resume`. It's `resumeProject` in `src/content/index.ts`. The PDF is `public/downloads/Enright-Resume.pdf` (`resumeFile` in `site.json`; it downloads under that name). The pages in the viewer are images made from the PDF: after replacing the PDF, run `npm run resume` (needs Poppler: `brew install poppler`), which renders the pages into `public/media/resume/full/`, puts them in `media.json`, lists them as `resumePages` in `site.json`, and writes `public/media/resume/full/pages.json` for the Nsyte copy's resume lightbox. `npm run media` leaves the resume's entries alone. Until pages exist, RESUME just opens the PDF.
- Breakpoints match Webflow: base < 480, `sm` 480+, `md` 768+, `lg` 992+, `wide` 1920+ (see `src/styles/index.css`). The `strip:` variant means "using the desktop strip layout" (992px+ and at least 5:4); it matches `STRIP_QUERY` in `src/hooks/useMediaQuery.ts`.
- Site files in `public/`: `404.html` (GitHub Pages shows it for any address that doesn't exist; the font and logo are inside it), `robots.txt`, `sitemap.xml`, and `og-image.png` (the preview picture for shared links, the sidebar logo on sand; set in `index.html`). No analytics for now.
- Colors: `ink` #1D262C, `sand` #CDBAA7, `tomato` #F15B49, `amber` #FDBA5A.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
Set the repo's Pages source to "GitHub Actions". The site is served from the custom domain (Settings > Pages > Custom domain: `enrightdesignfoundry.com`; DNS at Porkbun points the root at GitHub Pages' four addresses and `www` at `pmenright.github.io`), so the workflow builds with `BASE_PATH` `/`. For a test copy at `USERNAME.github.io/REPO/` without a custom domain, `BASE_PATH` would be the repo's sub-folder instead.

## Fonts

DDC Hardware (Draplin Design Co., sold by Lost Type). Confirm the license covers web embedding before going live.

## Nsyte site copy (`public/nsyte/`)

A static copy of the nsyte.com home page (captured 2026-11-13), served at `/nsyte/` and linked from the Nsyte entry's VISIT SITE button (`link` in `projects.json`). Everything loads from this folder; nothing is fetched from Webflow or Google.

Changes from the live page: Nsyte's analytics removed, contact block shows Jim's anvil mark and email (no phone or street address) plus a Resume link that opens the resume in a lightbox styled like the page (red DOWNLOAD, cream close, and the same "Download my resume" popup; its page list is `media/resume/full/pages.json`, and with no JavaScript the link opens the PDF), every demo / trial button opens a "Let's talk about your project" popout with the contact form, videos color-corrected to match the page (and no picture-in-picture pop-out button), the hero rearranged (graphic, factory, rule, then intro text), one content column down the whole page (65vw desktop, 80vw tablet, 85vw phone), body text that scales smoothly between 992 and 1440px, animated benefit icons (generated, CSS inside each SVG; they stop for visitors who ask for reduced motion), and `noindex` so search engines keep pointing at nsyte.com. The texture overlays keep their click-through setting.

Our additions live in `public/nsyte/assets/mirror.js` and `mirror.css`. Forms: with `FORM_ENDPOINT` empty, submitting opens the visitor's email app with the message filled in. Paste a form relay address into `FORM_ENDPOINT` to have messages arrive directly.
