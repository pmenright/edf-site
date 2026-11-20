# Hero remix: plan

Updated 2026-11-13. A living plan; we'll change it as the idea gets refined.

## The idea

The hero's solid background becomes a black-and-white video tinted in two bright colors. The logo sits on top in a third color. On every cut in the edit (and, for testing, on every press of a **Remix** button), the whole frame changes: a new tint, a new logo color and eventually a new logo design. The hero becomes a fast, constantly shifting reel that shows design range at a glance.

## How it will work

**Layers, back to front**

1. **Video, black and white.** One muted, looping clip with no audio. I convert your footage to grayscale and encode small web versions.
2. **Tint.** A gradient map: black becomes the palette's Shadow color, white becomes its Highlight, grays fall between. I'll build this in WebGL (a small shader drawing the video into a canvas), for three reasons:
   - The mapping is exact.
   - Contrast, levels and grain can be tuned live while we tweak.
   - Wipes, irises and halftone dissolves are just a mask in the same shader.

   If WebGL isn't available, a CSS fallback does the same tint with blend modes (the technique in `hero-palettes-preview.png`) and hard cuts only.
3. **Logo.** The SVG is used as a mask over a solid fill, so any single-color logo can take any color with no re-export. Future logos drop in the same way: one color, transparent background, and the same artboard size, so swaps don't jump around.
4. **UI.** The scroll hint and the Remix button take the palette's UI color.

**Data:** `src/content/hero-palettes.json` (filled from `HERO-PALETTES.md`) lists the frames in order: Shadow, Highlight, Logo, UI and which logo. A second small file lists the logos.

**Timing (phase 3):** the frame index comes from the video's own clock, `floor(currentTime / X)`, where X is your cut interval. It's checked every display frame, so the change lands on the cut, not a quarter second late. Palettes count up across loops, so each pass through the video can pair cuts with different colors.

## What I need from you

| Item | When | Notes |
|---|---|---|
| Stand-in video | Phase 1 | I'll try to pull the Fathom5 hero clip. My workspace can't download from most sites, so if that fails, drop the file (or your original export, which will look better) into the project folder. |
| Palettes | Any time | Fill in `HERO-PALETTES.md`. The placeholders work until then. |
| Cut interval X | Phase 3 | See "Edit specs" below. |
| Final video edit | Phase 4 | |
| New logos | Phase 4 | Single-color SVGs, same artboard size as the current lockup. |

## Phases and schedule

A "session" is one working session with me. The tweak buffers are deliberate: this is the part where the idea gets good.

| Phase | Work | Sessions |
|---|---|---|
| **1. Hero lab** | Stand-in video converted to B&W and encoded. Shader tint, logo mask, placeholder palettes. **Remix** button top left, plus a test switch for transition styles (`?transition=cut`, `wipe`, `iris` and so on). A dev-only tuning panel for contrast, levels and grain, so you can dial the look yourself. Reduced-motion support and a pause control from the start. | 1 |
| **Tweak buffer A** | You play with it; we adjust the tint, transitions, timing and palettes. Expect a few rounds. | 1 to 2 |
| **2. Sync to the edit** | Automatic changes on every cut (interval X). The video pauses when the hero scrolls out of view or the tab is hidden. Phone framing of the landscape video. Remix becomes "skip to the next frame" or goes away (your call). | 1 |
| **Tweak buffer B** | Real devices: your iPhone, Firefox on the Mac, Safari. Tune performance and the phone crop. | 1 |
| **3. Real content** | Final video, your palettes, multiple logos. Size budget check: about 2 to 4 MB of video, loaded after the page appears. A poster frame shows first. | 1 |
| **4. Polish** | Final transition choice, timings, accessibility pass, Lighthouse on the production build. | 1 |

Roughly 5 to 7 sessions in total. The launch track below runs alongside, not after.

## Transition ideas for Remix (to try in the lab)

1. **Hard cut.** Instant swap on the frame. It's the most "edit" feeling and the baseline for syncing to cuts.
2. **Wipe.** The new frame sweeps across in 150 to 250 ms, left to right like the site's sideways scroll.
3. **Iris from the button.** The new frame grows in a circle from the Remix button. Nice for the click, odd for automatic cuts.
4. **Flash frame.** One or two frames of solid logo color between palettes, like a camera flash. Use sparingly (flash safety).
5. **Halftone dissolve.** The new frame comes in through a growing dot pattern. This ties to the halftone texture on your DESIGN / VIDEO buttons.
6. **Misregistered plates.** The logo arrives as two or three offset color plates that snap into register, a print-shop nod that fits "foundry".
7. **Stamp.** The logo swaps with a tiny press (104% to 100%), like a stamp hitting paper. It combines with any of the above.

My guess: hard cuts for the automatic edit-synced changes, plus one stylized transition (wipe or halftone) for Remix clicks. The lab will settle it.

## Edit specs (for syncing)

