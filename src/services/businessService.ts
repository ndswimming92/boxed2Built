import { supabase } from '../lib/supabase';
import type {
  BusinessInfo,
  BusinessAddress,
  Service,
  ServiceArea,
  CustomerReview,
  BusinessHours,
  PaymentMethod,
  SocialMedia,
  BusinessAttribute,
  CompleteBusinessData
} from '../lib/supabase';

export class BusinessService {
  private static businessCache: CompleteBusinessData | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000;

  static clearCache() {
    this.businessCache = null;
    this.cacheTimestamp = 0;
  }

  private static isCacheValid(): boolean {
    return (
      this.businessCache !== null &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    );
  }

  static async getBusinessInfo(): Promise<BusinessInfo | null> {
    try {
      const { data, error } = await supabase
        .from('business_info')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching business info:', error);
      return null;
    }
  }

  static async getBusinessAddress(businessId: string): Promise<BusinessAddress | null> {
    try {
      const { data, error } = await supabase
        .from('business_address')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching business address:', error);
      return null;
    }
  }

  static async getServices(businessId: string): Promise<Service[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    }
  }

  static async getServiceAreas(businessId: string): Promise<ServiceArea[]> {
    try {
      const { data, error } = await supabase
        .from('service_areas')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching service areas:', error);
      return [];
    }
  }

  static async getReviews(businessId: string, featuredOnly: boolean = false): Promise<CustomerReview[]> {
    try {
      let query = supabase
        .from('customer_reviews')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .eq('is_verified', true);

      if (featuredOnly) {
        query = query.eq('is_featured', true);
      }

      const { data, error } = await query.order('date_published', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }
  }

  static async getBusinessHours(businessId: string): Promise<BusinessHours[]> {
    try {
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('business_id', businessId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching business hours:', error);
      return [];
    }
  }

  static async getPaymentMethods(businessId: string): Promise<PaymentMethod[]> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }
  }

  static async getSocialMedia(businessId: string): Promise<SocialMedia[]> {
    try {
      const { data, error } = await supabase
        .from('social_media')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching social media:', error);
      return [];
    }
  }

  static async getBusinessAttributes(businessId: string): Promise<BusinessAttribute[]> {
    try {
      const { data, error } = await supabase
        .from('business_attributes')
        .select('*')
        .eq('business_id', businessId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching business attributes:', error);
      return [];
    }
  }

  static async getCompleteBusinessData(): Promise<CompleteBusinessData | null> {
    if (this.isCacheValid()) {
      return this.businessCache;
    }

    try {
      const businessInfo = await this.getBusinessInfo();

      if (!businessInfo) {
        return null;
      }

      const [
        address,
        serviceAreas,
        services,
        businessHours,
        paymentMethods,
        socialMedia,
        reviews,
        attributes
      ] = await Promise.all([
        this.getBusinessAddress(businessInfo.id),
        this.getServiceAreas(businessInfo.id),
        this.getServices(businessInfo.id),
        this.getBusinessHours(businessInfo.id),
        this.getPaymentMethods(businessInfo.id),
        this.getSocialMedia(businessInfo.id),
        this.getReviews(businessInfo.id),
        this.getBusinessAttributes(businessInfo.id)
      ]);

      const completeData: CompleteBusinessData = {
        info: businessInfo,
        address: address || null,
        serviceAreas: serviceAreas || [],
        services: services || [],
        businessHours: businessHours || [],
        paymentMethods: paymentMethods || [],
        socialMedia: socialMedia || [],
        reviews: reviews || [],
        attributes: attributes || []
      };

      this.businessCache = completeData;
      this.cacheTimestamp = Date.now();

      return completeData;
    } catch (error) {
      console.error('Error fetching complete business data:', error);
      return null;
    }
  }
}
