import DemoPage from "./DemoPage";

export default async function Page({ params }: { params: Promise<{ restaurant: string }> }) {
  const { restaurant } = await params;
  return <DemoPage restaurant={restaurant} />;
}
