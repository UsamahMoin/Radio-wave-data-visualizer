# Radio Wave Data Visualizer

A research-backed interactive website that shows moving digital data on a modulated radio signal and explains the difference between carrier frequency and channel bandwidth.

Live Page: https://usamahmoin.github.io/Radio-Wave-Data-Visualizer/

## Features

- Type a message and see it converted into binary bits.
- Watch every bit in a long message move through a continuously scrolling waveform.
- Switch between ASK, FSK, and PSK modulation.
- Compare representative 2.4, 5, and 6 GHz Wi-Fi channel widths.
- See why wider channels can carry more data without implying that a higher GHz number is automatically faster.
- Use UTF-8 encoding for realistic text-to-byte conversion.
- Fully static: HTML, CSS, and JavaScript only.

## Run locally

Run a small local web server from this folder:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8000/
```

You can also open `index.html` directly in a browser, but the local server matches how the site is served online.

## Publish on GitHub Pages

1. Create a new public GitHub repository.
2. Upload or push these files to the repository root:
   - `.nojekyll`
   - `index.html`
   - `script.js`
   - `style.css`
   - `README.md`
   - `STYLE_GUIDE.md`
3. In the repository, go to **Settings -> Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Set **Branch** to `main` and folder to `/root`.
6. Save. GitHub will publish the site at:

```text
https://<your-github-username>.github.io/<repository-name>/
```

GitHub Pages can take a minute or two to build the first time after you save the setting.
