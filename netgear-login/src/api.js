export async function apiGet(url) {
  const token = localStorage.getItem("token");

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  });

  return res.json();
}
