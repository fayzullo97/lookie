
import React from 'react';

interface LogEntry {
  time: string;
  type: 'info' | 'error' | 'msg';
  text: string;
}

interface SettingsProps {
  telegramToken: string;
  setTelegramToken: (val: string) => void;
  providerToken: string;
  setProviderToken: (val: string) => void;
  openaiToken: string;
  setOpenaiToken: (val: string) => void;
  geminiToken: string;
  setGeminiToken: (val: string) => void;
  pixlabToken: string;
  setPixlabToken: (val: string) => void;
  useMockAI: boolean;
  setUseMockAI: (val: boolean) => void;
  isBotRunning: boolean;
  logs: LogEntry[];
  logsEndRef: React.RefObject<HTMLDivElement>;
}

const Settings: React.FC<SettingsProps> = ({
  telegramToken, setTelegramToken,
  providerToken, setProviderToken,
  openaiToken, setOpenaiToken,
  geminiToken, setGeminiToken,
  pixlabToken, setPixlabToken,
  useMockAI, setUseMockAI,
  isBotRunning,
  logs, logsEndRef
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Col: Config */}
      <div className="space-y-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            Bot Configuration
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-bold mb-1 block">Telegram Bot Token</label>
              <input 
                type="text" 
                value={telegramToken} 
                onChange={(e) => setTelegramToken(e.target.value)} 
                placeholder="123456:ABC-DEF..." 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                disabled={isBotRunning} 
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold mb-1 block">Payment Provider Token (Click/Payme)</label>
              <input 
                type="password" 
                value={providerToken} 
                onChange={(e) => setProviderToken(e.target.value)} 
                placeholder="TOKEN:CLICK..." 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                disabled={isBotRunning} 
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path><path d="M8.5 8.5v.01"></path><path d="M16 16v.01"></path><path d="M12 12v.01"></path><path d="M12 16v.01"></path><path d="M8.5 16v.01"></path><path d="M16 8.5v.01"></path></svg>
             AI Configuration
          </h3>
          
          <div className="space-y-4">
             <div>
                <label className="text-xs text-slate-400 font-bold mb-1 block">OpenAI API Key</label>
                <input 
                  type="password" 
                  value={openaiToken} 
                  onChange={(e) => setOpenaiToken(e.target.value)} 
                  placeholder="sk-..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                  disabled={isBotRunning} 
                />
             </div>

             <div>
                <label className="text-xs text-slate-400 font-bold mb-1 block">Google Gemini API Key</label>
                <input 
                  type="password" 
                  value={geminiToken} 
                  onChange={(e) => setGeminiToken(e.target.value)} 
                  placeholder="AIza..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                  disabled={isBotRunning} 
                />
             </div>

             <div>
                <label className="text-xs text-slate-400 font-bold mb-1 block">PixLab API Key (Background Removal)</label>
                <input 
                  type="password" 
                  value={pixlabToken} 
                  onChange={(e) => setPixlabToken(e.target.value)} 
                  placeholder="PixLab Key..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                  disabled={isBotRunning} 
                />
             </div>

             <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <input 
                  type="checkbox" 
                  id="mockMode" 
                  checked={useMockAI} 
                  onChange={(e) => setUseMockAI(e.target.checked)} 
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" 
                />
                <label htmlFor="mockMode" className="text-xs text-yellow-400 font-bold cursor-pointer select-none">
                   Enable Dev Mode (Mock AI Responses)
                </label>
             </div>
          </div>
        </div>
      </div>

      {/* Right Col: Console */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 flex flex-col h-[500px] lg:h-auto overflow-hidden shadow-inner">
        <div className="bg-slate-900 p-3 border-b border-slate-800 flex justify-between items-center">
            <span className="text-xs font-mono font-bold text-slate-400">./system_logs.log</span>
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
            </div>
        </div>
        <div className="flex-1 overflow-auto p-4 text-xs font-mono space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            {logs.length === 0 && <div className="text-slate-700 italic opacity-50">System initializing... waiting for events...</div>}
            {logs.map((l, i) => (
                <div key={i} className="flex gap-3 hover:bg-slate-900 p-0.5 rounded group">
                    <span className="text-slate-600 min-w-[70px] select-none">[{l.time}]</span>
                    <span className={`${l.type === 'error' ? 'text-red-400' : l.type === 'msg' ? 'text-cyan-400' : 'text-slate-300'} break-all`}>
                       {l.text}
                    </span>
                </div>
            ))}
            <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default Settings;
