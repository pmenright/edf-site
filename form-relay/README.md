# EDF form relay

The site's contact forms (the CONTACT popup on the main site, and both forms on the Nsyte copy) post
to this small Cloudflare Worker. It checks that the post came from the site and passed Cloudflare
Turnstile (the bot check), then emails it to pmenright@gmail.com, with Reply going straight to the
visitor. It stores nothing and logs nothing about the messages. It's free (Cloudflare's free plan).

Until it's set up, the forms open the visitor's email app with their message already written, so
nothing is broken in the meantime.

## One-time setup

### Part 1: Cloudflare (about 30 minutes, plus waiting for the domain)

1. **Account.** Sign up at dash.cloudflare.com (Free plan).
2. **Add the domain.** "Add a domain", enter `enrightdesignfoundry.com`, pick **Free**. Cloudflare
   copies your existing DNS records. Before going on, screenshot Porkbun's DNS records for the domain
   and check that every one shows up in Cloudflare's list. Set the GitHub Pages records to
   **DNS only** (gray cloud), so the site keeps working exactly as it does now.
3. **Nameservers at Porkbun.** If DNSSEC is on for the domain at Porkbun, turn it off first. Then in
   Porkbun: Domain Management, the domain, **Authoritative Nameservers**: replace Porkbun's with the
   two Cloudflare shows you. Wait for Cloudflare's email saying the domain is **Active** (usually
   under an hour, at most a day).
4. **Email Routing.** In Cloudflare: **Email**, **Email Routing** for the domain. Enable it and accept
   the records it adds. Add **pmenright@gmail.com** as a destination address and click the
   verification link Cloudflare emails you. Then **Settings**, **Subdomains**: add **`forms`**. The
   relay sends from `website@forms.enrightdesignfoundry.com`, so the main domain stays free for
   whatever email you set up later.
   - Optional: a forwarding address on your own domain (like `patrick@enrightdesignfoundry.com` to
     your Gmail) is a free routing rule here too. It only receives.
   - Later, if you move the main domain's email to a mailbox service, Email Routing on the main
     domain gets turned off for it. Leave the `forms` subdomain on: the relay keeps working.
5. **Turnstile.** **Turnstile**, **Add widget**: name "EDF forms"; hostnames
   `enrightdesignfoundry.com`, `www.enrightdesignfoundry.com` and `localhost`; mode **Managed**.
   Note the **Site Key** (public) and the **Secret Key** (private: it goes in one command below, and
   nowhere else).

### Part 2: deploy the relay (about 10 minutes)

From this folder on your Mac:

```
cd ~/Documents/Portfolio\ Site/React\ Tailwind\ Rebuild\ 2026/edf-site/form-relay
npx wrangler login
npx wrangler secret put TURNSTILE_SECRET
npx wrangler deploy
```

- `login` opens the browser to approve Wrangler (Cloudflare's command-line tool).
- `secret put` asks for the Turnstile **Secret Key**: paste it.
- `deploy` may ask you to pick a workers.dev name, then prints the relay's address, like
  `https://edf-forms.yourname.workers.dev`.

### Part 3: switch the forms on

Done (November 2026): the relay is `https://edf-forms.edfwork.workers.dev/`. If it ever moves, it's
two public values, in two files:

- `src/content/site.json`: `"forms": { "endpoint": "<the relay's address>", "turnstileSiteKey": "<Site Key>" }`
- `public/nsyte/assets/mirror.js`, near the top: `FORM_ENDPOINT` and `TURNSTILE_SITE_KEY`

Push live, then send yourself a message from the site. The first one may land in Gmail's spam: mark
it "Not spam".

## Upkeep

None routine. Things worth knowing:

- **Changing the Turnstile secret:** run `npx wrangler secret put TURNSTILE_SECRET` again.
- **Something not arriving?** `npx wrangler tail` shows the relay's activity live while you send a
  test (it logs only Cloudflare's error code on a failed send, never the message).
- **Settings** (sender address, where it sends, which pages may post) are in `wrangler.jsonc`;
  run `npx wrangler deploy` after changing them. The binding can only send to the verified address.
- **Tests:** `npm run test:forms` from the site's folder.

## What happens to a message

Visitor's browser, then Cloudflare (Turnstile check and this Worker), then Gmail. Nothing is stored
on the way. Turnstile's script only loads for visitors who start filling in a form.
