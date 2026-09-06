import { FeatureCard } from "@/components/feature-card";

const features = [
  {
    number: "01",
    title: "App Router",
    description: "Server Components als performanter und sicherer Standard.",
  },
  {
    number: "02",
    title: "Strikte Typen",
    description: "TypeScript und validierte Konfiguration statt Überraschungen.",
  },
  {
    number: "03",
    title: "Geprüfte Basis",
    description: "Linting, Typechecks und Tests sind vom ersten Commit an dabei.",
  },
] as const;

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__glow" aria-hidden="true" />
        <p className="eyebrow">Linguasud Software · Digital Studio</p>
        <h1 id="hero-title">
          Bereit für das,
          <span> was als Nächstes kommt.</span>
        </h1>
        <p className="hero__copy">
          Ein schlankes, produktionsnahes Fundament für moderne Webprodukte –
          verständlich strukturiert und bereit zum Wachsen.
        </p>
        <a className="button" href="#fundament">
          Fundament ansehen <span aria-hidden="true">→</span>
        </a>
      </section>

      <section className="features" id="fundament" aria-labelledby="features-title">
        <div className="section-heading">
          <p className="eyebrow">Technische Basis</p>
          <h2 id="features-title">Weniger Ballast. Mehr Substanz.</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <FeatureCard key={feature.number} {...feature} />
          ))}
        </div>
      </section>
    </main>
  );
}
