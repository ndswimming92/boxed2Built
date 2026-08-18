import { Head } from 'vite-react-ssg';
import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Megaphone, Package, Printer, ShoppingBag, Sparkles } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ProductCard from '../components/store/ProductCard';
import ProductDetailModal from '../components/store/ProductDetailModal';
import CartDrawer from '../components/store/CartDrawer';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useCart } from '../contexts/CartContext';
import { getShopSettings, listActiveProducts } from '../services/shopService';
import type { ShopProduct, ShopSettings } from '../types/shop';

const ALL_CATEGORIES = 'All';

const StorePage: React.FC = () => {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [detailProduct, setDetailProduct] = useState<ShopProduct | null>(null);

  const { addItem, openCart, itemCount } = useCart();

  useEffect(() => {
    let canceled = false;

    const load = async () => {
      try {
        const [productList, shopSettings] = await Promise.all([
          listActiveProducts(),
          getShopSettings(),
        ]);
        if (canceled) return;
        setProducts(productList);
        setSettings(shopSettings);
      } catch (error) {
        console.error('Failed to load the store:', error);
        if (!canceled) setLoadFailed(true);
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((product) => product.category).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return [ALL_CATEGORIES, ...unique];
  }, [products]);

  const visibleProducts = useMemo(
    () =>
      activeCategory === ALL_CATEGORIES
        ? products
        : products.filter((product) => product.category === activeCategory),
    [products, activeCategory],
  );

  const handleAdd = (product: ShopProduct, quantity = 1) => {
    // The cart drawer opens on add, so it is its own confirmation — a toast on
    // top of it would just cover the checkout button.
    addItem(product, quantity);
    setDetailProduct(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Head>
        <title>3D Print Shop | Custom Prints from Spring Hill, TN | Boxed2Built</title>
        <meta
          name="description"
          content="Shop 3D printed organizers, gadgets, and gifts printed in Spring Hill, TN by Boxed2Built. Ship to your door or pick up locally."
        />
        <link rel="canonical" href="https://boxed2built.com/store" />
        <meta property="og:url" content="https://boxed2built.com/store" />
        <meta property="og:title" content="Boxed2Built 3D Print Shop | Spring Hill, TN" />
        <meta
          property="og:description"
          content="Locally 3D printed organizers, gadgets, and gifts. Shipping and local pickup available."
        />
        <meta name="twitter:title" content="Boxed2Built 3D Print Shop" />
        <meta
          name="twitter:description"
          content="Locally 3D printed organizers, gadgets, and gifts from Spring Hill, TN."
        />
      </Head>

      <Header />

      <main className="pt-40 pb-20">
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
              <Printer className="h-4 w-4" /> Printed in-house
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              The Boxed2Built Print Shop
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
              Organizers, gadgets, and gifts designed and 3D printed right here in Spring Hill, TN.
              Ship them to your door or grab them at your next job.
            </p>
          </div>

          {settings?.announcement && (
            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <Megaphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <p className="text-sm leading-relaxed text-amber-900">{settings.announcement}</p>
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Highlight
              icon={Printer}
              title="Made locally"
              text="Every item comes off our own Bambu Lab P2S."
            />
            <Highlight
              icon={Package}
              title="Ship or pick up"
              text="Flat-rate shipping, or free local pickup in Spring Hill."
            />
            <Highlight
              icon={Sparkles}
              title="Custom welcome"
              text="Need something specific? We print custom orders too."
            />
          </div>

          {categories.length > 2 && (
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    activeCategory === category
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          <div className="mt-10">
            {loading ? (
              <div className="flex justify-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : loadFailed ? (
              <EmptyState
                title="The shop is taking a break"
                body="We couldn't load the catalog just now. Refresh the page, or give us a call and we'll take your order directly."
              />
            ) : visibleProducts.length === 0 ? (
              <EmptyState
                title="New prints coming soon"
                body="Nothing is listed yet — the printer is warming up. Check back shortly, or reach out if there's something you'd like us to make."
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onView={setDetailProduct}
                    onAdd={(item) => handleAdd(item)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-16 rounded-3xl bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 px-6 py-10 text-center text-white sm:px-10">
            <h2 className="text-2xl font-bold sm:text-3xl">Want something custom printed?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-blue-100">
              Replacement parts, jigs, signage, party favors, branded pieces for your business — if
              it fits on the plate, we can print it. Send us the details and we'll quote it.
            </p>
            <a
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 shadow-md transition-colors hover:bg-blue-50"
            >
              <ShoppingBag className="h-5 w-5" />
              Request a custom print
            </a>
          </div>
        </section>
      </main>

      {itemCount > 0 && (
        <button
          type="button"
          onClick={openCart}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-3 font-semibold text-white shadow-xl transition-colors hover:bg-blue-800 xl:hidden"
        >
          <ShoppingBag className="h-5 w-5" />
          View cart ({itemCount})
        </button>
      )}

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onAdd={handleAdd}
        />
      )}

      <CartDrawer settings={settings} />

      <Footer />
    </div>
  );
};

const Highlight: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({
  icon: Icon,
  title,
  text,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <Icon className="h-5 w-5 text-blue-700" />
    <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
  </div>
);

const EmptyState: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
    <Boxes className="mx-auto h-12 w-12 text-slate-300" />
    <h2 className="mt-4 text-xl font-semibold text-slate-900">{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{body}</p>
    <a
      href="/contact"
      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-800"
    >
      Get in touch
    </a>
  </div>
);

export default StorePage;
