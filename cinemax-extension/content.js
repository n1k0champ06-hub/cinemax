// content.js - Cinemax Subtitle Sync Helper Extension
(function() {
  const frameId = Math.random().toString(36).substring(2, 9);
  let videoElement = null;
  let syncInterval = null;
  let cachedSubtitleOffset = 0;
  let lastLoggedTime = 0;
  
  let cachedPlayerStatus = {
    currentTime: 0,
    isPlaying: false,
    duration: 0,
    subtitleOffset: 0
  };

  // Helper to log telemetry to the React page (God-Mode Console)
  function logToPage(level, message) {
    try {
      const context = window === window.top ? 'Top Frame' : 'Iframe';
      window.top.postMessage({
        source: 'cinemax-extension-telemetry',
        level: level,
        message: `[Extension Content Script (${context})] ${message}`
      }, '*');
    } catch (e) {
      // Ignore
    }
  }

  logToPage('info', 'Content script initialized on URL: ' + window.location.href);

  function findAndBindVideo() {
    const video = document.querySelector('video');
    if (video && video.isConnected && video !== videoElement) {
      // Ignore tiny/hidden video elements (likely ads or tracking pixels)
      const rect = video.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 150 || rect.height < 150)) {
        return;
      }

      // Ignore short videos (duration > 0 but < 60s, likely ads)
      if (video.duration > 0 && video.duration < 60) {
        return;
      }

      videoElement = video;
      console.log('[Cinemax Extension] Found video element:', video);
      logToPage('info', 'Video element found in frame and event listeners bound.');

      // Notify parent immediately that video is found
      sendState('init');

      // Bind events
      video.addEventListener('play', () => sendState('play'));
      video.addEventListener('pause', () => sendState('pause'));
      video.addEventListener('ended', () => sendState('ended'));

      // Seeked event — fires when a seek completes (currentTime has jumped)
      video.addEventListener('seeked', () => sendState('seeked'));

      let lastTimeSent = 0;
      video.addEventListener('timeupdate', () => {
        const now = Date.now();
        if (now - lastTimeSent > 250 || video.paused) {
          sendState('timeupdate');
          lastTimeSent = now;
        }
      });

      // Periodic fallback sync interval
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(() => {
        if (videoElement && videoElement.isConnected) {
          sendState('heartbeat');
        } else if (videoElement && !videoElement.isConnected) {
          logToPage('warn', 'Bound video element was disconnected from DOM. Unbinding.');
          videoElement = null;
          clearInterval(syncInterval);
          syncInterval = null;
        }
      }, 1000);
    }
  }

  function sendState(eventName) {
    if (!videoElement || !videoElement.isConnected) {
      if (videoElement && !videoElement.isConnected) {
        logToPage('warn', 'Attempted sendState on a disconnected video element. Unbinding.');
        videoElement = null;
        if (syncInterval) {
          clearInterval(syncInterval);
          syncInterval = null;
        }
      }
      return;
    }
    
    // Ignore tiny/hidden video elements (likely ads or tracking pixels)
    const rect = videoElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (rect.width < 150 || rect.height < 150)) {
      videoElement = null;
      return;
    }

    // Ignore short videos (duration > 0 but < 60s, likely ads)
    if (videoElement.duration > 0 && videoElement.duration < 60) {
      videoElement = null;
      return;
    }

    // Suppress idle-frame spam: skip sending if the video has no meaningful state yet
    // (duration unknown/0, not playing, at time 0) — this is an unloaded or blank embed.
    // Exception: allow 'init' and 'seeked' events through so the player knows we exist.
    const isIdleState = videoElement.duration === 0 && videoElement.paused && videoElement.currentTime === 0;
    if (isIdleState && eventName !== 'init' && eventName !== 'seeked' && eventName !== 'heartbeat') {
      return;
    }
    
    const stateData = {
      source: 'cinemax-extension',
      frameId: frameId,
      event: eventName,
      currentTime: videoElement.currentTime,
      isPlaying: !videoElement.paused,
      duration: videoElement.duration || 0,
      subtitleOffset: cachedSubtitleOffset
    };

    // 1. Send to React Player App via postMessage
    try {
      window.top.postMessage(stateData, '*');
    } catch (e) {
      // Ignore postMessage errors
    }

    // 2. Send to Extension Popup if it is active
    try {
      chrome.runtime.sendMessage({
        source: 'cinemax-extension-content',
        ...stateData
      });
    } catch (e) {
      // Ignore errors when popup is closed
    }
  }

  function removeOverlayAds() {
    if (window === window.top) return;
    try {
      const elements = document.querySelectorAll('div, section, iframe, a, span');
      const w = window.innerWidth;
      const h = window.innerHeight;

      elements.forEach(el => {
        if (!el.isConnected) return;
        
        // Safety checks to avoid breaking players/controls
        if (el.tagName === 'VIDEO' || el.classList.contains('jwplayer') || el.classList.contains('vjs-control-bar')) {
          return;
        }

        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex, 10) || 0;
        const isPositioned = style.position === 'fixed' || style.position === 'absolute';
        
        const rect = el.getBoundingClientRect();
        const isLarge = rect.width >= w * 0.7 && rect.height >= h * 0.7;

        if (isLarge && (isPositioned || zIndex > 5)) {
          const text = el.textContent || '';
          
          const isFakeCaptcha = /robot|allow|continue|captcha|robot|chặn|click/i.test(text);
          const isGamblingAd = /bet|casino|bóng\s*đá|cola|score|kèo/i.test(text);
          const hasAdIframe = el.tagName === 'IFRAME' && !el.src.includes(window.location.hostname);

          if (isFakeCaptcha || isGamblingAd || hasAdIframe || (rect.width >= w * 0.9 && rect.height >= h * 0.9 && zIndex >= 100000)) {
            console.log('[Cinemax Extension] Removing ad overlay element:', el);
            logToPage('info', `Successfully removed ad overlay element: ${el.tagName} (class="${el.className}", id="${el.id}", text="${text.substring(0, 30).trim()}...")`);
            el.remove();
          }
        }
      });
    } catch (e) {
      // Ignore errors
    }
  }

  // Scan for video element and clean overlays
  findAndBindVideo();
  removeOverlayAds();

  // Keep scanning in case video is loaded dynamically or DOM changes
  const observer = new MutationObserver(() => {
    findAndBindVideo();
    removeOverlayAds();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Heartbeat message to declare the extension is active in the top window context
  if (window === window.top) {
    window.postMessage({ source: 'cinemax-extension', event: 'ping' }, '*');
    setInterval(() => {
      window.postMessage({ source: 'cinemax-extension', event: 'ping' }, '*');
    }, 2000);
  }

  // --- POPUP INTERACTION LOGIC ---

  // 1. Listen to messages from the Extension Popup (ONLY in top frame to avoid conflicts)
  if (window === window.top) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Handle telemetry forwarded from the popup
      if (request.action === 'popupTelemetry') {
        try {
          window.postMessage({
            source: 'cinemax-extension-telemetry',
            level: request.level || 'info',
            message: request.message || ''
          }, '*');
        } catch (e) {}
        sendResponse({ status: 'telemetry_forwarded' });
        return true;
      }

      logToPage('info', `Received Chrome runtime message from popup: action="${request.action || ''}"`);

      // Send the cached player status immediately back to the popup on query
      if (request.action === 'popupQueryStatus') {
        try {
          chrome.runtime.sendMessage({
            source: 'cinemax-extension-content',
            event: 'queryResponse',
            currentTime: cachedPlayerStatus.currentTime,
            isPlaying: cachedPlayerStatus.isPlaying,
            duration: cachedPlayerStatus.duration,
            subtitleOffset: cachedPlayerStatus.subtitleOffset
          });
        } catch (e) {
          // Ignore
        }
      }

      // Broadcast popup command to all subframes (iframes) along with current cached offset
      window.postMessage({
        source: 'cinemax-extension-broadcast',
        action: request.action,
        offset: request.offset,
        time: request.time,
        subtitleOffset: cachedSubtitleOffset
      }, '*');

      sendResponse({ status: 'broadcasted' });
      return true;
    });
  }

  // 2. Listen to broadcasted messages and player state updates
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data) {
      // If we receive the status from the React Player app, cache it
      if (data.source === 'cinemax-player-status') {
        cachedPlayerStatus = {
          currentTime: data.currentTime || 0,
          isPlaying: data.isPlaying || false,
          duration: data.duration || 0,
          subtitleOffset: data.subtitleOffset || 0
        };

        if (data.subtitleOffset !== undefined) {
          cachedSubtitleOffset = data.subtitleOffset;
        }

        const now = Date.now();
        if (now - lastLoggedTime > 5000) {
          logToPage('info', `Cached status update from React app: isPlaying=${cachedPlayerStatus.isPlaying}, currentTime=${cachedPlayerStatus.currentTime.toFixed(1)}s, offset=${cachedSubtitleOffset}ms`);
          lastLoggedTime = now;
        }

        // Proactively forward React status to the popup in real-time
        if (window === window.top) {
          try {
            chrome.runtime.sendMessage({
              source: 'cinemax-extension-content',
              event: 'playerStatusUpdate',
              currentTime: cachedPlayerStatus.currentTime,
              isPlaying: cachedPlayerStatus.isPlaying,
              duration: cachedPlayerStatus.duration,
              subtitleOffset: cachedPlayerStatus.subtitleOffset
            });
          } catch (e) {
            // Ignore error when popup is closed
          }
        }
      }

      // If we receive a broadcast from the main frame
      if (data.source === 'cinemax-extension-broadcast') {
        if (data.subtitleOffset !== undefined) {
          cachedSubtitleOffset = data.subtitleOffset;
        }

        logToPage('info', `Received broadcast command in frame: action="${data.action || ''}" (hasVideoElement=${!!videoElement})`);

        if (videoElement) {
          // We are the subframe containing the video element!
          if (data.action === 'popupQueryStatus') {
            sendState('queryResponse');
          } else if (data.action === 'popupAdjustTime') {
            videoElement.currentTime = Math.max(0, videoElement.currentTime + Number(data.offset));
            sendState('timeupdate');
          } else if (data.action === 'popupTogglePlay') {
            if (videoElement.paused) {
              videoElement.play().catch(() => {});
            } else {
              videoElement.pause();
            }
          } else if (data.action === 'popupSetTime') {
            const duration = isNaN(videoElement.duration) ? Infinity : videoElement.duration;
            videoElement.currentTime = Math.max(0, Math.min(duration, Number(data.time)));
            sendState('timeupdate');
          } else if (data.action === 'popupAdjustSubtitleOffset' || data.action === 'popupSetSubtitleOffset') {
            sendState('offsetChanged');
          }
        }
        
        // Forward the broadcast recursively to all child frames so they receive it too!
        for (let i = 0; i < window.frames.length; i++) {
          try {
            window.frames[i].postMessage(data, '*');
          } catch (e) {
            // Ignore any cross-origin errors
          }
        }
        
        // If we are in the top/main frame context, forward offset adjustments to React player
        if (window === window.top) {
          if (data.action === 'popupAdjustSubtitleOffset') {
            window.postMessage({ source: 'cinemax-extension', event: 'adjustOffset', offset: data.offset }, '*');
          } else if (data.action === 'popupSetSubtitleOffset') {
            window.postMessage({ source: 'cinemax-extension', event: 'setOffset', offset: data.offset }, '*');
          } else if (data.action === 'popupTogglePlay') {
            window.postMessage({ source: 'cinemax-extension', event: 'togglePlay' }, '*');
          }
        }
      }
    }
  });

})();
