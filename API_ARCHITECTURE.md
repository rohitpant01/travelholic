# EkalGo API & AI Architecture

This document outlines the multi-API strategy used to power the EkalGo platform's intelligent features.

## 1. AI Content Generation (Text & Planning)

The platform uses three distinct AI providers to balance cost, reasoning depth, and response speed.

### **OpenAI (`OPENAI_API_KEY`)**
*   **Model**: `gpt-4o-mini`
*   **Primary Purpose**: **Main Itinerary Generation**
*   **Why?**: Reserved for the most complex task requiring high logic and reasoning to enrich the locked itinerary skeleton with descriptions, costs, and travel times.
*   **Scope**: Only used in the `generateItinerary` control flow.

### **Groq (`GROQ_API_KEY`)**
*   **Model**: `llama-3.3-70b-versatile`
*   **Primary Purpose**: **High-Speed UI Features**
*   **Features Powered**:
    *   **Lyra AI**: Transforming post captions into structured travel itineraries.
    *   **Top Indian Destinations**: Generating the 10 daily rotating iconic spots.
    *   **Place Insights**: Generating deep-dive stories and travel tips for specific locations.
    *   **Teaser Itineraries**: Generating the 2-day "preview" itineraries in the Discover tab.
    *   **Hidden Gems (Fallback)**: Automatically takes over if the Gemini API fails.
*   **Why?**: Chosen for its near-instant response time, which is critical for real-time UI interactions.

### **Google Gemini (`GOOGLE_GEMINI_API_KEY`)**
*   **Model**: `gemini-1.5-flash`
*   **Primary Purpose**: **Exploration & Culture**
*   **Features Powered**:
    *   **Hidden Gems**: Suggesting offbeat, lesser-known Indian destinations.
    *   **Travel Quotes**: Generating inspiring, location-specific quotes.
*   **Why?**: High reliability and specialized knowledge of diverse Indian locales.

---

## 2. Location & Spatial Data

All physical-world data is powered by a single, verified source to ensure accuracy in the itinerary skeleton.

### **Google Places API (`GOOGLE_PLACES_API_KEY`)**
*   **Location Resolution**: Converting text (e.g., "Manali") into GPS coordinates (Lat/Lng).
*   **Skeleton Locking**: Fetching real tourist attractions within a 20km radius to ensure the AI doesn't hallucinate non-existent places.
*   **Hotel Enrichment**: 
    *   Finding the specific locality of an AI-suggested hotel.
    *   Retrieving real-world ratings (e.g., 4.5/5 stars).
    *   Fetching high-quality photographic cover images.
*   **User Interface**: Powering the search bar autocomplete throughout the app.

---

## 3. High-Availability & Fallback Logic

The system is designed with "Silent Failure" prevention:
1.  **Itinerary Fallback**: If OpenAI fails, the system automatically attempts the generation using **Gemini**.
2.  **Explorer Fallback**: If Gemini hits a rate limit, the system automatically redirects the request to **Groq**.
3.  **Coordinate Guard**: If a GPS resolution fails, the engine blocks the generation rather than providing random data, ensuring the user never sees a broken map.

---

## 4. Key Security & Environment Variables
The following variables must be correctly set in the `.env` file for these features to function:
*   `OPENAI_API_KEY`
*   `GROQ_API_KEY`
*   `GOOGLE_GEMINI_API_KEY`
*   `GOOGLE_PLACES_API_KEY`
