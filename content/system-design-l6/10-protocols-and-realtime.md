---
title: "Proxies, APIs and Real-Time Protocols"
summary: "Different conversations need different ways to talk. Pick REST, RPC, queues, long polling, WebSockets, TCP or UDP by asking what the user is actually doing."
level: Advanced
tags: [system-design, api, websocket, tcp, udp, proxy]
---

## The story in one minute

You're building a **food delivery app**. It needs to do three very different things:

- **Place an order** (happens once, must never be lost or doubled).
- **Show the driver moving on a map** (updates every 2 seconds, an old position is useless).
- **Calculate the price** inside your own system (one service asks another, fast).

A team decides to use **one way of talking for everything**. Here is what goes wrong:

1. They send orders over the live map connection (a WebSocket). The phone goes into a tunnel. The order message vanishes, and nobody saved it.
2. They retry *every* driver position that fails. When the phone comes back online, it sends 60 old positions in a burst. The map jumps around, and the servers get flooded.
3. The price service is called through a slow public API with no deadline, so checkout hangs.

Each job needed its **own** tool. This lesson is about choosing the right one.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Request/response (REST, RPC)** | Ask one question, get one answer. | Asking a shop assistant "do you have this in size M?" |
| **Queue** | A waiting line of jobs that is saved, so jobs survive a crash. | A ticket system at the post office. |
| **WebSocket** | A phone line that stays open, so **both sides** can talk any time. | A phone call (vs. sending letters). |
| **SSE (Server-Sent Events)** | An open line where only the **server** talks. | A radio station: you listen, you don't talk back. |
| **Proxy** | A middle-man that passes messages along. | A receptionist who forwards your calls. |

## The fix in three rules

### Rule 1: For "do this once" actions, use request/response with a request ID

Placing an order is a single question that needs a clear answer: "Did it work?"

✅ Use a normal **HTTP API** (like `POST /orders`). Return a clear error if it fails. Include a **request ID** (an *idempotency key*) so that if the phone retries, the server says "I already have that order" instead of creating a second one.

For calls **inside** your own system (like the price calculation), **RPC** (Remote Procedure Call, for example gRPC) is a good fit. It feels like calling a normal function, checks data types on both sides, and lets you pass a **deadline** ("answer within 200 ms").

### Rule 2: For live updates, use an open connection, but plan for it to break

- Only the server needs to talk (order status: "cooking", "on the way")? **SSE** is enough.
- Both sides need to talk (chat with the driver)? Use a **WebSocket**.

Open connections still need: a login check, a **size limit** on how many unsent messages pile up for a slow phone, and a plan for **reconnecting**.

### Rule 3: Anything that must survive a crash goes in durable storage or a queue

**TCP** (the basic "reliable" internet connection) delivers bytes in order *while the connection lasts*. That's all.

❌ **Wrong:** "TCP is reliable, so my order will arrive." If the server crashes after receiving the bytes but before saving the order, it's gone.

✅ **Right:** save important things in a database, or put work on a **durable queue** (one that's written to disk and survives a restart).

## Walk through a failure

A phone gets the first 5 status updates, then the connection drops. It reconnects 30 seconds later.

- ❌ If the app only shows what arrives on the live socket, the user missed updates 6 to 9 forever.
- ✅ On reconnect, the app sends its **cursor** ("the last update I saw was number 5") and fetches the real current state from the server.

A live socket is just a **delivery pipe**. It's not where orders or messages are stored.

## How to prove it works

In a test environment, cause trouble on purpose:

1. **Disconnect** phones in the middle of updates.
2. Make a client **read very slowly**.
3. **Restart servers one by one** (a *rolling restart*).

Then measure these **separately**:

1. How many reconnects **succeed**.
2. How far behind the updates are (**lag**).
3. Whether the server's per-client buffers **keep growing** (they shouldn't).
4. Whether every order/payment **command succeeded exactly once**.

