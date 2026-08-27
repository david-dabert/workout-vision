const ENDPOINT = "https://httpbin.org/post";
function logEvent(event, data) {
  try {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        data,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        screen: `${window.innerWidth}x${window.innerHeight}`
      })
    }).catch(() => {
    });
  } catch (_) {
  }
}
export {
  logEvent as l
};
