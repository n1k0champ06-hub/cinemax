// defuser.js - uBlock/Adguard-style Scriptlet for Cinemax Helper
(function() {
  // Only apply inside iframe player contexts
  if (window === window.top) return;

  console.log('[Cinemax Helper] MAIN-world ad-defuser scriptlet active.');

  const adKeywords = [
    'doubleclick', 'syndication', 'popads', 'popcash', 'exoclick', 
    'propeller', 'juicyads', 'adcash', 'clickadu', 'cacuoc', 'gambling',
    'bet', 'cola', 'score', 'xemlive', 'websocket', 'tyso', 'xoilac'
  ];

  // 1. Prevent popups by stubbing window.open (and protecting it)
  try {
    const noop = function() {};
    const fakeWindow = { closed: true, focus: noop, blur: noop, close: noop, postMessage: noop };
    window.open = function(url) {
      console.warn('[Cinemax Blocker] Blocked window.open attempt:', url);
      return fakeWindow;
    };
    Object.defineProperty(window, 'open', { writable: false, configurable: false });
  } catch (e) {}

  // 2. Wrap WebSocket connections to prevent ad WebSockets without crashing
  try {
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const lowUrl = String(url).toLowerCase();
      if (adKeywords.some(kw => lowUrl.includes(kw))) {
        console.warn('[Cinemax Blocker] Blocked ad WebSocket connection:', url);
        return {
          send: function() {},
          close: function() {},
          addEventListener: function() {},
          removeEventListener: function() {},
          readyState: 3 // CLOSED
        };
      }
      return new OriginalWebSocket(url, protocols);
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;
  } catch (e) {}

  // 3. WebRTC is allowed because many P2P streaming players (like VidNest/NguonC) crash if it's disabled.

  // 4. Overwrite setAttribute to prevent ad-script/ad-iframe injection
  try {
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (String(name).toLowerCase() === 'src') {
        const tagName = this.tagName.toLowerCase();
        if (tagName === 'script' || tagName === 'iframe') {
          const lowVal = String(value).toLowerCase();
          if (adKeywords.some(kw => lowVal.includes(kw))) {
            console.warn('[Cinemax Blocker] Blocked setAttribute(src) injection:', value);
            return;
          }
        }
      }
      originalSetAttribute.apply(this, arguments);
    };
  } catch (e) {}

  // 5. Overwrite prototype src setters for script and iframe elements
  try {
    const originalScriptSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (originalScriptSrcDescriptor && originalScriptSrcDescriptor.set) {
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        get() { return originalScriptSrcDescriptor.get.call(this); },
        set(val) {
          const lowVal = String(val).toLowerCase();
          if (adKeywords.some(kw => lowVal.includes(kw))) {
            console.warn('[Cinemax Blocker] Blocked script.src property assignment:', val);
            return;
          }
          originalScriptSrcDescriptor.set.call(this, val);
        }
      });
    }

    const originalIFrameSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    if (originalIFrameSrcDescriptor && originalIFrameSrcDescriptor.set) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        get() { return originalIFrameSrcDescriptor.get.call(this); },
        set(val) {
          const lowVal = String(val).toLowerCase();
          if (adKeywords.some(kw => lowVal.includes(kw))) {
            console.warn('[Cinemax Blocker] Blocked iframe.src property assignment:', val);
            return;
          }
          originalIFrameSrcDescriptor.set.call(this, val);
        }
      });
    }
  } catch (e) {}

  // 6. Block click-triggered _blank window openings (capturing phase)
  try {
    window.addEventListener('click', (e) => {
      // Find closest anchor tag up the tree
      let target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentNode;
      }
      if (target && target.tagName === 'A') {
        // Block all cross-origin or unknown _blank links from within the iframe
        if (target.target === '_blank' || target.href.includes('http')) {
           // Allow same-origin internal routing if any (rare inside player embeds)
           if (target.href.startsWith(window.location.origin) && target.target !== '_blank') {
               return;
           }
           console.warn('[Cinemax Blocker] Intercepted and blocked anchor click:', target.href);
           e.preventDefault();
           e.stopPropagation();
        }
      }
    }, true);
  } catch (e) {}

  // 7. Block programmatic anchor clicks
  try {
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.target === '_blank' || (this.href && !this.href.startsWith(window.location.origin))) {
        console.warn('[Cinemax Blocker] Blocked programmatic click on anchor:', this.href);
        return;
      }
      return origClick.apply(this, arguments);
    };
  } catch (e) {}
})();
