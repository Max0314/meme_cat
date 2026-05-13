# Cat Meme Studio

Windows desktop app for making Chinese cat meme short videos.

## Commands

```powershell
npm install
npm run dev
npm run build
```

The app keeps working files under `D:\cat_meme` by default:

- `assets` for downloaded/imported media
- `projects` for `.catmeme.json` project files
- `output` for exported videos
- `data` for settings and asset indexes

Set `CAT_MEME_HOME` to override the workspace root.

Cat meme resource links are collected in `docs/cat-meme-resources.md`.
Cat meme theater product notes are in `docs/cat-meme-theater-design.md`.

## Editing shortcuts

- `Space`: play or pause the quick timeline preview
- `J` / `K` / `L`: jump back, pause, play; repeated `L` increases preview speed
- `Left/Right`: step one frame
- `Shift + Left/Right`: jump 15 frames
- `Ctrl + Left/Right`: jump to the previous or next edit point
- `Alt + Left/Right`: nudge the selected clip by one frame
- `Shift + Alt + Left/Right`: nudge the selected clip by ten frames
- `Home/End`: jump to start or end
- `S`, `B`, or `Ctrl + K`: split the selected clip at the playhead
- `[` / `]`: trim the selected clip start or end to the playhead
- `Ctrl + C` / `Ctrl + V`: copy and paste the selected clip at the playhead
- `Delete`: delete the selected clip
- `Esc`: clear selection
- `Ctrl + S`: save the project
- `Ctrl + D`: duplicate the selected clip
- `H` / `V`: flip the selected visual clip horizontally or vertically
- `R` / `Shift + R`: rotate the selected visual clip by 15 degrees
- `0`: reset selected visual clip transform
- `M`: mute or unmute the selected clip
- `Ctrl + mouse wheel` on the preview: scale the selected visual clip
- `Ctrl + mouse wheel` on the timeline: zoom the timeline view only
- `Ctrl + +` / `Ctrl + -`: zoom the timeline view only

Timeline editing:

- Drag a local asset card from the left panel onto a timeline track to place it at that frame.
- Drag a local image/video/GIF asset directly onto the preview canvas to place it visually at the current playhead frame.
- Drag a clip horizontally to change the frame where it appears.
- Drag a clip to another matching track to change its layer order.
- Drag the left or right edge of a video or audio clip to rate-stretch it; playback speed changes while the source in-point stays fixed.
- Use `[` / `]`, split, or the inspector source in field when you want trimming instead of rate stretch.
- Set the project duration from the timeline duration controls or the project overview; 15s, 30s, and 60s are available as quick choices.
- Use the selected visual clip inspector to set X/Y position, scale, rotation, horizontal flip, vertical flip, and opacity.
- Green-screen assets imported from the resource folder auto-enable keying when placed on a visual track; tune it in the selected clip inspector.
- Quick preview now plays active voice, music, SFX tracks, and native audio from visible video clips. Export also mixes detected video native audio plus audio-track clips.

## Packaging

Lightweight development build:

```powershell
npm run build
```

Full offline Windows package with the current `assets` directory bundled:

```powershell
npm run build:full
```

The full package is written to `release-full\Cat Meme Studio-0.1.0-full-offline-x64.zip`.
Users can unzip it and either run `Cat Meme Studio.exe` directly or run `Install-CatMemeStudio.cmd` to copy it to the current user's Programs folder and create shortcuts.

Subtitle and role dialogue controls:

- Select a subtitle clip on the `大字幕` track, then use the right inspector `角色对白` panel to set role name, show/hide role name, role-name position, dialogue text, and dialogue position.
- Open the right `脚本` tab and use `字幕样式` to set the global font, size, text color, outline color, outline width, default position, and background strip.
- The quick preview and exported MP4 both use these role name and subtitle style settings.

Role workflow:

- Open the right `角色` tab to create and edit character cards.
- Each role stores name, identity label, default video track, default stage position, common meme keywords, favorite meme assets, and common lines.
- Each role also has editable `状态 meme` rows, so the same role can switch between default, reaction, crying, angry, shocked, or custom meme assets.
- Use `出场`, `台词`, or `镜头+台词` to place role material at the current playhead frame.
- Role meme tiles are draggable; drop them onto any visual track for frame-level editing.
- Select any visual clip to set X/Y position, scale, rotation, horizontal flip, vertical flip, opacity, green-screen keying, and trim frames.

## Import local resource pack samples

Copy the current curated resource subset into the app asset library:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\import-resource-samples.ps1 -CleanManagedAssets
```

The script currently imports green-screen videos only from `资源\猫meme素材合集\猫meme绿幕素材 2000个\00.热门常用猫meme素材【B站的在这】`.
It imports 24 hot green-screen videos by default, then imports 4 images from each first-level scene folder under `资源\猫meme素材合集\背景素材  700个`.
Scene categories follow the folder names: `办公室`, `城市`, `窗口`, `古风`, `建筑内`, `建筑外`, `教室`, `街道`, `实景--办公室`, `实景--车内`, `实景--城市`, `实景--地铁 公交车 车站`, `实景--学校`, `小院`, `学校`, `野外`.
Use `-VideoLimit` and `-BackgroundsPerFolder` to tune the package size.

Import a larger hot green-screen set and classify it for direct browsing in the app:

```powershell
node scripts\import-full-green-screen-library.mjs
```

The Node importer defaults to the same hot directory with a limit of 48 videos.
Pass `--limit 0` only when you intentionally want every unique video from that hot directory bundled.

## Demo assets and demo export

Generate original local demo assets:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate-demo-assets.ps1
```

Export a complete demo video through the app render service:

```powershell
npm run build:app
npx electron . --export-demo
```
