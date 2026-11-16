import { describe, expect, it } from 'vitest';
import { commonsLicenceOk, fromCommons, fromPexels, fromPixabay, mergeQueue } from '../sources.mjs';

describe('the stock sources', () => {
  it('keeps Commons videos under a free licence, of a set\'s length, served from upload.wikimedia.org', () => {
    const page = (pageid, licence, duration, mime = 'video/webm', url = `https://upload.wikimedia.org/x/${pageid}.webm`) => ({ pageid, imageinfo: [{ mime, url, descriptionurl: `https://commons.wikimedia.org/wiki/File:${pageid}`, duration, width: 1280, height: 720, extmetadata: { LicenseShortName: { value: licence }, Artist: { value: '<a href="x">Ann</a>' } } }] });
    const json = { query: { pages: { 1: page(1, 'CC BY-SA 4.0', 30), 2: page(2, 'CC BY-NC 4.0', 30), 3: page(3, 'CC0', 3), 4: page(4, 'CC0', 40, 'image/jpeg'), 5: page(5, 'Public domain', 20), 6: page(6, 'CC BY 3.0', 20, 'video/webm', 'https://evil.example/x.webm') } } };
    const items = fromCommons(json, 'squat', 'squat exercise');
    expect(items.map(i => i.id)).toEqual(['commons-1', 'commons-5']);
    expect(items[0]).toMatchObject({ source: 'commons', licence: 'CC BY-SA 4.0', author: 'Ann', lift: 'squat', duration: 30 });
  });

  it('accepts free licences and refuses non-commercial or no-derivatives ones', () => {
    for (const ok of ['CC0', 'CC BY 4.0', 'CC BY-SA 3.0', 'Public domain']) expect(commonsLicenceOk(ok)).toBe(true);
    for (const no of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', 'Fair use', '', undefined]) expect(commonsLicenceOk(no)).toBe(false);
  });

  it('takes the widest Pexels mp4 up to 1920 px, on videos.pexels.com only', () => {
    const json = { videos: [
      { id: 7, url: 'https://www.pexels.com/video/7/', duration: 20, image: 'https://images.pexels.com/7.jpg', user: { name: 'Bo' }, video_files: [
        { file_type: 'video/mp4', link: 'https://videos.pexels.com/video-files/7/a.mp4', width: 3840, height: 2160 },
        { file_type: 'video/mp4', link: 'https://videos.pexels.com/video-files/7/b.mp4', width: 1920, height: 1080 },
        { file_type: 'video/mp4', link: 'https://videos.pexels.com/video-files/7/c.mp4', width: 640, height: 360 },
      ] },
      { id: 8, url: 'u', duration: 200, video_files: [{ file_type: 'video/mp4', link: 'https://videos.pexels.com/x.mp4', width: 640 }] },
      { id: 9, url: 'u', duration: 20, video_files: [{ file_type: 'video/mp4', link: 'https://player.vimeo.com/x.mp4', width: 640 }] },
    ] };
    const items = fromPexels(json, 'bicep_curl', 'bicep curl');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'pexels-7', file: 'https://videos.pexels.com/video-files/7/b.mp4', licence: 'Pexels License', author: 'Bo' });
  });

  it('takes the medium Pixabay file from cdn.pixabay.com', () => {
    const json = { hits: [{ id: 3, pageURL: 'https://pixabay.com/videos/3/', duration: 15, user: 'Cy', videos: { large: { url: 'https://cdn.pixabay.com/l.mp4', width: 1920, height: 1080 }, medium: { url: 'https://cdn.pixabay.com/m.mp4', width: 1280, height: 720, thumbnail: 't.jpg' } } }] };
    expect(fromPixabay(json, 'squat', 'squat exercise')[0]).toMatchObject({ id: 'pixabay-3', file: 'https://cdn.pixabay.com/m.mp4', width: 1280 });
  });

  it('never changes a clip already queued', () => {
    const q = [{ id: 'pexels-1', lift: 'squat', file: 'a' }];
    const merged = mergeQueue(q, [{ id: 'pexels-1', lift: 'bench_press', file: 'b' }, { id: 'pexels-2', lift: 'squat', file: 'c' }]);
    expect(merged).toEqual([{ id: 'pexels-1', lift: 'squat', file: 'a' }, { id: 'pexels-2', lift: 'squat', file: 'c' }]);
  });
});
