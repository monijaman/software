---
title: "Real-Time, Pub/Sub, Webhooks and CDC"
summary: "Pick the right way to push updates (to browsers, to partner servers, to other services), and make sure every event can be tracked, safely repeated and replayed."
level: Advanced
tags: [system-design, sse, webhooks, webrtc, pubsub, cdc, events]
---

## The story in one minute

You run an online shop platform. Two groups want to hear about order changes:

- **Merchants** watch a live dashboard in their browser: "Order 55: paid... packed... shipped."
- **Partners** (like a delivery company) want your server to call **their** server whenever an order changes. This is a **webhook**.

Here is what goes wrong, step by step:

1. An order is saved, but the app crashes **before** it sends the "order paid" event. The partner never hears about it.
2. A partner's server is down for **6 hours**. Your system tries once, fails, and gives up. Six hours of updates are lost.
3. A partner's server **does** handle an event and replies "OK", but the connection drops before your side hears the "OK". You send it again. The partner books **two** deliveries.
4. A merchant's laptop goes to sleep for 10 minutes. When it wakes up, the dashboard silently misses everything that happened meanwhile.

Real-time isn't just "send fast." It's "don't lose, don't double, and catch up." This lesson shows how.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Event** | A short message saying "this happened." | A text: "Your parcel was delivered." |
| **Webhook** | Your server calls a partner's URL when something happens. | A shop phoning you when your order is ready. |
| **SSE** (Server-Sent Events) | A one-way live stream from server to browser. | A live sports score ticker. |
| **Outbox** | A table where you save "events to send" in the same save as the data. | Writing "post this letter" on your to-do list at the same moment you write the letter. |
| **Idempotent** | Doing it twice has the same effect as doing it once. | Pressing a lift button twice still calls one lift. |

## The fix in three rules

### Rule 1: Save the change and the event together

❌ **Wrong:** save the order, *then* send the event. If you crash in between, the event is lost forever.

✅ **Right:** in **one** database transaction (an all-or-nothing save), write the order **and** a row in an `outbox` table. A separate **publisher** reads unsent outbox rows and sends them. If it crashes, it just picks up where it left off.

Every event gets a unique **event ID** and a **version** number (order 55, version 9).

### Rule 2: Pick the right pipe for the job

- Browser only needs to **listen** (dashboards, notifications)? Use **SSE**. Each message has an ID, so when the browser reconnects it can say "I last saw event 1234, send me what's after it."
- Browser and server both need to **talk** back and forth (chat, multiplayer game)? Use **WebSockets** (a two-way connection that stays open).
- Another company's **server** needs to know? Use a **webhook**.

### Rule 3: Expect duplicates, and keep trying (within limits)

Most event systems promise **at-least-once** delivery: an event will arrive, but **maybe more than once**. So:

