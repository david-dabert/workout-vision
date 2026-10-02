// The guide's search compares text without accents or case ("Élévations" finds "elevations"). Kept apart
// from Guide.jsx, which draws, so tests can search the catalogue as the screen does.
export const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
