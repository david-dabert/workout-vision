# Choice screen evidence

Production build and Playwright WebKit iPhone profile. `evidence.mjs` taps every choice and checks the selected lift in the existing upload screen, returns, then opens the guide and returns. `results.json` records console/request failures and visible local images. Build and quality check output is alongside it. Physical haptics remain unverified.

The prototype's choice CSS and recorded looping poses are ported directly, sharing its particle renderer. The old dashboard is bypassed. The old upload remains until Filming replaces it; its result now uses equal rep marks without durations or ranges. The guide destination is temporarily the existing guide, using the package's canonical catalogue and local, lossless WebP frames; its redesign follows. Unsupported extra slugs from the old hand-written catalogue are excluded by using the actual package manifest. There are no CDN image requests. No guide frames are precached.

All screenshots were opened before writing these captions:

- `lateral_raise.png`: Choice screen with the front-view lateral raise figure, French name and English alias.
- `bicep_curl.png`: The horizontally scrolled choice rail shows the side-view curl figure and its names.
- `lat_pulldown.png`: The rail shows the front-view pulldown figure and its names.
- `guide-destination.png`: Another exercise opens the existing guide with visible locally served illustrations; its replacement is not yet built.
