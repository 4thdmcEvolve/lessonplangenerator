// Lesson Plan Generator API proxy — plan, verify, then generate
// © 2026 4THDMC | EVOLVE LLC. All Rights Reserved.
//
// SETUP IN VERCEL (Settings → Environment Variables):
//   ANTHROPIC_API_KEY = your rotated Anthropic API key
//   TOOLKIT_PASSWORD  = ToolkitEvolve2026 (this tool's existing password — unchanged)
//
// IMPORTANT: This is a DEDICATED endpoint for Lesson Plan Generator only.
// It is NOT the shared universal generate.js used by Assignment Grader,
// Differentiation Helper, Sub Plan Generator, and Report Card Comment Writer.
// Those four tools must keep using the universal pass-through proxy —
// do not redirect them to this file, and do not merge this logic into theirs.
//
// ARCHITECTURE — adapted from Activity Generator's proven verify-then-generate
// pipeline, with one key structural difference: Activity Generator verifies
// EXISTING pasted content. Lesson Plan Generator has no existing content —
// it only has a topic/subject/grade — so verification has to happen against
// content that doesn't exist yet. The fix is to front-load a PLANNING pass
// that anticipates likely factual/computational content for the topic,
// verify THAT, then generate the lesson plan using only verified material.
//
// PIPELINE (always runs in full, every generation, per Brandon's decision —
// consistency and safety over speed):
//
// 1. PLAN: one call reads subject/grade/topic and predicts what factual or
//    computational claims a lesson on this topic would likely need (named
//    historical figures/events, scientific facts, or worked math/computation
//    examples). This is forward-looking since there's no existing content
//    to scan — it's inferring from the topic itself.
//
// 2. VERIFY:
//    - Factual claims anticipated -> web-search verification pass (same
//      silent-pass / flag-only-exceptions format as Activity Generator).
//    - Computational claims anticipated -> TWO method-diverse passes, same
//      as Activity Generator: Pass A solves and shows work, Pass B
//      independently re-derives using a genuinely different method. Only
//      problems both passes agree on are passed forward as pre-verified
//      examples the lesson is allowed to use.
//
// 3. GENERATE: builds the actual lesson plan, instructed to use ONLY the
//    pre-verified computational examples for any worked problems, and to
//    write generically rather than invent new unverified facts/numbers.
//
// This makes 3-4 sequential Anthropic calls total (plan, verify-math or
// verify-facts or both, generate) for almost every request, since the
// pipeline always runs. Frontend still makes ONE request and waits once.

// NOTE: maxDuration is configured in vercel.json at the project root, not
// here. The `export const config = { maxDuration }` pattern only applies to
// Next.js App Router functions — this project is a plain Vite + Vercel
// serverless function, so that export is silently ignored here. See
// vercel.json for the actual timeout configuration.

const rateLimitStore = new Map();
const MAX_REQUESTS_PER_WINDOW = 40;
const WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetAt: record.resetAt };
  }
  record.count += 1;
  return { allowed: true };
}

