# Hero palettes (fill-in)

Each row is one "frame" of the hero remix. The hero plays the rows top to bottom, one per cut (or per Remix click), then loops.

## What each color does

- **Shadow**: what black in the video becomes.
- **Highlight**: what white in the video becomes. Grays land between the two.
- **Logo**: the fill of the logo.
- **UI** (optional): the scroll hint and the Remix button. Leave it blank to use the Logo color.
- **Logo design**: which logo appears in this frame. Everything is "Lockup" (the current hero SVG) until the new logos exist.

## Guidelines

- **Bright, low contrast inside a palette.** The placeholders put the logo at about 1.1 to 1.6:1 against the background. They read by hue, not by light and dark.
- **Big jump between rows.** Each row should sit far around the color wheel from the one before it, so every cut is an obvious change. The placeholders jump roughly 150 to 180 degrees each time.
- **Order is the play order.** Add, remove or reorder rows freely; any number works.
- **The logo can be low contrast.** It's decorative. The page title is real text that screen readers get, so a logo that sits close to the background is a style choice, not an accessibility failure.
- **The scroll hint is a control.** It needs at least 3:1 against what's behind it. If a palette is too soft for that, put a stronger color in the UI column. Or we give the hint its own small chip.
- **Flash safety.** Full-screen color changes faster than 3 per second count as flashing (saturated reds especially). Cuts every second or slower are safe.

## Palettes

Hex values like `#FF8346`. The first 8 rows are my placeholders; overwrite anything.

| # | Name | Shadow | Highlight | Logo | UI (optional) | Logo design | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Tangerine | `#FF8346` | `#FED9BF` | `#04D5EE` | | Lockup | placeholder |
| 2 | Pool | `#07BFDE` | `#BBEAFF` | `#FF9F9F` | | Lockup | placeholder |
| 3 | Bubblegum | `#F779BA` | `#FED5DF` | `#26E085` | | Lockup | placeholder |
| 4 | Lime | `#86BF3C` | `#C0F1BA` | `#C3AFFE` | | Lockup | placeholder |
| 5 | Lilac | `#B296FF` | `#EBD9FE` | `#D7BF02` | | Lockup | placeholder |
| 6 | Butter | `#C9A90C` | `#E8E6A0` | `#98BFFE` | | Lockup | placeholder |
| 7 | Coral | `#FF7E77` | `#FED7CC` | `#02D9D1` | | Lockup | placeholder |
| 8 | Mint | `#04C89D` | `#9BF5E6` | `#FE91E8` | | Lockup | placeholder |
| 9 | | | | | | | |
| 10 | | | | | | | |
| 11 | | | | | | | |
| 12 | | | | | | | |

`hero-palettes-preview.png` shows the eight placeholders using the real technique (grayscale footage, two-color tint, recolored logo). The stand-in footage is the Miami board until we have the video.

When you've filled this in, tell me and I'll move it into `src/content/hero-palettes.json`, which the site reads. In VS Code, that JSON file shows a color swatch next to every hex value, so you can keep tuning there afterwards.
