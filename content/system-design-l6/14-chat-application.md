---
title: "Design a Chat Application"
summary: "Deliver messages live without ever losing them. Keep 'saving the message' separate from 'sending it out', 'who's online' and 'notifying offline phones'."
level: Advanced
tags: [system-design, chat, websocket, messaging, presence]
---

## The story in one minute

**Alice** sends "Meet at 6" to **Bob**. She's on a weak train Wi-Fi. Bob is online on **two devices**: his phone and his laptop.

Here is what goes wrong, step by step:

1. The server **saves** Alice's message.
2. Just before it can reply "sent", Alice's connection drops. She never sees the checkmark.
3. Alice taps **send again**. Now there are **two** "Meet at 6" messages in the chat.
4. Meanwhile, the server that was pushing to Bob's phone **crashes**. Bob's laptop got the message, his phone didn't, and the phone never finds out it missed something.

Chat seems simple. But "send once, arrive once, in order, on every device" takes some care. This lesson shows how.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Gateway** | The server your phone keeps an open connection (WebSocket) to. | The switchboard operator connecting your calls. |
| **Fan-out** | Sending one message out to every recipient and device. | One teacher handing a worksheet to every student. |
| **Cursor / sequence number** | A number on every message in a chat (1, 2, 3, ...) so you can say "give me everything after #42". | Page numbers in a book: you know exactly where you stopped. |
| **Presence** | Whether someone is online right now. | The "open" sign on a shop door. |
| **Idempotency key** | A unique ID on a request so repeating it doesn't do it twice. | A receipt number: the shop won't refund the same receipt twice. |

## The fix in three rules

### Rule 1: Every message carries its own ID from the phone

When Alice's app sends a message, it includes:

- the **conversation ID** (which chat), and
- a **client message ID** the app made up, like `phoneA:981:4`.

Before saving anything, the server checks that Alice is actually **a member** of that conversation.

### Rule 2: Save first, say "sent" second, and block duplicates

