export interface WompiWidgetOptions {
  publicKey: string;
  currency: "COP";
  amountInCents: number;
  reference: string;
  integrity: string;
  expirationTime: string;
  redirectUrl: string;
}

const SCRIPT = "https://checkout.wompi.co/widget.js";

interface WidgetCheckoutInstance {
  open: (onResult: () => void) => void;
}

type WidgetCheckoutCtor = new (config: {
  currency: "COP";
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
  expirationTime: string;
  redirectUrl: string;
}) => WidgetCheckoutInstance;

declare global {
  interface Window {
    WidgetCheckout?: WidgetCheckoutCtor;
  }
}

function loadWompiScript(): Promise<void> {
  if (window.WidgetCheckout) return Promise.resolve();
  const found = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
  if (found) {
    return new Promise((resolve, reject) => {
      found.addEventListener("load", () => resolve(), { once: true });
      found.addEventListener("error", () => reject(new Error("wompi")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("wompi"));
    document.head.appendChild(script);
  });
}

/** Opens the official Wompi widget. The result callback is not treated as proof of payment. */
export async function openWompiWidget(options: WompiWidgetOptions): Promise<void> {
  await loadWompiScript();
  const Checkout = window.WidgetCheckout;
  if (!Checkout) throw new Error("wompi");
  const widget = new Checkout({
    currency: options.currency,
    amountInCents: options.amountInCents,
    reference: options.reference,
    publicKey: options.publicKey,
    signature: { integrity: options.integrity },
    expirationTime: options.expirationTime,
    redirectUrl: options.redirectUrl,
  });
  widget.open(() => undefined);
}
