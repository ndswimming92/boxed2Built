import { supabase } from '../lib/supabase';
import type { GPSCoordinate, LocationData, MileageRecord, TrackingState } from '../lib/supabase';
import { createExpense, getExpenseCategories, createExpenseCategory } from './expenseService';

const TRACKING_INTERVAL = 10000;
const MIN_ACCURACY = 100;
const MIN_DISTANCE_THRESHOLD = 0.01;
const MILEAGE_CATEGORY_NAME = 'Vehicle & Mileage';

export class MileageTrackingService {
  private trackingState: TrackingState = {
    isTracking: false,
    startTime: null,
    currentDistance: 0,
    waypoints: [],
    watchId: null,
  };

  private lastPosition: GPSCoordinate | null = null;

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async startTracking(): Promise<{ success: boolean; error?: string }> {
    if (!navigator.geolocation) {
      return { success: false, error: 'Geolocation is not supported by your browser' };
    }

    if (this.trackingState.isTracking) {
      return { success: false, error: 'Tracking is already active' };
    }

    try {
      const permission = await this.requestLocationPermission();
      if (!permission) {
        return { success: false, error: 'Location permission denied' };
      }

      this.trackingState = {
        isTracking: true,
        startTime: new Date(),
        currentDistance: 0,
        waypoints: [],
        watchId: null,
      };

      const initialPosition = await this.getCurrentPosition();
      if (initialPosition) {
        this.lastPosition = initialPosition;
        this.trackingState.waypoints.push(initialPosition);
      }

      const watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => this.handlePositionError(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      this.trackingState.watchId = watchId;

      return { success: true };
    } catch (error) {
      console.error('Error starting tracking:', error);
      return { success: false, error: 'Failed to start tracking' };
    }
  }

  async stopTracking(): Promise<TrackingState> {
    if (this.trackingState.watchId !== null) {
      navigator.geolocation.clearWatch(this.trackingState.watchId);
    }

    const finalState = { ...this.trackingState };

    this.trackingState = {
      isTracking: false,
      startTime: null,
      currentDistance: 0,
      waypoints: [],
      watchId: null,
    };

    this.lastPosition = null;

    return finalState;
  }

  private async requestLocationPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state === 'granted' || result.state === 'prompt';
    } catch (error) {
      return true;
    }
  }

  private getCurrentPosition(): Promise<GPSCoordinate | null> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          console.error('Error getting current position:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    });
  }

  private handlePositionUpdate(position: GeolocationPosition): void {
    const newCoord: GPSCoordinate = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    };

    if (position.coords.accuracy > MIN_ACCURACY) {
      console.warn('GPS accuracy too low:', position.coords.accuracy);
      return;
    }

    if (this.lastPosition) {
      const distance = this.calculateDistance(
        this.lastPosition.lat,
        this.lastPosition.lng,
        newCoord.lat,
        newCoord.lng
      );

      if (distance >= MIN_DISTANCE_THRESHOLD) {
        this.trackingState.currentDistance += distance;
        this.trackingState.waypoints.push(newCoord);
        this.lastPosition = newCoord;
      }
    } else {
      this.lastPosition = newCoord;
      this.trackingState.waypoints.push(newCoord);
    }
  }

  private handlePositionError(error: GeolocationPositionError): void {
    console.error('Position error:', error);
  }

  getTrackingState(): TrackingState {
    return { ...this.trackingState };
  }

  isTracking(): boolean {
    return this.trackingState.isTracking;
  }

  private async getOrCreateMileageCategory(businessId: string): Promise<string | null> {
    try {
      const categories = await getExpenseCategories(businessId);
      const mileageCategory = categories.find(cat => cat.name === MILEAGE_CATEGORY_NAME);

      if (mileageCategory) {
        return mileageCategory.id;
      }

      const newCategory = await createExpenseCategory({
        business_id: businessId,
        name: MILEAGE_CATEGORY_NAME,
        description: 'Vehicle mileage and transportation expenses',
        irs_category: 'Car and Truck Expenses',
        is_tax_deductible: true,
        is_default: false,
        display_order: 999,
        is_active: true,
      });

      return newCategory?.id || null;
    } catch (error) {
      console.error('Error getting/creating mileage category:', error);
      return null;
    }
  }

  private async createMileageExpense(
    businessId: string,
    mileageRecord: MileageRecord,
    jobDescription?: string
  ): Promise<string | null> {
    try {
      const categoryId = await this.getOrCreateMileageCategory(businessId);

      const expense = await createExpense({
        business_id: businessId,
        category_id: categoryId,
        expense_date: mileageRecord.trip_date,
        vendor_name: 'Mileage',
        description: `${mileageRecord.distance_miles.toFixed(2)} miles - ${mileageRecord.purpose || jobDescription || 'Business travel'}`,
        amount: mileageRecord.deduction_amount,
        payment_method: null,
        confirmation_number: null,
        is_tax_deductible: true,
        deductible_amount: mileageRecord.deduction_amount,
        tax_year: new Date(mileageRecord.trip_date).getFullYear(),
        quarter: Math.ceil((new Date(mileageRecord.trip_date).getMonth() + 1) / 3),
        receipt_url: null,
        has_receipt: false,
        is_recurring: false,
        recurrence_pattern: null,
        tags: ['mileage', 'auto-generated'],
        notes: `Auto-generated from mileage record. Rate: $${mileageRecord.irs_rate_per_mile.toFixed(3)}/mile`,
        is_active: true,
      });

      return expense?.id || null;
    } catch (error) {
      console.error('Error creating mileage expense:', error);
      return null;
    }
  }

  async saveMileageRecord(
    businessId: string,
    jobId: string,
    trackingData: TrackingState,
    irsRate: number,
    purpose?: string,
    notes?: string,
    createExpenseRecord: boolean = true
  ): Promise<{ success: boolean; record?: MileageRecord; error?: string }> {
    try {
      const startLocation: LocationData | null = trackingData.waypoints.length > 0
        ? {
            lat: trackingData.waypoints[0].lat,
            lng: trackingData.waypoints[0].lng,
            accuracy: trackingData.waypoints[0].accuracy,
          }
        : null;

      const endLocation: LocationData | null = trackingData.waypoints.length > 0
        ? {
            lat: trackingData.waypoints[trackingData.waypoints.length - 1].lat,
            lng: trackingData.waypoints[trackingData.waypoints.length - 1].lng,
            accuracy: trackingData.waypoints[trackingData.waypoints.length - 1].accuracy,
          }
        : null;

      const recordData = {
        business_id: businessId,
        job_id: jobId,
        trip_date: new Date().toISOString().split('T')[0],
        start_time: trackingData.startTime?.toISOString() || new Date().toISOString(),
        end_time: new Date().toISOString(),
        start_location: startLocation,
        end_location: endLocation,
        waypoints: trackingData.waypoints,
        distance_miles: Math.round(trackingData.currentDistance * 100) / 100,
        is_manual_entry: false,
        purpose: purpose || null,
        irs_rate_per_mile: irsRate,
        notes: notes || null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('mileage_records')
        .insert(recordData)
        .select()
        .single();

      if (error) {
        console.error('Error saving mileage record:', error);
        return { success: false, error: error.message };
      }

      const mileageRecord = data as MileageRecord;

      if (createExpenseRecord) {
        const expenseId = await this.createMileageExpense(businessId, mileageRecord, purpose);

        if (expenseId) {
          await supabase
            .from('mileage_records')
            .update({ expense_id: expenseId })
            .eq('id', mileageRecord.id);

          mileageRecord.expense_id = expenseId;
        }
      }

      return { success: true, record: mileageRecord };
    } catch (error) {
      console.error('Error in saveMileageRecord:', error);
      return { success: false, error: 'Failed to save mileage record' };
    }
  }

  async saveManualMileageRecord(
    businessId: string,
    jobId: string,
    distanceMiles: number,
    tripDate: string,
    irsRate: number,
    purpose?: string,
    notes?: string,
    createExpenseRecord: boolean = true
  ): Promise<{ success: boolean; record?: MileageRecord; error?: string }> {
    try {
      const recordData = {
        business_id: businessId,
        job_id: jobId,
        trip_date: tripDate,
        start_time: new Date(tripDate).toISOString(),
        end_time: new Date(tripDate).toISOString(),
        start_location: null,
        end_location: null,
        waypoints: [],
        distance_miles: distanceMiles,
        is_manual_entry: true,
        purpose: purpose || null,
        irs_rate_per_mile: irsRate,
        notes: notes || null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('mileage_records')
        .insert(recordData)
        .select()
        .single();

      if (error) {
        console.error('Error saving manual mileage record:', error);
        return { success: false, error: error.message };
      }

      const mileageRecord = data as MileageRecord;

      if (createExpenseRecord) {
        const expenseId = await this.createMileageExpense(businessId, mileageRecord, purpose);

        if (expenseId) {
          await supabase
            .from('mileage_records')
            .update({ expense_id: expenseId })
            .eq('id', mileageRecord.id);

          mileageRecord.expense_id = expenseId;
        }
      }

      return { success: true, record: mileageRecord };
    } catch (error) {
      console.error('Error in saveManualMileageRecord:', error);
      return { success: false, error: 'Failed to save manual mileage record' };
    }
  }

  async getMileageRecordsForJob(jobId: string): Promise<MileageRecord[]> {
    try {
      const { data, error } = await supabase
        .from('mileage_records')
        .select('*')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .order('trip_date', { ascending: false });

      if (error) {
        console.error('Error fetching mileage records:', error);
        return [];
      }

      return (data as MileageRecord[]) || [];
    } catch (error) {
      console.error('Error in getMileageRecordsForJob:', error);
      return [];
    }
  }

  async deleteMileageRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('mileage_records')
        .update({ is_active: false })
        .eq('id', recordId);

      if (error) {
        console.error('Error deleting mileage record:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deleteMileageRecord:', error);
      return { success: false, error: 'Failed to delete mileage record' };
    }
  }

  async updateMileageRecord(
    recordId: string,
    updates: Partial<MileageRecord>
  ): Promise<{ success: boolean; record?: MileageRecord; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('mileage_records')
        .update(updates)
        .eq('id', recordId)
        .select()
        .single();

      if (error) {
        console.error('Error updating mileage record:', error);
        return { success: false, error: error.message };
      }

      return { success: true, record: data as MileageRecord };
    } catch (error) {
      console.error('Error in updateMileageRecord:', error);
      return { success: false, error: 'Failed to update mileage record' };
    }
  }

  async getCurrentMileageRate(businessId: string): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('mileage_settings')
        .select('rate_per_mile')
        .eq('business_id', businessId)
        .lte('effective_date', today)
        .eq('is_active', true)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return 0.67;
      }

      return data.rate_per_mile;
    } catch (error) {
      console.error('Error fetching mileage rate:', error);
      return 0.67;
    }
  }
}

export const mileageTracker = new MileageTrackingService();
