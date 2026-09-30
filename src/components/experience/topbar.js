import { useEffect } from 'react';

/**
 * The large title that condenses into the topbar (design/SYSTEM.md, section 3, change 1). Within the
 * section `ref`, the topbar sticks; once the screen's `.title` has scrolled under it, the bar turns to
 * frosted glass and shows the same title, small and centred. The words are the title's own: nothing
 * new is said, and the copy in the bar is hidden from screen readers, which read the title itself.
 */
export function useCondensingTopbar(ref, deps = []) {
  useEffect(() => {
    const root = ref.current;
    const bar = root?.querySelector('.topbar'), title = root?.querySelector('.title');
    if (!bar || !title) return undefined;
    bar.classList.add('is-sticky');
    const copy = document.createElement('span');
    copy.className = 'topbar-title';
    copy.setAttribute('aria-hidden', 'true');
    copy.textContent = title.textContent;
    bar.appendChild(copy);
    // The bar condenses as soon as the title reaches its bottom edge, so no word ever runs under a clear
    // bar, Back or the pill; measured on every scroll and resize, so a rotation (a new safe area) holds
    // too (review, 30 September: it had waited for the whole title to pass, and measured the bar once).
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // The glyphs, not the element's box: a serif title's ascenders rise above its line box.
        const text = document.createRange(); text.selectNodeContents(title);
        bar.classList.toggle('is-condensed', text.getBoundingClientRect().top < bar.getBoundingClientRect().bottom);
      });
    };
    document.addEventListener('scroll', check, { capture: true, passive: true });
    window.addEventListener('resize', check);
    check();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', check, { capture: true });
      window.removeEventListener('resize', check);
      copy.remove(); bar.classList.remove('is-sticky', 'is-condensed');
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
