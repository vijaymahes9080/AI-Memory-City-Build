import React, { useEffect, useState, useRef } from 'react';
import { useCityStore, store, Building, ChatMessage } from './store';
import { Canvas3D } from './components/Canvas3D';
import { 
  Search, UploadCloud, Terminal, FileText, Send, X, 
  HelpCircle, CheckCircle, ShieldAlert, Award, Clock, Activity 
} from 'lucide-react';

export const App: React.FC = () => {
  const { 
    buildings, selectedBuilding, searchQuery, 
    timeTravelMode, timeTravelIndex, isUploading, logs 
  } = useCityStore();

  // Upload fields
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Chat fields
  const [activeAgent, setActiveAgent] = useState<'Professor' | 'Engineer' | 'Teacher' | 'Reviewer'>('Professor');
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Quiz states
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);

  // Gamification points
  const [expPoints, setExpPoints] = useState(() => {
    return parseInt(localStorage.getItem('memory_city_exp') || '150', 10);
  });

  // Load initial city structures
  useEffect(() => {
    store.fetchCity();
  }, []);

  // Connect WebSocket for live sync updates
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws`;
    
    let ws: WebSocket;
    
    function connect() {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        store.addLog("Synchronized connection established with City Core.");
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "WEATHER_CHANGE") {
            store.addLog(`⚠️ Weather change: ${msg.message}`);
            // Refresh city state to draw weather shift
            store.fetchCity();
          } else if (msg.type === "CONSTRUCTION") {
            store.addLog(`🏗️ New Construction: ${msg.message}`);
            store.fetchCity();
          }
        } catch (err) {
          console.error("Failed to parse websocket event", err);
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 3000); // Auto reconnect in 3s
      };
    }
    
    connect();
    return () => ws && ws.close();
  }, []);

  // Scroll chat messages to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedBuilding, activeAgent, store.getState().chatLogs]);

  // Handle Document upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle && !selectedFile) {
      alert("Please specify a title or select a document to upload.");
      return;
    }
    
    const fileToUpload = selectedFile;
    const titleToUpload = uploadTitle || (fileToUpload ? fileToUpload.name.replace(/\.[^/.]+$/, "") : "Untitled Document");
    
    await store.uploadKnowledge(titleToUpload, uploadContent, fileToUpload);
    
    // Clear forms
    setUploadTitle('');
    setUploadContent('');
    setSelectedFile(null);
  };

  // Chat message send
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    await store.sendAgentChat(activeAgent, msg);
  };

  // Launch Quiz
  const handleStartQuiz = async () => {
    if (!selectedBuilding) return;
    try {
      const res = await fetch(`/api/quiz/${selectedBuilding.node_id}`);
      const data = await res.json();
      if (data.quiz && data.quiz.length > 0) {
        setQuizQuestions(data.quiz);
        setCurrentQuizIdx(0);
        setSelectedAnswer(null);
        setQuizScore(0);
        setQuizCompleted(false);
        setShowQuizModal(true);
      } else {
        alert("This building's knowledge archives are currently indexing.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitQuizAnswer = () => {
    if (selectedAnswer === null) return;
    
    const isCorrect = selectedAnswer === quizQuestions[currentQuizIdx].correct_index;
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }

    if (currentQuizIdx + 1 < quizQuestions.length) {
      setCurrentQuizIdx(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      setQuizCompleted(true);
      // Reward exp points on completion
      const rewards = isCorrect ? 50 : 20;
      setExpPoints(prev => {
        const next = prev + rewards;
        localStorage.setItem('memory_city_exp', next.toString());
        return next;
      });
    }
  };

  // Find active chat history
  const activeChat: ChatMessage[] = selectedBuilding 
    ? (store.getState().chatLogs[selectedBuilding.id] || [])
    : [];

  return (
    <div className="relative w-screen h-screen flex overflow-hidden bg-cyber-bg text-gray-100">
      
      {/* 3D Visual Simulation Layer */}
      <div className="absolute inset-0 w-full h-full z-0">
        <Canvas3D />
      </div>

      {/* Top Header Panel (Search, Time Travel HUD & Exp Points) */}
      <header className="absolute top-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-5xl z-10 flex flex-col md:flex-row items-center gap-4 justify-between pointer-events-none">
        
        {/* Title Logo */}
        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3 shadow-lg pointer-events-auto border border-cyber-border select-none">
          <span className="text-2xl">🏙️</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white glow-blue">AI Memory City</h1>
            <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Local Spatial Knowledge OS</p>
          </div>
        </div>

        {/* Dynamic Search */}
        <div className="glass-panel-neon flex items-center px-4 py-2 rounded-2xl w-full md:w-96 shadow-lg pointer-events-auto border border-cyber-neonBlue/30">
          <Search className="text-cyber-neonBlue mr-3 w-5 h-5" />
          <input
            type="text"
            placeholder="Search concepts, buildings, or districts..."
            value={searchQuery}
            onChange={(e) => store.setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-white focus:outline-none w-full text-sm placeholder-gray-500"
          />
          {searchQuery && (
            <button onClick={() => store.setSearchQuery('')}>
              <X className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>

        {/* Time Travel Slider & Score Dashboard */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Exp Level Shield */}
          <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-2 shadow-md">
            <Award className="text-yellow-400 w-5 h-5 animate-pulse" />
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-semibold">Reputation</div>
              <div className="text-sm font-bold text-yellow-300">{expPoints} EP</div>
            </div>
          </div>

          {/* Time Travel */}
          <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-3 shadow-md">
            <button 
              onClick={() => store.setTimeTravel(!timeTravelMode, timeTravelIndex)}
              className={`p-1.5 rounded-lg border transition-all ${
                timeTravelMode 
                  ? 'bg-cyber-neonPink/20 border-cyber-neonPink text-cyber-neonPink glow-pink' 
                  : 'bg-cyber-bg/50 border-cyber-border text-gray-400 hover:text-white'
              }`}
              title="Time Travel Mode"
            >
              <Clock className="w-4 h-4" />
            </button>
            {timeTravelMode && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={timeTravelIndex}
                  onChange={(e) => store.setTimeTravel(true, parseInt(e.target.value))}
                  className="w-24 h-1 bg-cyber-border rounded-lg appearance-none cursor-pointer accent-cyber-neonPink"
                />
                <span className="text-[10px] text-cyber-neonPink font-bold">
                  {timeTravelIndex === 10 ? 'Present' : `T-${10 - timeTravelIndex}d`}
                </span>
              </div>
            )}
          </div>
        </div>

      </header>

      {/* Left Sidebar: Knowledge Upload & Real-time Logs Feed */}
      <section className="absolute bottom-6 left-6 w-80 max-h-[55%] z-10 flex flex-col gap-4 pointer-events-none select-none">
        
        {/* Upload Terminal */}
        <div className="glass-panel p-4 rounded-2xl pointer-events-auto flex flex-col gap-3 shadow-lg border border-cyber-border">
          <div className="flex items-center justify-between border-b border-cyber-border pb-2">
            <div className="flex items-center gap-2">
              <UploadCloud className="text-cyber-accent w-5 h-5" />
              <span className="text-sm font-semibold text-white">Construct Node</span>
            </div>
            <span className="text-[9px] bg-cyber-bg border border-cyber-border px-1.5 py-0.5 rounded text-gray-400 uppercase tracking-widest">Parser</span>
          </div>

          <form onSubmit={handleUploadSubmit} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Topic Title (e.g. Docker, Physics)"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="bg-cyber-bg border border-cyber-border text-xs px-3 py-2 rounded-xl focus:border-cyber-accent focus:outline-none w-full text-white placeholder-gray-600"
            />
            <textarea
              placeholder="Summarize concept details or paste text here..."
              value={uploadContent}
              onChange={(e) => setUploadContent(e.target.value)}
              rows={3}
              className="bg-cyber-bg border border-cyber-border text-xs px-3 py-2 rounded-xl focus:border-cyber-accent focus:outline-none w-full text-white resize-none placeholder-gray-600"
            />
            
            <div className="flex items-center justify-between gap-2 mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer border border-dashed border-cyber-border rounded-xl px-3 py-1.5 bg-cyber-bg hover:border-gray-500 transition-all text-[10px] text-gray-400">
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px]">{selectedFile ? selectedFile.name : 'Attach PDF/MD'}</span>
                <input 
                  type="file" 
                  accept=".txt,.md,.pdf" 
                  className="hidden" 
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                type="submit"
                disabled={isUploading}
                className="bg-cyber-accent hover:bg-blue-600 disabled:bg-blue-800 text-white rounded-xl text-[10px] font-semibold px-4 py-1.5 flex items-center gap-1 shadow-md transition-all"
              >
                {isUploading ? 'Building...' : 'Erect'}
              </button>
            </div>
          </form>
        </div>

        {/* Activity Live Feed */}
        <div className="glass-panel p-4 rounded-2xl pointer-events-auto flex flex-col gap-2 shadow-lg border border-cyber-border flex-1 min-h-0">
          <div className="flex items-center gap-2 border-b border-cyber-border pb-1.5">
            <Activity className="text-emerald-400 w-4 h-4" />
            <span className="text-xs font-semibold text-white tracking-wide">Live Infrastructure Logs</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 max-h-40">
            {logs.map((log, index) => (
              <div key={index} className="text-[10px] font-mono leading-relaxed text-gray-400 flex items-start gap-1">
                <span className="text-cyber-accent">&gt;</span>
                <span className="break-words">{log}</span>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* Right Sidebar: Selected Building HUD (Information Room & Citizen Chat Room) */}
      {selectedBuilding && (
        <section className="absolute top-28 right-6 bottom-6 w-96 z-10 glass-panel-neon rounded-2xl shadow-xl flex flex-col pointer-events-auto border border-cyber-neonBlue/20 overflow-hidden">
          
          {/* Header Area */}
          <div className="p-4 border-b border-cyber-border bg-cyber-bg/40 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-xs border bg-cyber-bg border-cyber-border" style={{ color: selectedBuilding.color, borderColor: `${selectedBuilding.color}50` }}>
                  {selectedBuilding.district_id}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">visits: {selectedBuilding.visits_count}</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1.5 tracking-tight glow-blue">{selectedBuilding.title}</h2>
            </div>
            <button 
              onClick={() => store.setSelectedBuilding(null)}
              className="p-1 rounded-lg bg-cyber-bg/50 border border-cyber-border hover:bg-cyber-bg hover:text-white text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Details Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            
            {/* Summary */}
            <div className="bg-cyber-bg/40 border border-cyber-border/60 rounded-xl p-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Concept Summary</h3>
              <p className="text-xs leading-relaxed text-gray-300">{selectedBuilding.summary}</p>
            </div>

            {/* Quiz Button Module */}
            <div className="flex items-center justify-between bg-cyber-bg/60 border border-cyber-border rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <HelpCircle className="text-cyber-neonBlue w-5 h-5" />
                <div>
                  <div className="text-xs font-bold text-white">Quiz Evaluation</div>
                  <div className="text-[10px] text-gray-400">Validate and unlock Reputation Points</div>
                </div>
              </div>
              <button 
                onClick={handleStartQuiz}
                className="bg-cyber-bg hover:bg-cyber-bg/80 border border-cyber-neonBlue/40 text-cyber-neonBlue hover:border-cyber-neonBlue rounded-lg px-3 py-1 text-xs font-semibold shadow transition-all"
              >
                Launch Test
              </button>
            </div>

            {/* AI Citizen Chat Room */}
            <div className="border border-cyber-border rounded-xl bg-cyber-bg/30 flex-1 flex flex-col min-h-[220px]">
              
              {/* Agent Selector HUD */}
              <div className="flex border-b border-cyber-border bg-cyber-bg/50 text-[10px] text-gray-400 font-semibold uppercase tracking-wider text-center select-none">
                {(['Professor', 'Engineer', 'Teacher', 'Reviewer'] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => setActiveAgent(role)}
                    className={`flex-1 py-2 border-r last:border-none border-cyber-border transition-all ${
                      activeAgent === role 
                        ? 'bg-cyber-accent/10 text-cyber-neonBlue font-bold' 
                        : 'hover:bg-cyber-bg hover:text-white'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 max-h-[160px]">
                {activeChat.filter(c => c.agentName === activeAgent || c.sender === 'user').length === 0 ? (
                  <div className="text-[11px] text-gray-500 text-center italic mt-6 select-none">
                    Walk up to the {activeAgent} inside the room to start talking.
                  </div>
                ) : (
                  activeChat.filter(c => c.agentName === activeAgent || c.sender === 'user').map((chat, idx) => (
                    <div 
                      key={idx} 
                      className={`flex flex-col max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                        chat.sender === 'user' 
                          ? 'bg-cyber-accent/15 border border-cyber-accent/30 self-end text-white' 
                          : 'bg-cyber-card border border-cyber-border self-start text-gray-300'
                      }`}
                    >
                      <span className="text-[9px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">
                        {chat.agentName}
                      </span>
                      <p className="leading-relaxed font-sans">{chat.text}</p>
                    </div>
                  ))
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input box */}
              <form onSubmit={handleSendChat} className="p-2 border-t border-cyber-border flex items-center bg-cyber-bg/50">
                <input
                  type="text"
                  placeholder={`Ask the ${activeAgent}...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="bg-transparent border-none text-xs focus:outline-none w-full text-white placeholder-gray-600 px-2"
                />
                <button type="submit" className="p-1.5 rounded-lg bg-cyber-accent hover:bg-blue-600 text-white shadow-md transition-all">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

            </div>

          </div>
        </section>
      )}

      {/* Quiz Modal Evaluation View */}
      {showQuizModal && quizQuestions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-bg/85 backdrop-blur-md">
          <div className="glass-panel p-6 rounded-3xl w-full max-w-lg shadow-2xl border border-cyber-neonBlue/30 relative">
            
            <button 
              onClick={() => setShowQuizModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white border border-cyber-border rounded-lg p-1 bg-cyber-bg"
            >
              <X className="w-4 h-4" />
            </button>

            {!quizCompleted ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-cyber-border pb-2">
                  <span className="text-xs text-cyber-neonBlue uppercase tracking-widest font-bold">
                    Knowledge Assessment
                  </span>
                  <span className="text-xs text-gray-400">
                    Question {currentQuizIdx + 1} of {quizQuestions.length}
                  </span>
                </div>

                <h3 className="text-md font-bold text-white leading-snug">
                  {quizQuestions[currentQuizIdx].question}
                </h3>

                <div className="flex flex-col gap-2 mt-2">
                  {quizQuestions[currentQuizIdx].options.map((opt: string, optIdx: number) => (
                    <button
                      key={optIdx}
                      onClick={() => setSelectedAnswer(optIdx)}
                      className={`text-left text-xs px-4 py-3 rounded-xl border transition-all ${
                        selectedAnswer === optIdx
                          ? 'bg-cyber-accent/20 border-cyber-accent text-white font-semibold'
                          : 'bg-cyber-bg border-cyber-border text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <button
                  onClick={submitQuizAnswer}
                  disabled={selectedAnswer === null}
                  className="bg-cyber-accent hover:bg-blue-600 disabled:bg-blue-900 text-white py-2.5 rounded-xl font-bold mt-4 text-sm transition-all shadow-md"
                >
                  Submit Answer
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center py-4">
                <CheckCircle className="text-cyber-neonGreen w-16 h-16 animate-bounce" />
                <div>
                  <h3 className="text-xl font-bold text-white">Assessment Complete!</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    You scored {quizScore} out of {quizQuestions.length} correct.
                  </p>
                </div>

                <div className="bg-cyber-bg/50 border border-cyber-border p-3 rounded-2xl w-full flex items-center justify-center gap-2">
                  <Award className="text-yellow-400 w-5 h-5" />
                  <span className="text-xs font-semibold text-yellow-300">
                    +{quizScore * 20} Reputation Points Unlocked
                  </span>
                </div>

                <button
                  onClick={() => setShowQuizModal(false)}
                  className="bg-cyber-accent hover:bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-semibold transition-all mt-2"
                >
                  Return to City Map
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
export default App;
