import OpenAI from "openai";

// OpenAI client using Replit AI Integration (no personal API key needed)
function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

// Rate limiting per user - 10 questions per day
const DAILY_LIMIT = 10;
const usageMap: Map<string, { count: number; date: string }> = new Map();

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().split('T')[0];
  const usage = usageMap.get(userId);
  
  if (!usage || usage.date !== today) {
    usageMap.set(userId, { count: 0, date: today });
    return { allowed: true, remaining: DAILY_LIMIT };
  }
  
  if (usage.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  return { allowed: true, remaining: DAILY_LIMIT - usage.count };
}

export function incrementUsage(userId: string): void {
  const today = new Date().toISOString().split('T')[0];
  const usage = usageMap.get(userId);
  
  if (!usage || usage.date !== today) {
    usageMap.set(userId, { count: 1, date: today });
  } else {
    usage.count++;
  }
}

const SYSTEM_PROMPT = `Waxaad tahay khabiir waalidnimo oo caawiya waalidka Soomaaliyeed.
Ka jawaab su'aalaha waalidnimada adigoo isticmaalaya cilmi-baadhis iyo talooyinka casriga ah.
Had iyo jeer ku jawaab AF-SOOMAALI oo keliya.
U hoggaansan dhaqanka Soomaalida iyo diinta.
Ha bixin talo caafimaad ama sharci.
Jawaabaha ha ka dheeraanin 2-3 cutub.
Noqo mid tixgelin leh, waxtar leh, oo dhaqan-fiican.`;

export interface ParentingHelpRequest {
  question: string;
}

export interface ParentingHelpResponse {
  answer: string;
  remaining: number;
}

export async function getParentingHelp(
  question: string,
  userId: string
): Promise<ParentingHelpResponse> {
  const rateCheck = checkRateLimit(userId);
  
  if (!rateCheck.allowed) {
    return {
      answer: "Waxaad gaartay xadka maalinlaha ah (10 su'aalood). Fadlan soo noqo berri.",
      remaining: 0,
    };
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question }
      ],
      max_completion_tokens: 300,
    });

    const answer = response.choices[0]?.message?.content || "Waan ka xumahay, jawaab ma helin. Fadlan isku day mar kale.";
    
    incrementUsage(userId);
    
    return {
      answer,
      remaining: rateCheck.remaining - 1,
    };
  } catch (error: any) {
    console.error("[AI] Parenting help error:", error.message);
    return {
      answer: "Khalad ayaa dhacay. Fadlan isku day mar kale.",
      remaining: rateCheck.remaining,
    };
  }
}
