# Mobile and lightbox pass

Date: 2026-11-20. Checked on the `dev` branch at 320×568, 360×740, 375×812, 390×844, 430×932, 600×960, 768×1024, 820×1180, 991×1400 (portrait), 568×320, 667×375, 844×390, 932×430 (phones on their side), 1024×768, 1180×820 (iPad landscape), 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440. Chromium and Firefox, dev server and production build at `/dev/`.

## Fixed

| # | Where | Problem | Fix |
|---|---|---|---|
| M1 | Hero, phones on their side (844×390, 932×430) | The lockup was sized by width only, so it overflowed the screen and ENRIGHT was cut off at the top | The lockup now fits the hero box both ways (`object-contain`, at most 1000px wide) at every size |
| M2 | Hero, 480–991px | Sizes jumped: at 600px wide the lockup was larger than at 768px (`sm:h-[70%]` then `md:w-[90%]`) | One rule for every phone and tablet |
| M3 | First screen, phones | The hero was 95vh, so on a phone with its toolbars showing the DESIGN / VIDEO row was below the fold | Hero = screen height (`svh`) minus the row, so the first screen is CONTACT / RESUME, the lockup, and DESIGN / VIDEO |
| M4 | DESIGN / VIDEO row | Not sticky: after 13 projects, switching to VIDEO meant scrolling all the way back up (Priority 1 item 4 in the rebuild plan) | Sticks to the top once scrolled to. Switching while deep in the work starts the new side at its first project, without a visible jump (same idea as the desktop strip) |
| M5 | Work tiles, phones on their side | Every tile was a full-width square, two to three screens tall, so you only ever saw a slice of each board | Tiles are sized so a whole one fits on screen: two or three across |
| M6 | Work tiles, tablets (768px and up, portrait) | One giant square per screen | Two across |
| M7 | End of each side | The work just stopped | End card: see the other side, About me, Contact. It fills out the grid's last row so there's never an empty square |
| M8 | CONTACT / RESUME bar | 6vw on phones, then 3vh from 480px (about 10px on a phone on its side), then 16.8px from 768px | One size curve, 16–22px |
| M9 | DESIGN / VIDEO row | 75px tall from 480px, a quarter of a phone on its side | 50px on phones and short screens, 56px, 64px on tablets |

## Lightbox (why people weren't finding DESCRIPTION and the other buttons)

What was going on, from screenshots at every size:

1. **The buttons sat on top of the artwork** in the top-right corner, outlined in sand on a 40% ink fill. On light boards (Army Futures Command is white, Nsyte is cream) that fill turns light gray and the sand outline and text nearly vanish: "VIEW BRANDING PRESENTATION" was close to invisible on AFC at 1440×900.
2. **They were small and far from where people look**: 30px tall with 12–14px text, in the corner, while the eye goes to the center of the artwork. On a 2560px screen they were tiny.
3. **On phones under 480px the extra button wrapped onto a second row** under DESCRIPTION and close.
4. **The description covered the artwork** (a gradient over the bottom of the board), and on big screens it was 15px text crossing busy art.

What it is now:

- **A caption bar under the artwork**, in its own strip (nothing ever sits on top of the art): the project's title and discipline, then DESCRIPTION and the project's extra buttons (Visit site, Watch video, Download typeface...). Solid ink buttons with the sand outline, 40px tall with a mouse, 44px on touch, larger on very wide screens. Only the close button stays in the top corner, where everyone looks for it.
- **The title is always visible**, which is the cue that there's more to read.
- DESCRIPTION has a plus that turns into a minus; external links get an arrow, downloads a download mark.
- **Phones**: the title sits above a full-width row of buttons (long labels wrap inside their button instead of pushing the row onto two lines), in thumb's reach, and the artwork rests right on the bar so the two read together.
- **The description** opens as a solid panel down the right side on screens lying on their side, and as a drawer under the caption bar on tall screens. The artwork re-fits into what's left, so the text never covers it, and it can stay open while a video plays.
- The first project a visitor opens, DESCRIPTION flashes once (the same flash the extra buttons already had). The extras still flash every time, after DESCRIPTION when both do.

## Needs new artwork (alternate graphics for phones)

These can't be fixed in code without changing the art, so they're yours:

1. **Hero lockup for phones.** The lockup is wide (1013 × 594), so on a portrait phone it's 337px wide with a lot of empty ink above and below, and the small lines (AUSTIN BASED, VETERAN OWNED, GRAPHIC DESIGN, VIDEOGRAPHY) render about 6px tall. A stacked version (badge on top, ENRIGHT, DESIGN FOUNDRY, then the four tags) would fill a phone screen. Drop it in and the hero can switch on `(orientation: portrait)`.
2. **Portrait layouts of the wide boards**, like Candescent's (`"portrait"` in `projects.json`). The ones that suffer most on a phone, with small text the viewer shrinks to the screen width:
   - Nsyte (1.59:1): the color swatch values are unreadable without zooming
   - Honest Barber (1.86:1): can't use `"split"` because the lettering crosses the middle
   - EkoTots (1.45:1)
   - HACKtheMACHINE Unmanned and Virtual (1.69:1 and 1.78:1)
3. **About page portrait.** Placeholder frame for now (`photo` in `src/content/about.json`).
4. **Award icon.** One-color placeholder medal in `src/about/AwardIcon.tsx`.

## Left as is

- The viewer's backdrop is `#000000CC` like the Webflow site, so the page behind shows through faintly (the hero lockup behind a phone's artwork). A darker backdrop would hide it.
- No end card on the desktop strip yet (the plan's Priority 2 item 7); the mobile one could be reused.
