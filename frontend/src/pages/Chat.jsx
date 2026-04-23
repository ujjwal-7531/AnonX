import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import toast from "react-hot-toast";function Chat() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [socket, setSocket] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const userCode = localStorage.getItem("userCode");

  useEffect(() => {
    if (!userCode) {
      navigate("/login");
      return;
    }

    // Initialize socket securely with JWT
    const newSocket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
      auth: { token: localStorage.getItem("token") }
    });
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userCode, navigate]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await axios.get(
          `/conversations/${userCode}`
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
      // Fetch message history for selected chat
      const fetchMessages = async () => {
        try {
          const res = await axios.get(
            `/messages/${selectedConv.conversationId || selectedConv._id}`
          );
          setMessages(res.data.messages || []);
          
          // mark these messages as read passively
          await axios.patch(`/messages/read/${selectedConv.conversationId || selectedConv._id}`);
        } catch (error) {
          console.error("Error fetching messages:", error);
        }
      };

      fetchMessages();
    }
  }, [selectedConv, userCode]);

  // Global REAL-TIME message listener 
  useEffect(() => {
    if (!socket || !userCode) return;
    
    const handleReceive = (message) => {
      const activeConvId = selectedConv?.conversationId || selectedConv?._id;
      
      if (message.conversationId === activeConvId) {
        // Message belongs to the chat currently open on screen
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        
        // Passively mark as read immediately
        axios.patch(`/messages/read/${activeConvId}`).catch(() => {});
      } else {
        // Message belongs to a background chat - inject it into the sidebar unread counter!
        setConversations(prev => {
          const exists = prev.find(c => (c.conversationId || c._id) === message.conversationId);
          if (exists) {
            return prev.map(c => 
              (c.conversationId || c._id) === message.conversationId 
                ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } 
                : c
            );
          } else {
            // Secretly inject a brand new chat into the sidebar layout
            const newConv = {
              _id: message.conversationId,
              conversationId: message.conversationId,
              targetUserCode: message.sender,
              displayName: message.sender,
              unreadCount: 1,
            };
            return [newConv, ...prev];
          }
        });
      }
    };

    socket.on("receive_message", handleReceive);
    return () => socket.off("receive_message", handleReceive);
  }, [socket, selectedConv, userCode]);

  // Handle auto-scroll to latest message securely
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!searchError) return;
    const timeoutId = setTimeout(() => setSearchError(""), 3000);
    return () => clearTimeout(timeoutId);
  }, [searchError]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    setSearchError("");

    if (searchCode.trim() === userCode) {
      setSearchError("You cannot search your own ID.");
      return;
    }

    // Check if chat already exists locally
    const existingChat = conversations.find(c => c.targetUserCode === searchCode.trim());
    if (existingChat) {
      toast("Chat is already actively open", {
        icon: "✨",
        style: {
          background: '#2d2d2d',
          color: '#e0e0e0',
          fontSize: '13px'
        }
      });
      setSelectedConv(existingChat);
      setSearchCode("");
      setSearchError("");
      return;
    }
    
    setIsSearching(true);
    setSearchError("");

    try {
      const res = await axios.post(`/users/search/${searchCode.trim()}`);

      // API returns conversationId, alias, sentCount
      const { conversationId, alias, sentCount } = res.data;
      
      const newConv = {
        conversationId,
        _id: conversationId,
        displayName: alias || "New Chat",
        aliasForA: alias,
        aliasForB: alias,
        targetUserCode: searchCode.trim(),
        sentCount: sentCount || 0
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
      const res = await axios.post("/messages/send", {
        conversationId: selectedConv.conversationId || selectedConv._id,
        messageText: textToSend
      });
      // Append manually for incredibly fast rendering as the sender
      const savedMessage = res.data.data;
      setMessages(prev => {
        if (prev.find(m => m._id === savedMessage._id)) return prev;
        return [...prev, savedMessage];
      });
      // Deduct message quota locally
      setConversations(prev => prev.map(c => 
        (c.conversationId || c._id) === (selectedConv.conversationId || selectedConv._id) 
        ? { ...c, sentCount: (c.sentCount || 0) + 1 } 
        : c
      ));
      setSelectedConv(prev => ({ ...prev, sentCount: (prev.sentCount || 0) + 1 }));
    } catch (error) {
      setMessageText(textToSend); // Restore text so they don't lose it
      toast.error(error.response?.data?.message || "Error sending message");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userCode");
    if (socket) socket.disconnect();
    navigate("/login");
  };

  const handleSetAlias = () => {
    if (!selectedConv) return;
    toast((t) => (
      <div className="flex flex-col gap-3 w-52 relative">
        <span className="font-bold text-[14px] text-white tracking-wide">Set Nickname</span>
        <button onClick={() => toast.dismiss(t.id)} className="absolute -top-1 -right-1 text-neutral-500 hover:text-white text-lg">&times;</button>
        <input 
          id="toast-alias-input" 
          className="bg-neutral-900 border border-neutral-700/50 p-2.5 text-white rounded-lg text-[13px] outline-none focus:border-indigo-500/50 shadow-inner" 
          placeholder="Enter new nickname..." 
          autoFocus 
          onKeyDown={(e) => {
            if(e.key === 'Enter') document.getElementById('save-alias-btn').click();
          }}
        />
        <button 
          id="save-alias-btn"
          className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-2.5 rounded-lg text-white font-bold transition-all shadow-md mt-1" 
          onClick={async () => {
            const val = document.getElementById('toast-alias-input').value;
            if (!val.trim()) { toast.error("Nickname cannot be empty"); return; }
            toast.dismiss(t.id);
            try {
              await axios.patch(`/conversations/${selectedConv.conversationId || selectedConv._id}/nickname`, {
                nickname: val.trim()
              });
              setConversations(prev => prev.map(c => 
                (c.conversationId || c._id) === (selectedConv.conversationId || selectedConv._id) ? { ...c, displayName: val.trim() } : c
              ));
              setSelectedConv(prev => ({ ...prev, displayName: val.trim() }));
              toast.success("Alias updated");
            } catch { toast.error("Failed to update alias"); }
        }}>Save Alias</button>
      </div>
    ), { duration: Infinity });
  };

  const handleBlockUser = () => {
    if (!selectedConv?.targetUserCode) { toast.error("Target user code missing. Try refreshing."); return; }
    
    toast((t) => (
      <div className="flex flex-col gap-2 relative w-52">
        <span className="font-bold text-sm text-white tracking-wide">Block this user?</span>
        <p className="text-[11px] text-neutral-400">They will no longer be able to message you.</p>
        <button onClick={() => toast.dismiss(t.id)} className="absolute -top-1 -right-1 text-neutral-500 hover:text-white text-lg">&times;</button>
        <div className="flex gap-2 mt-2 w-full">
          <button className="text-[12px] bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 px-3 py-2 rounded-lg font-bold w-full transition-colors" onClick={async () => {
            toast.dismiss(t.id);
            try {
              await axios.post("/users/block", {
                targetUserCode: selectedConv.targetUserCode
              });
              toast.success("User blocked successfully");
              setConversations(prev => prev.map(c => 
                (c.conversationId || c._id) === (selectedConv.conversationId || selectedConv._id) ? {...c, isBlocked: true} : c
              ));
              setSelectedConv(prev => ({...prev, isBlocked: true}));
            } catch (error) { toast.error(error.response?.data?.message || "Failed to block user"); }
          }}>Yes, Block</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleUnblockUser = async () => {
    if (!selectedConv?.targetUserCode) { toast.error("Target user code missing. Try refreshing."); return; }
    try {
      await axios.post("/users/unblock", {
        targetUserCode: selectedConv.targetUserCode
      });
      toast.success("User unblocked successfully");
      // Update local state dynamically
      setConversations(prev => prev.map(c => 
        (c.conversationId || c._id) === (selectedConv.conversationId || selectedConv._id) ? {...c, isBlocked: false} : c
      ));
      setSelectedConv(prev => ({...prev, isBlocked: false}));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to unblock user");
    }
  };

  const handleDeleteAccount = () => {
    toast((t) => (
      <div className="flex flex-col gap-3 w-64 relative">
        <span className="font-bold text-[14px] text-red-400 tracking-wide">Delete Account</span>
        <p className="text-[11px] text-neutral-400 leading-5">
          This will permanently delete your account, conversations, aliases and messages.
        </p>
        <button onClick={() => toast.dismiss(t.id)} className="absolute -top-1 -right-1 text-neutral-500 hover:text-white text-lg">&times;</button>
        <input
          id="delete-account-password-input"
          type="password"
          className="bg-neutral-900 border border-neutral-700/50 p-2.5 text-white rounded-lg text-[13px] outline-none focus:border-red-500/50 shadow-inner"
          placeholder="Enter password to confirm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") document.getElementById("confirm-delete-account-btn").click();
          }}
        />
        <button
          id="confirm-delete-account-btn"
          className="text-xs bg-red-600 hover:bg-red-500 px-3 py-2.5 rounded-lg text-white font-bold transition-all shadow-md mt-1"
          onClick={async () => {
            const password = document.getElementById("delete-account-password-input").value;
            if (!password?.trim()) {
              toast.error("Password is required");
              return;
            }
            try {
              await axios.delete("/users/me", { data: { password: password.trim() } });
              toast.dismiss(t.id);
              toast.success("Account deleted successfully");
              localStorage.removeItem("token");
              localStorage.removeItem("userCode");
              if (socket) socket.disconnect();
              navigate("/login");
            } catch (error) {
              toast.error(error.response?.data?.message || "Failed to delete account");
            }
          }}
        >
          Permanently Delete
        </button>
      </div>
    ), { duration: Infinity });
  };

  return (
    <div className="h-screen flex bg-neutral-950 text-white overflow-hidden">
      
      {/* Sidebar Overlay */}
      <div className="w-80 lg:w-96 flex flex-col border-r border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md">
        
        {/* Profile Branding */}
        <div className="p-5 border-b border-neutral-800/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AnonX Chat</h2>
            <span className="text-xs bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-md font-mono border border-neutral-700 shadow-sm">Code: {userCode}</span>
          </div>
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
                onChange={(e) => {
                  setSearchCode(e.target.value.replace(/[^0-9a-zA-Z-]/g, ''));
                  if (searchError) setSearchError("");
                }}
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
                    onClick={() => {
                      setSelectedConv(conv);
                      setSearchError("");
                    }}
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

        <div className="p-3 border-t border-neutral-800/50 bg-neutral-900/30 flex flex-col gap-2">
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-800/70 text-neutral-200 hover:bg-neutral-700 font-semibold text-sm transition-colors flex items-center justify-center"
          >
            Logout
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full px-3 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-semibold text-sm transition-colors flex items-center justify-center"
          >
            Delete Account
          </button>
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
            <div className="h-[73px] flex items-center px-6 bg-neutral-900/60 backdrop-blur-md border-b border-neutral-800/50 shrink-0 shadow-sm z-10 w-full relative">
               <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold opacity-90 shadow-md shadow-indigo-500/20 mr-4 border border-indigo-400/20">
                 {(selectedConv.aliasForA || selectedConv.displayName || '?').charAt(0).toUpperCase()}
               </div>
               <div className="flex flex-col">
                  <span className="font-bold text-white tracking-wide text-[15px]">{selectedConv.aliasForA || selectedConv.displayName}</span>
               </div>
               
               {/* Context Menu Dropdown */}
               <div className="ml-auto relative">
                 <button 
                    onClick={() => setShowMenu(!showMenu)} 
                    className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                     <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                   </svg>
                 </button>
                 
                 {showMenu && (
                   <>
                     {/* Invisible full-screen overlay to close menu on outside click */}
                     <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                     <div className="absolute top-12 right-0 bg-neutral-800 border border-neutral-700 rounded-xl text-sm w-44 overflow-hidden shadow-xl z-50 animate-fade-in divide-y divide-neutral-700/50">
                       <button onClick={() => { handleSetAlias(); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-neutral-700 text-white font-medium transition-colors">Set Alias</button>
                       {selectedConv?.isBlocked ? (
                         <button onClick={() => { handleUnblockUser(); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-neutral-700 text-emerald-400 font-medium transition-colors">Unblock User</button>
                       ) : (
                         <button onClick={() => { handleBlockUser(); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-neutral-700 text-red-400 font-medium transition-colors">Block User</button>
                       )}
                     </div>
                   </>
                 )}
               </div>
            </div>

            {/* Rendered Bubbles */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 flex flex-col no-scrollbar">
                <div className="text-center text-[11px] text-neutral-500 uppercase tracking-widest font-semibold mb-6 border-b border-neutral-800/50 pb-3 mx-auto max-w-[50%]">
                  Secure Chat Context
                </div>
                {messages.map((msg, index) => {
                  const isMine = msg.sender === userCode;
                  const timeString = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={msg._id || index} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                       <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                         <div className={`px-4 py-2.5 rounded-2xl ${isMine ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-[2px] shadow-md shadow-indigo-500/10 border border-indigo-400/20' : 'bg-neutral-800 border border-neutral-700/80 text-neutral-100 rounded-tl-[2px] shadow-sm'}`}>
                            <p className="text-[14px] leading-[1.6] whitespace-pre-wrap">{msg.messageText}</p>
                         </div>
                         <span className="text-[10px] text-neutral-500 mt-1.5 mx-1.5 font-medium tracking-wide">{timeString}</span>
                       </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} className="pb-2" />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-neutral-900 border-t border-neutral-800 shrink-0 relative z-10 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.3)]">
              <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto w-full relative items-center">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type an anonymous message..."
                    className="w-full bg-neutral-950 border border-neutral-800 text-white text-[15px] rounded-xl pl-5 pr-16 py-3 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 shadow-inner placeholder-neutral-600 transition-all"
                    maxLength={250}
                  />
                  <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium tracking-wide ${messageText.length >= 240 ? 'text-red-400' : 'text-neutral-500'}`}>
                    {messageText.length}/250
                  </span>
                </div>
                <button 
                  type="submit" 
                  disabled={!messageText.trim() || selectedConv?.isBlocked}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-[0.98] flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="transform translate-x-[1px] -translate-y-[1px]">
                      <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
                    </svg>
                  </button>
                  <span className="text-[11px] text-indigo-400 font-medium whitespace-nowrap">
                    {Math.max(0, 30 - (selectedConv.sentCount || 0))}/30 left
                  </span>
               </form>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

export default Chat;