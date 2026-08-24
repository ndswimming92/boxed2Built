import React from 'react';
import { Head } from 'vite-react-ssg';
import { Compass, Home, Wrench, MapPin, Phone } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

/**
 * Rendered two ways, and both matter for indexing:
 *
 *  - Pre-rendered to dist/404.html, which Netlify serves with a real HTTP 404
 *    for any path that matches no static file and no rule in public/_redirects.
 *  - Matched client-side by the `*` route, so an in-app navigation to a dead
 *    link lands here instead of the generic route error screen.
 *
 * The page is noindex: a 404 body that Google can index is how soft 404s and
 * duplicate-of-homepage reports start.
 */
const NotFoundPage: React.FC = () => (
  <>
    <Head>
      <title>Page Not Found | Boxed2Built</title>
      <meta
        name="description"
        content="That page isn't here. Browse Boxed2Built furniture assembly and TV mounting services, our service areas across Middle Tennessee, or get in touch."
      />
      <meta name="robots" content="noindex, follow" />
      <link rel="canonical" href="https://boxed2built.com/404" />
      <meta property="og:url" content="https://boxed2built.com/404" />
      <meta property="og:title" content="Page Not Found | Boxed2Built" />
      <meta
        property="og:description"
        content="That page isn't here. Browse our services, service areas, or get in touch."
      />
    </Head>

    <Header />

    <main className="pt-20">
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <Compass className="mx-auto h-12 w-12 text-blue-700" aria-hidden="true" />
            <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-blue-700">
              Error 404
            </p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              We couldn't find that page
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              The link may be out of date, or the address may have a typo. Everything we offer is
              one of these clicks away.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <a
                href="/"
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-6 font-semibold text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <Home className="h-6 w-6 text-blue-700" aria-hidden="true" />
                Home
              </a>
              <a
                href="/services"
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-6 font-semibold text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <Wrench className="h-6 w-6 text-blue-700" aria-hidden="true" />
                Services
              </a>
              <a
                href="/service-areas"
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-6 font-semibold text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <MapPin className="h-6 w-6 text-blue-700" aria-hidden="true" />
                Service Areas
              </a>
            </div>

            <a
              href="/contact"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-800"
            >
              <Phone className="h-5 w-5" aria-hidden="true" />
              Get a free quote
            </a>
          </div>
        </div>
      </section>
    </main>

    <Footer />
  </>
);

export default NotFoundPage;
