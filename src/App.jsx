import React, { useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://probable-funicular-5g6xqj7vjj4427pg.app.github.dev:8000'

function App() {
  const [content, setContent] = useState('')
  const [summary, setSummary] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [subject, setSubject] = useState('General')

  const [studySubTab, setStudySubTab] = useState('questions')
  const [mcqAnswers, setMcqAnswers] = useState({})
  const [summaryLength, setSummaryLength] = useState(50)
  const [examMode, setExamMode] = useState(true)
  const [explainSimply, setExplainSimply] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [difficulty, setDifficulty] = useState('medium')
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [language, setLanguage] = useState('English')
  const [isRephrasing, setIsRephrasing] = useState(false)
  const [rephrasedText, setRephrasedText] = useState('')
  const [regeneratingMcqs, setRegeneratingMcqs] = useState(false)

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/stats`)
      const data = await res.json()
      setStats(data)
    } catch (e) { console.error(e) }
  }

  // If `VITE_API_URL` is not set, use relative paths so Vite's dev server proxy forwards requests.
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/history`)
      const data = await res.json()
      setHistory(data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (activeTab === 'history') fetchHistory()
    if (activeTab === 'stats') fetchStats()
  }, [activeTab])

  const handleStudy = async () => {
    if (!content.trim()) return

    setLoading(true)
    setProgress(0)

    try {
      const summRes = await fetch(`${API_BASE_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          length: summaryLength,
          examMode: examMode,
          explainSimply: explainSimply,
          topic: subject || 'New Study Session',
          difficulty: difficulty,
          language: language
        })
      });

      if (!summRes.ok) throw new Error('Summary generation failed');
      const summaryData = await summRes.json();
      console.log("Summary Data Received:", summaryData);

      // Fetch MCQs separately so it doesn't block the summary if it fails
      let mcqs = [];
      try {
        const mcqRes = await fetch(`${API_BASE_URL}/generate-mcqs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content, difficulty })
        });
        if (mcqRes.ok) {
          const mcqData = await mcqRes.json();
          console.log("MCQ Data Received:", mcqData);
          mcqs = mcqData.mcqs || [];
        }
      } catch (me) { console.error("MCQ Error:", me); }

      if (summaryData) {
        setSummary({ ...summaryData, mcqs });
        setActiveTab('summarize');
        setMcqAnswers({});
        console.log("Summary state updated successfully");
      }
      setLoading(false);
    } catch (error) {
      console.error("AI Error:", error)
      // Fallback for demo if backend is not running
      alert("Backend not reachable. Ensure FastAPI is running on port 8000.")
      setLoading(false)
    }
  }

  const handleRephrase = async (style) => {
    if (!content.trim()) return
    setIsRephrasing(true)
    try {
      const res = await fetch(`${API_BASE_URL}/rephrase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, style })
      })
      const data = await res.json()
      setRephrasedText(data.rephrased)
    } catch (e) {
      console.error(e)
    } finally {
      setIsRephrasing(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE_URL}/parse-file`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('File parse failed')

      const data = await response.json()
      setContent(data.text)
      setLoading(false)
    } catch (error) {
      console.error("Upload Error:", error)
      alert("Failed to parse file. Ensure it's a valid PDF or DOCX.")
      setLoading(false)
    }
  }

  const handleMcqSelect = async (questionIdx, optionIdx) => {
    if (mcqAnswers[questionIdx] !== undefined) return
    const newAnswers = { ...mcqAnswers, [questionIdx]: optionIdx }
    setMcqAnswers(newAnswers)

    // If all questions answered, save to backend
    if (Object.keys(newAnswers).length === (summary?.mcqs?.length || 0)) {
      const score = Object.entries(newAnswers).reduce((acc, [idx, ans]) =>
        acc + (ans === summary.mcqs[idx].correct ? 1 : 0), 0)

      try {
        await fetch(`${API_BASE_URL}/save-quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: summary.id || 1, // session_id would come from backend
            score: score,
            total: summary.mcqs.length,
            weak_topics: score < summary.mcqs.length ? [subject || 'General'] : []
          })
        })
      } catch (e) { console.error("Failed to save quiz", e) }
    }
  }

  const menuItems = [
    { title: 'Home', id: 'home' },
    { title: 'Smart Summary', id: 'summarize' },
    { title: 'Study Mode', id: 'study' },
    { title: 'History', id: 'history' },
    { title: 'Statistics', id: 'stats' }
  ]

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      try {
        await fetch(`${API_BASE_URL}/history`, { method: 'DELETE' });
        setHistory([]);
      } catch (e) { console.error("Failed to clear history", e); }
    }
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleRegenerateMcqs = async () => {
    setRegeneratingMcqs(true);
    try {
      // Use original content if available, otherwise try to reconstruct context from summary
      const context = content || (summary && summary.concepts ? summary.concepts.map(c => c.content).join("\n") : "");

      if (!context) {
        alert("No context available to regenerate questions.");
        setRegeneratingMcqs(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/generate-mcqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: context, difficulty: 'medium' })
      });

      const data = await res.json();
      if (data.mcqs && data.mcqs.length > 0) {
        setSummary(prev => ({ ...prev, mcqs: data.mcqs }));
        setMcqAnswers({});
      }
    } catch (e) {
      console.error("Failed to regenerate MCQs", e);
    }
    setRegeneratingMcqs(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Sidebar Navigation */}
      <aside className="glass-card" style={{
        width: '240px',
        borderRadius: '0',
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        padding: '30px 15px',
        background: '#0d0d10',
        zIndex: 10
      }}>
        <h2 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '40px', cursor: 'pointer', textAlign: 'center' }} onClick={() => setActiveTab('home')}>Study Mate</h2>
        <nav>
          {menuItems.map(item => (
            <div
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              style={{ fontSize: '0.95rem' }}
            >
              {item.title}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        {loading ? (
          <div className="loader-container fade-in">
            <div className="spinner"></div>
            <h3 style={{ color: 'white', fontWeight: 500 }}>Understanding your notes...</h3>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{Math.round(progress)}% Processed</p>
          </div>
        ) : activeTab === 'home' ? (
          <div className="home-centered-hero fade-in">
            <header style={{ marginBottom: '40px' }}>
              <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, margin: 0 }}>
                Turn Long Notes into Smart Study Material
              </h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '15px', fontSize: '1.1rem', fontWeight: 500 }}>
                Summarize. Practice. Revise. Perform.
              </p>
            </header>

            <div className="glass-card input-card" style={{ padding: '40px', width: '100%' }}>
              <div style={{ marginBottom: '30px', background: 'rgba(0,0,0,0.4)', borderRadius: '16px', padding: '25px', border: '1px solid var(--border-glass)' }}>
                <textarea
                  placeholder="Paste your notes here or describe what you want to learn..."
                  rows="10"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', padding: '0', color: 'white' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25px', color: 'var(--text-secondary)', fontSize: '0.85rem', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                  <span>{content.length} characters</span>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)' }}>
                    <span>📂 Upload PDF/DOCX</span>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Subject Area</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '220px', height: '45px' }}
                  >
                    <option>General</option>
                    <option>Computer Science</option>
                    <option>Biology</option>
                    <option>Mathematics</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={explainSimply} onChange={(e) => setExplainSimply(e.target.checked)} />
                    🚀 Explain Simply
                  </label>
                  <button
                    className="btn-glow"
                    style={{ padding: '15px 40px', fontSize: '1.1rem', background: 'var(--primary-gradient)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                    onClick={handleStudy}
                  >
                    Generate Smart Summary
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="fade-in">
            {/* Header with Title & Action Buttons */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '25px', minHeight: '60px' }}>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', width: 'auto', zIndex: 0 }}>
                <h2 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '5px' }}>
                  {activeTab === 'summarize' ? 'Smart Summary' : activeTab === 'study' ? 'Study Mode' : `Workspace: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
                </h2>
                {summary && (activeTab === 'summarize' || activeTab === 'study') && (
                  <p style={{ color: 'var(--text-secondary)' }}>Topic: <strong style={{ color: 'white' }}>{summary.topic}</strong></p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '15px', position: 'relative', zIndex: 1 }}>
                <button
                  onClick={handleDownloadPDF}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', cursor: 'pointer', color: 'white' }}
                >
                  Download PDF
                </button>
                <button
                  onClick={handleStudy}
                  style={{ background: 'transparent', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', fontSize: '0.85rem' }}
                >
                  Regenerate Focus
                </button>
                <button onClick={() => setActiveTab('home')} style={{ background: 'var(--primary-gradient)', border: 'none', color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>New Topic</button>
              </div>
            </div>

            {/* Sub-Views Ternary Chain */}
            {activeTab === 'history' ? (
              <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                  <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>Study History</h2>
                  {history.length > 0 && (
                    <button
                      onClick={handleClearHistory}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid #ef4444',
                        color: '#f87171',
                        padding: '6px 15px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      🗑️ Clear History
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gap: '20px' }}>
                  {(history || []).length > 0 ? history.map(h => (
                    <div key={h.id} className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ color: 'white', margin: 0 }}>{h.topic}</h4>
                        <small style={{ color: 'var(--text-secondary)' }}>{new Date(h.date).toLocaleDateString()}</small>
                      </div>
                      <button
                        className="btn-glow"
                        style={{ padding: '8px 20px', fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', cursor: 'pointer', borderRadius: '8px' }}
                        onClick={() => { setSummary(h.summary); setActiveTab('summarize'); }}
                      >
                        Review Notes
                      </button>
                    </div>
                  )) : (
                    <p style={{ color: 'var(--text-secondary)' }}>No study history found. Start your first session!</p>
                  )}
                </div>
              </div>
            ) : activeTab === 'stats' ? (
              <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <h2 style={{ color: 'white', marginBottom: '30px', textAlign: 'center', fontSize: '1.5rem' }}>Learning Analytics</h2>
                {stats ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
                      <h1 style={{ color: 'var(--accent-blue)', fontSize: '3rem', margin: 0 }}>{stats.mastery}%</h1>
                      <p style={{ color: 'var(--text-secondary)' }}>Average Mastery</p>
                    </div>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
                      <h1 style={{ color: 'var(--accent-violet)', fontSize: '3rem', margin: 0 }}>{stats.total_sessions}</h1>
                      <p style={{ color: 'var(--text-secondary)' }}>Total Sessions</p>
                    </div>
                    <div className="glass-card" style={{ gridColumn: 'span 2', padding: '30px' }}>
                      <h4 style={{ color: 'white', marginBottom: '15px' }}>📊 Topic Performance</h4>
                      <div style={{ display: 'grid', gap: '15px' }}>
                        {stats.topic_breakdown && stats.topic_breakdown.length > 0 ? (
                          stats.topic_breakdown.map((t, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                              <span style={{ color: 'white' }}>{t.topic}</span>
                              <span style={{ color: t.mastery >= 70 ? '#4ade80' : t.mastery >= 40 ? '#fbbf24' : '#ef4444', fontWeight: 600 }}>
                                {t.mastery}% Mastery
                              </span>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-secondary)' }}>Complete quizzes to see topic breakdown.</p>
                        )}
                      </div>
                    </div>
                    <div className="glass-card" style={{ gridColumn: 'span 2', padding: '30px' }}>
                      <h4 style={{ color: 'white', marginBottom: '15px' }}>🚨 Weak Topics (Focus Areas)</h4>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {(stats.weak_topics || []).length > 0 ? stats.weak_topics.map(t => (
                          <span key={t} style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '8px 15px', borderRadius: '20px', border: '1px solid #ef4444' }}>
                            {t}
                          </span>
                        )) : (
                          <p style={{ color: 'var(--text-secondary)' }}>Keep taking quizzes to identify weaknesses!</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : <p style={{ color: 'white' }}>Loading stats...</p>}
              </div>
            ) : activeTab === 'settings' ? (
              <div className="glass-card" style={{ padding: '50px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Personalize your study experience in Settings.</p>
              </div>
            ) : summary ? (
              <>
                {activeTab === 'summarize' && (
                  <>
                    <div className="control-panel">
                      <div className="control-group">
                        <label style={{ fontSize: '0.9rem', color: 'white' }}>Summary Length:</label>
                        <input
                          type="range"
                          className="summary-slider"
                          min="0" max="100"
                          value={summaryLength}
                          onChange={(e) => setSummaryLength(e.target.value)}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '60px' }}>
                          {summaryLength < 33 ? 'Short' : summaryLength < 66 ? 'Medium' : 'Detailed'}
                        </span>
                      </div>
                      <div className="control-group">
                        <label style={{ fontSize: '0.9rem', color: 'white' }}>Exam Mode</label>
                        <label className="switch">
                          <input type="checkbox" checked={examMode} onChange={() => setExamMode(!examMode)} />
                          <span className="slider"></span>
                        </label>
                      </div>
                      <div className="control-group">
                        <label style={{ fontSize: '0.9rem', color: 'white' }}>Language</label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-glass)' }}
                        >
                          <option value="English">🇬🇧 English</option>
                          <option value="Hindi">🇮🇳 Hindi</option>
                          <option value="Spanish">🇪🇸 Spanish</option>
                          <option value="French">🇫🇷 French</option>
                          <option value="German">🇩🇪 German</option>
                        </select>
                      </div>
                    </div>

                    <div className="split-view">
                      {/* Left Column: Original Content & Rephrasing */}
                      <div className="original-view">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <h5 style={{ color: 'white', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px', margin: 0 }}>Source Material</h5>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {['Academic', 'Scientific', 'Simplified'].map(style => (
                              <button
                                key={style}
                                onClick={() => handleRephrase(style)}
                                disabled={isRephrasing}
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  color: 'var(--accent-blue)',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  cursor: 'pointer'
                                }}
                              >
                                {isRephrasing ? '...' : `✨ ${style}`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-glass)', minHeight: '400px' }}>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                            {rephrasedText || content}
                          </p>
                        </div>
                      </div>

                      {/* Right Column: Summarized Output */}
                      <div className="summary-view">
                        {summary.simplification && (
                          <div className="summary-card fade-in" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid var(--accent-blue)' }}>
                            <h4><div className="icon-box">🧠</div> Simplified Concept</h4>
                            <p style={{ color: 'white', fontStyle: 'italic', fontSize: '1.05rem' }}>"{summary.simplification}"</p>
                          </div>
                        )}

                        {summary.concepts?.map((c, i) => (
                          <div key={i} className="summary-card fade-in">
                            <h4><div className="icon-box">💡</div> {c.title || 'Concept'}</h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{c.content || c.text}</p>
                          </div>
                        ))}

                        {summary.definitions && Object.keys(summary.definitions).length > 0 && (
                          <div className="summary-card fade-in">
                            <h4><div className="icon-box">📖</div> Key Definitions</h4>
                            <div style={{ display: 'grid', gap: '15px' }}>
                              {Object.entries(summary.definitions).map(([term, def], i) => (
                                <div key={i}>
                                  <strong style={{ color: 'var(--accent-blue)', display: 'block' }}>{term}</strong>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{def}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'study' && (
                  <div className="fade-in">
                    <div className="sub-tab-nav">
                      {['Questions', 'Revision', 'Topology', 'Planner'].map(tab => (
                        <div
                          key={tab}
                          className={`sub-tab-item ${studySubTab === tab ? 'active' : ''}`}
                          onClick={() => setStudySubTab(tab)}
                        >
                          {tab === 'topology' ? '📍 Concept Graph' : tab === 'planner' ? '📅 Daily Plan' : tab}
                        </div>
                      ))}
                    </div>

                    <div style={{ minHeight: '50vh' }}>
                      {studySubTab === 'Questions' && (
                        <div className="fade-in">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ color: 'white', margin: 0, flex: 1, textAlign: 'center' }}>Adaptive Practice</h3>
                            <button
                              onClick={handleRegenerateMcqs}
                              disabled={regeneratingMcqs}
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--accent-blue)',
                                color: 'var(--accent-blue)',
                                padding: '5px 15px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              {regeneratingMcqs ? 'Refreshing...' : '↻ New Questions'}
                            </button>
                          </div>
                          {summary.mcqs?.map((m, qIdx) => (
                            <div key={qIdx} className="mcq-card fade-in">
                              <p style={{ color: 'white', fontSize: '1.1rem' }}>{qIdx + 1}. {m.question}</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                                {m.options.map((opt, oIdx) => (
                                  <button
                                    key={oIdx}
                                    className={`option-btn ${mcqAnswers[qIdx] !== undefined ? (oIdx === m.correct ? 'correct' : mcqAnswers[qIdx] === oIdx ? 'incorrect' : '') : ''}`}
                                    onClick={() => handleMcqSelect(qIdx, oIdx)}
                                  >
                                    {String.fromCharCode(65 + oIdx)}. {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {studySubTab === 'Revision' && (
                        <div className="fade-in">
                          <h3 style={{ color: 'white', marginBottom: '25px', textAlign: 'center' }}>Detailed Learning Blocks</h3>
                          <div className="sticky-grid">
                            {(summary.concepts || []).map((note, i) => (
                              <div key={i} className={`sticky-note ${i % 3 === 0 ? 'sticky-blue' : i % 3 === 1 ? 'sticky-violet' : 'sticky-yellow'} fade-in`} style={{ animationDelay: `${i * 0.05}s` }}>
                                <h5 style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '8px', marginBottom: '15px', textTransform: 'uppercase', fontSize: '1rem', letterSpacing: '1px', fontWeight: 800 }}>
                                  {note.title || (note.text ? note.text : 'Key Point')}
                                </h5>
                                <p style={{ fontSize: '0.95rem', lineHeight: '1.7', whiteSpace: 'pre-wrap', overflowY: 'auto', flex: 1 }}>
                                  {note.content || note.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {studySubTab === 'Topology' && (
                        <div className="fade-in">
                          <h3 style={{ color: 'white', marginBottom: '25px', textAlign: 'center' }}>Concept Dependency Mapping</h3>
                          <div className="summary-card" style={{ background: 'rgba(0,0,0,0.3)', padding: '40px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                              {(() => {
                                const groups = {};
                                const uniqueDeps = new Set();
                                (summary.dependencies || []).forEach(d => {
                                  // Create unique key to prevent exact duplicate edges
                                  const edgeKey = `${d[0]}->${d[1]}`;
                                  if (!uniqueDeps.has(edgeKey)) {
                                    uniqueDeps.add(edgeKey);
                                    if (!groups[d[0]]) groups[d[0]] = [];
                                    groups[d[0]].push(d[1]);
                                  }
                                });

                                const sources = Object.keys(groups);
                                if (sources.length === 0) return <p style={{ color: 'var(--text-secondary)' }}>No complex dependencies to map.</p>;

                                return sources.map((src, i) => (
                                  <div key={i} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
                                    {/* Source Node */}
                                    <div className="glass-card" style={{
                                      padding: '15px 30px',
                                      border: '1px solid var(--accent-blue)',
                                      color: 'white',
                                      fontWeight: 800,
                                      fontSize: '1.2rem',
                                      background: 'rgba(56, 189, 248, 0.1)'
                                    }}>
                                      {src}
                                    </div>

                                    {/* Connector */}
                                    <div style={{ height: '30px', width: '2px', background: 'var(--accent-blue)', margin: '5px 0' }}></div>

                                    {/* Targets Container */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' }}>
                                      {groups[src].map((target, j) => (
                                        <div key={j} className="glass-card" style={{
                                          padding: '10px 20px',
                                          border: '1px solid var(--accent-violet)',
                                          color: 'white',
                                          fontSize: '0.95rem'
                                        }}>
                                          {target}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      {studySubTab === 'Planner' && (
                        <div className="fade-in">
                          <h3 style={{ color: 'white', marginBottom: '25px', textAlign: 'center' }}>Personalized Learning Path</h3>
                          <div style={{ display: 'grid', gap: '15px' }}>
                            {(summary.studySchedule || []).map((day, i) => (
                              <div key={i} className="focus-item fade-in" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                  <div style={{ textAlign: 'center', minWidth: '50px' }}>
                                    <span style={{ fontSize: '0.7rem', display: 'block' }}>DAY</span>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{day.day}</span>
                                  </div>
                                  <div>
                                    <h4 style={{ color: 'white', margin: 0 }}>{day.task}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Goal: {day.goal}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}


                    </div>
                  </div>
                )}


              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '120px', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '1.2rem' }}>No active summary. Go to <strong style={{ color: 'white', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>Home</strong> to start.</p>
              </div>
            )}
          </div>
        )}
      </main>
      <style>{`
        @media print {
          /* Hide Sidebar and UI Elements */
          aside, button, .sub-tab-nav, .input-card, .loader-container, .control-panel, .revision-toggle { 
            display: none !important; 
          }

          /* Reset Layout for Print */
          body, html, #root, .main-content { 
            height: auto !important; 
            overflow: visible !important; 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important; 
            color: black !important; 
            display: block !important;
          }

          /* Ensure Split View expands */
          .split-view {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            gap: 0 !important;
          }

          /* Expand Scrollable Areas */
          .original-view, .summary-view {
            height: auto !important;
            overflow: visible !important;
            flex: none !important;
            width: 100% !important;
            border: none !important;
            padding: 0 !important;
            margin-bottom: 30px !important;
          }
          
          /* Hide Source Material in Print (Optional, but often preferred for clean summary PDF) */
          .original-view { display: none !important; }

          /* Card Styling for Print */
          .glass-card, .summary-card, .sticky-note {
             background: white !important;
             border: 1px solid #ddd !important;
             box-shadow: none !important;
             color: black !important;
             break-inside: avoid;
             margin-bottom: 20px;
          }
          
          /* Typography */
          h1, h2, h3, h4, h5, p, span, div, strong, li { 
            color: black !important; 
            text-shadow: none !important; 
          }
          
          .gradient-text { 
            background: none !important; 
            -webkit-text-fill-color: black !important; 
            color: black !important; 
          }
        }
      `}</style>
    </div>
  );
}

export default App;
