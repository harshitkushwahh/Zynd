import successAnimation from "../../../../public/success.json";
import waitingAnimation from "../../../../public/Waiting.json";

/** Bundled Lottie data — avoids fetch delay/failure on the outcome card. */
export const KYC_SUCCESS_LOTTIE = successAnimation;
export const KYC_WAITING_LOTTIE = waitingAnimation;

/** @deprecated Use KYC_SUCCESS_LOTTIE — kept for callers that still fetch by URL. */
export const KYC_SUCCESS_LOTTIE_SRC = "/success.json";
/** @deprecated Use KYC_WAITING_LOTTIE */
export const KYC_WAITING_LOTTIE_SRC = "/Waiting.json";

export type KycOutcomeVariant = "success" | "waiting";
