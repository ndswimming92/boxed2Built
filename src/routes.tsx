import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { RouteRecord } from 'vite-react-ssg';
import { businessDataLoader } from './loaders/businessDataLoader';
import AppShell from './components/AppShell';
// Deliberately not lazy: the error page must render even when loading a
// hashed chunk is exactly what failed.
import RouteErrorPage from './components/RouteErrorPage';

const HomePage = React.lazy(() => import('./pages/HomePage'));
const ServicesPage = React.lazy(() => import('./pages/ServicesPage'));
const FurnitureAssemblyPage = React.lazy(() => import('./pages/services/FurnitureAssemblyPage'));
const TVMountingPage = React.lazy(() => import('./pages/services/TVMountingPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const GalleryPage = React.lazy(() => import('./pages/GalleryPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = React.lazy(() => import('./pages/TermsOfServicePage'));
const PartnersPage = React.lazy(() => import('./pages/PartnersPage'));
const RequestLookupPage = React.lazy(() => import('./pages/RequestLookupPage'));
const FAQPage = React.lazy(() => import('./pages/FAQPage'));
const QRRedirectPage = React.lazy(() => import('./pages/QRRedirectPage'));
const InvoicePaymentPage = React.lazy(() => import('./pages/InvoicePaymentPage'));
const InvoiceThankYouPage = React.lazy(() => import('./pages/InvoiceThankYouPage'));
const GiftCardsPage = React.lazy(() => import('./pages/GiftCardsPage'));
const GiftCardSuccessPage = React.lazy(() => import('./pages/GiftCardSuccessPage'));
const RedeemGiftCardPage = React.lazy(() => import('./pages/RedeemGiftCardPage'));

const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout'));
const LoginPage = React.lazy(() => import('./pages/admin/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/admin/DashboardPage'));
const BusinessInfoPage = React.lazy(() => import('./pages/admin/BusinessInfoPage'));
const ServicesAdminPage = React.lazy(() => import('./pages/admin/ServicesPage'));
const ServiceAreasPage = React.lazy(() => import('./pages/admin/ServiceAreasPage'));
const ReviewsPage = React.lazy(() => import('./pages/admin/ReviewsPage'));
const BusinessHoursPage = React.lazy(() => import('./pages/admin/BusinessHoursPage'));
const PaymentMethodsPage = React.lazy(() => import('./pages/admin/PaymentMethodsPage'));
const SocialMediaPage = React.lazy(() => import('./pages/admin/SocialMediaPage'));
const UTMLinkBuilderPage = React.lazy(() => import('./pages/admin/UTMLinkBuilderPage'));
const AttributesPage = React.lazy(() => import('./pages/admin/AttributesPage'));
const GalleryAdminPage = React.lazy(() => import('./pages/admin/GalleryPage'));
const JobsAdminPage = React.lazy(() => import('./pages/admin/JobsPage'));
const ContractorsPage = React.lazy(() => import('./pages/admin/ContractorsPage'));
const AnalyticsPage = React.lazy(() => import('./pages/admin/AnalyticsPage'));
const InquiriesPage = React.lazy(() => import('./pages/admin/InquiriesPage'));
const InvoicesPage = React.lazy(() => import('./pages/admin/InvoicesPage'));
const InvoiceSettingsPage = React.lazy(() => import('./pages/admin/InvoiceSettingsPage'));
const ForecastingPage = React.lazy(() => import('./pages/admin/ForecastingPage'));
const BurnRatePage = React.lazy(() => import('./pages/admin/BurnRatePage'));
const NotificationBarPage = React.lazy(() => import('./pages/admin/NotificationBarPage'));
const TaxSettingsPage = React.lazy(() => import('./pages/admin/TaxSettingsPage'));
const MileageSettingsPage = React.lazy(() => import('./pages/admin/MileageSettingsPage'));
const GoalsPage = React.lazy(() => import('./pages/admin/GoalsPage'));
const ActivityLogsPage = React.lazy(() => import('./pages/admin/ActivityLogsPage'));
const QRCodesPage = React.lazy(() => import('./pages/admin/QRCodesPage'));
const QRCodeDetailPage = React.lazy(() => import('./pages/admin/QRCodeDetailPage'));
const CompletionsPage = React.lazy(() => import('./pages/admin/CompletionsPage'));
const RemindersPage = React.lazy(() => import('./pages/admin/RemindersPage'));
const ClientsPage = React.lazy(() => import('./pages/admin/ClientsPage'));
const TestIdentifiersPage = React.lazy(() => import('./pages/admin/TestIdentifiersPage'));
const EmailActivityPage = React.lazy(() => import('./pages/admin/EmailActivityPage'));
const AccountLinkReviewQueuePage = React.lazy(() => import('./pages/admin/AccountLinkReviewQueuePage'));
const PrivacyRequestsPage = React.lazy(() => import('./pages/admin/PrivacyRequestsPage'));
const SupportQueuePage = React.lazy(() => import('./pages/admin/SupportQueuePage'));
const PortalAdoptionPage = React.lazy(() => import('./pages/admin/PortalAdoptionPage'));
const AdminDocumentsPage = React.lazy(() => import('./pages/admin/AdminDocumentsPage'));
const BrandingPage = React.lazy(() => import('./pages/admin/BrandingPage'));
const AdminGiftCardsPage = React.lazy(() => import('./pages/admin/GiftCardsPage'));
const ApiKeysPage = React.lazy(() => import('./pages/admin/ApiKeysPage'));
const ConnectionsPage = React.lazy(() => import('./pages/admin/ConnectionsPage'));
const ClaudeUsagePage = React.lazy(() => import('./pages/admin/ClaudeUsagePage'));
const SocialMetricsPage = React.lazy(() => import('./pages/admin/SocialMetricsPage'));
const SocialCommentsPage = React.lazy(() => import('./pages/admin/SocialCommentsPage'));
const SocialMessagesPage = React.lazy(() => import('./pages/admin/SocialMessagesPage'));

const PortalLoginPage = React.lazy(() => import('./pages/portal/LoginPage'));
const PortalDashboardPage = React.lazy(() => import('./pages/portal/DashboardPage'));
const PortalCallbackPage = React.lazy(() => import('./pages/portal/CallbackPage'));
const PortalJobsPage = React.lazy(() => import('./pages/portal/JobsPage'));
const PortalDocumentsPage = React.lazy(() => import('./pages/portal/DocumentsPage'));
const PortalInvoicesPage = React.lazy(() => import('./pages/portal/InvoicesPage'));
const PortalJobDetailPage = React.lazy(() => import('./pages/portal/JobDetailPage'));
const PortalProfilePage = React.lazy(() => import('./pages/portal/ProfilePage'));
const PortalLinkAccountPage = React.lazy(() => import('./pages/portal/LinkAccountPage'));
const PortalNotificationsPage = React.lazy(() => import('./pages/portal/NotificationsPage'));
const PortalSupportPage = React.lazy(() => import('./pages/portal/SupportPage'));

const AdminRouteGuard = React.lazy(() => import('./components/auth/AdminRouteGuard'));
const PortalRouteGuard = React.lazy(() => import('./components/auth/PortalRouteGuard'));

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <AppShell><Outlet /></AppShell>,
    errorElement: <RouteErrorPage />,
    children: [
      // Public pages with build-time data loading
      { index: true, Component: HomePage, loader: businessDataLoader },
      { path: 'services', Component: ServicesPage, loader: businessDataLoader },
      { path: 'services/furniture-assembly', Component: FurnitureAssemblyPage, loader: businessDataLoader },
      { path: 'services/tv-mounting', Component: TVMountingPage, loader: businessDataLoader },
      { path: 'about', Component: AboutPage, loader: businessDataLoader },
      { path: 'contact', Component: ContactPage, loader: businessDataLoader },
      { path: 'partners', Component: PartnersPage, loader: businessDataLoader },
      { path: 'gallery', Component: GalleryPage, loader: businessDataLoader },
      { path: 'faq', Component: FAQPage, loader: businessDataLoader },
      { path: 'privacy-policy', Component: PrivacyPolicyPage },
      { path: 'terms-of-service', Component: TermsOfServicePage },
      { path: 'gift-cards', Component: GiftCardsPage },
      { path: 'gift-cards/success', Component: GiftCardSuccessPage },
      { path: 'redeem-gift-card', Component: RedeemGiftCardPage },
      { path: 'lookup-request', Component: RequestLookupPage },

      // Dynamic routes (client-only, not pre-rendered)
      { path: 'go/:slug', Component: QRRedirectPage },
      { path: 'pay/:invoiceId/:paymentToken', Component: InvoicePaymentPage },
      { path: 'pay/:invoiceId/:paymentToken/thank-you', Component: InvoiceThankYouPage },

      // Auth pages (client-only)
      { path: 'admin/login', Component: LoginPage },
      { path: 'portal/login', Component: PortalLoginPage },
      { path: 'portal/callback', Component: PortalCallbackPage },
      { path: 'portal', element: <Navigate to="/portal/dashboard" replace /> },

      // Portal routes (client-only, auth-protected)
      { path: 'portal/dashboard', element: <PortalRouteGuard><PortalDashboardPage /></PortalRouteGuard> },
      { path: 'portal/jobs', element: <PortalRouteGuard><PortalJobsPage /></PortalRouteGuard> },
      { path: 'portal/documents', element: <PortalRouteGuard><PortalDocumentsPage /></PortalRouteGuard> },
      { path: 'portal/invoices', element: <PortalRouteGuard><PortalInvoicesPage /></PortalRouteGuard> },
      { path: 'portal/jobs/:id', element: <PortalRouteGuard><PortalJobDetailPage /></PortalRouteGuard> },
      { path: 'portal/notifications', element: <PortalRouteGuard><PortalNotificationsPage /></PortalRouteGuard> },
      { path: 'portal/support', element: <PortalRouteGuard><PortalSupportPage /></PortalRouteGuard> },
      { path: 'portal/profile', element: <PortalRouteGuard><PortalProfilePage /></PortalRouteGuard> },
      { path: 'portal/link-account', element: <PortalRouteGuard><PortalLinkAccountPage /></PortalRouteGuard> },

      // Admin routes (client-only, auth-protected)
      {
        path: 'admin',
        element: <AdminRouteGuard><AdminLayout /></AdminRouteGuard>,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', Component: DashboardPage },
          { path: 'goals', Component: GoalsPage },
          { path: 'inquiries', Component: InquiriesPage },
          { path: 'invoices', Component: InvoicesPage },
          { path: 'invoice-settings', Component: InvoiceSettingsPage },
          { path: 'analytics', Component: AnalyticsPage },
          { path: 'forecasting', Component: ForecastingPage },
          { path: 'burn-rate', Component: BurnRatePage },
          { path: 'tax-settings', Component: TaxSettingsPage },
          { path: 'mileage-settings', Component: MileageSettingsPage },
          { path: 'notification-bar', Component: NotificationBarPage },
          { path: 'activity-logs', Component: ActivityLogsPage },
          { path: 'test-identifiers', Component: TestIdentifiersPage },
          { path: 'business-info', Component: BusinessInfoPage },
          { path: 'services', Component: ServicesAdminPage },
          { path: 'service-areas', Component: ServiceAreasPage },
          { path: 'clients', Component: ClientsPage },
          { path: 'reviews', Component: ReviewsPage },
          { path: 'gallery', Component: GalleryAdminPage },
          { path: 'qr-codes', Component: QRCodesPage },
          { path: 'qr-codes/:id', Component: QRCodeDetailPage },
          { path: 'jobs', Component: JobsAdminPage },
          { path: 'contractors', Component: ContractorsPage },
          { path: 'completions', Component: CompletionsPage },
          { path: 'reminders', Component: RemindersPage },
          { path: 'business-hours', Component: BusinessHoursPage },
          { path: 'payment-methods', Component: PaymentMethodsPage },
          { path: 'social-media', Component: SocialMediaPage },
          { path: 'utm-link-builder', Component: UTMLinkBuilderPage },
          { path: 'attributes', Component: AttributesPage },
          { path: 'email-activity', Component: EmailActivityPage },
          { path: 'account-link-review', Component: AccountLinkReviewQueuePage },
          { path: 'support', Component: SupportQueuePage },
          { path: 'portal-adoption', Component: PortalAdoptionPage },
          { path: 'documents', Component: AdminDocumentsPage },
          { path: 'branding', Component: BrandingPage },
          { path: 'gift-cards', Component: AdminGiftCardsPage },
          { path: 'privacy-requests', Component: PrivacyRequestsPage },
          { path: 'api-keys', Component: ApiKeysPage },
          { path: 'connections', Component: ConnectionsPage },
          { path: 'claude-usage', Component: ClaudeUsagePage },
          { path: 'social-metrics', Component: SocialMetricsPage },
          { path: 'social-comments', Component: SocialCommentsPage },
          { path: 'social-messages', Component: SocialMessagesPage },
        ],
      },
    ],
  },
];
