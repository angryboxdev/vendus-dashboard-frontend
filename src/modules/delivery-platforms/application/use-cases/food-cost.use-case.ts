import type { FoodCost, ProductMappingChange } from "../../domain/entities/food-cost.ts";
import type { GetFoodCostPort, SaveProductMappingsPort } from "../../domain/ports/in/food-cost.port.ts";
import type { DeliveryPlatformsApiPort } from "../../domain/ports/out/delivery-platforms-api.port.ts";

export class GetFoodCostUseCase implements GetFoodCostPort {
  private readonly api: DeliveryPlatformsApiPort;

  constructor(api: DeliveryPlatformsApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<FoodCost> {
    return this.api.getFoodCost(year, month);
  }
}

export class SaveProductMappingsUseCase implements SaveProductMappingsPort {
  private readonly api: DeliveryPlatformsApiPort;

  constructor(api: DeliveryPlatformsApiPort) {
    this.api = api;
  }

  execute(changes: ProductMappingChange[]): Promise<void> {
    return changes.length === 0 ? Promise.resolve() : this.api.saveProductMappings(changes);
  }
}
