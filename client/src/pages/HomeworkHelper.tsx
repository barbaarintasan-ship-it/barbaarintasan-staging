import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Send, Bot, User, Sparkles, Loader2, BookOpen, Calculator, Globe, Beaker, History, Clock, Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useParentAuth } from "@/contexts/ParentAuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  subject: string;
  childAge: string | null;
  createdAt: string;
}

const SUBJECTS = [
  { id: "Xisaab", icon: Calculator, label: "Xisaab", labelEn: "Math" },
  { id: "Aqrinta", icon: BookOpen, label: "Aqrinta iyo Qoraalka", labelEn: "Reading & Writing" },
  { id: "Sayniska", icon: Beaker, label: "Sayniska", labelEn: "Science" },
  { id: "Taariikhda", icon: History, label: "Taariikhda", labelEn: "History" },
  { id: "Luuqadaha", icon: Globe, label: "Luuqadaha", labelEn: "Languages" },
  { id: "Guud", icon: MessageSquare, label: "Guud", labelEn: "General" },
];

const AGE_RANGES = [
  { id: "4-6", label: "4-6 sano" },
  { id: "7-9", label: "7-9 sano" },
  { id: "10-12", label: "10-12 sano" },
  { id: "13-15", label: "13-15 sano" },
  { id: "16+", label: "16+ sano" },
];

