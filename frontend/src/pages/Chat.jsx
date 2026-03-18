import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

function Chat() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [socket, setSocket] = useState(null);

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const userCode = localStorage.getItem("userCode");

  useEffect(() => {
    if (!userCode) {
      navigate("/login");
      return;
    }

    // Initialize socket
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.emit("register_user", userCode);

    newSocket.on("receive_message", (message) => {
      // Functional state update ensures we don't have stale closures on messages list
      setMessages((prev) => {
          // Add if not already there to prevent duplication issues, 
          // but checking by _id is safest:
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
      });
    });

    return () => {
      newSocket.off("receive_message");
      newSocket.disconnect();
    };
  }, [userCode, navigate]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/conversations/${userCode}`
        );
        // Safely extract conversations 
        setConversations(res.data.data || res.data.conversations || []);
      } catch (error) {
        console.error("Error fetching conversations:", error);
      }
    };

    if (userCode) {
      fetchConversations();
    }
  }, [userCode]);

  useEffect(() => {
    if (selectedConv) {
      // Join room in Socket.io
      if (socket) {
        socket.emit("join_conversation", selectedConv.conversationId || selectedConv._id);
      }

      // Fetch message history for selected chat
      const fetchMessages = async () => {
        try {
          const res = await axios.get(
            `http://localhost:5000/messages/${selectedConv.conversationId || selectedConv._id}`
          );
          setMessages(res.data.messages || []);
          
          // Also mark these messages as read passively
          await axios.patch(`http://localhost:5000/messages/read/${selectedConv.conversationId || selectedConv._id}`, {
            currentUserCode: userCode
          });
        } catch (error) {
          console.error("Error fetching messages:", error);
        }
      };

      fetchMessages();
    }
  }, [selectedConv, socket, userCode]);

  // Handle auto-scroll to latest message securely
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    
    setIsSearching(true);
    setSearchError("");

    try {
      const res = await axios.get(`http://localhost:5000/users/search/${searchCode.trim()}`, {
        // Axios config for payload in GET requests
        data: { currentUserCode: userCode }
      });

      // API returns conversationId, alias
      const { conversationId, alias } = res.data;
      
      const newConv = {
        conversationId,
        _id: conversationId,
        displayName: alias || "New Chat",
        aliasForA: alias,
        aliasForB: alias
      };

      // Append it locally on left sidebar dynamically
      setConversations(prev => {
        if (!prev.find(c => (c.conversationId || c._id) === conversationId)) {
          return [newConv, ...prev];
        } else {
            // Already there
            const existing = prev.find(c => (c.conversationId || c._id) === conversationId);
            if (existing) newConv.displayName = existing.aliasForA || existing.displayName || alias;
            return prev;
        }
      });
      
      setSelectedConv(newConv);
      setSearchCode("");
      
    } catch (error) {
      setSearchError(error.response?.data?.message || "User not found");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConv) return;

    const textToSend = messageText;
    setMessageText("");

    try {
      await axios.post("http://localhost:5000/messages/send", {
        conversationId: selectedConv.conversationId || selectedConv._id,
        senderUserCode: userCode,
        messageText: textToSend
      });
      // (Message broadcast runs via "receive_message" WebSocket event automatically natively for us)
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className="h-screen flex bg-neutral-950 text-white overflow-hidden">
      
      {/* Sidebar Overlay */}
      <div className="w-80 lg:w-96 flex flex-col border-r border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md">
        
        {/* Profile Branding */}
        <div className="p-5 border-b border-neutral-800/50 flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AnonX Chat</h2>
          <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded-md font-mono border border-neutral-700 shadow-sm">Code: {userCode}</span>
        </div>

        {/* Global Search Interface */}
        <div className="p-4 border-b border-neutral-800/50 bg-neutral-900/20">
          <form onSubmit={handleSearch} className="flex flex-col gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Find unique user ID..."
                className="w-full bg-neutral-800 text-white text-sm border border-neutral-700/50 rounded-lg p-2.5 pl-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-neutral-500 shadow-inner"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.replace(/[^0-9a-zA-Z-]/g, ''))}
              />
              <button 
                type="submit" 
                disabled={isSearching || !searchCode}
                className="absolute right-1 top-1.5 p-1 bg-indigo-500 hover:bg-indigo-600 rounded-md text-white transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-indigo-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
              </button>
            </div>
            {searchError && <p className="text-red-400 text-[11px] text-center font-medium mt-1">{searchError}</p>}
          </form>
        </div>

        {/* Active Conversations Mapper */}
        <div className="flex-1 overflow-y-auto space-y-1 p-3 (scrollbar-hide)">
          {conversations.length === 0 ? (
             <div className="mt-14 flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 bg-neutral-800/50 rounded-full flex items-center justify-center mb-4 border border-neutral-700/50 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                </div>
                <p className="text-neutral-300 text-sm font-medium">No active chats</p>
                <p className="text-neutral-500 text-xs mt-2 w-full px-2">Copy an ID and start messaging securely end-to-end.</p>
             </div>
          ) : (
            conversations.map((conv) => {
              const isActive = selectedConv && (selectedConv.conversationId || selectedConv._id) === (conv.conversationId || conv._id);
              return (
                 <div
                    key={conv.conversationId || conv._id}
                    onClick={() => setSelectedConv(conv)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 border border-transparent flex justify-between items-center ${isActive ? 'bg-indigo-500/10 border-indigo-500/30 shadow-sm shadow-indigo-500/5' : 'hover:bg-neutral-800/80 hover:border-neutral-700/50'}`}
                  >
                    <div className="flex flex-col">
                       <span className={`font-medium tracking-wide text-sm ${isActive ? 'text-indigo-400' : 'text-neutral-200'}`}>
                         {conv.aliasForA || conv.displayName || "Unknown Chat"}
                       </span>
                    </div>
                    {conv.unreadCount > 0 && !isActive && (
                      <span className="bg-gradient-to-tr from-indigo-500 to-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                        {conv.unreadCount}
                      </span>
                    )}
                 </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Messaging Layout */}
      <div className="flex-1 flex flex-col relative bg-neutral-900/10">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center relative">
             <div className="w-40 h-40 bg-indigo-500/10 rounded-full blur-[60px] absolute"></div>
             <p className="text-neutral-400 text-lg font-medium relative z-10 border border-neutral-800/50 bg-neutral-900/50 px-6 py-2 rounded-full backdrop-blur-md">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Header Identity Plate */}
            <div className="h-[73px] flex items-center px-6 bg-neutral-900/60 backdrop-blur-md border-b border-neutral-800/50 shrink-0 shadow-sm z-10">
               <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold opacity-90 shadow-md shadow-indigo-500/20 mr-4 border border-indigo-400/20">
                 {(selectedConv.aliasForA || selectedConv.displayName || '?').charAt(0).toUpperCase()}
               </div>
               <div className="flex flex-col">
                  <span className="font-bold text-white tracking-wide text-[15px]">{selectedConv.aliasForA || selectedConv.displayName}</span>
                  <span className="text-[11px] text-indigo-400 font-medium">Session Initialized</span>
               </div>
            </div>

            {/* Rendered Bubbles */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 flex flex-col no-scrollbar">
                <div className="text-center text-[11px] text-neutral-500 uppercase tracking-widest font-semibold mb-6 border-b border-neutral-800/50 pb-3 mx-auto max-w-[50%]">
                  Secure Chat Context
                </div>
                {messages.map((msg, index) => {
                  const isMine = msg.sender === userCode;
                  return (
                    <div key={msg._id || index} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[70%] px-4 py-3 rounded-2xl ${isMine ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-[2px] shadow-md shadow-indigo-500/10 border border-indigo-400/20' : 'bg-neutral-800 border border-neutral-700/80 text-neutral-100 rounded-tl-[2px] shadow-sm'}`}>
                          <p className="text-[14px] leading-[1.6] whitespace-pre-wrap">{msg.messageText}</p>
                       </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} className="pb-2" />
            </div>

            {/* Typographic Entry Bar */}
            <div className="p-4 bg-neutral-900/60 backdrop-blur-xl border-t border-neutral-800/50">
               <form onSubmit={handleSendMessage} className="flex gap-3 items-end max-w-5xl mx-auto w-full relative">
                  <textarea
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Message anonymously..."
                    className="flex-1 bg-neutral-800/80 border border-neutral-700/50 text-white p-3.5 pr-4 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500 resize-none max-h-32 placeholder-neutral-500 shadow-inner text-[15px]"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="shrink-0 w-12 h-12 bg-indigo-500 text-white rounded-full flex items-center justify-center hover:bg-indigo-400 active:scale-95 disabled:opacity-40 disabled:bg-neutral-700 transition-all font-bold shadow-lg shadow-indigo-500/25 border border-indigo-400/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="transform translate-x-[1px] -translate-y-[1px]">
                      <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
                    </svg>
                  </button>
               </form>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

export default Chat;