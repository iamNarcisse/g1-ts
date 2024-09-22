// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { generateResponse } from "@/helpers/helper";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = req.body;

    if (!data || !data.prompt) {
      return res.status(400).json({ message: "Missing prompt" });
    }

    const prompt = data.prompt;

    const result = generateResponse(prompt);

    for await (const { steps, totalThinkingTime } of result) {
      console.log("Steps:", steps);
      if (totalThinkingTime) {
        console.log("Total Thinking Time:", totalThinkingTime);
      }
    }

    res.status(200).json({ name: "John Doe" });
  } catch (error) {
    return res.status(200).json({ name: "John Doe" });
  }
}
