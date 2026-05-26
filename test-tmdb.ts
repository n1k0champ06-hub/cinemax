const token = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlODBkOGQxMDIyNDFlZTllNGY3MmU0YmIxMjA5YWI2YSIsIm5iZiI6MTc3Nzg2NDcyOS4wNiwic3ViIjoiNjlmODEwMTk4MWQwYmZlNTcwYzYwMDMzIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.JH8fusjlUu3Ed8HAJRmY-A-aOio1VRoKW-_Aiot17Og";

async function test() {
  const res = await fetch('https://api.themoviedb.org/3/authentication', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  console.log(res.status);
  console.log(await res.json());
}
test();
