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
    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      // The title counts as gone once it has passed wholly under the bar's bottom edge.
      io = new IntersectionObserver(entries => {
        const e = entries[entries.length - 1];
        const under = !e.isIntersecting && e.boundingClientRect.top < bar.getBoundingClientRect().bottom;
        bar.classList.toggle('is-condensed', under);
      }, { rootMargin: `-${Math.round(bar.getBoundingClientRect().height)}px 0px 0px 0px`, threshold: 0 });
      io.observe(title);
    }
    return () => { io?.disconnect(); copy.remove(); bar.classList.remove('is-sticky', 'is-condensed'); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
