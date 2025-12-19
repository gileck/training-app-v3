import { processApiCall } from "@/apis/processApiCall";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const response = await processApiCall(req, res);
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in API handler:', error);
    // NOTE: Never return non-200 from API routes in this app; encode errors in the body.
    return res.status(200).json({
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      isFromCache: false
    });
  }
}

export const config = {
  maxDuration: 60,
};

