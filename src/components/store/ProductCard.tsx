import React from 'react';
import { Boxes, Package, ShoppingCart } from 'lucide-react';
import type { ShopProduct } from '../../types/shop';
import { formatMoney, isProductAvailable } from '../../services/shopService';

interface ProductCardProps {
  product: ShopProduct;
  onView: (product: ShopProduct) => void;
  onAdd: (product: ShopProduct) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onView, onAdd }) => {
  const available = isProductAvailable(product);
  const onSale =
    product.compare_at_price_cents !== null &&
    product.compare_at_price_cents > product.price_cents;
  const lowStock = product.track_inventory && product.stock_quantity > 0 && product.stock_quantity <= 3;

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
      <button
        type="button"
        onClick={() => onView(product)}
        className="relative aspect-square w-full bg-slate-100 overflow-hidden"
        aria-label={`View details for ${product.name}`}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-300">
            <Boxes className="w-14 h-14" />
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col items-start gap-2">
          {product.is_featured && (
            <span className="bg-blue-700 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
              Staff pick
            </span>
          )}
          {onSale && (
            <span className="bg-rose-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
              Sale
            </span>
          )}
        </div>

        {!available && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-full">
              Sold out
            </span>
          </div>
        )}
      </button>

      <div className="flex flex-col flex-1 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
          {product.category}
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900 leading-snug">{product.name}</h3>

        {product.short_description && (
          <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-3">
            {product.short_description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Package className="w-3.5 h-3.5" />
          <span>
            {product.track_inventory
              ? product.stock_quantity === 0
                ? 'Out of stock'
                : lowStock
                  ? `Only ${product.stock_quantity} left`
                  : `${product.stock_quantity} in stock`
              : `Made to order · ready in ~${product.lead_time_days} ${
                  product.lead_time_days === 1 ? 'day' : 'days'
                }`}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <span className="text-xl font-bold text-slate-900">
              {formatMoney(product.price_cents)}
            </span>
            {onSale && (
              <span className="ml-2 text-sm text-slate-400 line-through">
                {formatMoney(product.compare_at_price_cents as number)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={!available}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ShoppingCart className="w-4 h-4" />
            {available ? 'Add' : 'Sold out'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
