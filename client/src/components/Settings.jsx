import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Copy, 
  HardDrive, 
  Key, 
  Sparkles, 
  Mail, 
  CheckCircle, 
  AlertTriangle, 
  Settings as SettingsIcon, 
  HelpCircle 
} from 'lucide-react';

export default function Settings({ stats, fetchAllData, addToast, closeModal }) {
  const [keys, setKeys] = useState({
    geminiApiKey: '',
    notionToken: '',
    databaseIds: {
      transactions: '',
      emails: '',
      budgets: '',
      subscriptions: '',
      bills: ''
    },
    emailAddress: '',
    emailPassword: ''
  });

  const [parentPageId, setParentPageId] = useState('');
  const [activeTab, setActiveTab] = useState('quick-setup'); // 'quick-setup' | 'email-connect' | 'manual-config' | 'sandbox'
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState(null);

  // Fetch existing settings on load
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setKeys({
            geminiApiKey: data.geminiApiKey || '',
            notionToken: data.notionToken || '',
            databaseIds: data.databaseIds || {
              transactions: '',
              emails: '',
              budgets: '',
              subscriptions: '',
              bills: ''
            },
            emailAddress: data.emailAddress || '',
            emailPassword: data.hasEmailPassword ? '******' : ''
          });
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys)
      });

      if (response.ok) {
        const data = await response.json();
        addToast("Settings Updated", data.isMockMode ? "Saved. Running in Sandbox Mock Mode." : "Success! Saved credentials to .env file.", "success");
        fetchAllData();
        if (closeModal) closeModal();
      }
    } catch (err) {
      console.error(err);
      addToast("Failed", "Could not update configurations.", "critical");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSetup = async (e) => {
    e.preventDefault();
    if (!keys.notionToken || !parentPageId) {
      addToast("Required Fields", "Please enter Notion Token and Parent Page ID", "medium");
      return;
    }
    setSetupLoading(true);
    setSetupResult(null);

    try {
      const response = await fetch('/api/setup-notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notionToken: keys.notionToken,
          parentPageId: parentPageId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSetupResult(data.databaseIds);
        setKeys(prev => ({
          ...prev,
          databaseIds: data.databaseIds
        }));
        addToast("Setup Completed!", "Successfully created 5 databases in Notion!", "success");
        fetchAllData();
      } else {
        const data = await response.json();
        addToast("Setup Failed", data.error || "Could not setup databases.", "critical");
      }
    } catch (err) {
      console.error(err);
      addToast("Setup Failed", "An error occurred during database creation.", "critical");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleLoadMockData = async () => {
    try {
      const response = await fetch('/api/simulate-bulk', { method: 'POST' });
      if (response.ok) {
        addToast("Sandbox Mock Loaded", "Loaded 8 emails and 7 transaction ledger entries.", "success");
        fetchAllData();
        if (closeModal) closeModal();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearDb = async () => {
    if (!window.confirm("Are you sure you want to clear your local offline sandbox database?")) return;
    try {
      const response = await fetch('/api/clear-db', { method: 'POST' });
      if (response.ok) {
        addToast("Database Reset", "Cleared cached sandbox records.", "medium");
        fetchAllData();
        if (closeModal) closeModal();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addToast("Copied", "Webhook URL copied.", "medium");
  };

  const webhookUrl = `${window.location.protocol}//${window.location.host}/api/process-email`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Navigation tabs */}
      <div 
        style={{ 
          display: 'flex', 
          borderBottom: '2px solid var(--border-color)', 
          gap: '8px',
          paddingBottom: '8px',
          overflowX: 'auto'
        }}
      >
        <button 
          type="button"
          onClick={() => setActiveTab('quick-setup')}
          style={{
            padding: '8px 12px',
            fontSize: '0.82rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            border: activeTab === 'quick-setup' ? '2px solid var(--border-color)' : '2px solid transparent',
            background: activeTab === 'quick-setup' ? 'var(--fill-primary-light)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-primary)'
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--fill-primary)' }} />
          Notion Setup
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('email-connect')}
          style={{
            padding: '8px 12px',
            fontSize: '0.82rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            border: activeTab === 'email-connect' ? '2px solid var(--border-color)' : '2px solid transparent',
            background: activeTab === 'email-connect' ? 'var(--fill-accent-light)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-primary)'
          }}
        >
          <Mail size={14} style={{ color: 'var(--fill-accent)' }} />
          Direct Email
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('manual-config')}
          style={{
            padding: '8px 12px',
            fontSize: '0.82rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            border: activeTab === 'manual-config' ? '2px solid var(--border-color)' : '2px solid transparent',
            background: activeTab === 'manual-config' ? 'var(--fill-warning-light)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-primary)'
          }}
        >
          <SettingsIcon size={14} style={{ color: 'var(--fill-warning)' }} />
          Manual Settings
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('sandbox')}
          style={{
            padding: '8px 12px',
            fontSize: '0.82rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            border: activeTab === 'sandbox' ? '2px solid var(--border-color)' : '2px solid transparent',
            background: activeTab === 'sandbox' ? 'var(--border-color-light)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-primary)'
          }}
        >
          <HardDrive size={14} style={{ color: 'var(--text-secondary)' }} />
          Sandbox
        </button>
      </div>

      {/* Tab Contents */}
      
      {/* 1. Quick Notion Setup Wizard */}
      {activeTab === 'quick-setup' && (
        <form onSubmit={handleAutoSetup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--fill-primary-light)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--border-color)' }}>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} style={{ color: 'var(--fill-primary)' }} /> Notion 1-Click Database Setup
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.4 }}>
              Enter your Notion Credentials. Pikachu will automatically build, structure, and seed all 5 databases under your parent page. No CLI commands or manual tables required!
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Notion Integration Token</label>
            <input 
              type="password" 
              placeholder="secret_..." 
              className="playful-input"
              style={{ padding: '8px 12px' }}
              value={keys.notionToken}
              onChange={e => setKeys(prev => ({ ...prev, notionToken: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Parent Page ID</label>
            <input 
              type="text" 
              placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..." 
              className="playful-input"
              style={{ padding: '8px 12px' }}
              value={parentPageId}
              onChange={e => setParentPageId(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
              Copy this from your Notion browser address bar (the last string of characters in the URL). Make sure you have invited your integration to this page!
            </span>
          </div>

          {setupResult && (
            <div style={{ background: '#e6f4ea', border: '2px solid #57bb8a', padding: '12px', borderRadius: 'var(--radius-sm)', color: '#137333', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '6px' }}>
                <CheckCircle size={14} /> databases Created Successfully!
              </div>
              <ul style={{ paddingLeft: '18px', margin: 0, lineHeight: 1.4 }}>
                <li>Transactions DB: {setupResult.transactions}</li>
                <li>Emails DB: {setupResult.emails}</li>
                <li>Budgets DB: {setupResult.budgets}</li>
                <li>Subscriptions DB: {setupResult.subscriptions}</li>
                <li>Bills DB: {setupResult.bills}</li>
              </ul>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '0.7rem', fontStyle: 'italic' }}>
                Configs successfully written to server/.env file.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" className="playful-btn primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} disabled={setupLoading}>
              {setupLoading ? "Creating & Seeding..." : "Create & Link Databases"}
            </button>
          </div>
        </form>
      )}

      {/* 2. Direct Email Setup (IMAP) */}
      {activeTab === 'email-connect' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--fill-accent-light)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--border-color)' }}>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={16} style={{ color: 'var(--fill-accent)' }} /> Zero-n8n Direct Email Connection
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.4 }}>
              Let Pikachu scan your financial alert emails directly from your inbox. Automatically works for Gmail, Outlook, Yahoo, and Hotmail.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Email Address</label>
            <input 
              type="email" 
              placeholder="friend@gmail.com" 
              className="playful-input"
              style={{ padding: '8px 12px' }}
              value={keys.emailAddress}
              onChange={e => setKeys(prev => ({ ...prev, emailAddress: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              App Password / Password
            </label>
            <input 
              type="password" 
              placeholder={keys.emailPassword === '******' ? '******' : 'Enter 16-character App Password'} 
              className="playful-input"
              style={{ padding: '8px 12px' }}
              value={keys.emailPassword}
              onChange={e => setKeys(prev => ({ ...prev, emailPassword: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-primary)', border: '2px solid var(--border-color)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
            <HelpCircle size={28} style={{ color: 'var(--fill-accent)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>How to set up App Password (Gmail):</strong>
              1. Open your Google Account &gt; Security.<br />
              2. Enable 2-Step Verification.<br />
              3. Search for "App Passwords" in the search bar.<br />
              4. Generate a new app password for "Other (Custom Name)" named "Pikachu CFO". Copy the 16-character code and paste it here!
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" className="playful-btn primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} disabled={loading}>
              {loading ? "Connecting..." : "Connect Email Ingestion"}
            </button>
          </div>
        </form>
      )}

      {/* 3. Manual Configs */}
      {activeTab === 'manual-config' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <Key size={14} style={{ color: 'var(--fill-accent)' }} /> Production Credentials
          </h4>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Gemini API Key</label>
            <input 
              type="password" 
              placeholder="AI Studio API Key" 
              className="playful-input"
              style={{ padding: '8px 12px' }}
              value={keys.geminiApiKey}
              onChange={e => setKeys(prev => ({ ...prev, geminiApiKey: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Notion Token</label>
            <input 
              type="password" 
              placeholder="secret_..." 
              className="playful-input"
              style={{ padding: '8px 12px' }}
              value={keys.notionToken}
              onChange={e => setKeys(prev => ({ ...prev, notionToken: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notion Database IDs</span>
            
            <div className="grid-2" style={{ gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Transactions DB</label>
                <input 
                  type="text" 
                  placeholder="Database ID" 
                  className="playful-input"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  value={keys.databaseIds.transactions}
                  onChange={e => setKeys(prev => ({ 
                    ...prev, 
                    databaseIds: { ...prev.databaseIds, transactions: e.target.value } 
                  }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Emails DB</label>
                <input 
                  type="text" 
                  placeholder="Database ID" 
                  className="playful-input"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  value={keys.databaseIds.emails}
                  onChange={e => setKeys(prev => ({ 
                    ...prev, 
                    databaseIds: { ...prev.databaseIds, emails: e.target.value } 
                  }))}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Budgets DB</label>
                <input 
                  type="text" 
                  placeholder="Database ID" 
                  className="playful-input"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  value={keys.databaseIds.budgets}
                  onChange={e => setKeys(prev => ({ 
                    ...prev, 
                    databaseIds: { ...prev.databaseIds, budgets: e.target.value } 
                  }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Subscriptions DB</label>
                <input 
                  type="text" 
                  placeholder="Database ID" 
                  className="playful-input"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  value={keys.databaseIds.subscriptions}
                  onChange={e => setKeys(prev => ({ 
                    ...prev, 
                    databaseIds: { ...prev.databaseIds, subscriptions: e.target.value } 
                  }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ width: '48.5%', marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Bills DB</label>
              <input 
                type="text" 
                placeholder="Database ID" 
                className="playful-input"
                style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                value={keys.databaseIds.bills}
                onChange={e => setKeys(prev => ({ 
                  ...prev, 
                  databaseIds: { ...prev.databaseIds, bills: e.target.value } 
                }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            {closeModal && (
              <button type="button" className="playful-btn" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={closeModal}>
                Cancel
              </button>
            )}
            <button type="submit" className="playful-btn primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} disabled={loading}>
              {loading ? "Saving..." : "Save Credentials"}
            </button>
          </div>
        </form>
      )}

      {/* 4. Sandbox Control */}
      {activeTab === 'sandbox' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* n8n Webhook configuration */}
          <div style={{ paddingBottom: '16px', borderBottom: '2px dashed var(--border-color)' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Terminal size={16} style={{ color: 'var(--fill-primary)' }} /> n8n Ingestion Webhook URL
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '12px', lineHeight: 1.4 }}>
              Enter this URL in n8n's HTTP Request node (Method: POST) to process incoming emails if using n8n:
            </p>

            <div 
              style={{ 
                background: 'var(--bg-primary)', 
                border: '2px solid var(--border-color)', 
                padding: '10px 14px', 
                borderRadius: 'var(--radius-sm)', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                marginBottom: '12px'
              }}
            >
              <span style={{ color: 'var(--fill-accent)' }}>{webhookUrl}</span>
              <Copy 
                size={14} 
                className="toast-close" 
                style={{ cursor: 'pointer' }}
                onClick={() => copyToClipboard(webhookUrl)}
              />
            </div>
          </div>

          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <HardDrive size={16} style={{ color: 'var(--fill-warning)' }} /> Sandbox Control
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '12px', lineHeight: 1.4 }}>
              Seed mock dataset containing bank UPI alerts, Netflix bills, and Stripe messages to test the playfulness instantly:
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="playful-btn primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={handleLoadMockData}>
                Load Sandbox Mock Data
              </button>
              <button className="playful-btn danger" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={handleClearDb}>
                Reset Database
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
