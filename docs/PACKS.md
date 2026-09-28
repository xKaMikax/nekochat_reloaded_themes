# Cursors, sounds, icons, chat wallpapers, assistants and combos

Besides themes, the **Catalog** installs **packs**. There are six types:

| Type | What it changes | Folder in this repository |
|---|---|---|
| `cursors` | The mouse pointers | [`cursors/`](../cursors) |
| `sounds` | The sounds of the app (new message, calls, clicks…) | [`sounds/`](../sounds) |
| `icons` | The icons of the app's buttons and windows | [`icons/`](../icons) |
| `wallpapers` | Pictures for the chat background | [`wallpapers/`](../wallpapers) |
| `assistants` | A Microsoft Agent character in the chat window, like Rover | [`assistants/`](../assistants) |
| `combo` | A list of items from this catalog: a theme and cursor, sound and icon packs | [`combos/`](../combos) |

People choose installed packs in **Display Properties**: sounds on the **Sounds** tab; cursors, icons and the chat background on the **Display** tab.

A **combo** has no files of its own: it is an entry in `packs.json` that names a theme and packs **from this catalog**. Installing it installs each of them (skipping what is already installed); removing it removes them again. Its sounds, cursors and icons can be chosen like those of any pack.

## The pack archive

A pack can be published in two ways: as plain files (see [Without Pack.ZIP](#without-packzip)) or as an archive.

With an archive, each pack is a folder with three files:

```
sounds/my-sounds/
├── Pack.ZIP        the pack itself
├── Preview.png     picture shown in the catalog
└── Description.md  text shown in the catalog
```

Inside `Pack.ZIP`:

```
pack.json           name, author, type
sounds/             sound files (sounds packs)
cursors/            cursors.json + cursor files (cursors packs)
icons/              icons.json + pictures (icons packs)
wallpapers/         .jpg, .png or .webp pictures (wallpapers packs)
```

Start from the [template](../template/pack).

### `pack.json`

```json
{ "name": "My sounds", "author": "Your name", "type": "sounds" }
```

### Sounds

Name each file after the event it plays for. `.wav` works everywhere; `.mp3` and `.ogg` work too. Leave out any sound to keep the app's own.

| File | When it plays |
|---|---|
| `notify.wav` | A new message |
| `ringin.wav` | An incoming call or voice channel invite (loops) |
| `ringout.wav` | Your outgoing call is ringing (loops) |
| `logon.wav` | Signing in |
| `logoff.wav` | Signing out |
| `navigation.wav` | A click on a button |
| `minimize.wav` | Minimizing a window |
| `default.wav` | An information message |
| `exclamation.wav` | A warning |
| `error.wav` | An error |
| `critical.wav` | A critical error |

### Cursors: `cursors/cursors.json`

Each entry names a pointer, its file and its hot spot (the pixel that points). Files can be `.cur` or `.png` (animated `.ani` cursors are not supported by the app's web engine; use the first frame as a `.png`).

```json
{
  "default": { "file": "arrow.cur", "x": 0, "y": 0 },
  "pointer": { "file": "hand.cur", "x": 6, "y": 0 },
  "text": { "file": "ibeam.cur", "x": 8, "y": 9 }
}
```

Pointer names: `default`, `pointer` (links and buttons), `text`, `wait`, `progress`, `not-allowed`, `help`, `crosshair`, `move`, `ew-resize`, `ns-resize`, `nwse-resize`, `nesw-resize`.

### Icons: `icons/icons.json`

Square PNG pictures, 32×32 or larger.

```json
{ "app": "app.png", "call": "call.png", "members": "members.png" }
```

Icon names: `app` (window icon), `personalize`, `change-user`, `sign-out`, `room` (rooms in the chat list), `add` (new chat), `call`, `members`, `notifications`.

### Chat wallpapers

Put `.jpg`, `.png` or `.webp` pictures in `wallpapers/`. Each picture appears under **Chat background** by its file name. A large picture (1920×1200 or so) looks best; it is scaled to cover the chat.

### Assistants

An assistant is a Microsoft Agent character (a `.acs` file, like Merlin or the Windows XP search
companions) that lives in the chat window. A click on it opens a balloon: search all chats,
unread chats, change your status, tips. Rover is built into the app.

Turn a `.acs` file into a pack with [`tools/acs2pack.py`](../tools/acs2pack.py) (needs Pillow):

```
python3 tools/acs2pack.py Merlin.acs assistants/merlin
```

It writes `agent.json` (the animations), `frames.png` (every image), `sound<N>.wav` and
`Preview.png`, and prints the `Files` list for `packs.json`. Add a `Description.md` and an entry with
`"type": "assistants"`; the files go to the pack's `assistant/` folder. The app plays the usual
animations when it has them: `Show`, `Hide`, `Idle…`, `Searching`, `ClickedOn`, `GetAttention`,
`Pleased`, `Thinking`, `Acknowledge`, `Congratulate`.

Only publish characters you may share.

## Without Pack.ZIP

You do not have to make an archive. Put the files straight into the pack's folder and list them in `Files`:

```
wallpapers/autumn/
├── Autumn.jpg
└── Description.md
```

```json
{
  "pack_id": "autumn-wallpaper",
  "type": "wallpapers",
  "directory": "wallpapers/autumn",
  "DisplayName": "Autumn",
  "Files": ["Autumn.jpg"],
  "Details": { "Author": "Microsoft", "Version": "1.0", "Added": "2026-09-28" }
}
```

The app downloads each listed file into the folder of the pack's type, as if it came from `Pack.ZIP` (`Autumn.jpg` becomes `wallpapers/Autumn.jpg`). The files must sit directly in the pack's folder, with no subfolders. For cursors and icons, list `cursors.json` or `icons.json` too.

`Preview.png` is optional here: a wallpapers pack without one shows its first picture in the catalog.

## Combos

A combo is only a `packs.json` entry. `Includes` lists what it is made of, by the `theme_id` of
a theme in `themes.json` and the `pack_id` of packs in `packs.json` (`cursors`, `sounds`, `icons`, `wallpapers`):

```json
{
  "pack_id": "zune-complete",
  "type": "combo",
  "DisplayName": "Zune — theme, cursors and sounds",
  "Includes": { "theme": "Zune", "cursors": "zune-cursors", "sounds": "zune-sounds" },
  "Details": { "Author": "Your name", "Version": "1.0", "Added": "2026-09-28" }
}
```

Any part can be left out. A combo can have a `Preview.png` and `Description.md` in `combos/<id>/`
(set `"directory": "combos/<id>"`), but it has no `Pack.ZIP`.

## Publishing

Add your folder, then an entry to [`packs.json`](../packs.json):

```json
{
  "pack_id": "my-sounds",
  "type": "sounds",
  "directory": "sounds/my-sounds",
  "DisplayName": "My sounds",
  "Contains": ["sounds"],
  "Details": { "Author": "Your name", "Version": "1.0", "Added": "2026-09-28" }
}
```

`Added` is the date the pack was added. The catalog sorts by it, newest first.
