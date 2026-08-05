// Theme preference, shared by every page.
//
// Three preferences are stored: 'light', 'dark', 'system'. Only the *resolved*
// value ('light' | 'dark') ever reaches the DOM, as :root[data-theme].
// The early-paint snippet inlined in each page's <head> mirrors resolve() —
// keep the two in sync if the rules change.
(function (global) {
  const KEY = 'showsouk-theme';
  const darkQuery = global.matchMedia('(prefers-color-scheme: dark)');

  function getPreference() {
    try {
      const stored = localStorage.getItem(KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function resolve(pref) {
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    return darkQuery.matches ? 'dark' : 'light';
  }

  function apply(pref) {
    const resolved = resolve(pref);
    document.documentElement.dataset.theme = resolved;
    document.dispatchEvent(new CustomEvent('themechange', { detail: { pref, resolved } }));
    return resolved;
  }

  function setPreference(pref) {
    try {
      if (pref === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch (e) {
      // Storage unavailable — the choice still applies for this page view.
    }
    return apply(pref);
  }

  // Following the OS only makes sense while the user hasn't picked a side.
  darkQuery.addEventListener('change', () => {
    if (getPreference() === 'system') apply('system');
  });

  global.Theme = { get: getPreference, set: setPreference, resolve, apply };
})(window);
