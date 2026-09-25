# NekoChat Reloaded Themes

This repository is the online catalog used by **Theme Browser** in the NekoChat Reloaded PC client.

The client downloads [`themes.json`](themes.json), shows every listed theme in the **Discovery** tab, and installs its `Theme.ZIP` file. **Classic** and **Luna** are built into the client, so they do not belong in this catalog.

## Adding a theme

Create a directory for the theme and include these files:

- `Theme.ZIP` — the downloadable package;
- `Preview.png` — preview image;
- `Description.md` — short description;
- `Details.json` — author, version, and type.

`Theme.ZIP` must contain either a Windows `.theme`/`.msstyles` file or a `theme.css` file.

- `WindowsThemeFile` means a Windows visual-style theme (`.theme` or `.msstyles`).
- `CSS` means a NekoChat CSS theme (`theme.css`).

Then add the theme to [`themes.json`](themes.json):

```json
{
  "themes": [
    {
      "theme_id": "example-theme",
      "directory": "themes/example-theme",
      "DisplayName": "Example Theme",
      "ColorSchemes": ["NormalColor"],
      "Preview": "https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded_themes/main/themes/example-theme/Preview.png",
      "Description": "https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded_themes/main/themes/example-theme/Description.md",
      "Details": {
        "Author": "Author name",
        "Version": "1.0",
        "Type": "WindowsThemeFile"
      },
      "ThemeZIP": "https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded_themes/main/themes/example-theme/Theme.ZIP"
    }
  ]
}
```

The client also accepts `ColorShemas` for compatibility with older catalog files.
