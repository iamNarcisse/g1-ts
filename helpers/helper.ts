import Groq from "groq-sdk";

const client = new Groq();

export const sleep = (duration = 1) => {
  return new Promise((resolve) => setTimeout(resolve, duration * 1000));
};

export const makeApiCall = async (
  messages: Groq.Chat.ChatCompletionMessageParam[],
  maxTokens = 400,
  isFinalAnswer = false
) => {
  const max_tokens = maxTokens;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        messages: messages,
        model: "llama-3.1-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens,
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    } catch (error) {
      const errorObject = error as any;
      if (attempt === 2) {
        if (isFinalAnswer) {
          return {
            title: "Error",
            content: `Failed to generate final answer after 3 attempts. Error: ${errorObject.message}`,
          };
        } else {
          return {
            title: "Error",
            content: `Failed to generate step after 3 attempts. Error: ${errorObject.message}`,
            next_action: "final_answer",
          };
        }
      }
      await sleep(1);
    }
  }
};

export async function* generateResponse(prompt: any) {
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an expert AI assistant that explains your reasoning step by step. For each step, provide a title that describes what you're doing in that step, along with the content. Decide if you need another step or if you're ready to give the final answer. Respond in JSON format with 'title', 'content', and 'next_action' (either 'continue' or 'final_answer') keys. USE AS MANY REASONING STEPS AS POSSIBLE. AT LEAST 3. BE AWARE OF YOUR LIMITATIONS AS AN LLM AND WHAT YOU CAN AND CANNOT DO. IN YOUR REASONING, INCLUDE EXPLORATION OF ALTERNATIVE ANSWERS. CONSIDER YOU MAY BE WRONG, AND IF YOU ARE WRONG IN YOUR REASONING, WHERE IT WOULD BE. FULLY TEST ALL OTHER POSSIBILITIES. YOU CAN BE WRONG. WHEN YOU SAY YOU ARE RE-EXAMINING, ACTUALLY RE-EXAMINE, AND USE ANOTHER APPROACH TO DO SO. DO NOT JUST SAY YOU ARE RE-EXAMINING. USE AT LEAST 3 METHODS TO DERIVE THE ANSWER. USE BEST PRACTICES.
            
            Example of a valid JSON response:
            {
                "title": "Identifying Key Information",
                "content": "To begin solving this problem, we need to carefully examine the given information and identify the crucial elements that will guide our solution process. This involves...",
                "next_action": "continue"
            }`,
    },
    { role: "user", content: prompt },
    {
      role: "assistant",
      content:
        "Thank you! I will now think step by step following my instructions, starting at the beginning after decomposing the problem.",
    },
  ];

  let steps = [];
  let stepCount = 1;
  let totalThinkingTime = 0;

  while (true) {
    const startTime = Date.now();
    const stepData = await makeApiCall(messages, 300); // Assuming makeApiCall is an async function
    const endTime = Date.now();
    const thinkingTime = (endTime - startTime) / 1000; // Convert to seconds
    totalThinkingTime += thinkingTime;

    steps.push({
      title: `Step ${stepCount}: ${stepData.title}`,
      content: stepData.content,
      thinkingTime: thinkingTime,
    });

    messages.push({ role: "assistant", content: JSON.stringify(stepData) });

    if (stepData.next_action === "final_answer" || stepCount >= 10) {
      break; // Stop if final answer or step limit reached
    }

    stepCount += 1;

    // Return steps so far after each iteration (like yielding)
    yield { steps, totalThinkingTime: null }; // Not returning total time yet
  }

  // Request the final answer
  messages.push({
    role: "user",
    content: "Please provide the final answer based on your reasoning above.",
  });

  const startFinalTime = Date.now();
  const finalData = await makeApiCall(messages, 200, true); // Assuming the 3rd param is isFinalAnswer
  const endFinalTime = Date.now();
  const finalThinkingTime = (endFinalTime - startFinalTime) / 1000; // Convert to seconds
  totalThinkingTime += finalThinkingTime;

  steps.push({
    title: "Final Answer",
    content: finalData.content,
    thinkingTime: finalThinkingTime,
  });

  // Return the full set of steps and total thinking time
  yield { steps, totalThinkingTime };
}
