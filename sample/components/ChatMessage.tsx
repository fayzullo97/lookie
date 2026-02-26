import React from 'react';
import { Message, MessageRole } from '../types';

interface ChatMessageProps {
  message: Message;
  onRegenerate?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRegenerate }) => {
  const isBot = message.role === MessageRole.BOT;

  return (
    <div className={`flex w-full mb-6 ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex flex-col max-w-[85%] ${isBot ? 'items-start' : 'items-end'}`}>
        {/* Avatar / Name */}
        <span className="text-xs text-gray-400 mb-1 ml-1">
          {isBot ? 'Try-On Bot' : 'You'}
        </span>

        {/* Bubble */}
        <div
          className={`p-4 rounded-2xl shadow-sm text-sm md:text-base ${
            isBot
              ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
              : 'bg-indigo-600 text-white rounded-tr-none'
          }`}
        >
          {message.text && (
            <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
          )}

          {message.image && (
            <div className="mt-3 rounded-lg overflow-hidden border border-gray-200">
              <img 
                src={`data:image/jpeg;base64,${message.image}`} 
                alt="Uploaded or Generated" 
                className="max-w-full h-auto max-h-96 object-cover"
              />
            </div>
          )}
        </div>

        {/* Actions (Regenerate Button) */}
        {isBot && message.actions?.includes('regenerate') && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-xs font-medium rounded-full hover:bg-slate-700 transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
              </svg>
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;