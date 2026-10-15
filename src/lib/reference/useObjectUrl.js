import { useEffect, useMemo } from 'react';

/** A file's object URL for a video element, revoked when the file changes or the screen closes. */
export function useObjectUrl(file) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}