1. Save the message, giving it the next **sequence number** for that chat (say, **#44**).
2. Only **after** it's safely saved, tell Alice "sent".
3. The database has a **unique rule** on `(sender_id, client_message_id)`. If Alice's app retries the same message, the database refuses to make a second copy, and the server just returns the one it already saved.

### Rule 3: Sending out, offline alerts and "online" status are separate jobs

- **Fan-out:** gateways push the message to each recipient's open connections.
- **Offline phones:** a separate worker sends a **push notification**.
- **Catching up:** every device remembers the last sequence number it saw and asks for anything newer when it reconnects.
- **Receipts and presence** ("delivered", "read", "online") are stored separately from the messages themselves.

## Walk through a failure

The gateway dies **after** saving Alice's message but **before** telling her "sent".

- ✅ Alice's app retries with the **same** client message ID `phoneA:981:4`. The database says "already have it" and returns the saved message **#44**. No duplicate.
- ✅ Bob's phone reconnects to another gateway and says "my last message was **#43**". The server sends **#44**. Bob gets it, even though the live push failed.

Nothing was lost, and nothing was doubled.

## How to prove it works

In a test environment, cause these on purpose:

1. **Crash right after saving** (before the "sent" reply).
2. **Send the same message twice.**
3. **Disconnect a device** for a few minutes, then reconnect it.

Then check:

1. **No message** that got a "sent" checkmark is ever lost (under the failures you've said you handle).
2. **No duplicates** appear.
3. **Delivery time** stays within your target.
4. Messages in each chat are **never out of order**.

### Check your understanding

How would a group with **100,000 members** change the fan-out path?

<details>
<summary>Show answer</summary>

You can't push to 100,000 people (and their devices) while Alice waits for "sent". That one request would take ages and could overload the gateways.

Instead:

1. **Save the message once** and tell Alice "sent" right away.
2. Hand the fan-out to **background workers** that send it out **in batches** at a safe speed, and record how far they've gotten (so a crash can resume, not restart).
3. Push live only to members who are **online and have the chat open**. Everyone else just gets an updated unread count or a summarized notification, and **pulls** new messages by cursor when they open the chat.
4. Keep **priority** for direct chats and security messages, so a giant group can't delay them.

</details>

---

## Going deeper

![Chat separates durable conversation storage from WebSocket fan-out, presence and offline push paths](/img/system-design-l6/chat.svg)

## The core idea in three sentences

1. **Save** a message before you say "sent", then publish a saved event that recipients' delivery can rely on.
2. The **client's message ID** makes retries and reconnects safe.
3. Order messages **within each conversation**, not across the whole world.

**Presence** ("online now") is short-lived: each device sends a heartbeat, and the "online" record expires on its own after, say, 30 seconds without one (a *TTL*, time to live). **Delivered** and **read** receipts are different: they are saved, permanent changes. **Offline push notifications** are triggered by the saved event, not by a gateway's memory (which disappears if the gateway crashes).

## The message promise

For a 1-to-1 chat, a sensible promise is:

1. The sender sees "sent" **only after** the message is safely saved.
2. Each recipient **eventually** sees it **exactly once**.
3. Messages within **one conversation** appear **in order**.

Ordering every message across all conversations worldwide would be slow and expensive, and nobody needs it. Nobody cares whether your chat with Bob is "before" or "after" a stranger's chat in another country.

## The send and receive flow

```text
Sender app -> WebSocket gateway -> message API -> conversation database
                                             -> MessageAccepted event
                                                -> online recipient gateway
                                                -> offline push worker
```

In words: the phone sends over its open connection, the message service saves it in the conversation database, and a "message accepted" event goes out to (a) the gateways holding recipients' live connections and (b) a worker that sends push notifications to offline phones.

The client message ID (for example `phoneA:981:4`) plus the unique rule on `(sender_id, client_message_id)` mean that if the phone's network drops **after** the server saved the message, the retry gets back the **original** message instead of creating a new one.

## Ordering without trusting the network

Each conversation has its own counter. Every saved message gets the next number: 42, 43, 44...

Messages can still **arrive** out of order. Say Bob's phone receives **#44 before #43**:

- Hold #44 for a moment, or
- Ask the server: "send me what's between #42 and #44."

❌ **Don't use the phone's clock** to order messages. Phones disagree about the time, sometimes by minutes.

## Three different "states" of a message

| State | Meaning |
| --- | --- |
| **Accepted** | The server saved the sender's message safely. |
| **Delivered** | At least one of the recipient's devices confirmed it received it. |
| **Read** | The recipient actually moved their "read up to here" marker past it. |

These are **separate facts**. An open WebSocket connection does **not** prove anyone saw the message.

## Failures and scale

**A gateway crashes:** its users reconnect to another gateway and ask for everything after their last sequence number. Gateway memory is **never** the source of truth; the database is.

**A group with one million members:** don't make one million socket writes inside the original send request. Instead:

- Create fan-out work in **bounded batches** (a fixed number at a time).
- Give **priority** to direct messages and security alerts.
- **Record delivery progress**, so a crashed worker can pick up where it left off.

## What to watch

- How many users are **connected**
- How often users **reconnect** (a spike means something's wrong)
- How old the **oldest undelivered message** is
- How many **duplicate sends were rejected** (shows retries are happening)
- **Gaps** in sequence numbers seen by devices
- **Push notification failures**
- **Hot spots:** single conversations getting huge traffic

## Quick recap

- 🆔 **Client message ID + unique rule:** retries never create duplicates.
- 💾 **Save before "sent":** the database is the truth, not the gateway.
- 🔢 **Per-chat sequence numbers:** order within a chat, and catch up by cursor after reconnecting.
- 📣 **Separate jobs:** fan-out, offline push, presence and receipts each have their own path.
