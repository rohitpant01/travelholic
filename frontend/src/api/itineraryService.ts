import apiClient from './client';

export interface ItineraryStop {
  time: string;
  placeName: string;
  address: string;
  distance: string;
  why: string;
  secretStory?: string;
  coordinates: { lat: number; lng: number };
  rating?: number;
  photoReference?: string;
}

export interface ItineraryResponse {
  title: string;
  itinerary: ItineraryStop[];
  whyThisPlan: string;
}

export const itineraryService = {
  /**
   * Generate a smart day plan based on mood and location
   */
  generate: (query: string, lat: number, lng: number, moods?: string[], radius: number = 20000): Promise<{ data: ItineraryResponse }> => {
    return apiClient.get('/itinerary/generate', {
      params: { query, lat, lng, moods, radius }
    });
  }
};
