import React from 'react';
import { Check, Phone } from 'lucide-react';
import { PRIMARY_SERVICES } from '../../constants/localSEO';
import { trackEvent } from '../../utils/analytics';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';

/**
 * Per-item starting prices, read from the same live business data the
 * Services cards above use so the savings never disagree with them. Falls
 * back to the build-time constants when a service is missing from that data.
 */
const usePerItemPrices = () => {
  const { data } = useBusinessDataWithFallback();
  const priceFor = (name: string): number => {
    const live = data?.services.find((service) => service.name === name)?.base_price;
    if (typeof live === 'number') return live;
    return Number(PRIMARY_SERVICES.find((service) => service.name === name)?.price ?? 0);
  };
  return {
    small: priceFor('Small Furniture Assembly'),
    shelving: priceFor('Storage & Shelving Assembly'),
    desk: priceFor('Tables & Desks Assembly'),
    dresser: priceFor('Dressers & Storage Assembly'),
    bed: priceFor('Beds & Frames Assembly'),
  };
};

interface RoomPackage {
  id: string;
  name: string;
  price: number;
  items: string[];
  /** Sum of the per-item starting prices for the included items. */
  separateTotal: number;
}

const RoomPackages: React.FC = () => {
  const { small, shelving, desk, dresser, bed } = usePerItemPrices();
  const packages: RoomPackage[] = [
    {
      id: 'nursery',
      name: 'Nursery Package',
      price: 400,
      items: ['Crib', 'Dresser', 'Glider'],
      separateTotal: bed + dresser + small,
    },
    {
      id: 'bedroom',
      name: 'Bedroom Package',
      price: 475,
      items: ['Bed frame', 'Dresser', 'Two nightstands'],
      separateTotal: bed + dresser + small * 2,
    },
    {
      id: 'home-office',
      name: 'Home Office Package',
      price: 500,
      items: ['Desk', 'Two office chairs', 'Shelving unit'],
      separateTotal: desk + small * 2 + shelving,
    },
  ];

  return (
  <section id="packages" className="py-12 bg-white">
    <div className="container mx-auto px-4">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Whole-Room Assembly Packages</h2>
        <p className="text-gray-600 max-w-3xl mx-auto text-lg">
          Setting up a whole room? Bundle the builds at a fixed starting price. Includes assembly, placement and
          packaging cleanup.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {packages.map((pkg) => {
          const savings = pkg.separateTotal - pkg.price;
          return (
            <div key={pkg.id} className="rounded-xl border-t-4 border-t-blue-600 bg-gray-50 shadow-md p-6 flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-3">{pkg.name}</h3>
              <ul className="text-sm text-gray-700 space-y-2 mb-5">
                {pkg.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check size={15} className="text-blue-600 mt-0.5 shrink-0" strokeWidth={3} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4 border-t border-gray-200">
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Starting at</span>
                <span className="inline-block text-2xl font-extrabold text-white bg-blue-600 px-3 py-1 rounded-lg">
                  ${pkg.price}
                </span>
                {savings > 0 && (
                  <p className="mt-3 text-sm font-semibold text-green-700">
                    Save ${savings} vs. ${pkg.separateTotal} in per-item starting prices
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">
        Package prices are starting prices; larger or more complex builds are quoted before we start. Labor-only
        service.{' '}
        <a
          href="tel:+16154034538"
          onClick={() => trackEvent('room_packages_call_click')}
          className="inline-flex items-center gap-1 text-blue-700 underline font-medium"
        >
          <Phone size={12} /> Call for a package quote
        </a>
      </p>
    </div>
  </section>
  );
};

export default RoomPackages;
