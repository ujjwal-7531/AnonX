import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import {
  getOrGenerateKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage
} from "../utils/cryptoUtils";

function Chat() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [socket, setSocket] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sharedKey, setSharedKey] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const userCode = localStorage.getItem("userCode");

  // Register public key on mount
  useEffect(() => {
    const registerKey = async () => {
      try {
        const { publicKeyBase64 } = await getOrGenerateKeyPair();
        await axios.post("/users/public-key", { publicKey: publicKeyBase64 });
      } catch (err) {
        console.warn("Public key registration error:", err);
      }
    };
    if (userCode) {
      registerKey();
    }
  }, [userCode]);

  useEffect(() => {
    if (!userCode) {
      navigate("/login");
      return;
    }

    // Initialize socket securely with JWT (normalize trailing slash)
    const socketUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
    const newSocket = io(socketUrl, {
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
      // Fetch message history for selected chat and decrypt
      const fetchMessages = async () => {
        try {
          const activeConvId = selectedConv.conversationId || selectedConv._id;
          const partnerCode = selectedConv.targetUserCode;
          
          // Derive shared key for selected chat (fetch partner public key if missing)
          let targetPubKey = selectedConv.targetPublicKey;
          if (!targetPubKey && partnerCode) {
            try {
              const keyRes = await axios.get(`/users/public-key/${partnerCode}`);
              targetPubKey = keyRes.data.publicKey;
              if (targetPubKey) {
                setSelectedConv(prev => prev ? { ...prev, targetPublicKey: targetPubKey } : prev);
                setConversations(prev => prev.map(c => 
                  (c.conversationId || c._id) === activeConvId ? { ...c, targetPublicKey: targetPubKey } : c
                ));
              }
            } catch (err) {
              console.warn("Could not fetch target public key:", err);
            }
          }

          let key = null;
          if (targetPubKey) {
            key = await deriveSharedKey(targetPubKey);
          }
          setSharedKey(key);

          const res = await axios.get(`/messages/${activeConvId}`);
          const rawMsgs = res.data.messages || [];

          // Decrypt messages asynchronously
          const decryptedMsgs = await Promise.all(
            rawMsgs.map(async (m) => {
              const plainText = await decryptMessage(m.messageText, m.iv, key);
              return { ...m, messageText: plainText };
            })
          );

          setMessages(decryptedMsgs);
          await axios.patch(`/messages/read/${activeConvId}`);
          setConversations(prev => prev.map(c => 
            (c.conversationId || c._id) === activeConvId ? { ...c, unreadCount: 0 } : c
          ));
          setSelectedConv(prev => prev ? { ...prev, unreadCount: 0 } : prev);
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
    
    const handleReceive = async (message) => {
      const activeConvId = selectedConv?.conversationId || selectedConv?._id;
      
      if (message.conversationId === activeConvId) {
        // Message belongs to active chat -> Ensure key and decrypt
        let currentKey = sharedKey;
        if (!currentKey && selectedConv?.targetUserCode) {
          try {
            const keyRes = await axios.get(`/users/public-key/${selectedConv.targetUserCode}`);
            if (keyRes.data.publicKey) {
              currentKey = await deriveSharedKey(keyRes.data.publicKey);
              setSharedKey(currentKey);
            }
          } catch (e) {}
        }

        const plainText = await decryptMessage(message.messageText, message.iv, currentKey);
        const decryptedMsg = { ...message, messageText: plainText };

        setMessages(prev => {
          if (prev.find(m => m._id === decryptedMsg._id)) return prev;
          return [...prev, decryptedMsg];
        });
        
        axios.patch(`/messages/read/${activeConvId}`).catch(() => {});
      } else {
        // Background message received -> Update sidebar
        setConversations(prev => {
          const exists = prev.find(c => (c.conversationId || c._id) === message.conversationId);
          if (exists) {
            return prev.map(c => 
              (c.conversationId || c._id) === message.conversationId 
                ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } 
                : c
            );
          } else {
            const aliasToShow = userCode === message.userA ? message.aliasForA : message.aliasForB;

            const newConv = {
              _id: message.conversationId,
              conversationId: message.conversationId,
              targetUserCode: message.sender,
              displayName: aliasToShow || message.sender,
              unreadCount: 1,
            };
            return [newConv, ...prev];
          }
        });
      }
    };

    socket.on("receive_message", handleReceive);
    return () => socket.off("receive_message", handleReceive);
  }, [socket, selectedConv, userCode, sharedKey]);

  useEffect(() => {
    if (!socket || !selectedConv || !userCode) return;

    const activeConvId = selectedConv.conversationId || selectedConv._id;

    const handleTyping = ({ conversationId, sender }) => {
      if (conversationId !== activeConvId || sender === userCode) return;
      setIsOtherTyping(true);
    };

    const handleStopTyping = ({ conversationId, sender }) => {
      if (conversationId !== activeConvId || sender === userCode) return;
      setIsOtherTyping(false);
    };

    const handleNicknameUpdated = ({ conversationId, nickname, userCode: updaterCode }) => {
      setConversations(prev => prev.map(c => {
        if ((c.conversationId || c._id) === conversationId && updaterCode === userCode) {
          return { ...c, displayName: nickname };
        }
        return c;
      }));
      setSelectedConv(prev => {
        if (prev && (prev.conversationId || prev._id) === conversationId && updaterCode === userCode) {
          return { ...prev, displayName: nickname };
        }
        return prev;
      });
    };

    const handleBlockUpdated = ({ blocker, targetUserCode, isBlocked }) => {
      setConversations(prev => prev.map(c => {
        if (c.targetUserCode === targetUserCode || c.targetUserCode === blocker) {
          return { ...c, isBlocked };
        }
        return c;
      }));
      setSelectedConv(prev => {
        if (prev && (prev.targetUserCode === targetUserCode || prev.targetUserCode === blocker)) {
          return { ...prev, isBlocked };
        }
        return prev;
      });
    };

    const handleUserDeleted = ({ deletedUserCode, conversationId }) => {
      toast("Chat partner deleted their account", { icon: "ℹ️" });
      setConversations(prev => prev.filter(c => (c.conversationId || c._id) !== conversationId));
      setSelectedConv(prev => {
        if (prev && (prev.conversationId || prev._id) === conversationId) {
          return null;
        }
        return prev;
      });
    };

    const handleMessagesRead = ({ conversationId }) => {
      setConversations(prev => prev.map(c => {
        if ((c.conversationId || c._id) === conversationId) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      }));
    };

    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);
    socket.on("nickname_updated", handleNicknameUpdated);
    socket.on("block_updated", handleBlockUpdated);
    socket.on("user_deleted", handleUserDeleted);
    socket.on("messages_read", handleMessagesRead);

    return () => {
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
      socket.off("nickname_updated", handleNicknameUpdated);
      socket.off("block_updated", handleBlockUpdated);
      socket.off("user_deleted", handleUserDeleted);
      socket.off("messages_read", handleMessagesRead);
    };
  }, [socket, selectedConv, userCode]);

  useEffect(() => {
    setIsOtherTyping(false);
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [selectedConv]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

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

      // API returns conversationId, alias, sentCount, targetPublicKey
      const { conversationId, alias, sentCount, targetPublicKey } = res.data;
      
      const newConv = {
        conversationId,
        _id: conversationId,
        displayName: alias || "New Chat",
        targetUserCode: searchCode.trim(),
        targetPublicKey,
        sentCount: sentCount || 0
      };

      // Append it locally on left sidebar dynamically
      setConversations(prev => {
        if (!prev.find(c => (c.conversationId || c._id) === conversationId)) {
          return [newConv, ...prev];
        } else {
            // Already there
            const existing = prev.find(c => (c.conversationId || c._id) === conversationId);
            if (existing) newConv.displayName = existing.displayName || alias;
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

    const textToSend = messageText.trim();
    if (textToSend.length > 250) {
      toast.error("Message exceeds 250 character limit");
      return;
    }
    setMessageText("");

    const activeConvId = selectedConv.conversationId || selectedConv._id;
    if (isTyping && socket && activeConvId) {
      socket.emit("stop_typing", { conversationId: activeConvId });
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }

    try {
      // Ensure shared key is available (fetch target public key on-demand if missing)
      let keyToUse = sharedKey;
      let targetPubKey = selectedConv.targetPublicKey;

      if (!targetPubKey && selectedConv.targetUserCode) {
        try {
          const keyRes = await axios.get(`/users/public-key/${selectedConv.targetUserCode}`);
          targetPubKey = keyRes.data.publicKey;
          if (targetPubKey) {
            setSelectedConv(prev => prev ? { ...prev, targetPublicKey: targetPubKey } : prev);
          }
        } catch (err) {
          console.warn("On-demand public key fetch error:", err);
        }
      }

      if (!keyToUse && targetPubKey) {
        keyToUse = await deriveSharedKey(targetPubKey);
        setSharedKey(keyToUse);
      }

      if (!keyToUse) {
        toast.error("Waiting for chat partner's encryption key...");
        setMessageText(textToSend);
        return;
      }

      // Encrypt message text
      const { ciphertext, iv } = await encryptMessage(textToSend, keyToUse);

      const res = await axios.post("/messages/send", {
        conversationId: activeConvId,
        messageText: ciphertext,
        iv
      });

      // Render plaintext in sender UI instantly
      const savedMessage = {
        ...res.data.data,
        messageText: textToSend
      };

      setMessages(prev => {
        if (prev.find(m => m._id === savedMessage._id)) return prev;
        return [...prev, savedMessage];
      });

      // Deduct message quota locally
      setConversations(prev => prev.map(c => 
        (c.conversationId || c._id) === activeConvId
        ? { ...c, sentCount: (c.sentCount || 0) + 1 } 
        : c
      ));
      setSelectedConv(prev => ({ ...prev, sentCount: (prev.sentCount || 0) + 1 }));
    } catch (error) {
      setMessageText(textToSend); // Restore text so they don't lose it
      toast.error(error.response?.data?.message || "Error sending message");
    }
  };

  const handleMessageInputChange = (e) => {
    const value = e.target.value;
    setMessageText(value);

    if (!socket || !selectedConv) return;
    const activeConvId = selectedConv.conversationId || selectedConv._id;
    if (!activeConvId) return;

    if (value.trim()) {
      if (!isTyping) {
        socket.emit("typing", { conversationId: activeConvId });
        setIsTyping(true);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stop_typing", { conversationId: activeConvId });
        setIsTyping(false);
        typingTimeoutRef.current = null;
      }, 1000);
    } else if (isTyping) {
      socket.emit("stop_typing", { conversationId: activeConvId });
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
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
          className="bg-neutral-900 border border-neutral-700/50 p-2.5 text-white rounded-lg text-[13px] outline-none focus:border-violet-500/50 shadow-inner" 
          placeholder="Enter new nickname..." 
          autoFocus 
          onKeyDown={(e) => {
            if(e.key === 'Enter') document.getElementById('save-alias-btn').click();
          }}
        />
        <button 
          id="save-alias-btn"
          className="text-xs bg-violet-600 hover:bg-violet-500 px-3 py-2.5 rounded-lg text-white font-bold transition-all shadow-md mt-1" 
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
        <button
          id="confirm-delete-account-btn"
          className="text-xs bg-red-600 hover:bg-red-500 px-3 py-2.5 rounded-lg text-white font-bold transition-all shadow-md mt-1"
          onClick={async () => {
            try {
              await axios.delete("/users/me");
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
    <div className="h-screen flex bg-neutral-950 text-white overflow-hidden font-sans">
      
      {/* Sidebar Overlay */}
      <div className="w-80 lg:w-96 flex flex-col border-r border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md">
        
        {/* Profile Branding */}
        <div className="p-5 border-b border-neutral-800/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-violet-400 tracking-tight">AnonX Chat</h2>
            <span className="text-xs bg-neutral-800/80 text-violet-400 px-3 py-1.5 rounded-md font-mono border border-violet-500/30 shadow-sm">Code: {userCode}</span>
          </div>
        </div>

        {/* Global Search Interface */}
        <div className="p-4 border-b border-neutral-800/50 bg-neutral-900/20">
          <form onSubmit={handleSearch} className="flex flex-col gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Find unique user ID..."
                className="w-full bg-neutral-800 text-white text-sm border border-neutral-700/50 rounded-lg p-2.5 pl-3 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono transition-colors placeholder-neutral-500 shadow-inner"
                value={searchCode}
                onChange={(e) => {
                  setSearchCode(e.target.value.replace(/[^0-9a-zA-Z-]/g, ''));
                  if (searchError) setSearchError("");
                }}
              />
              <button 
                type="submit" 
                disabled={isSearching || !searchCode}
                className="absolute right-1 top-1.5 p-1 bg-violet-600 hover:bg-violet-500 rounded-md text-white transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-violet-600/20"
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
                <div className="w-12 h-12 bg-violet-600/10 rounded-full flex items-center justify-center mb-4 border border-violet-500/20 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 border border-transparent flex justify-between items-center ${isActive ? 'bg-violet-600/10 border-violet-500/30 shadow-sm shadow-violet-600/5' : 'hover:bg-neutral-800/80 hover:border-neutral-700/50'}`}
                  >
                    <div className="flex flex-col">
                       <span className={`font-medium tracking-wide text-sm ${isActive ? 'text-violet-400' : 'text-neutral-200'}`}>
                         {conv.displayName || "Unknown Chat"}
                       </span>
                    </div>
                    {conv.unreadCount > 0 && !isActive && (
                      <span className="bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
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
             <div className="w-40 h-40 bg-violet-600/10 rounded-full blur-[60px] absolute"></div>
             <p className="text-neutral-400 text-lg font-medium relative z-10 border border-neutral-800/50 bg-neutral-900/50 px-6 py-2 rounded-full backdrop-blur-md">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Header Identity Plate */}
            <div className="h-[73px] flex items-center px-6 bg-neutral-900/60 backdrop-blur-md border-b border-neutral-800/50 shrink-0 shadow-sm z-10 w-full relative">
               <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold opacity-90 shadow-md shadow-violet-600/20 mr-4 border border-violet-400/20">
                 {(selectedConv.displayName || '?').charAt(0).toUpperCase()}
               </div>
               <div className="flex flex-col">
                  <span className="font-bold text-white tracking-wide text-[15px]">{selectedConv.displayName}</span>
                  <span className={`text-[11px] mt-0.5 transition-opacity ${isOtherTyping ? 'text-violet-400 opacity-100' : 'text-transparent opacity-0'}`}>
                    typing...
                  </span>
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
                  🔒 E2EE Encrypted Channel
                </div>
                {messages.map((msg, index) => {
                  const isMine = msg.sender === userCode;
                  const timeString = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={msg._id || index} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                       <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                         <div className={`px-4 py-2.5 rounded-2xl ${isMine ? 'bg-violet-600 text-white rounded-tr-[2px] shadow-md shadow-violet-600/15 border border-violet-500/20' : 'bg-neutral-800 border border-neutral-700/80 text-neutral-100 rounded-tl-[2px] shadow-sm'}`}>
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
                    onChange={handleMessageInputChange}
                    placeholder="Type an anonymous message..."
                    className="w-full bg-neutral-950 border border-neutral-800 text-white text-[15px] rounded-xl pl-5 pr-16 py-3 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 shadow-inner placeholder-neutral-600 transition-all"
                    maxLength={250}
                  />
                  <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium tracking-wide ${messageText.length >= 240 ? 'text-red-400' : 'text-neutral-500'}`}>
                    {messageText.length}/250
                  </span>
                </div>
                <button 
                  type="submit" 
                  disabled={!messageText.trim() || selectedConv?.isBlocked}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:hover:bg-violet-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-violet-600/20 active:scale-[0.98] flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="transform translate-x-[1px] -translate-y-[1px]">
                      <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
                    </svg>
                  </button>
                  <span className="text-[11px] text-violet-400 font-medium whitespace-nowrap">
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