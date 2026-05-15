import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AnalysisResult {
  symptom: string;
  pastConnection: string;
  priceHealth: string;
  priceFinance: string;
  relationshipPartner: string;
  relationshipFriends: string;
  childrenImpact: string;
  variantA: string;
  variantB: string;
  isCritical?: boolean;
}

export async function getCoachingQuestions(symptom: string): Promise<{ questions: string[], isCritical: boolean }> {
  try {
    const systemInstruction = `Role: Profesionální ICF kouč. Úkol: Vygeneruj 3 krátké, úderné a přímé koučovací otázky v češtině.
    DŮLEŽITÉ PRAVIDLO PRO JAZYK:
    - Vždy používej vykání (formální oslovení).
    DŮLEŽITÉ PRAVIDLO PRO isCritical:
    - Nastav isCritical: true POUZE pokud uživatelův text obsahuje PŘÍMÉ náznaky sebepoškozování, sebevražedných úmyslů nebo akutní ohrožení života.
    - Pro všechny ostatní témata (stres, vyhoření, úzkost, prokrastinace, vztahy, finance, nepohoda) musí být isCritical: false.
    - Pokud si nejste jistý, nastavte isCritical: false. Bezpečnostní varování je určeno pouze pro extrémní případy.
    JSON: { "questions": string[], "isCritical": boolean }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: symptom,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            isCritical: { type: Type.BOOLEAN }
          },
          required: ["questions", "isCritical"]
        }
      }
    });

    const data = JSON.parse(response.text || "{\"questions\": [], \"isCritical\": false}");
    return data;
  } catch (error) {
    console.error('Error fetching coaching questions:', error);
    throw error;
  }
}

export async function getAnalysis(context: string): Promise<AnalysisResult> {
  const systemInstruction = `Role: Mentorské zrcadlo iHappy (ICF standardy). Úkol: Přímý, úderný a hluboký vhled v češtině. Zaměř se na odhalování vnitřních limitů.
    DŮLEŽITÉ PRAVIDLO PRO JAZYK:
    - Vždy používej vykání (formální oslovení).
    DŮLEŽITÉ PRAVIDLO PRO isCritical:
    - Nastav isCritical: true POUZE při prokazatelném riziku sebepoškozování nebo sebevraždy.
    - Pro stres, vyhoření, vztek, smutek nebo únavu VŽDY nastav isCritical: false.
    JSON: { symptom, pastConnection, priceHealth, priceFinance, relationshipPartner, relationshipFriends, childrenImpact, variantA, variantB, isCritical }.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: context,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symptom: { type: Type.STRING },
            pastConnection: { type: Type.STRING },
            priceHealth: { type: Type.STRING },
            priceFinance: { type: Type.STRING },
            relationshipPartner: { type: Type.STRING },
            relationshipFriends: { type: Type.STRING },
            childrenImpact: { type: Type.STRING },
            variantA: { type: Type.STRING },
            variantB: { type: Type.STRING },
            isCritical: { type: Type.BOOLEAN }
          },
          required: ["symptom", "pastConnection", "priceHealth", "priceFinance", "relationshipPartner", "relationshipFriends", "childrenImpact", "variantA", "variantB", "isCritical"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error('Odpověď od AI je prázdná.');
    return JSON.parse(text);
  } catch (error) {
    console.error('Error fetching analysis:', error);
    throw error;
  }
}
