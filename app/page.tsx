import { Container } from "@radix-ui/themes";
import {
  type ArticlesSection,
  type CountryGridSection,
  type HeroSection,
  type EsimProductSummary,
  type LiveNetworkWidgetSection,
  type NewsletterSection,
  type RegionalBundleSpotlightSection,
  type StepsSection,
  type WhyChooseUsSection,
  getHomePage,
  getSiteSettings,
  getEsimProducts
} from "@/lib/sanity.queries";
import { Hero } from "@/components/cms/Hero";
import { CountryGrid } from "@/components/cms/CountryGrid";
import { WhyChooseUs } from "@/components/cms/WhyChooseUs";
import { Steps } from "@/components/cms/Steps";
import { BundleSpotlight } from "@/components/cms/BundleSpotlight";
import { LiveNetworkWidget } from "@/components/cms/LiveNetworkWidget";
import { Newsletter } from "@/components/cms/Newsletter";
import { Articles } from "@/components/cms/Articles";
import { SiteHeader } from "@/components/cms/SiteHeader";
import { SiteFooter } from "@/components/cms/SiteFooter";
import { AfricaCoverageMap } from "@/components/AfricaCoverageMap";

export const dynamic = "force-static";
export const revalidate = 60;

export default async function HomePage() {
  const [settings, home, products] = await Promise.all([getSiteSettings(), getHomePage(), getEsimProducts()]);

  if (!settings || !home) {
    return null;
  }

  const sections = home.sections ?? [];
  const heroSection = sections.find((section): section is HeroSection => section._type === "heroSection");
  const countrySection = sections.find((section): section is CountryGridSection => section._type === "countryGridSection");
  const whySection = sections.find((section): section is WhyChooseUsSection => section._type === "whyChooseUsSection");
  const stepsSection = sections.find((section): section is StepsSection => section._type === "stepsSection");
  const bundleSection = sections.find(
    (section): section is RegionalBundleSpotlightSection => section._type === "regionalBundleSpotlightSection"
  );
  const liveSection = sections.find(
    (section): section is LiveNetworkWidgetSection => section._type === "liveNetworkWidgetSection"
  );
  const newsletterSection = sections.find(
    (section): section is NewsletterSection => section._type === "newsletterSection"
  );
  const articlesSection = sections.find((section): section is ArticlesSection => section._type === "articlesSection");

  const allProducts = products ?? [];

  const highlightedProducts: EsimProductSummary[] = heroSection?.featuredProductIds?.length
    ? heroSection.featuredProductIds
        .map((id) => {
          const fromAll = allProducts.find((product) => product._id === id);
          if (fromAll) {
            return fromAll;
          }

          return heroSection.featuredProducts?.find((product) => product._id === id) ?? null;
        })
        .filter((product): product is EsimProductSummary => Boolean(product))
    : heroSection?.featuredProducts ?? [];

  return (
    <div className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-radial-fade" aria-hidden />
      <SiteHeader settings={settings} />
      <main>
        <Container size="4" px={{ initial: "4", sm: "6" }}>
          {heroSection ? (
            <Hero
              hero={heroSection}
              tagline={settings.tagline}
              highlightedProducts={highlightedProducts}
              allProducts={allProducts}
              fallbackCountries={countrySection?.countries ?? []}
            />
          ) : null}
        </Container>
        <AfricaCoverageMap />
        {countrySection ? <CountryGrid section={countrySection} /> : null}
        {whySection ? <WhyChooseUs section={whySection} /> : null}
        {stepsSection ? <Steps section={stepsSection} /> : null}
        {bundleSection ? <BundleSpotlight section={bundleSection} /> : null}
        {liveSection ? <LiveNetworkWidget section={liveSection} /> : null}
        {newsletterSection ? <Newsletter section={newsletterSection} /> : null}
        {articlesSection ? <Articles section={articlesSection} /> : null}
      </main>
      <SiteFooter settings={settings} />
    </div>
  );
}
