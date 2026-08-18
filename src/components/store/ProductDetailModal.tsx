import React, { useEffect, useState } from 'react';
import { Boxes, Minus, Plus, ShoppingCart, Truck, X } from 'lucide-react';
import type { ShopProduct } from '../../types/shop';
import { formatMoney, isProductAvailable, maxQuantityFor } from '../../services/shopService';

interface ProductDetailModalProps {
  product: ShopProduct;
  onClose: () => void;
  onAdd: (product: ShopProduct, quantity: number) => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, onAdd }) => {
  const images = [product.image_url, ...product.image_urls].filter(
    (src): src is string => !!src,
  );
  const [activeImage, setActiveImage] = useState(images[0] ?? null);
  const [quantity, setQuantity] = useState(1);

  const available = isProductAvailable(product);
  const cap = Math.max(1, maxQuantityFor(product));
  const onSale =
    product.compare_at_price_cents !== null &&
    product.compare_at_price_cents > product.price_cents;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const specs: Array<{ label: string; value: string }> = [
    ...(product.material ? [{ label: 'Material', value: product.material }] : []),
    ...(product.color ? [{ label: 'Color', value: product.color }] : []),
    {
      label: product.track_inventory ? 'Availability' : 'Print time',
      value: product.track_inventory
        ? `${product.stock_quantity} in stock`
        : `~${product.lead_time_days} ${product.lead_time_days === 1 ? 'day' : 'days'}`,
    },
    {
      label: 'Delivery',
      value: product.requires_shipping
        ? product.allow_local_pickup
          ? 'Ship or local pickup'
          : 'Shipped to you'
        : 'Local pickup only',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow hover:bg-white hover:text-slate-900"
          aria-label="Close product details"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid md:grid-cols-2">
          <div className="bg-slate-100 p-4 sm:p-6">
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-white">
              {activeImage ? (
                <img src={activeImage} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <Boxes className="w-16 h-16" />
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(src)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      activeImage === src ? 'border-blue-700' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              {product.category}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{product.name}</h2>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-bold text-slate-900">
                {formatMoney(product.price_cents)}
              </span>
              {onSale && (
                <span className="text-lg text-slate-400 line-through">
                  {formatMoney(product.compare_at_price_cents as number)}
                </span>
              )}
            </div>

            {(product.description || product.short_description) && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {product.description || product.short_description}
              </p>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-4">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {spec.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-800">{spec.value}</dd>
                </div>
              ))}
            </dl>

            {available ? (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-700">Quantity</span>
                  <div className="flex items-center rounded-lg border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:text-slate-300"
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(cap, q + 1))}
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:text-slate-300"
                      disabled={quantity >= cap}
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAdd(product, quantity)}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white shadow-md transition-colors hover:bg-blue-800"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Add to cart
                </button>
              </>
            ) : (
              <p className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                This one is sold out right now. Give us a call and we can print another batch.
              </p>
            )}

            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Truck className="w-3.5 h-3.5" />
              Printed in Spring Hill, TN on our Bambu Lab P2S.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
