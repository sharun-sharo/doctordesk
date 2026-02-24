# Adding a Demo Video to the Landing Page

The "Watch 2-min demo" section and the hero area are wired to play a single demo video. The app **does not include** a video file; you add your own.

## Quick setup

1. **Create or obtain your demo video**
   - Record a 1–2 minute walkthrough (e.g. Loom, OBS, or QuickTime).
   - Export as **MP4** (H.264) for best compatibility.

2. **Add the file to the frontend**
   - Put the file in `frontend/public/`, e.g.:
     - `frontend/public/demo.mp4`

3. **Configure in code**
   - Open `frontend/src/pages/Login.jsx`.
   - Set the constants near the top:
     ```js
     const DEMO_VIDEO_SRC = '/demo.mp4';
     const DEMO_VIDEO_POSTER = ''; // optional: '/demo-poster.jpg'
     ```
   - Optional: add a poster image (thumbnail before play) in `public/` and set `DEMO_VIDEO_POSTER` to its path, e.g. `'/demo-poster.jpg'`.

4. **Result**
   - Clicking "Watch 2-min demo" opens the modal and plays the video.
   - If you set `DEMO_VIDEO_SRC`, the hero background can use the same video (desktop).

## Tips

- Keep the file under ~50MB so the page loads quickly; compress if needed.
- Use a poster image so the modal doesn’t start as a black frame.
- Hosting the video on a CDN (e.g. Cloudinary, Vimeo) and using that URL in `DEMO_VIDEO_SRC` is also supported.
