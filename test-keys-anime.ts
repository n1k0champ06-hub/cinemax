async function testKey(key: string) {
  const res = await fetch('https://anime-db.p.rapidapi.com/anime?page=1&size=10&sortBy=ranking&sortOrder=asc', {
    headers: {
      'x-rapidapi-host': 'anime-db.p.rapidapi.com',
      'x-rapidapi-key': key
    }
  });
  const data = await res.json();
  console.log("Anime Key", key.substring(0, 5), "message:", data?.message, " has data?", !!data?.data);
}
testKey("1349644f56mshbd1a582f9f80113p171564jsneb07bf153208").then(() => 
  testKey("dc085282f5mshe6977cddf598decp1f301bjsnacd41e19228f")
);
