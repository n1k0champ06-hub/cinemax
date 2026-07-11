// background.js - Cinemax Ad Blocker Service Worker
// Handles declarativeNetRequest rules for popup ad blocking

'use strict';

// ─── Ad Blocker State ───────────────────────────────────────────────────────

let adBlockerEnabled = false;

// Load persisted state
chrome.storage.local.get(['adBlockerEnabled'], (result) => {
  adBlockerEnabled = result.adBlockerEnabled !== false; // default ON
  applyAdBlockerRules(adBlockerEnabled);
});

// ─── Rule IDs ────────────────────────────────────────────────────────────────

const RULE_ID_BASE = 1000;
const AD_BLOCKER_RULES = [
  // --- Popup / New-tab ad patterns ---
  { id: RULE_ID_BASE + 1, domains: ['*://*.doubleclick.net/*'] },
  { id: RULE_ID_BASE + 2, domains: ['*://*.googlesyndication.com/*'] },
  { id: RULE_ID_BASE + 3, domains: ['*://*.googleadservices.com/*'] },
  { id: RULE_ID_BASE + 4, domains: ['*://*.adnxs.com/*'] },
  { id: RULE_ID_BASE + 5, domains: ['*://*.adsrvr.org/*'] },
  { id: RULE_ID_BASE + 6, domains: ['*://*.smartadserver.com/*'] },
  { id: RULE_ID_BASE + 7, domains: ['*://*.rubiconproject.com/*'] },
  { id: RULE_ID_BASE + 8, domains: ['*://*.openx.net/*'] },
  { id: RULE_ID_BASE + 9, domains: ['*://*.pubmatic.com/*'] },
  { id: RULE_ID_BASE + 10, domains: ['*://*.casalemedia.com/*'] },
  { id: RULE_ID_BASE + 11, domains: ['*://*.criteo.com/*'] },
  { id: RULE_ID_BASE + 12, domains: ['*://*.aniview.com/*'] },
  { id: RULE_ID_BASE + 13, domains: ['*://*.springserve.com/*'] },
  { id: RULE_ID_BASE + 14, domains: ['*://*.yieldmo.com/*'] },
  // Vietnamese ad networks / gambling popups
  { id: RULE_ID_BASE + 15, domains: ['*://*.cdn-ads.vip/*'] },
  { id: RULE_ID_BASE + 16, domains: ['*://*.ads.opstream.vip/*'] },
  { id: RULE_ID_BASE + 17, domains: ['*://*.adstream.vip/*'] },
  { id: RULE_ID_BASE + 18, domains: ['*://*.cdn-ad.net/*'] },
  { id: RULE_ID_BASE + 19, domains: ['*://*.staticads.net/*'] },
  { id: RULE_ID_BASE + 20, domains: ['*://*.adcdn.net/*'] },
  { id: RULE_ID_BASE + 21, domains: ['*://*.stream-ads.net/*'] },
  { id: RULE_ID_BASE + 22, domains: ['*://*.quangcao.net/*'] },
  { id: RULE_ID_BASE + 23, domains: ['*://*.adserver.vn/*'] },
  { id: RULE_ID_BASE + 24, domains: ['*://*.ads.vn/*'] },
  // Tracking & data brokers that trigger popups
  { id: RULE_ID_BASE + 25, domains: ['*://*.taboola.com/*'] },
  { id: RULE_ID_BASE + 26, domains: ['*://*.outbrain.com/*'] },
  { id: RULE_ID_BASE + 27, domains: ['*://*.mgid.com/*'] },
  { id: RULE_ID_BASE + 28, domains: ['*://*.popcash.net/*'] },
  { id: RULE_ID_BASE + 29, domains: ['*://*.popads.net/*'] },
  { id: RULE_ID_BASE + 30, domains: ['*://*.propellerads.com/*'] },
  { id: RULE_ID_BASE + 31, domains: ['*://*.exoclick.com/*'] },
  { id: RULE_ID_BASE + 32, domains: ['*://*.trafficjunky.com/*'] },
  { id: RULE_ID_BASE + 33, domains: ['*://*.juicyads.com/*'] },
  { id: RULE_ID_BASE + 34, domains: ['*://*.adcash.com/*'] },
  { id: RULE_ID_BASE + 35, domains: ['*://*.revcontent.com/*'] },
  { id: RULE_ID_BASE + 36, domains: ['*://*.clickadu.com/*'] },
];

