export const ZYND_AI_DASHBOARD_HREF = "/dashboard/zyndai";

type RouterPush = { push: (href: string) => void };

export function navigateToZyndAi(router: RouterPush) {
  const go = () => router.push(ZYND_AI_DASHBOARD_HREF);

  if (typeof document !== "undefined" && "startViewTransition" in document) {
    document.startViewTransition(go);
    return;
  }

  go();
}