async function callAnthropic({ model, maxTokens, prompt, useWebSearch }) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (data.error) return { ok: false, text: "", raw: data };
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { ok: true, text, raw: data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const { toolkitPassword, subject, grade, topic, duration, learningStyle, standard, extras } = req.body || {};

  const expected = process.env.TOOLKIT_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: { message: "Server configuration error: TOOLKIT_PASSWORD not set" } });
  }
  if (!toolkitPassword || toolkitPassword !== expected) {
    return res.status(401).json({ error: { message: "Invalid or missing access password.", code: "AUTH_REQUIRED" } });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: "Server configuration error: ANTHROPIC_API_KEY not set" } });
  }

  const limit = checkRateLimit(toolkitPassword);
  if (!limit.allowed) {
    const minutes = Math.ceil((limit.resetAt - Date.now()) / 60000);
    return res.status(429).json({ error: { message: `Rate limit reached. Try again in about ${minutes} minute(s).` } });
  }

  if (!subject || !grade || !topic) {
    return res.status(400).json({ error: { message: "Subject, Grade Level, and Topic are required." } });
  }

  const lessonDescriptor = `Subject: ${subject}\nGrade Level: ${grade}\nTopic: ${topic}\nDuration: ${duration} minutes\n${standard ? `Standards/Objectives: ${standard}\n` : ""}${extras ? `Special Notes: ${extras}\n` : ""}`;

  try {
    // ── STEP 1: PLANNING PASS ──────────────────────────────────────────
    // Unlike Activity Generator, there is no existing content to scan.
    // This pass infers what a lesson on this topic would likely need.
    const planPrompt = `A teacher wants a lesson plan with the details below. Before writing the lesson, predict what specific factual or computational content it would likely need — regardless of subject area.

For each likely claim or example, classify it as exactly one of:
- FACTUAL: a real-world claim a lesson on this topic would likely include (a named historical figure/event, a scientific fact, a business/economic principle, a statistic) that should be verified before use.
- COMPUTATIONAL: a worked example, calculation, or formula a lesson on this topic would likely include (math problems, financial calculations, scientific formulas, measurement conversions) that should be solved and verified before use.

If this topic is purely skills-based with no likely factual or computational content (e.g. brainstorming techniques, creative writing structure, presentation skills), say "NOTHING TO VERIFY."

LESSON DETAILS:
${lessonDescriptor}

Output format, one line per anticipated claim/example:
FACTUAL: [claim]
or
COMPUTATIONAL: [specific example problem to solve, e.g. "factor x^2 + 7x + 12" or "calculate compound interest on $1000 at 5% for 3 years"]
or just: NOTHING TO VERIFY`;

    const planResult = await callAnthropic({
      model: "claude-sonnet-4-6",
      maxTokens: 500,
      prompt: planPrompt,
    });

    const plan = planResult.ok ? planResult.text : "NOTHING TO VERIFY";
    const hasFactual = /FACTUAL:/i.test(plan);
    const hasComputational = /COMPUTATIONAL:/i.test(plan);

    let factualNotes = "";
    let computationalNotes = "";
    let computationalPassed = true;

    // ── STEP 2a: FACTUAL VERIFICATION (web search) ────────────────────
    if (hasFactual) {
      const factCheckPrompt = `The following are claims a lesson plan will likely need. Verify each via web search.

Check EVERY claim, but report concisely: do NOT explain or describe claims that are simply confirmed accurate. Only give detail on claims that are INCORRECT or that need an important NUANCE a teacher should know before presenting it to students.

CLAIMS TO VERIFY:
${plan}

LESSON CONTEXT (for reference):
${lessonDescriptor}

OUTPUT FORMAT — exactly this structure:
SUMMARY: [X] of [Y] claims confirmed accurate with no issues.

[Only include the section below if there is at least one flagged claim. If everything passed clean, end after the SUMMARY line and write nothing else.]

FLAGGED CLAIMS:
- [claim]: [INCORRECT or NUANCE] — [brief explanation and correction if needed]`;

      const factResult = await callAnthropic({
        model: "claude-sonnet-4-6",
        maxTokens: 800,
        prompt: factCheckPrompt,
        useWebSearch: true,
      });
      factualNotes = factResult.ok ? factResult.text : "Fact verification could not be completed.";
    }

    // ── STEP 2b: COMPUTATIONAL VERIFICATION (two method-diverse passes) ─
    if (hasComputational) {
      const solvePrompt = `Solve the following computational examples that a lesson plan will likely need, showing full step-by-step work for each. Use the most direct method appropriate to each problem.

COMPUTATIONAL EXAMPLES:
${plan}

LESSON CONTEXT:
${lessonDescriptor}

For each problem, output EXACTLY these four lines, in this order, with no line ever left blank:
Problem: [restate it]
Method used: [name the method]
Worked solution: [full steps]
Answer: [the final numeric/algebraic answer — this line is REQUIRED and must always contain the actual answer value, never left blank or cut short]

CRITICAL: Before moving to the next problem, confirm the Answer line for the current problem is complete and contains an actual value. Never end a problem's entry without a filled-in Answer line.`;

      const passA = await callAnthropic({
        model: "claude-sonnet-4-6",
        maxTokens: 1000,
        prompt: solvePrompt,
      });

      const passAText = passA.ok ? passA.text : "";

      const verifyPrompt = `Below are solved problems with their answers. Independently verify each answer using a DIFFERENT method than was likely used to solve it originally — for example, if it looks like factoring was used, verify by expanding; if substitution was used to solve, verify by solving directly; if one formula was used, verify with an alternate formula or by working backward from the answer.

Do not just re-check the same way — use a genuinely different verification approach for each problem. State clearly whether each answer is CONFIRMED or INCORRECT, and if incorrect, give the correct answer.

SOLVED PROBLEMS TO VERIFY:
${passAText}

For each problem, output:
Problem: [restate it]
Verification method used: [different from original method]
Verification work: [show it]
Result: CONFIRMED or INCORRECT (if incorrect, state the correct answer)`;

      const passB = await callAnthropic({
        model: "claude-sonnet-4-6",
        maxTokens: 1000,
        prompt: verifyPrompt,
      });

      const passBText = passB.ok ? passB.text : "";

      computationalPassed = !/INCORRECT/i.test(passBText) && passA.ok && passB.ok;

      computationalNotes = computationalPassed
        ? `${passAText}\n\n--- Independently re-verified using a different method: ---\n${passBText}`
        : `Verification found a discrepancy and could not confirm all problems independently. Original work:\n${passAText}\n\nVerification attempt:\n${passBText}`;
    }

    // ── STEP 3: GENERATE THE LESSON PLAN ───────────────────────────────
    let verificationBlock = "No specific factual or computational content was anticipated for this topic.";
    let usageRule = "Write naturally for this topic.";

    if (hasFactual && hasComputational) {
      verificationBlock = `FACTUAL CLAIMS — VERIFIED:\n${factualNotes}\n\nCOMPUTATIONAL EXAMPLES — ${computationalPassed ? "VERIFIED (two independent methods agree)" : "COULD NOT BE FULLY VERIFIED"}:\n${computationalNotes}`;
      usageRule = computationalPassed
        ? "Use the verified facts and EXACT pre-verified computational examples below wherever the lesson needs worked problems or named facts. If the lesson needs an additional example beyond what was pre-verified, write it generically without specific invented numbers/dates rather than making up a new unverified one."
        : "Use the verified facts above. The computational examples could not be fully verified — use simpler, well-known textbook-style examples instead of anything resembling the unverified attempt, or describe the process generically without specific numbers.";
    } else if (hasFactual) {
      verificationBlock = factualNotes;
      usageRule = "Use only the verified facts above for any named historical/scientific claims. Do not invent additional specific factual claims — write generically if more is needed.";
    } else if (hasComputational) {
      verificationBlock = computationalNotes;
      usageRule = computationalPassed
        ? "Use the EXACT pre-verified computational examples below for worked problems in this lesson. If additional examples are needed beyond what was verified, keep them simple and well-known rather than inventing new unverified numbers."
        : "Verification could not confirm the attempted examples. Use simple, well-known textbook examples instead of inventing new numeric content.";
    }

    const prompt = `You are an expert curriculum designer. Create a focused, practical lesson plan.

CRITICAL FORMATTING RULES:
- Use PLAIN TEXT only. No markdown, no asterisks, no hashtags, no backticks, no code blocks.
- Use numbered sections (1. 2. 3.) and lettered sub-points (a. b. c.) for organization.
- Use simple dashes (-) for list items if needed.
- Write in a clean, professional format that can be copied directly into any document.

ACCURACY REQUIREMENT:
- ${usageRule}
- Double-check grammar, spelling, and factual accuracy in all examples.
- If you include a deliberately incorrect example for students to diagnose (e.g. "find the error"), VERIFY the example actually contains the error you claim it does — do not present a correct answer as if it were wrong.

LENGTH REQUIREMENT:
- Keep each section CONCISE: 3-5 bullet points or one short paragraph per section.
- Do not over-elaborate. Teachers can adapt and expand.
- A complete, shorter plan is better than an incomplete detailed one.
- Total length should be under 800 words.

COMPLETION REQUIREMENT:
- You MUST complete ALL 8 sections. Do not stop mid-sentence or skip sections.
- Every section must have substantive content, not placeholders.
- Before ending your response, confirm the final section (Extension Activities) is fully written with a complete closing sentence, not cut off mid-thought.

${lessonDescriptor}
Learning Style Focus: ${learningStyle}

VERIFICATION RESULTS FROM PRE-CHECK (use this to ground any factual/computational content):
${verificationBlock}

Create these sections (keep each section brief but useful):

1. Learning Objectives (3-4 measurable objectives)
2. Materials Needed (brief list)
3. Warm-Up / Hook (5-10 min activity)
4. Direct Instruction (key teaching points)
5. Guided Practice (teacher-supported activity)
6. Independent Practice (student work)
7. Assessment / Exit Ticket (how to check understanding)
8. Extension Activities (for early finishers)

Do NOT include a Differentiation Strategies section — differentiation is handled by a separate dedicated tool in this toolkit, not by this lesson plan.

Be specific, practical, and immediately usable. Complete every section.`;

    const genResult = await callAnthropic({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 2000,
      prompt,
    });

    if (!genResult.ok) {
      return res.status(500).json({ error: { message: genResult.raw?.error?.message || "Generation failed." } });
    }
    if (!genResult.text) {
      return res.status(500).json({ error: { message: "Nothing was generated. Please try again." } });
    }

    const verificationType = hasFactual && hasComputational
      ? "both"
      : hasFactual
      ? "facts"
      : hasComputational
      ? "math"
      : "none";

    return res.status(200).json({
      text: genResult.text,
      verificationRan: hasFactual || hasComputational,
      verificationType,
      computationalPassed: hasComputational ? computationalPassed : null,
      verificationNotes: verificationBlock,
    });
  } catch (error) {
    return res.status(500).json({ error: { message: "Proxy error: " + error.message } });
  }
}
