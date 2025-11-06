"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container, Flex, Grid, Text } from "@radix-ui/themes";
import { MagnifyingGlassIcon, StarIcon } from "@heroicons/react/24/outline";
import { Globe2, ShieldCheck, Sparkles, Waves, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

const fadeIn = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const navLinks = [
  { label: "eSIM Store", hash: "store" },
  { label: "How it works", hash: "how" },
  { label: "Coverage", hash: "coverage" },
  { label: "Resources", hash: "resources" }
];

const features = [
  {
    icon: <Globe2 className="h-6 w-6 text-brand-600" />,
    title: "190+ countries",
    description: "Local and regional plans curated for seamless roaming-free travel."
  },
  {
    icon: <ShieldCheck className="h-6 w-6 text-brand-600" />,
    title: "Trusted partners",
    description: "Tier-one carriers with transparent pricing and round-the-clock support."
  },
  {
    icon: <Zap className="h-6 w-6 text-brand-600" />,
    title: "Instant activation",
    description: "Install your QR in minutes and get connected before you even depart."
  }
];

const curatedPlans = [
  {
    country: "Namibia",
    carrier: "TN Mobile",
    plan: "Nama",
    description: "Perfect for safari adventurers with 15GB high-speed data.",
    price: "$18",
    badge: "Popular",
    image: "/illustrations/namibia-card.svg"
  },
  {
    country: "South Africa",
    carrier: "VodaConnect",
    plan: "Cape Explorer",
    description: "20GB data + hotspot support ideal for road trips.",
    price: "$24",
    badge: "Best value",
    image: "/illustrations/south-africa-card.svg"
  },
  {
    country: "Kenya",
    carrier: "SafariNet",
    plan: "Maasai",
    description: "10GB data with free WhatsApp calls for 21 days.",
    price: "$16",
    badge: "New",
    image: "/illustrations/kenya-card.svg"
  }
];

const motionCards = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 }
};

const experiences = [
  {
    title: "One tap install",
    description: "Guided install cards and native wallet passes keep everything in one place.",
    icon: <Sparkles className="h-5 w-5 text-sand-500" />
  },
  {
    title: "Coverage map",
    description: "Explore live signal heatmaps and know before you go.",
    icon: <Waves className="h-5 w-5 text-sand-500" />
  }
];

const stats = [
  { metric: "1.5M+", label: "Trips connected" },
  { metric: "98%", label: "Satisfaction score" },
  { metric: "<3 mins", label: "Average activation" }
];

