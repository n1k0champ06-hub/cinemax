export const RAPID_API_KEYS = [
  "1349644f56mshbd1a582f9f80113p171564jsneb07bf153208", // User provided
  "dc085282f5mshe6977cddf598decp1f301bjsnacd41e19228f", // Old one
];

let currentKeyIndex = 0;

export const getRapidApiKey = () => {
  return RAPID_API_KEYS[currentKeyIndex];
};

export const rotateRapidApiKey = () => {
  currentKeyIndex = (currentKeyIndex + 1) % RAPID_API_KEYS.length;
  console.log("Rotated RapidAPI key to index:", currentKeyIndex);
  return RAPID_API_KEYS[currentKeyIndex];
};

export const fetchRapidApi = async (url: string, host: string, options: RequestInit = {}): Promise<any> => {
  let attempts = 0;
  const maxAttempts = RAPID_API_KEYS.length;

  while (attempts < maxAttempts) {
    const key = getRapidApiKey();
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'x-rapidapi-host': host,
          'x-rapidapi-key': key,
        }
      });
      
      const clone = res.clone();
      const data = await res.json();
      
      // Check for quota or rate limit error
      if (data?.message && (data.message.includes("quota") || data.message.includes("exceeded") || data.message.toLowerCase().includes("rate limit"))) {
        console.warn(`Key ${key} exceeded quota. Rotating...`);
        rotateRapidApiKey();
        attempts++;
        continue;
      }
      
      return data;
    } catch (e: any) {
      // If error is JSON parse error, it might be HTML (502, 503, 429 html pages)
      // Check if status in options but usually we want to retry if HTTP 429
      console.warn("RapidAPI fetch error", e);
      // Depending on error, we might rotate
      rotateRapidApiKey();
      attempts++;
    }
  }
  
  // All keys failed, maybe return null
  return null;
};
