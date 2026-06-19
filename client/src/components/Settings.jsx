import React, { useState } from 'react';
import { Terminal, Copy, HardDrive, Key } from 'lucide-react';

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
    }
  });

  const [loading, setLoading] = useState(false);

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
        addToast("Settings Updated", data.isMockMode ? "Saved. Running in Sandbox Mock Mode." : "Success! Connected to Notion Databases.", "success");
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

  const webhookUrl = "http://localhost:3001/api/process-email";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* n8n Webhook configuration */}
      <div style={{ paddingBottom: '16px', borderBottom: '2px dashed var(--border-color)' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Terminal size={16} style={{ color: 'var(--fill-primary)' }} /> n8n Ingestion Webhook URL
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '12px', lineHeight: 1.4 }}>
          Enter this URL in n8n's HTTP Request node (Method: POST) to process incoming emails:
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

      {/* Sandbox Simulator */}
      <div style={{ paddingBottom: '16px', borderBottom: '2px dashed var(--border-color)' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <HardDrive size={16} style={{ color: 'var(--fill-warning)' }} /> Sandbox Control
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '12px', lineHeight: 1.4 }}>
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

      {/* Notion/Gemini Credentials */}
      <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Key size={16} style={{ color: 'var(--fill-accent)' }} /> Production Credentials
        </h3>

        <div className="form-group" style={{ marginBottom: '8px' }}>
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

        <div className="form-group" style={{ marginBottom: '8px' }}>
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
    </div>
  );
}
