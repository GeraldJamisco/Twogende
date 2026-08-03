# Twogende

Peer-to-peer carpooling for Uganda. Someone already driving to Jinja posts the
trip; someone else going the same way asks for a seat and splits the cost.

It is deliberately **not** a taxi app. There are no professional drivers, no
dispatch, and no fares — people share a journey they were making anyway.

The starting wedge is daily commuter routes in and around Kampala, with
intercity travel to follow.

---

## Repository layout

```
api/                  Laravel 13 REST API (PHP 8.4, MySQL/MariaDB)
mobile/               Expo SDK 54 app (React Native 0.81, TypeScript)
LAUNCH-CHECKLIST.md   Everything designed or promised but not yet built
```

Screens are designed first in Claude Design and translated into Expo. The
design project is the source of truth for anything visual — see
[Designs](#designs).

---

## Getting started

You need **PHP 8.4**, **Composer**, **Node 22+**, and **MySQL** running.

### 1. API

```bash
cd api
composer install
cp .env.example .env
php artisan key:generate
```

Create two databases — `twogende` and `twogende_testing` — then:

```bash
php artisan migrate
php artisan storage:link
php artisan serve --host=0.0.0.0 --port=8000
```

`--host=0.0.0.0` matters. A phone running Expo Go is not the machine running
Laravel, so binding to `127.0.0.1` makes the API unreachable from the handset.

### 2. Mobile

```bash
cd mobile
npm install
cp .env.example .env      # then set EXPO_PUBLIC_API_URL to this machine's LAN IP
npx expo start
```

`EXPO_PUBLIC_API_URL` must be a LAN address such as
`http://192.168.1.62:8000/api/v1`. `localhost` resolves to the phone itself.

Scan the QR code with Expo Go on an Android device.

### 3. Signing in

There are no passwords. Enter any Ugandan mobile number and you'll be sent a
one-time code — which, in development, is written to the dev console rather
than an actual handset.

---

## The dev console

Local-only tooling at **http://localhost:8000/dev**.

- Fire real requests at real endpoints and watch the response
- **SMS outbox** — read the OTP that was "sent" (codes are stored hashed, so
  this is the gateway's record, not the database's)
- Live view of every table
- Seed demo data, or reset the database

The routes are never registered outside `local`, and carry an environment guard
as well. It is a backend harness, not product UI — the app's look comes from
the design project.

---

## Testing

```bash
cd api && php artisan test        # 175 tests
cd mobile && npx tsc --noEmit     # typecheck
```

**Tests run against MySQL, not SQLite.** The schema leans on strict mode
(unsigned seat counts refusing to go negative) and on row locking, neither of
which SQLite reproduces — testing there would pass while production behaved
differently.

`php artisan test` expects a `twogende_testing` database to exist.

---

## Things that will surprise you

Decisions that look odd until you know why. Each is commented at the code that
implements it.

### Money is always a "contribution"

Never a fare, never a price — in column names, API fields and UI copy alike.
Uganda's PSV licensing rules apply to commercial passenger transport, and the
whole product is positioned as cost-sharing. `contribution_per_seat`, not
`price`.

Amounts are whole Ugandan shillings stored as integers. UGX has no subunit in
practice, so integers avoid float rounding entirely.

### A phone number is the only credential

There is no `password` column — it was deliberately dropped rather than made
nullable, because a nullable password invites code that treats "no password" as
"any password". Proving you control a number is the whole of authentication,
for signing in and signing up alike.

Numbers are normalised to E.164 before validation, so `0701234567`,
`701234567`, `+256 701 234 567` and `00256701234567` cannot become four
accounts.

### Seat counts are the one real race

Two passengers accepting the last seat at the same moment is the only genuine
concurrency problem here. `Trip::claimSeats()` locks the row for the
check-and-decrement, and `seats_available` is **unsigned** so the database
refuses to go negative even if that locking were ever bypassed. Both layers are
tested, including the bypass.

### Places are matched by identifier, then by distance

Origins and destinations are chosen from Google Places, never typed free-hand —
two people writing "Ntinda" have to resolve to the same place or search
silently returns nothing. Matching is exact `place_id` **or** within 3km, so
"Ntinda" still finds "Ntinda Stage" 400m away.

The Places API is proxied through Laravel. A key shipped inside an APK is a key
that gets extracted and billed to you.

### Some things are visible but inert

A control that cannot work yet is rendered as designed and left disabled —
never faked, never silently removed. In-app calling, chat translation, and
editing a published ride are all in this state. Each has a code comment saying
why and an entry in [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md).

### What is deliberately not published

- **Phone numbers.** `PublicUserResource` is a security boundary, not
  formatting. Contact details are released only once a booking is accepted.
- **Full number plates.** Drivers give the last four characters; the full plate
  is read from the vehicle photo during review. Four characters is enough to
  pick a car out of a queue and not enough to look someone up.
- **Identity documents, selfies and chat photos.** Private disk, served through
  an authorised route. A photo of where somebody is standing is a photo of
  where somebody is.
- **Live coordinates.** Location reporting is write-only. Only the latest point
  is kept — no history table — and the only thing that escapes is the "your
  driver is here" notice generated when the two are close enough.

---

## Designs

Every screen comes from the Claude Design project. When a design and the schema
disagree, the disagreement is recorded in `LAUNCH-CHECKLIST.md` rather than
quietly resolved in code.

Implemented: Register, Verify, Home, Search, Search Results, Trip detail,
Ride requested, Offer a ride, Ride posted, Chat, Profile, Driver verification.
Chats is the one screen not from a mockup.

---

## Where things stand

Working end to end: phone-only OTP auth, trip publishing and search, bookings
with accept/reject, in-app messaging with location and photo sharing, driver
arrival detection, identity and vehicle submission, and the Places proxy.

Not built yet: ratings, push notifications, in-app calling, WhatsApp OTP
delivery, and driver location reporting from the app.

The full list, with reasons, is in [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md).