- **Senders** store every webhook attempt, **sign** each request (so the partner knows it's really from you), retry with growing waits, and cap retries by **age** (e.g. stop after 3 days) and by **how many at once** per partner.
- **Receivers** remember which event IDs they already handled and skip repeats.

## Walk through a failure

**The lost "OK":** the partner processed event `evt_777` and replied "OK", but the network dropped the reply.

- ❌ Assume it failed and send a **new** event with a new ID. The partner can't tell it's a repeat.
- ✅ Retry with the **same** `evt_777`. The partner sees "already done", replies "OK" again, and nothing doubles.

**The sleepy laptop:** the browser reconnects and says "last event I saw was 1234."

- If the server still has events after 1234 (say it keeps the last 1 hour), it sends them.
- If 1234 is too old (outside that **resume window**), the server says so, and the browser **reloads the current state** of the orders instead of trying to replay.

## How to prove it works

1. **Duplicate test:** send the same event twice. The effect must happen once.
2. **Long outage test:** take a test partner offline for hours, then bring it back. All events must arrive, oldest still retried until its age limit.
3. **Expired cursor test:** reconnect a browser with a very old event ID. It must reload, not show stale data.
4. **Watch the numbers:** how old the oldest undelivered event is, how fresh dashboards are, how many events ended up in the **dead-letter queue** (DLQ, a "problem events" pile), and how many signature checks failed.

A green "connected" light on the socket proves nothing by itself. Check that events were actually **processed**.

### Check your understanding

A consumer gets two events for order 55. How can it tell "this is a duplicate" apart from "this is a newer change"?

<details>
<summary>Show answer</summary>

Look at two different fields:

- **Event ID:** same ID as one already handled? It's a **duplicate**. Skip it.
- **Order version:** a new ID, but is the version higher than what you've stored? If you have version 9 and this is version 10, it's a **newer change**. Apply it. If it's version 8, it's **stale** (older news arriving late). Ignore it, don't overwrite version 9.

So: event ID catches repeats, version number catches out-of-order arrivals.

</details>

---

## Going deeper

![Event patterns: an event stream can feed pub-sub consumers, webhook delivery, server-sent updates and database change capture](/img/system-design-l6/realtime-events.svg)

## The five patterns side by side

| Pattern | Best for | Key rule |
| --- | --- | --- |
| **SSE** | Server-to-browser updates | One-way stream; reconnect using the last event ID |
| **Webhook** | Notifying another company's server | Sign it, retry it, and the receiver must be idempotent |
| **WebRTC** | Direct, very low-delay audio/video/data between users | Needs a **signaling** server to introduce the two sides, a way through home routers (**NAT traversal**), and a relay fallback when direct fails |
| **Pub/Sub** | One event, many internal listeners | Decide how long events are kept and which team owns each listener |
| **CDC** | Publishing changes already saved in a database | Read the database's change log or an outbox, don't guess from app code |

**Pub/Sub** (publish/subscribe) is like a newsletter: the sender publishes once, and every subscriber gets a copy.

**CDC** (Change Data Capture) watches the database's own internal change log and turns each saved change into an event. Handy, but careful: it exposes your **table structure**, not a business meaning. If you rename a column, every listener breaks. A deliberate `OrderPlaced` event from an outbox is a stable contract; a raw "row changed in table orders" is not.

## What every event should carry

- **Event ID:** to spot duplicates.
- **Schema version:** which shape of message this is.
- **Ordering key:** e.g. `order_id`, so events about the same order stay in order.
- **Trace context:** a request ID so you can follow the event across services when debugging.

Events that keep failing after all retries go to a **DLQ** so a human can look at them, instead of blocking everything behind them.

## A reliable order event, step by step

1. In the **same** transaction that creates the order, write `outbox(OrderPlaced, order_id, version, event_id)`.
2. A publisher reads unsent rows and publishes them.
3. The publisher may crash after sending but before marking the row "sent". When it restarts, it sends again. So **duplicates are normal**.
4. Consumers either store processed `event_id`s, or make the write itself unique (e.g. a unique constraint on `delivery_for_order_id`), so the visible effect happens **once**.

## Ordering: promise only what you can keep

Events are spread across **partitions** (separate lanes that run in parallel). Order is kept **within a lane**, not across lanes.

- Put all events for one order in the same lane by using `order_id` as the **partition key**. Now order 55's history stays in order.
- **Don't** promise one global order across **all** orders. That would mean a single lane, which can't scale.
- Even within a lane, a retry can bring an old event late. A consumer holding version 9 that receives version 8 must **notice and ignore** it.

## Changing events without breaking listeners

- **Add** new fields as **optional** first. Old listeners ignore them.
- Never change what an existing field **means** (e.g. `amount` in cents suddenly becoming dollars).
- Include the **schema version**, and give listeners a **migration window** (e.g. 3 months) before removing anything.
- Keep events long enough to **rebuild** a consumer from scratch if needed.
- But don't treat an event topic as a dumping ground for personal data. Events get copied everywhere, so limit what personal information goes in.

## Quick recap

- 📦 **Outbox:** save the data and the event together, so nothing is lost on a crash.
- 🔀 **Pick the pipe:** SSE for one-way to browsers, WebSockets for two-way, webhooks for partner servers.
- 🔁 **At-least-once:** duplicates will happen; dedupe by event ID, reject old versions.
- 🛣️ **Order per key**, not globally.
- 🔎 **Measure delivery age**, not just "connected."
