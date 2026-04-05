import apiClient from './client';

export interface Place {
  id: string;
  name: string;
  address: string;
  rating: number;
  totalRatings: number;
  distanceKm: number;
  distanceText?: string;
  location: { lat: number; lng: number };
  types: string[];
  photoReference?: string;
  whyThisPlace: string;
}

export interface CategorizedPlaces {
  nature: Place[];
  romantic: Place[];
  family: Place[];
  adventure: Place[];
  fun: Place[];
  spiritual: Place[];
  restaurants: Place[];
  cafes: Place[];
  hotels: Place[];
  others: Place[];
  hidden_gems?: Place[];
}

export interface PlaceSearchResponse {
  success: boolean;
  cached: boolean;
  isCitySearch: boolean;
  locationName: string;
  results: CategorizedPlaces;
}

export const placeService = {
  /**
   * Search for nearby places based on NLP query and location
   */
  searchNearMe: (query: string, lat: number, lng: number, radius: number = 15000) => {
    return apiClient.get<PlaceSearchResponse>('places/search', {
      params: { query, lat, lng, radius }
    });
  },

  /**
   * Get public URL for a Google Place photo
   */
  getPhotoUrl: (photoReference: string, maxWidth: number = 800) => {
    // Note: In production, you might want to proxy this through your backend to hide API keys
    // For MVP, we'll use a direct link if possible or a backend proxy endpoint
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=YOUR_API_KEY_HERE`;
    // RECOMMENDED: Create a backend route for this to avoid exposing API key on frontend
  },
  getPlaceDetails: (placeId: string, name: string, location: string, category: string, rating?: number, distance?: number) => {
    return apiClient.get<{ success: boolean; details: any }>('places/details', {
      params: { id: placeId, name, location, category, rating, distance }
    });
  }
};
