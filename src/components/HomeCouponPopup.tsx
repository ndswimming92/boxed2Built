import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CouponPopup from './CouponPopup';
import { getHomeCouponPopup, type HomeCouponPopup as HomeCouponPopupData } from '../services/couponService';
import { recallReferralCode } from '../services/referralQRService';
import { popupLastSeenAt, rememberPopupSeen, shouldShowPopup } from '../utils/couponPopup';
import { trackEvent } from '../utils/analytics';

interface HomeCouponPopupProps {
  businessId: string | null;
  /**
   * False while the opening box animation still covers the page. The delay the
   * admin sets counts from the moment the visitor can actually see the site.
   */
  ready?: boolean;
}

// One showing per page load: coming back to the home page from another page on
// the site is not a new visit, whatever the frequency setting says.
let shownThisLoad = false;

/**
 * Decides whether and when the coupon popup appears on the home page, then
 * hands the drawing to CouponPopup. Renders nothing until there is something
 * to show, so it costs the page one small request and no layout.
 */
export default function HomeCouponPopup({ businessId, ready = true }: HomeCouponPopupProps) {
  const [data, setData] = useState<HomeCouponPopupData | null>(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Someone who arrived with a code already in hand — a shared coupon link or a
  // friend's referral — has their offer. The quote form takes one code, so a
  // popup pushing another would only cost the friend their referral credit.
  const params = new URLSearchParams(location.search);
  const alreadyHasCode = params.has('coupon') || params.has('ref') || Boolean(recallReferralCode());

  useEffect(() => {
    if (!businessId || alreadyHasCode || shownThisLoad) return;

    let cancelled = false;
    getHomeCouponPopup(businessId).then((result) => {
      if (cancelled || !result) return;
      if (!shouldShowPopup(result.settings.frequency, popupLastSeenAt(result.coupon.code))) return;
      setData(result);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (!data || !ready || open || shownThisLoad) return;

    const timer = window.setTimeout(() => {
      shownThisLoad = true;
      rememberPopupSeen(data.coupon.code);
      setOpen(true);
      trackEvent('coupon_popup_view', 'coupon_popup', {
        event_category: 'promotion',
        event_label: data.coupon.code,
      });
    }, data.settings.delay_seconds * 1000);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready]);

  if (!data || !open) return null;

  const { coupon, settings } = data;

  const handleClaim = () => {
    trackEvent('coupon_popup_claim', 'coupon_popup', {
      event_category: 'conversion',
      event_label: coupon.code,
    });
    setOpen(false);

    // The quote form reads `?coupon=` and applies it; the hash scrolls to it.
    // Existing params (campaign tags) ride along.
    const next = new URLSearchParams(location.search);
    next.set('coupon', coupon.code);
    navigate(
      { pathname: location.pathname, search: `?${next.toString()}`, hash: '#contact-form-section' },
      { replace: true },
    );
    document.getElementById('contact-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleClose = () => {
    trackEvent('coupon_popup_dismiss', 'coupon_popup', {
      event_category: 'promotion',
      event_label: coupon.code,
    });
    setOpen(false);
  };

  return <CouponPopup coupon={coupon} settings={settings} onClaim={handleClaim} onClose={handleClose} />;
}