- **Constant frame rate**, 24 or 30 fps.
- **X a whole number of frames**, for example 1.0 s (24 frames) or 0.75 s (18 frames at 24 fps).
- **The first cut at X**, not at 0, and the **total length an exact multiple of X**, so the loop point is also a cut.
- **Not faster than about 3 cuts per second**, because every cut is a full-screen color change (flash safety).
- **Master at 1920x1080 or larger**, black and white or color (I'll desaturate). Strong contrast and texture tint best; flat gray footage turns into flat color.
- **Phones:** the hero there is tall, so the center of the landscape frame gets cropped. Keep the action near the center, or cut a separate 9:16 version later.
- **No audio needed.**

## Guardrails

- **Weight:** the video only starts loading after the page appears; the poster frame shows first. Web encodes target about 2 to 4 MB in total.
- **Battery and CPU:** the video pauses when the hero is off screen or the tab is hidden.
- **iPhone Low Power Mode** blocks autoplaying video. Then the poster shows, and palettes still change on a timer.
- **Reduced motion:** no video playback and no automatic changes. Remix still works, as a plain cut.
- **Pause control:** anything that moves for more than 5 seconds needs a way to stop it (WCAG 2.2.2). A small pause button in the corner covers it.

## Open questions (no rush)

1. Is Remix test-only, or a permanent toy for visitors?
2. Should the logo design change on every cut, or only every few cuts?
3. Should the scroll hint change color with each frame, or stay sand?
4. Phones: crop the landscape video, or a separate vertical edit?
5. Launch before the hero refresh, or wait for it? Launch doesn't depend on it; the current hero is ready now.

---

# Going live

## GitHub

You need a free GitHub account. If you already have one from earlier GitHub Pages projects, use it. On the free plan, the repository has to be **public** for GitHub Pages, so two things need settling before the first push:

- **Audit S5:** your Gmail address and phone number are in the source. Once pushed, they stay in the public history even if removed later. Either accept that (they're already on the live site) or swap in an alias before the first commit.
- **Fonts:** done. You cleared them.

Steps:

1. **Create the repo and push the project.** The easiest way is GitHub Desktop: File > Add Local Repository > choose `edf-site` > Publish repository, and uncheck "Keep this code private". `node_modules`, `dist`, `backups/`, `media-src/` and `_for-media-src/` are already ignored.
   - I can do the local git setup and the first commit in your folder instead, if you allow file deletion there. git needs to delete its own lock files.
2. **Turn on Pages.** Repo Settings > Pages > Source: **GitHub Actions**. The workflow already in the project builds and deploys on every push.
3. **Test it.** The first deploy goes to `https://YOUR-USERNAME.github.io/edf-site/`. Check it on your phone and in Firefox.

## Domain: GoDaddy to Porkbun (start now; it takes days)

1. **Get into GoDaddy.** You need access to the account and to the email address listed as the domain's administrator contact.
2. **Remove blockers.** Downgrade any paid "Domain Protection" plan, then unlock the domain.
3. **Get the authorization code.** GoDaddy emails it.
4. **Start the transfer at Porkbun.** porkbun.com/transfer: enter the domain and the code, then pay. A .com transfer includes a year of renewal. Confirm the emails from both companies.
5. **Speed it up.** Approve the transfer at GoDaddy. Otherwise it can take 5 to 7 days.
6. **Set up DNS at Porkbun** before switching nameservers, so nothing goes dark. The domain keeps its old nameservers after the transfer until you change them.

## Cutover (once the transfer is done and the site is ready)

1. **Verify the domain on GitHub.** Profile Settings > Pages > Add a domain. Add the TXT record it gives you at Porkbun. This stops anyone else from claiming the domain on GitHub.
2. **Add the records at Porkbun** and delete the old Webflow and Zoho ones:

   | Type | Host | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | AAAA | @ | 2606:50c0:8000::153 |
   | AAAA | @ | 2606:50c0:8001::153 |
   | AAAA | @ | 2606:50c0:8002::153 |
   | AAAA | @ | 2606:50c0:8003::153 |
   | CNAME | www | YOUR-USERNAME.github.io |

3. **Switch the build to the root.** In `.github/workflows/deploy.yml`, set `BASE_PATH` to `/` (audit S4).
4. **Connect the domain.** Repo Settings > Pages > Custom domain: `enrightdesignfoundry.com`, Save. Once the certificate is issued, tick **Enforce HTTPS**. DNS changes can take up to a day to spread.
5. **Shut down Webflow.** Once the new site is live on the domain, cancel the Webflow site plan.

## Before it goes public (from the audit)

- **S5:** the email and phone decision (above).
- **Resume button:** `/resume/` doesn't exist yet. Point it at a PDF, or hide it for launch.
- **U7:** a share image (`og-image.jpg`, 1200x630), a 404 page, and robots and sitemap files.
- **A3 and U10:** alt text, copy fixes, descriptions for Phantom 5 and Hands, and the now-redundant AFC "Logo Option 3" line.
- **Optional:** the Nsyte notice bar (S1). Nsyte has OK'd the copy, so it's your call.

## Why GitHub Pages and not the Rock 5B

The Rock could serve this site. But for a public portfolio, GitHub Pages is the better fit: free, a global CDN, HTTPS handled for you, and nothing exposed on your home network. The Rock is the right home for the contact form relay later (audit S2), where an always-on machine actually helps.
