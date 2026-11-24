// src/common/mappers/entity.mapper.ts
export class EntityMapper {
    static toEntity<T extends object>(
        EntityClass: new () => T,
        data: any,
    ): T {
        const entity = new EntityClass();

        Object.assign(entity, data);

        return entity;
    }

    static toEntities<T extends object>(
        EntityClass: new () => T,
        dataArray: any[],
    ): T[] {
        return dataArray.map((data) =>
            this.toEntity(EntityClass, data),
        );
    }
}
