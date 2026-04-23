class SmartBudgetAllocator {
  constructor(totalBudget, durationDays) {
    this.totalBudget = totalBudget || 0;
    this.durationDays = durationDays || 1;
    this.allocations = this.calculateBaseAllocations();
  }

  calculateBaseAllocations() {
    return {
      hotels: this.totalBudget * 0.45,
      food: this.totalBudget * 0.25,
      travel: this.totalBudget * 0.15,
      activities: this.totalBudget * 0.15
    };
  }

  // Filter and format hotels strictly within budget
  filterHotelsWithinBudget(hotels) {
    const maxHotelTotalCost = this.allocations.hotels;
    
    return hotels
      .map(hotel => {
        // Fallback for price calculation if missing
        let pricePerNight = hotel.pricePerNight || hotel.price_level ? this._mapPriceLevelToAmount(hotel.price_level) : 3000;
        let totalCost = pricePerNight * this.durationDays;
        
        return {
          ...hotel,
          pricePerNight,
          totalCost,
          isBudgetFriendly: totalCost < (maxHotelTotalCost * 0.7)
        };
      })
      .filter(hotel => hotel.totalCost <= maxHotelTotalCost)
      .sort((a, b) => a.totalCost - b.totalCost); // Show budget options first
  }

  // Filter food options strictly within budget
  filterFoodWithinBudget(foods) {
    const dailyFoodLimit = this.allocations.food / this.durationDays;
    
    return foods
      .map(food => {
        let averagePrice = food.averagePrice || (food.price_level ? this._mapPriceLevelToAmount(food.price_level, true) : 500);
        return {
          ...food,
          averagePrice,
          isBudgetFriendly: averagePrice < (dailyFoodLimit * 0.3) // A single meal should be < 30% of daily budget
        };
      })
      .filter(food => food.averagePrice <= dailyFoodLimit * 0.8) // Can't have a single dish eat 80% of daily food
      .sort((a, b) => a.averagePrice - b.averagePrice);
  }

  // Generate budget state for frontend tracker
  generateBudgetState(spentHotels = 0, spentFood = 0, spentTravel = 0, spentActivities = 0) {
    const totalSpent = spentHotels + spentFood + spentTravel + spentActivities;
    
    return {
      totalBudget: this.totalBudget,
      totalSpent,
      totalRemaining: this.totalBudget - totalSpent,
      allocations: {
        hotels: { maxLimit: this.allocations.hotels, spent: spentHotels, remaining: this.allocations.hotels - spentHotels },
        food: { maxLimit: this.allocations.food, dailyEst: this.allocations.food / this.durationDays, spent: spentFood, remaining: this.allocations.food - spentFood },
        travel: { maxLimit: this.allocations.travel, spent: spentTravel, remaining: this.allocations.travel - spentTravel },
        activities: { maxLimit: this.allocations.activities, spent: spentActivities, remaining: this.allocations.activities - spentActivities }
      }
    };
  }

  // Private helper to map Google Place price level to INR
  _mapPriceLevelToAmount(level, isFood = false) {
    if (isFood) {
      // Food prices
      const foodRanges = [200, 500, 1500, 3000, 6000];
      return foodRanges[level] || 500;
    } else {
      // Hotel prices
      const hotelRanges = [1000, 2500, 5500, 11000, 25000];
      return hotelRanges[level] || 3000;
    }
  }
}

module.exports = SmartBudgetAllocator;
