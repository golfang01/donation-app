import axios, { AxiosError } from 'axios';
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
  errorMessage?: string;
}

const SLIPOK_BRANCH_ID = process.env.SLIPOK_BRANCH_ID ?? '';
const SLIPOK_API_KEY = process.env.SLIPOK_API_KEY ?? '';
const SLIPOK_API_URL = `https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`;
const SLIPOK_MODE = process.env.SLIPOK_MODE ?? 'mock';
const STREAMER_ACCOUNT_SUFFIX = process.env.STREAMER_ACCOUNT_SUFFIX ?? '';

// Donor-facing — these are slip-specific problems the donor can act on.
const DONOR_ERROR_MESSAGES: Record<number, string> = {
  1000: "We couldn't read your slip. Please try a clearer photo.",
  1005: 'Please upload a JPG, PNG, JFIF, or WEBP image.',
  1006: "This doesn't look like a valid slip image.",
  1007: "We couldn't find a valid QR code on this slip. Try a clearer photo.",
  1008: "This QR code isn't from a payment slip.",
  1009: 'The bank system is briefly unavailable. Please try again in about 15 minutes.',
  1011: "This slip's QR code has expired or the transaction wasn't found.",
  1013: "The amount on the slip doesn't match what you entered.",
  1014: "This slip wasn't sent to the correct account.",
};

// Operator/account-level — never shown to the donor verbatim. Logged loudly
// so the streamer notices a billing/config problem instead of silently
// rejecting every donation with a confusing message.
const OPERATOR_ERROR_CODES = new Set([1001, 1002, 1003, 1004, 1015]);

// Codes where SlipOK's own message already includes dynamic, useful detail
// (bank name + wait time for 1010, original timestamp for 1012) — pass
// those through rather than overriding with a generic static string.
const PASSTHROUGH_MESSAGE_CODES = new Set([1010, 1012]);

const GENERIC_UNAVAILABLE_MESSAGE = 'Verification is temporarily unavailable. Please try again later.';

export async function verifySlip(params: VerifySlipParams): Promise<VerifySlipResult> {
  return SLIPOK_MODE === 'mock' ? verifySlipMock(params) : verifySlipLive(params);
}

async function verifySlipMock(params: VerifySlipParams): Promise<VerifySlipResult> {
  console.log(`[slipOk.service] MOCK verifying ${params.filePath} for amount ${params.expectedAmount}`);
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    referenceId: `MOCK-REF-${Date.now()}`,
    rawResponse: { mock: true, expectedAmount: params.expectedAmount },
  };
}

async function verifySlipLive(params: VerifySlipParams): Promise<VerifySlipResult> {
  if (!SLIPOK_BRANCH_ID || !SLIPOK_API_KEY) {
    console.error('[slipOk.service] SLIPOK_BRANCH_ID or SLIPOK_API_KEY is missing.');
    return { success: false, errorMessage: GENERIC_UNAVAILABLE_MESSAGE };
  }

  if (!STREAMER_ACCOUNT_SUFFIX) {
    console.error('[slipOk.service] STREAMER_ACCOUNT_SUFFIX is not configured — refusing to verify live.');
    return { success: false, errorMessage: GENERIC_UNAVAILABLE_MESSAGE };
  }

  const form = new FormData();
  form.append('files', fs.createReadStream(params.filePath));
  form.append('amount', params.expectedAmount.toString());
  // log: true — lets SlipOK check the linked receiving account natively
  // (error 1014) and skip charging quota on a re-submitted duplicate slip
  // (error 1012). Requires the receiving account to be linked to this
  // branch in the SlipOK dashboard, which it already is.
  form.append('log', 'true');

  try {
    const response = await axios.post(SLIPOK_API_URL, form, {
      headers: { ...form.getHeaders(), 'x-authorization': SLIPOK_API_KEY },
      timeout: 15000,
    });

    const body = response.data;

    if (body?.success !== true) {
      return { success: false, rawResponse: body, errorMessage: body?.message ?? 'Slip verification failed.' };
    }

    const receiver = body?.data?.receiver;
    const receiverDigits =
      normalizeDigits(receiver?.account?.value) || normalizeDigits(receiver?.proxy?.value);

    if (!receiverDigits.endsWith(STREAMER_ACCOUNT_SUFFIX)) {
      // Should rarely fire now that SlipOK's own log:true check (1014) runs
      // first — kept as a backup in case the LINE LIFF-linked account ever
      // drifts out of sync with what we expect.
      console.warn('[slipOk.service] Slip verified but receiver account did not match streamer account.');
      return {
        success: false,
        rawResponse: body,
        errorMessage: "This slip wasn't sent to the correct account.",
      };
    }

    return {
      success: true,
      referenceId: body?.data?.transRef,
      rawResponse: body,
    };
  } catch (err) {
    const axiosErr = err as AxiosError<{ code?: number; message?: string }>;

    if (axiosErr.response) {
      const code = axiosErr.response.data?.code;
      const rawMessage = axiosErr.response.data?.message;

      if (code !== undefined && OPERATOR_ERROR_CODES.has(code)) {
        console.error(`[slipOk.service] OPERATOR ERROR ${code}: ${rawMessage} — check SlipOK account/billing.`);
        return {
          success: false,
          rawResponse: axiosErr.response.data as Record<string, unknown>,
          errorMessage: GENERIC_UNAVAILABLE_MESSAGE,
        };
      }

      const shouldPassThrough = code !== undefined && PASSTHROUGH_MESSAGE_CODES.has(code);
      const knownMessage = code !== undefined ? DONOR_ERROR_MESSAGES[code] : undefined;

      return {
        success: false,
        rawResponse: axiosErr.response.data as Record<string, unknown>,
        errorMessage: shouldPassThrough ? rawMessage ?? knownMessage : knownMessage ?? rawMessage ?? 'Slip verification failed.',
      };
    }

    console.error('[slipOk.service] SlipOK request failed with no response:', axiosErr.message);
    return { success: false, errorMessage: 'Could not reach the verification service. Please try again in a moment.' };
  }
}

function normalizeDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^0-9]/g, '') : '';
}

// Optional operational helper — check remaining quota without burning a
// verification call. Useful to run manually before/after a stream.
export async function checkSlipOkQuota(): Promise<void> {
  try {
    const response = await axios.get(`${SLIPOK_API_URL}/quota`, {
      headers: { 'x-authorization': SLIPOK_API_KEY },
    });
    console.log('[slipOk.service] Quota status:', response.data?.data);
  } catch (err) {
    console.error('[slipOk.service] Failed to check quota:', err);
  }
}