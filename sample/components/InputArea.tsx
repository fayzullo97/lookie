import React, { useRef, useState } from 'react';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
  onSendImage: (file: File) => void;
  disabled: boolean;
  placeholder?: string;
}

const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  onSendImage, 
  disabled,
  placeholder = "Type a message..."
}) => {
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !disabled) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && !disabled) {
      onSendImage(e.target.files[0]);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-4 md:px-6">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3 items-end">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors disabled:opacity-50"
          title="Upload Image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full bg-gray-100 text-gray-900 rounded-2xl px-5 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || disabled}
          className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default InputArea;