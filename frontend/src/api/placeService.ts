import apiClient, { API_BASE_URL } from './client';

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
  image?: string;
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
    return `${API_BASE_URL}/images/google-photo?ref=${photoReference}`;
  },
  getPlaceDetails: (placeId: string, name: string, location: string, category: string, rating?: number, distance?: number) => {
    return apiClient.get<{ success: boolean; details: any }>('places/details', {
      params: { id: placeId, name, location, category, rating, distance }
    });
  }
};
