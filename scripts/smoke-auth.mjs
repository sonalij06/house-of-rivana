/** Verifies the seeded credentials work against the live Better Auth handler. */
const base = "http://localhost:3000";

async function signIn(email, password) {
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.text();
  const cookie = response.headers.getSetCookie?.().join("; ") ?? "";
  return { status: response.status, body, cookie };
}

const admin = await signIn("admin@houseofrivana.com", "ChangeMe!2026");
console.log("admin sign-in:", admin.status);
if (admin.status !== 200) console.log(admin.body);

if (admin.cookie) {
  const session = await fetch(`${base}/api/auth/get-session`, {
    headers: { cookie: admin.cookie },
  });
  const data = await session.json();
  console.log("session role:", data?.user?.role, "| email:", data?.user?.email);

  const adminPage = await fetch(`${base}/admin`, {
    headers: { cookie: admin.cookie },
    redirect: "manual",
  });
  console.log("GET /admin with session:", adminPage.status);
}

const anon = await fetch(`${base}/admin`, { redirect: "manual" });
console.log("GET /admin anonymous:", anon.status, "->", anon.headers.get("location"));

const bad = await signIn("admin@houseofrivana.com", "wrong-password");
console.log("wrong password:", bad.status);
