# Creating themes for NekoChat Reloaded

Want NekoChat to look your way? There are two kinds of themes you can make:

| Kind | Best for | What you need |
|---|---|---|
| **CSS theme** | Changing colors, fonts, buttons, title bars | A text editor |
| **Windows theme** | Reusing a theme made for Windows XP | A `.msstyles` or `.theme` file |

If you're new to this, start with a **CSS theme** — it's the easiest.

---

## Option 1: Make a CSS theme

### Step 1. Copy the template

Copy the [`template`](../template) folder and give it your theme's name, for example `my-theme`.

Inside you'll find:

- `theme.css` — the look of your theme. **This is the file you edit.**
- `Description.md` — a short description people will see in the catalog.
- `Details.json` — your name and the theme version.

The template is already a complete theme (it looks like Windows Classic), so it works before you change anything.

### Step 2. Change the colors

Open `theme.css` in any text editor. At the top, in the `:root { ... }` block, you'll see settings like these:

```css
--xp-theme-window: #ffffff;        /* background of windows and chat */
--xp-theme-buttonface: #bfbfbf;    /* background of buttons and panels */
--xp-theme-windowtext: #000000;    /* main text color */
--xp-theme-highlight: #00007b;     /* selected items and active tab */
--xp-theme-highlighttext: #ffffff; /* text on selected items */
--xp-theme-graytext: #808080;      /* disabled / hint text */
--xp-title-fill: linear-gradient(270deg, #1085d2 0%, #00007b 100%); /* title bar */
```

Change the values, save the file, and reinstall the theme to see the result.
These six colors plus the title bar already change most of the app.

> **Tip:** Colors are written as `#rrggbb`. Any online "color picker" gives you this code.

### Useful settings

**Title bar**

| Setting | What it changes |
|---|---|
| `--xp-title-fill` | Title bar background (a color or a gradient) |
| `--xp-caption-height` | Title bar height |

**Minimize / maximize / close buttons**

| Setting | What it changes |
|---|---|
| `--xp-caption-normal`, `--xp-caption-hover`, `--xp-caption-pressed` | Minimize and maximize buttons |
| `--xp-close-normal`, `--xp-close-hover`, `--xp-close-pressed` | Close button |
| `--xp-minimize-glyph`, `--xp-maximize-glyph`, `--xp-close-glyph` | The icons drawn on those buttons |
| `--xp-control-width`, `--xp-control-height` | Button size |

**Regular buttons**

| Setting | What it changes |
|---|---|
| `--xp-button-background`, `-hover`, `-pressed` | Button color in each state |
| `--xp-button-shadow`, `-hover`, `-pressed` | 3D edges of buttons |

Below the `:root` block there are normal CSS rules (`.xp-window`, `.chat-app .tab`, and so on). Edit them if you know CSS and want finer control — or just leave them as they are.

> **Important:** Keep every setting from the template, even the ones you don't change. If a setting is removed, parts of the window may look broken.

### Step 3. Fill in the details

`Details.json`:

```json
{ "Author": "Your name", "Version": "1.0", "Type": "CSS" }
```

`Description.md`:

```markdown
# My Theme

Dark theme with purple title bars.
```

### Step 4. Pack it

Put `theme.css` (and any pictures it uses) into a ZIP file named **`Theme.ZIP`**.

- **Windows:** select the files → right-click → *Send to* → *Compressed (zipped) folder*, then rename it.
- **macOS:** select the files → right-click → *Compress*, then rename it.
- **Linux:** `zip Theme.ZIP theme.css`

### Step 5. Try it

- **Android / iPhone:** *Display Properties* → *Themes* → **Add Theme…** → pick `Theme.ZIP` (or just `theme.css`).
- **PC:** copy your theme folder (the one with `theme.css`) into the NekoChat themes folder and restart the app:
  - Windows: `%APPDATA%\NekoChat Reloaded\themes\`
  - Linux: `~/.config/NekoChat Reloaded/themes/`

  Your theme then appears in *Display Properties* → *Themes*.

Not happy yet? Edit `theme.css` and try again. On PC you can edit the file right inside the themes folder and restart the app.

### Using pictures

You can use images (PNG, JPG) in your theme:

1. Put the image next to `theme.css`, e.g. `title.png`.
2. Refer to it by file name only: `background: url("title.png");`
3. Include the image in `Theme.ZIP`.

Don't use folders or web links for images — just the file name.

---

## Option 2: Use a Windows theme

Have a Windows XP visual style? NekoChat can use it directly.

1. Find the theme's `.msstyles` file (and the `.theme` file, if it has one).
2. In NekoChat, open *Display Properties* → *Themes* → **Add Theme…** and pick that file.

That's it — NekoChat converts it automatically.

To share it in the catalog, put the whole theme folder into a ZIP named `Theme.ZIP` and set `"Type": "WindowsThemeFile"` in `Details.json`.

---

## Share your theme with everyone

Want your theme in the in-app **Theme Browser**? Send it to this repository:

1. Fork this repository.
2. Create a folder `themes/<your-theme-id>/` with these files:
   - `Theme.ZIP` — your packed theme
   - `Preview.png` — a screenshot of NekoChat with your theme
   - `Description.md`
   - `Details.json`
3. Add your theme to [`themes.json`](../themes.json):

   ```json
   {
     "theme_id": "my-theme",
     "directory": "themes/my-theme",
     "DisplayName": "My Theme",
     "ColorSchemes": ["Default"],
     "Details": { "Author": "Your name", "Version": "1.0", "Type": "CSS" }
   }
   ```

   The app finds `Theme.ZIP`, `Preview.png` and `Description.md` in that folder automatically.
4. Open a pull request.

**Rules for the catalog**

- `theme_id` must be unique and use only letters, numbers, `-`, `_` and `.`.
- Don't add **Classic** or **Luna** — they're already built into the app.
- Only share themes you made or are allowed to share.

---

## Something went wrong?

| Problem | Fix |
|---|---|
| "Theme.ZIP must contain a .theme, .msstyles, or theme.css file" | The CSS file must be named exactly `theme.css`. |
| Parts of the window look broken | You probably deleted a setting. Copy it back from the template. |
| Picture doesn't show | Check that the image is inside `Theme.ZIP` and referenced by file name only. |
| Changes don't appear | Re-import the theme (phone) or restart the app (PC) after every change. |
| PC's **Add Theme…** doesn't show my file | That button is for Windows themes only. For CSS themes, use the themes folder (see Step 5). |