function buildDNRRules(enabled) {
  if (!enabled) return [];
  return AD_BLOCKER_RULES.map((r) => ({
    id: r.id,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: r.domains[0].replace('*://', '').replace('/*', ''),
      resourceTypes: [
        'main_frame',
        'sub_frame',
        'xmlhttprequest',
        'script',
        'image',
        'media',
        'other',
      ],
    },
  }));
}

async function applyAdBlockerRules(enabled) {
  try {
    // Remove all previously registered dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map((r) => r.id);

    const newRules = buildDNRRules(enabled);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: newRules,
    });

    console.log(
      `[Cinemax AdBlocker] Rules ${enabled ? 'ENABLED' : 'DISABLED'} — ${newRules.length} active rules.`
    );
  } catch (err) {
    console.error('[Cinemax AdBlocker] Failed to update rules:', err);
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAdBlockerState') {
    sendResponse({ enabled: adBlockerEnabled });
    return true;
  }

  if (request.action === 'setAdBlockerState') {
    adBlockerEnabled = !!request.enabled;
    chrome.storage.local.set({ adBlockerEnabled });
    applyAdBlockerRules(adBlockerEnabled).then(() => {
      sendResponse({ enabled: adBlockerEnabled });
    });
    return true; // keep channel open for async
  }
});

// ─── Popup window blocker (content-script injected via message) ───────────────

// When a new tab is opened from a known streaming embed, check if it looks like a popup ad
chrome.tabs.onCreated.addListener((tab) => {
  if (!adBlockerEnabled) return;

  // If a tab opens with no opener or an empty URL — likely a popup ad
  const url = tab.pendingUrl || tab.url || '';
  const isBlankOrEmpty = !url || url === 'about:blank' || url === 'chrome://newtab/';

  // Give it 300ms to load, then check if it redirects to an ad URL
  setTimeout(async () => {
    try {
      const updatedTab = await chrome.tabs.get(tab.id).catch(() => null);
      if (!updatedTab) return;

      const finalUrl = updatedTab.url || updatedTab.pendingUrl || '';
      if (!finalUrl || finalUrl === 'about:blank') return;

      if (isAdUrl(finalUrl)) {
        console.log(`[Cinemax AdBlocker] Closing popup ad tab: ${finalUrl}`);
        chrome.tabs.remove(tab.id).catch(() => {});
      }
    } catch (_) {}
  }, 300);
});

// Also monitor tab updates to close ads that redirect slower (delayed redirects)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!adBlockerEnabled) return;
  
  if (changeInfo.url) {
    if (isAdUrl(changeInfo.url)) {
      console.log(`[Cinemax AdBlocker] Closing updated popup ad tab: ${changeInfo.url}`);
      chrome.tabs.remove(tabId).catch(() => {});
    }
  }
});

const AD_URL_PATTERNS = [
  /[?&](utm_|fbclid|gclid)/i,
  /\/(ads?|advert|promo|sponsor|click|redirect)\//i,
  /(doubleclick|googlesyndication|adnxs|adsrvr|taboola|outbrain|popcash|popads|propellerads|exoclick|trafficjunky|juicyads|adcash|revcontent|clickadu|quangcao|cdn-ads|adstream|stream-ads)/i,
  /(bet|casino|gambling|poker|cback\.me|track\.|cola|score|cacuoc|keonhacai|xoilac|tyso|kubet|thabet|shbet|new88|jun88|f8bet|789bet|hi88|sv388)/i,
];

function isAdUrl(url) {
  return AD_URL_PATTERNS.some((pat) => pat.test(url));
}
