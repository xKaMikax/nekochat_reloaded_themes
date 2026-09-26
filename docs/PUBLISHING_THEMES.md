# Publishing your theme to the Theme Browser

Made a theme you're proud of? Put it in the **Theme Browser** so everyone can install it in one click.

You only need a free GitHub account and a web browser. No programs to install, no command line.

> Haven't made a theme yet? Start here: [Creating themes](CREATING_THEMES.md).

---

## What you need

Get these four files ready in one folder on your computer:

| File | What it is | Tips |
|---|---|---|
| `Theme.ZIP` | Your packed theme | See [Step 4 of the creation guide](CREATING_THEMES.md#step-4-pack-it) |
| `Preview.png` | A screenshot of NekoChat with your theme | About **807 × 559** px, so it looks like the other previews |
| `Description.md` | A short description | One heading and one or two sentences |
| `Details.json` | Author, version and type | See below |

`Details.json` looks like this:

```json
{ "Author": "Your name", "Version": "1.0", "Type": "CSS" }
```

Use `"Type": "CSS"` for a CSS theme or `"Type": "WindowsThemeFile"` for a `.msstyles` / `.theme` theme.

### Pick a theme ID

Your theme needs a short **ID**, for example `midnight-purple`.

- Use only lowercase letters, numbers and `-`.
- It must not be used by another theme. Check the [`themes`](../themes) folder first.

In the steps below, replace `my-theme` with your ID.

---

## Step 1. Make your own copy of the repository

1. Sign in to [GitHub](https://github.com) (or create an account; it's free).
2. Open this repository and click **Fork** in the top-right corner.
3. Click **Create fork**.

You now have your own copy where you can add files.

## Step 2. Upload your theme files

1. In **your copy**, open the `themes` folder.
2. Click **Add file** → **Upload files**.
3. Drag your four files into the page.
4. Put them in their own folder. Click at the top where the path is shown and type `my-theme/` before the file names.
   The files must end up in `themes/my-theme/`.
5. Click **Commit changes**.

Check the result: `themes/my-theme/` must contain `Theme.ZIP`, `Preview.png`, `Description.md` and `Details.json`.

## Step 3. Add your theme to the list

The app only shows themes listed in `themes.json`.

1. Open [`themes.json`](../themes.json) in your copy and click the ✏️ **pencil** icon.
2. Find the last theme in the list. After its closing `}`, add a **comma** and your entry:

   ```json
       },
       {
         "theme_id": "my-theme",
         "directory": "themes/my-theme",
         "DisplayName": "My Theme",
         "ColorSchemes": ["Default"],
         "Details": { "Author": "Your name", "Version": "1.0", "Type": "CSS" }
       }
     ]
   }
   ```

   - `theme_id` is your ID.
   - `directory` is `themes/` plus your ID.
   - `DisplayName` is the name people see in the app. Spaces and capital letters are fine here.
3. Click **Commit changes**.

> ⚠️ **The most common mistake is a missing or extra comma.** Every theme entry except the last one ends with `},` and the last one ends with `}`.
> Not sure? Paste the whole file into [jsonlint.com](https://jsonlint.com). It will tell you if something is wrong.

## Step 4. Send it to us

1. Go to the main page of your copy.
2. Click **Contribute** → **Open pull request**.
3. Give it a title like `Add theme: My Theme` and attach a screenshot if you like.
4. Click **Create pull request**.

Done! We'll check your theme and publish it. If something needs fixing, we'll leave a comment on your pull request.

---

## After your theme is published

Your theme appears in **Theme Browser** → **Discovery** for everyone, on PC, Android and iPhone. No app update is needed.

### Updating your theme

1. Replace `Theme.ZIP` (and `Preview.png`, if the look changed) in `themes/my-theme/`.
2. Raise the version number in `Details.json` **and** in your `themes.json` entry, for example `1.0` → `1.1`.
3. Open a new pull request, just like in Step 4.

Keep the same `theme_id` so it's treated as the same theme.

---

## Before you send: checklist

- [ ] The theme installs and looks right on your own device.
- [ ] The folder is `themes/<your-id>/` and contains all four files.
- [ ] The ZIP file is named exactly `Theme.ZIP`.
- [ ] `themes.json` passes [jsonlint.com](https://jsonlint.com).
- [ ] `theme_id` and `directory` match your folder name.
- [ ] You made this theme yourself, or you have permission to share it.
- [ ] It isn't **Classic** or **Luna**. Those are already built into the app.

## We may not accept a theme if…

- it copies someone else's work without permission;
- it has offensive images or text;
- it breaks the app (unreadable text, missing buttons);
- it's almost identical to a theme that's already in the catalog.
