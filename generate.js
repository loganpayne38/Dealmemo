import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are a senior venture capital analyst at a top-tier VC firm. Your job is to write rigorous, insightful investment memos based on founder pitches.

You are skeptical but fair. You identify both genuine strengths and serious risks. You do not hype. You think like an investor who has seen thousands of pitches.

Always respond with valid JSON matching the exact schema provided. No markdown, no extra text — raw JSON only.`;

const buildPrompt = (data) => `
${SYSTEM_PROMPT}

Write a VC investment memo for this company. Be specific, analytical, and rigorous. Play devil's advocate where appropriate.

Company: ${data.companyName}
Tagline: ${data.tagline || 'Not provided'}
Stage: ${data.stage || 'Not specified'}
Sector: ${data.sector || 'Not specified'}
Funding Ask: ${data.ask || 'Not specified'}
Traction: ${data.traction || 'Not provided'}

Pitch Content:
${data.pitchText}

Return ONLY a JSON object with this exact structure:
{
  "verdict": "Pass" | "Explore" | "Strong Yes",
  "summary": "2-3 sentence executive summary of the company and opportunity",
  "problemSolution": "2-3 sentences on the problem being solved and why this solution is differentiated",
  "market": "2-3 sentences on market size, dynamics, and why now",
  "metrics": [
    { "label": "metric name", "value": "metric value" }
  ],
  "businessModel": "2-3 sentences on how the company makes money, unit economics if available",
  "team": "2-3 sentences assessing the team — strengths, gaps, and relevant background",
  "competition": "2-3 sentences on the competitive landscape and defensibility",
  "strengths": [
    { "title": "Short title", "description": "1-2 sentence explanation" }
  ],
  "risks": [
    { "title": "Short risk title", "description": "1-2 sentence explanation of the risk and its severity" }
  ],
  "questions": [
    "Specific, hard question a VC would ask the founder"
  ],
  "recommendation": "2-3 sentence investment recommendation with clear reasoning"
}

Requirements:
- metrics: extract or infer 3-5 key metrics (ARR, growth rate, market size, team size, etc). Use "N/A" if not mentioned.
- strengths: identify 3-4 genuine strengths with specific evidence from the pitch
- risks: identify 3-5 real risks — be honest, not diplomatic
- questions: generate 5-6 probing questions that get at the weakest parts of the pitch
- verdict: be honest. Most pitches should be "Explore" unless clearly exceptional or clearly not investable.

Return raw JSON only. No markdown fences, no explanation.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyName, tagline, pitchText, stage, sector, ask, traction } = req.body;

  if (!companyName || !pitchText) {
    return res.status(400).json({ error: 'Company name and pitch text are required' });
  }

  if (pitchText.length < 50) {
    return res.status(400).json({ error: 'Pitch text is too short' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(
      buildPrompt({ companyName, tagline, pitchText, stage, sector, ask, traction })
    );

    const text = result.response.text().trim();

    // Strip any accidental markdown fences
    const jsonStr = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
    const memo = JSON.parse(jsonStr);

    return res.status(200).json(memo);

  } catch (err) {
    console.error('API error:', err);

    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
