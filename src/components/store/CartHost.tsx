import React, { Suspense } from 'react';
import { useCartOptional } from '../../contexts/CartContext';

const CartDrawer = React.lazy(() => import('./CartDrawer'));

/**
 * Mounts the cart drawer for the whole public site so the header's cart button
 * can open it from any page.
 *
 * The drawer's code is lazy so visitors who never shop don't pay for it, and it
 * stays mounted while the cart has items — closing the drawer to keep browsing
 * therefore doesn't wipe the checkout details someone already typed.
 */
const CartHost: React.FC = () => {
  const cart = useCartOptional();
  if (!cart || (!cart.isOpen && cart.itemCount === 0)) return null;

  return (
    <Suspense fallback={null}>
      <CartDrawer />
    </Suspense>
  );
};

export default CartHost;