export default function HomePage() {
  const staggeredPlans = useMemo(
    () =>
      curatedPlans.map((plan, index) => ({
        ...plan,
        delay: 0.2 * index
      })),
    []
  );

  return (
    <div className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-radial-fade" aria-hidden />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-8 pt-10 lg:px-10">
        <Flex align="center" gap="4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="material-symbols-rounded text-2xl text-brand-600">wifi</span>
            Simplify
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-brand-700 lg:flex">
            {navLinks.map((link) => (
              <Link key={link.hash} href={{ hash: link.hash }} className="transition hover:text-brand-900">
                {link.label}
              </Link>
            ))}
          </nav>
        </Flex>
        <Flex align="center" gap="3">
          <Button variant="ghost" size="sm" className="hidden md:inline-flex">
            Log in
          </Button>
          <Button size="sm">Sign up</Button>
        </Flex>
      </header>

      <main>
        <Container size="4" px={{ initial: "4", sm: "6" }}>
          <section className="relative mb-24 grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
            <motion.div
              className="space-y-8"
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              variants={{ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 } }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-subtle">
                <StarIcon className="h-4 w-4 text-sand-500" />
                #1 eSIM marketplace in Africa 2024
              </span>
              <h1 className="font-display text-4xl tracking-tight text-brand-900 sm:text-5xl lg:text-[3.35rem]">
                Instant eSIMs for every leg of your journey.
              </h1>
              <p className="max-w-xl text-lg text-brand-700">
                Discover curated local, regional, and global plans, install in minutes, and stay connected with
                confident coverage from touchdown to takeoff.
              </p>
              <motion.div
                className="flex flex-col gap-3 sm:flex-row"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
              >
                <Button size="lg" className="shadow-subtle">
                  Browse plans
                </Button>
                <Button variant="secondary" size="lg">
                  Check compatibility
                </Button>
              </motion.div>
              <Flex wrap="wrap" gap="5" className="pt-2">
                {stats.map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <p className="text-2xl font-semibold text-brand-900">{stat.metric}</p>
                    <p className="text-sm text-brand-600">{stat.label}</p>
                  </div>
                ))}
              </Flex>
            </motion.div>

            <motion.div
              className="relative rounded-3xl border border-brand-100/80 bg-white/70 p-6 shadow-card backdrop-blur-lg"
              {...fadeIn}
              transition={{ ...fadeIn.transition, delay: 0.2 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-700">Where do you need an eSIM?</p>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-600">Live</span>
              </div>
              <label className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-inner">
                <MagnifyingGlassIcon className="h-5 w-5 text-brand-500" />
                <input
                  type="search"
                  placeholder="Search by country or city"
                  className="w-full border-none bg-transparent text-sm text-brand-900 placeholder:text-brand-400 focus:outline-none"
                />
                <span className="material-symbols-rounded text-brand-500">arrow_outward</span>
              </label>

              <div className="space-y-4">
                {staggeredPlans.map((plan) => (
                  <motion.article
                    key={plan.plan}
                    className="flex items-start gap-4 rounded-2xl border border-brand-100/80 bg-white px-4 py-4 shadow-sm"
                    initial={{ opacity: 0, x: 24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: plan.delay, duration: 0.5, ease: "easeOut" }}
                  >
                    <div className="relative h-16 w-20 overflow-hidden rounded-xl bg-sand-100/70">
                      <Image
                        src={plan.image}
                        alt={`${plan.country} illustration`}
                        fill
                        className="object-cover object-center"
                        sizes="(max-width: 768px) 80px, 96px"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-brand-800">{plan.country}</p>
                        <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase text-brand-600">
                          {plan.badge}
                        </span>
                      </div>
                      <p className="text-xs text-brand-500">{plan.carrier}</p>
                      <p className="font-medium text-brand-900">{plan.plan}</p>
                      <p className="text-sm text-brand-600">{plan.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <p className="font-semibold text-brand-900">{plan.price}</p>
                      <Button variant="ghost" size="sm" className="text-xs">
                        View
                      </Button>
                    </div>
                  </motion.article>
                ))}
              </div>
            </motion.div>
          </section>
        </Container>

        <section id="store" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
          <motion.div className="mb-12 max-w-2xl" {...fadeIn}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Why travellers choose us</p>
            <h2 className="mt-3 font-display text-3xl text-brand-900 sm:text-4xl">Built for constant movement</h2>
            <p className="mt-4 text-base text-brand-700">
              Designed from the runway up to keep you connected. Transparent pricing, clear coverage, and a
              supportive crew all the way.
            </p>
          </motion.div>
          <Grid
            columns={{ initial: "1", md: "3" }}
            gap="6"
            className="[&>div]:rounded-3xl [&>div]:border [&>div]:border-brand-100/80 [&>div]:bg-white [&>div]:p-6 [&>div]:shadow-card"
          >
            {features.map((feature, index) => (
              <motion.div key={feature.title} {...motionCards} transition={{ duration: 0.5, delay: index * 0.15 }}>
                <div className="mb-4 inline-flex rounded-full bg-brand-100/80 p-3 text-brand-600">{feature.icon}</div>
                <Text className="font-display text-xl text-brand-900">{feature.title}</Text>
                <Text as="p" className="mt-3 text-sm text-brand-600">
                  {feature.description}
                </Text>
              </motion.div>
            ))}
          </Grid>
        </section>

        <section id="how" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
          <motion.div className="mb-10 flex flex-col gap-6 rounded-[2rem] border border-brand-100/80 bg-white p-10 shadow-card lg:flex-row lg:items-center lg:gap-16" {...fadeIn}>
            <div className="flex-1 space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Effortless onboarding</p>
              <h2 className="font-display text-3xl text-brand-900 sm:text-4xl">Activate in three guided steps</h2>
              <p className="text-base text-brand-700">
                Purchase, install, and manage every eSIM directly in the Simplify hub. Track usage, top-up, and switch
                carriers without swapping plastic.
              </p>
              <Flex gap="5" className="pt-4">
                {experiences.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-sand-200/80 bg-sand-50/80 p-4 text-brand-700">
                    <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sand-500">
                      {item.icon}
                    </div>
                    <p className="font-medium text-brand-800">{item.title}</p>
                    <p className="text-sm text-brand-600">{item.description}</p>
                  </div>
                ))}
              </Flex>
            </div>
            <motion.ol
              className="flex-1 space-y-4"
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true, amount: 0.5 }}
              variants={{ initial: { opacity: 0, x: 24 }, whileInView: { opacity: 1, x: 0 } }}
            >
              {["Choose destination plan", "Install QR or manual setup", "Enjoy secure global coverage"].map(
                (step, index) => (
                  <li
                    key={step}
                    className="relative overflow-hidden rounded-2xl border border-brand-100/80 bg-brand-50/60 p-5 pl-16"
                  >
                    <span className="absolute left-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-brand-600 shadow-subtle">
                      {index + 1}
                    </span>
                    <p className="font-semibold text-brand-800">{step}</p>
                    <p className="text-sm text-brand-600">
                      {index === 0 && "Filter by travel dates, network speed, and perks tailored to your itinerary."}
                      {index === 1 && "Detailed instructions for iOS, Android, and wearables keep setup stress-free."}
                      {index === 2 && "Monitor usage, top up in seconds, and switch plans without touching a SIM tray."}
                    </p>
                  </li>
                )
              )}
            </motion.ol>
          </motion.div>
        </section>

        <section id="coverage" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
          <motion.div className="mb-8" {...fadeIn}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Coverage spotlight</p>
            <h2 className="mt-3 font-display text-3xl text-brand-900 sm:text-4xl">Regional bundles for your next escape</h2>
            <p className="mt-3 max-w-2xl text-base text-brand-700">
              Pair countries and switch networks automatically as you cross borders. Smart routing keeps you on the
              strongest partner without roaming penalties.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
            <motion.div
              className="relative overflow-hidden rounded-[2rem] border border-brand-100/80 bg-gradient-to-br from-white via-white to-brand-100/60 p-8 shadow-card"
              {...fadeIn}
              transition={{ ...fadeIn.transition, delay: 0.1 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <Text className="font-display text-2xl text-brand-900">Southern Explorer</Text>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase text-brand-600">
                  Best seller
                </span>
              </div>
              <Text as="p" className="max-w-md text-sm text-brand-600">
                Covers South Africa, Namibia, Botswana, and Zambia with seamless handoffs. Includes hotspot, Wi-Fi
                calling, and travel concierge.
              </Text>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {["40GB shared data", "5G where available", "24/7 live chat", "In-app travel alerts"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3">
                    <span className="material-symbols-rounded text-brand-500">check_circle</span>
                    <span className="text-sm font-medium text-brand-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button size="lg" className="shadow-subtle">
                  Get this bundle
                </Button>
                <Button variant="ghost" size="lg">
                  Compare all regions
                </Button>
              </div>
            </motion.div>

            <motion.div
              className="relative rounded-[2rem] border border-brand-100/80 bg-white/70 p-8 shadow-card backdrop-blur"
              {...fadeIn}
              transition={{ ...fadeIn.transition, delay: 0.2 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <Text className="text-sm font-semibold text-brand-700">Live network quality</Text>
                <span className="inline-flex items-center gap-2 text-xs font-medium text-brand-500">
                  <span className="material-symbols-rounded text-brand-400">podcasts</span>
                  Updated 2 min ago
                </span>
              </div>
              <div className="grid gap-4">
                {[
                  { country: "Namibia", strength: "Strong", latency: "32ms" },
                  { country: "Botswana", strength: "Excellent", latency: "28ms" },
                  { country: "Zambia", strength: "Strong", latency: "41ms" }
                ].map((row, index) => (
                  <motion.div
                    key={row.country}
                    className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-4"
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15, duration: 0.45, ease: "easeOut" }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-brand-800">{row.country}</p>
                      <p className="text-xs text-brand-500">Latency {row.latency}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-600">
                      <span className="material-symbols-rounded text-brand-400">signal_cellular_alt</span>
                      {row.strength}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="resources" className="mx-auto mb-24 max-w-6xl px-6 lg:px-10">
          <motion.div className="rounded-[2rem] border border-brand-100/80 bg-brand-900 px-10 py-14 text-sand-50 shadow-card" {...fadeIn}>
            <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
              <div className="space-y-6">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sand-200">Stay in the know</p>
                <h2 className="font-display text-3xl text-white sm:text-4xl">Travel smarter with the Simplify briefing</h2>
                <p className="max-w-xl text-base text-sand-100/90">
                  Monthly guides to new destinations, carrier launches, lounge perks, and real traveller tips.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="flex flex-1 items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md">
                    <MagnifyingGlassIcon className="h-5 w-5 text-sand-200" />
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="w-full bg-transparent text-sm text-white placeholder:text-sand-200/70 focus:outline-none"
                    />
                  </label>
                  <Button variant="secondary" size="lg" className="bg-white/15 text-white hover:bg-white/25">
                    Subscribe
                  </Button>
                </div>
              </div>
              <motion.div
                className="space-y-4 rounded-[1.75rem] border border-white/15 bg-white/5 p-6"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
              >
                {["What is an eSIM?", "How to switch carriers abroad", "Best data plans for digital nomads"].map(
                  (topic) => (
                    <div key={topic} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">{topic}</p>
                        <p className="text-xs text-sand-200/70">5 min read</p>
                      </div>
                      <span className="material-symbols-rounded text-sand-200">arrow_outward</span>
                    </div>
                  )
                )}
              </motion.div>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="mx-auto mb-10 mt-20 flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-brand-600 lg:px-10">
        <p>© {new Date().getFullYear()} Simplify Technologies. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="#" className="hover:text-brand-900">
            Privacy
          </Link>
          <Link href="#" className="hover:text-brand-900">
            Terms
          </Link>
          <Link href="#" className="hover:text-brand-900">
            Support
          </Link>
        </div>
      </footer>
    </div>
  );
}
