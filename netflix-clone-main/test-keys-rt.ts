async function testKey(key: string) {
  const res = await fetch('https://rottentomato.p.rapidapi.com/search?search-term=Batman', {
    headers: {
      'x-rapidapi-host': 'rottentomato.p.rapidapi.com',
      'x-rapidapi-key': key
    }
  });
  const data = await res.json();
  console.log("RT Key", key.substring(0, 5), "message:", data?.message);
}
testKey("1349644f56mshbd1a582f9f80113p171564jsneb07bf153208").then(() => 
  testKey("dc085282f5mshe6977cddf598decp1f301bjsnacd41e19228f")
);