Dropping an old driver position is fine. Losing an order is not.

### Check your understanding

Should driver positions and payment commands use the **same retry policy**?

<details>
<summary>Show answer</summary>

**No.**

- **Driver positions:** don't retry old ones. A position from 10 seconds ago is already out of date. Just send the **newest** one when you can, and drop the rest.
- **Payment commands:** must not be lost *or* doubled. Retry only temporary errors, reuse the **same idempotency key** each time, stay inside the deadline, and if unsure, **check the payment status** before trying again.

Different value, different rules: one is a "latest is best" stream, the other is a "must happen exactly once" command.

</details>

---

## Going deeper

![Communication choices: reverse proxy at the edge, request APIs, queues and persistent real-time connections](/img/system-design-l6/protocols-realtime.svg)

## The menu of options

| What you need | Good starting point | The trade-off |
| --- | --- | --- |
| Public API for things like orders, profiles | REST over HTTPS | Familiar to everyone, and easy to cache. |
| Fast typed call between your own services | gRPC / RPC | Both sides are tied more tightly to the same contract. |
| Slow work (minutes) | Queue | The result comes later, and there can be a backlog. |
| Occasional updates | Long polling (client asks "anything new?" and the server waits to answer until there is) | Keeps reopening connections. |
| Live two-way chat | WebSocket | You must manage many open connections and send to many people. |
| Bytes that must arrive complete and in order | TCP | A bit more overhead; one lost packet holds up everything behind it. |
| Live audio/video where a little loss is OK | UDP, or QUIC (built on UDP) | The app must cope with missing or out-of-order pieces. |

A note on QUIC: it's what HTTP/3 uses. It runs on top of UDP but adds its own reliability, so one lost packet only delays its own stream instead of everything.

## Forward proxy vs reverse proxy

Both are middle-men, but they work for different sides:

| | Works for | Example |
| --- | --- | --- |
| **Forward proxy** | The **clients** | An office proxy that all employees' browsers go through to reach the internet. |
| **Reverse proxy** | The **servers** | A front door (like Nginx) that receives all public traffic, handles **TLS** (the encryption in HTTPS), routes requests to the right server, caches answers and limits how fast each user can call. |

Keep these straight too: a **queue is not a WebSocket**, and a **WebSocket is not a saved message history**.

## Pick by what the user is doing

| User action | Best fit | Why |
| --- | --- | --- |
| "Save my profile" | HTTP REST | Needs one answer, right now. |
| Receive a chat message | WebSocket for live delivery, **but** save the message in a database before saying "sent" | The server must push messages, but pushing isn't storing. |
| Make a video thumbnail (takes 2 minutes) | Return a **job ID** right away, do the work through a queue | Don't hold an HTTP request open for 2 minutes. The app can check back with the job ID. |

## Checklist for live connections

1. **Check who they are** when they connect, and re-check permission before joining sensitive channels (like a private room).
2. **Send heartbeats** and close dead connections. Phones often vanish without saying goodbye.
3. **Store "who's connected where"** in shared, short-lived storage (like Redis), not in one server's memory. Otherwise, when that server restarts, the info is gone.
4. **Define reconnecting:** the client resumes from a saved **cursor** or **sequence number** ("give me everything after #120").
5. **Set limits per user and per room**, so one huge room can't use up all the connections.

WebSockets save you from constant polling. But on their own they do **not** give you guaranteed delivery, saved history, correct ordering across many servers, or messages for people who were offline. You build those with storage.

## Quick recap

- 📮 **Do-once actions** (orders, payments): request/response plus an idempotency key.
- 📡 **Live updates:** SSE for one-way, WebSocket for two-way, and always plan the reconnect.
- 💾 **Must survive a crash:** a database or durable queue, not "TCP is reliable."
- 🚪 **Reverse proxy:** the front door for your servers (TLS, routing, caching, rate limits).
