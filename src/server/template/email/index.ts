import AWS from 'aws-sdk';

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

function getFromAddress(): string | null {
  return process.env.TWO_FACTOR_EMAIL_FROM || null;
}

function getSesClient() {
  return new AWS.SES({
    region: process.env.AWS_REGION || 'us-east-1',
  });
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const fromAddress = getFromAddress();

  if (!fromAddress) {
    return { success: false, error: 'Missing TWO_FACTOR_EMAIL_FROM' };
  }

  try {
    const ses = getSesClient();
    await ses.sendEmail({
      Source: fromAddress,
      Destination: {
        ToAddresses: [params.to],
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: params.text,
            Charset: 'UTF-8',
          },
          Html: {
            Data: params.html,
            Charset: 'UTF-8',
          },
        },
      },
    }).promise();

    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return { success: false, error: String(error) };
  }
}
