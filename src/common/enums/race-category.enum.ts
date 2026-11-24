export enum RaceCategory {
    KM_1_5 = '1.5 KM',
    KM_3 = '3 KM',
    KM_5 = '5 KM',
}

export enum RaceAmount {
    KM_1_5 = 350,
    KM_3 = 350,
    KM_5 = 400,
}

export const RaceCategoryAmountMap: Record<string, number> = {
    [RaceCategory.KM_1_5]: RaceAmount.KM_1_5,
    [RaceCategory.KM_3]: RaceAmount.KM_3,
    [RaceCategory.KM_5]: RaceAmount.KM_5,
    // Mapping for raw inputs provided in the request
    '1.5KM': RaceAmount.KM_1_5,
    '5KM': RaceAmount.KM_5,
    '3KM': RaceAmount.KM_3,
};
