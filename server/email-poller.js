import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

let pollIntervalId = null;
let activeClient = null;
let isPolling = false;

/**
 * Stop any existing poller and active connections.
 */
export function stopEmailPoller() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  console.log("Email poller stopped.");
}

/**
 * Start the email polling background service.
 * @param {Object} config - { email, password, host, port, secure }
 * @param {Function} onNewEmail - Callback async function(emailData)
 */
export function startEmailPoller(config, onNewEmail) {
  stopEmailPoller();

  const { email, password } = config;
  if (!email || !password) {
    console.log("Email poller: Email or password not configured. Poller not started.");
    return;
  }

  // Auto-detect IMAP details if not explicitly provided
  let imapHost = config.host;
  let imapPort = config.port || 993;
  let imapSecure = config.secure !== undefined ? config.secure : true;

  if (!imapHost) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain === 'gmail.com') {
      imapHost = 'imap.gmail.com';
    } else if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
      imapHost = 'outlook.office365.com';
    } else if (domain === 'yahoo.com' || domain === 'ymail.com') {
      imapHost = 'imap.mail.yahoo.com';
    } else {
      // Default fallback
      imapHost = `imap.${domain}`;
    }
  }

  console.log(`Email poller starting for ${email} connecting to ${imapHost}:${imapPort}...`);

  const checkMail = async () => {
    if (isPolling) {
      console.log("Email poller is already running a check, skipping this tick.");
      return;
    }
    
    isPolling = true;
    console.log("Checking for new financial emails via direct IMAP...");
    
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: imapSecure,
      auth: {
        user: email,
        pass: password
      },
      logger: false
    });

    activeClient = client;

    try {
      await client.connect();
      
      // Select INBOX
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Search for unseen messages
        const messages = await client.search({ unseen: true });
        console.log(`Found ${messages.length} unseen emails.`);

        for (const messageSeq of messages) {
          try {
            // Fetch message source
            const message = await client.fetchOne(messageSeq, { source: true });
            if (!message || !message.source) continue;

            // Parse message using mailparser
            const parsed = await simpleParser(message.source);
            
            const subject = parsed.subject || 'No Subject';
            const sender = parsed.from?.value?.[0]?.address || 'Unknown';
            const body = parsed.text || parsed.html || '';
            const date = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

            // Parse attachments
            const files = [];
            if (parsed.attachments && parsed.attachments.length > 0) {
              for (const att of parsed.attachments) {
                files.push({
                  buffer: att.content,
                  originalname: att.filename || 'attachment',
                  mimetype: att.contentType
                });
              }
            }

            console.log(`Processing email "${subject}" from ${sender}`);
            
            // Process the email
            await onNewEmail({
              subject,
              body,
              sender,
              date,
              files
            });

            // Mark message as seen
            await client.messageFlagsAdd(messageSeq, ['\\Seen']);
            console.log(`Successfully processed and marked as seen: "${subject}"`);
          } catch (msgErr) {
            console.error("Error processing individual message:", msgErr);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err) {
      console.error("Error fetching emails via IMAP:", err.message);
      try {
        await client.logout();
      } catch (_) {}
    } finally {
      activeClient = null;
      isPolling = false;
    }
  };

  // Poll immediately on start, then every 2 minutes (120,000 ms)
  checkMail();
  pollIntervalId = setInterval(checkMail, 120000);
}
