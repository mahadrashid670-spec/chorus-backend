# Chorus API

The real backend for Chorus — accounts, a database, and a working embed widget
that renders on any website.

## What's in here

- `server.js` — the app entry point
- `db.js` — SQLite database + schema (two tables: `businesses`, `testimonials`)
- `routes/auth.js` — sign up / log in (returns a login token)
- `routes/business.js` — get/update your business name & question
- `routes/testimonials.js` — dashboard actions (list/approve/delete) + the public
  endpoints customers hit when they submit a testimonial
- `routes/embed.js` — **this is the important one**: serves real JavaScript at
  `/embed/your-slug.js` that any website can load to show the wall
- `routes/billing.js` — Paddle checkout + webhook, to handle the paid plan

## 1. Run it locally

```bash
npm install
cp .env.example .env
# open .env and set JWT_SECRET to any long random string
npm start
```

The API runs on `http://localhost:3000`.

Test it's alive: `curl localhost:3000/` → `Chorus API is running.`

## 2. Try the flow with curl

```bash
# create an account
curl -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-real-password","bizName":"Studio Loop"}'
# → returns a token and your slug (e.g. "studio-loop")

# a customer submits a testimonial (no login needed - this is the public form)
curl -X POST localhost:3000/api/public/studio-loop/testimonials \
  -H "Content-Type: application/json" \
  -d '{"name":"Amara K.","role":"Founder","quote":"Great tool!","rating":5}'

# approve it (use the token from registration)
curl -X PATCH localhost:3000/api/me/testimonials/<id> \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"approved":true}'

# see the real embeddable widget
curl localhost:3000/embed/studio-loop.js
```

## 3. Deploy it for real (recommended: Railway or Render)

Both have free/cheap tiers and work with almost zero config for a small Node app:

1. Push this folder to a GitHub repo.
2. On [railway.app](https://railway.app) or [render.com](https://render.com): "New Project" → "Deploy from GitHub" → pick the repo.
3. Add the environment variables from `.env.example` in their dashboard's
   "Variables" tab (use a real random `JWT_SECRET`).
4. Deploy. You'll get a live URL like `https://chorus-api-production.up.railway.app`.

One thing to note: `db.js` uses a SQLite **file** (`chorus.db`). This is fine to
start, but Railway/Render's filesystem resets on redeploy unless you attach a
persistent volume (both platforms support this — look for "Volumes" in the
project settings and mount it at `/app` or wherever your repo lives). Once you
have real paying customers, migrating to a hosted Postgres (Railway/Render both
offer this for a few dollars/month) is the safer long-term move.

## 4. Connect your frontend to this API

In your `chorus.html` app, replace the `localStorage`-based functions with
`fetch` calls to your deployed API URL, for example:

```js
const API_BASE = 'https://your-api.up.railway.app';

async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  localStorage.setItem('chorus_token', data.token); // just the token, not your data
  return data;
}
```

Then use `Authorization: Bearer <token>` on every `/api/me/...` call. Happy to
wire this up fully in your frontend file if you'd like — just ask.

## 5. Payments: Paddle + Nsave (since Stripe doesn't support Pakistan)

Paddle acts as "merchant of record" — it takes the customer's card payment
worldwide, then pays *you* out by bank transfer, which lands in your Nsave USD
account.

1. Create an account at [paddle.com](https://www.paddle.com) (Pakistan is supported as a seller location).
2. In Paddle's dashboard: **Catalog → Products** → create "Chorus Pro" → add a
   $19/month recurring price. Copy its Price ID into `PADDLE_PRO_PRICE_ID`.
3. **Developer Tools → Authentication** → create an API key → put it in `PADDLE_API_KEY`.
4. **Developer Tools → Notifications** → add a webhook pointing to
   `https://your-api.../api/billing/webhook`, subscribed to
   `transaction.completed` and `subscription.canceled`. Copy the signing
   secret into `PADDLE_WEBHOOK_SECRET`.
5. In **Payouts**, set your payout method to bank transfer and enter your
   Nsave USD account/routing details (the ones Nsave gives you after
   verification) — this is where your subscription revenue lands.

Once this is set up, `POST /api/billing/checkout` will start returning a real
Paddle transaction that your frontend can open in Paddle's checkout overlay
(Paddle.js — a script tag Paddle gives you), and the webhook will
automatically flip a business from `free` to `pro` the moment they pay.

## Notes on going further

- Add rate-limiting on the public submit endpoint before launch (e.g.
  `express-rate-limit`) so it can't be spammed.
- Add a "forgot password" flow before you have real users depending on it.
- Consider adding basic profanity/spam filtering on submitted testimonials
  before they hit a business's dashboard.
