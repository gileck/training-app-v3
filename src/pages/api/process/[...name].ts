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
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error && { errorDetails: error.stack }),
      },
      isFromCache: false
    });
  }
}

export const config = {
  maxDuration: 60,
  api: {
    // Default Next.js Pages Router body cap is 1mb. Several API
    // domains accept inline payloads larger than that — most notably
    // `agent/uploadAttachment`, which base64-encodes user files (~33%
    // inflation, so the 10mb attachment cap maps to a ~14mb body).
    // 15mb gives headroom; the per-endpoint logic still validates the
    // *decoded* payload size against its own limit.
    bodyParser: { sizeLimit: '15mb' },
  },
};

