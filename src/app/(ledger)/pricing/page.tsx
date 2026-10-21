import { PricingView } from "../../../components/pricing/pricing-view";
import { getBillingSnapshot } from "../../../actions/stripe";

type Props = { searchParams: Promise<{ checkout?: string }> };

export default async function PricingPage({ searchParams }: Props) {
  const params = await searchParams;
  const notice = params.checkout === "success" || params.checkout === "canceled" || params.checkout === "wompi" ? params.checkout : null;
  const billing = await getBillingSnapshot();
  return <PricingView billing={billing} notice={notice} />;
}