export default function HomeworkHelper() {
  const { t, i18n } = useTranslation();
  const { parent } = useParentAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedAge, setSelectedAge] = useState<string>("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleBack = () => {
    // If we have messages or are in a conversation, go back to subject selection
    if (messages.length > 0 || currentConversationId) {
      setMessages([]);
      setCurrentConversationId(null);
      setSelectedSubject("");
      setSelectedAge("");
      setShowNewChat(true);
      return;
    }
    
    // Otherwise, navigate back
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch usage stats
  const { data: usageData } = useQuery({
    queryKey: ["homework-usage"],
    queryFn: async () => {
      const res = await fetch("/api/homework/usage", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
    enabled: !!parent,
  });

  // Fetch conversation history
  const { data: conversations } = useQuery({
    queryKey: ["homework-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/homework/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json() as Promise<Conversation[]>;
    },
    enabled: !!parent,
  });

  // Load messages when conversation is selected
  const loadConversation = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/homework/conversations/${conversationId}/messages`, { 
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(data.messages);
      setCurrentConversationId(conversationId);
      setSelectedSubject(data.conversation.subject);
      setSelectedAge(data.conversation.childAge || "");
      setShowNewChat(false);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  // Ask question mutation
  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await fetch("/api/homework/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          question,
          conversationId: currentConversationId,
          subject: selectedSubject || "Guud",
          childAge: selectedAge || null
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw { ...data, status: res.status };
      }
      return data;
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: data.answer,
        createdAt: new Date().toISOString()
      }]);
      
      if (data.conversationId && !currentConversationId) {
        setCurrentConversationId(data.conversationId);
        setShowNewChat(false);
      }
      
      // Refresh usage and conversations
      queryClient.invalidateQueries({ queryKey: ["homework-usage"] });
      queryClient.invalidateQueries({ queryKey: ["homework-conversations"] });
    },
    onError: (error: any) => {
      const errorMessage = error.answer || "Waan ka xumahay, cilad ayaa dhacday. Fadlan isku day mar kale.";
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: errorMessage,
        createdAt: new Date().toISOString()
      }]);
    },
  });

  const handleSubmit = () => {
    if (!input.trim() || askMutation.isPending) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    askMutation.mutate(input.trim());
    setInput("");
    
    textareaRef.current?.blur();
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setSelectedSubject("");
    setSelectedAge("");
    setShowNewChat(true);
  };

  const suggestedQuestions = [
    "Sidee ayaan u xisaabiyaa 15 + 27?",
    "Maxaa loo yaqaan xiddigaha?",
    "Sidee ayaan u qoraa jumlad Ingiriisi?",
    "Yaa ahaa Cabdirashiid Cali Sharmaarke?"
  ];

  // Show login prompt if not logged in
  if (!parent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <Bot className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Laylisyada Guriga</h2>
        <p className="text-gray-600 mb-6 text-center max-w-sm">
          Fadlan gal akoonkaaga si aad u isticmaasho Laylisyada Guriga.
        </p>
        <Link href="/register">
          <Button className="bg-gradient-to-r from-purple-500 to-indigo-500">
            Gal ama Isdiiwaangeli
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col pb-20">
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white sticky top-0 z-40 shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full text-white hover:bg-white/20" 
              data-testid="button-back"
              onClick={handleBack}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Laylisyada Guriga</h1>
                <p className="text-xs text-white/70">AI-ka ku caawinaya ilmahaaga laylisyada dugsiga</p>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/20"
            onClick={startNewConversation}
            data-testid="button-new-chat"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Usage indicator */}
        {usageData && (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Su'aalo maanta: {usageData.questionsAsked}/{usageData.limit}
              </span>
              <span>Haray: {usageData.remaining}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5 mt-1">
              <div 
                className="bg-white rounded-full h-1.5 transition-all"
                style={{ width: `${(usageData.questionsAsked / usageData.limit) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {showNewChat && messages.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Ku soo dhawoow Laylisyada Guriga</h2>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Weydii su'aal kasta oo la xiriira hawlaha guriga ilmahaaga - xisaab, aqris, sayniska, iyo wax kale!
            </p>
            
            {/* Subject selection */}
            <div className="max-w-sm mx-auto mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Dooro mawduuca (optional)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SUBJECTS.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubject(subject.id)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedSubject === subject.id
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-purple-200"
                    }`}
                    data-testid={`subject-${subject.id}`}
                  >
                    <subject.icon className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-medium">{subject.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Age selection */}
            <div className="max-w-sm mx-auto mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Da'da ilmaha (optional)
              </label>
              <Select value={selectedAge} onValueChange={setSelectedAge}>
                <SelectTrigger className="w-full" data-testid="select-age">
                  <SelectValue placeholder="Dooro da'da" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map((age) => (
                    <SelectItem key={age.id} value={age.id}>
                      {age.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Suggested questions */}
            <div className="space-y-2 max-w-sm mx-auto">
              <p className="text-sm font-medium text-gray-500 mb-3">Tusaalooyinka su'aalaha:</p>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(q);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left p-3 bg-white rounded-xl border border-purple-100 text-sm text-gray-700 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                  data-testid={`suggested-question-${i}`}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Recent conversations */}
            {conversations && conversations.length > 0 && (
              <div className="mt-8 max-w-sm mx-auto">
                <p className="text-sm font-medium text-gray-500 mb-3 text-left">Wada-hadalladii hore:</p>
                <div className="space-y-2">
                  {conversations.slice(0, 3).map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className="w-full text-left p-3 bg-white rounded-xl border border-gray-100 hover:border-purple-200 transition-colors"
                      data-testid={`conversation-${conv.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-700">{conv.subject}</span>
                        {conv.childAge && (
                          <span className="text-xs text-gray-400">({conv.childAge})</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(conv.createdAt).toLocaleDateString('so-SO')}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Current conversation info */}
            {selectedSubject && (
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/50 rounded-lg px-3 py-2">
                <BookOpen className="w-4 h-4" />
                <span>Mawduuca: {selectedSubject}</span>
                {selectedAge && <span className="text-gray-400">• Da'da: {selectedAge}</span>}
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`message-${message.role}-${message.id}`}
              >
                <div className={`flex items-start gap-2 max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === "user" 
                      ? "bg-blue-500" 
                      : "bg-gradient-to-br from-purple-400 to-indigo-500"
                  }`}>
                    {message.role === "user" ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className={`p-3 rounded-2xl ${
                    message.role === "user"
                      ? "bg-blue-500 text-white rounded-tr-sm"
                      : "bg-white border border-gray-100 shadow-sm rounded-tl-sm"
                  }`}>
                    <p className={`text-sm whitespace-pre-wrap ${message.role === "user" ? "text-white" : "text-gray-700"}`}>
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        
        {askMutation.isPending && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="p-3 bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Waan ka fikiraa...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-3 max-w-2xl mx-auto">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Qor su'aashaada halkan..."
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border-gray-200 focus:border-purple-400 focus:ring-purple-400"
            rows={1}
            data-testid="input-question"
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || askMutation.isPending || (usageData?.remaining === 0)}
            className="h-11 w-11 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
            data-testid="button-send"
          >
            {askMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        {usageData?.remaining === 0 && (
          <p className="text-xs text-red-500 mt-2 text-center">
            Waxaad gaartay xadka maalintii. Fadlan soo noqo berri.
          </p>
        )}
      </div>
    </div>
  );
}
