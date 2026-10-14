# Footage Search Blocked: Missing API Keys

Task C requires searching the Pexels and/or Pixabay video APIs for licensed demo footage candidates across 13 sports and animal movement subjects.

Neither `PEXELS_API_KEY` nor `PIXABAY_API_KEY` is currently set in the environment or in `.env.local`.

Per the task brief:
> "Run this task only if PEXELS_API_KEY or PIXABAY_API_KEY is set. If neither is, write data/footage/BLOCKED.md and stop."

## To Unblock

Free API keys can be generated at:
- **Pexels API**: https://www.pexels.com/api/
- **Pixabay API**: https://pixabay.com/api/docs/

Set either or both in your shell environment:
```bash
export PEXELS_API_KEY="<your_key>"
export PIXABAY_API_KEY="<your_key>"
```
or add them to `.env.local`:
```bash
PEXELS_API_KEY=<your_key>
PIXABAY_API_KEY=<your_key>
```
