import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

interface VerifySlipParams {
  filePath: string;
  expectedAmount: number;
}

interface VerifySlipResult {
  success: boolean;
  referenceId?: string;
  rawResponse?: Record<string, unknown>;
}

const SLIPOK_API_URL = process.env.SLIPOK_API_URL ?? '';
const SLIPOK_API_KEY = process.env.SLIPOK_API_KEY ?? '';

/**
 * Sends the uploaded slip to SlipOK for verification.
 *
 * MOCKED for Phase 2 — returns a fake success after a short delay so
 * we can build and test the full request/response flow without live
 * SlipOK credentials. Swap the function body for the commented-out
 * real implementation once credentials are confirmed.
 */
export async function verifySlip(params: VerifySlipParams): Promise<VerifySlipResult> {
  console.log(`[slipOk.service] MOCK verifying ${params.filePath} for amount ${params.expectedAmount}`);
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    referenceId: `MOCK-REF-${Date.now()}`,
    rawResponse: { mock: true, expectedAmount: params.expectedAmount },
  };

  /* ---- REAL IMPLEMENTATION (uncomment once SlipOK creds are ready) ----
  const form = new FormData();
  form.append('files', fs.createReadStream(params.filePath));
  form.append('amount', params.expectedAmount.toString());

  const response = await axios.post(SLIPOK_API_URL, form, {
    headers: { ...form.getHeaders(), 'x-authorization': SLIPOK_API_KEY },
  });

  // SlipOK's exact response shape needs verifying against their docs —
  // this is illustrative, not confirmed.
  return {
    success: response.data.success === true,
    referenceId: response.data.data?.transRef,
    rawResponse: response.data,
  };
  */
}