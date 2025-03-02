import {
    Entity,
    MikroORM,
    PrimaryKey, Property, PostgreSqlDriver, Collection, OneToMany, ManyToMany, Cascade, PrimaryKeyProp, ManyToOne,
    wrap,
    Type
} from '@mikro-orm/postgresql';

interface PointDTO {
    latitude: number
    longitude: number
}

export class PointType extends Type<
    PointDTO | undefined,
    string | undefined
> {
    convertToDatabaseValue(value?: PointDTO): string | undefined {
        if (!value)
            return undefined

        return `SRID=4326;POINT(${value.longitude} ${value.latitude})`
    }

    convertToJSValue(value?: string): PointDTO | undefined {
        const m = value?.match(/point\((-?\d+(\.\d+)?) (-?\d+(\.\d+)?)\)/i)

        if (!m)
            return undefined

        return { latitude: +m[1], longitude: +m[3] }
    }

    convertToJSValueSQL(key: string) {
        return `ST_AsText(${key})`
    }

    convertToDatabaseValueSQL(key: string) {
        return `${key}::geometry`
    }

    getColumnType(): string {
        return 'geometry'
    }
}


@Entity()
export class CalendarEvent {
    @PrimaryKey()
    id!: number

    @Property()
    name!: string
    @OneToMany(() => EventOccurrence, occurrence => occurrence.event, { cascade: [Cascade.ALL], orphanRemoval: true })
    occurrences = new Collection<EventOccurrence>(this)

    @ManyToMany(() => Station)
    stations = new Collection<Station>(this)
}

@Entity()
export class Station {
    @PrimaryKey({ type: 'text' })
    name!: string

    @Property({ type: PointType })
    position!: PointDTO

    @ManyToMany(() => CalendarEvent, event => event.stations)
    events = new Collection<CalendarEvent>(this);

    // this is needed for proper type checks in `FilterQuery`
    [PrimaryKeyProp]?: ['name']
}

@Entity()
export class EventOccurrence {
    @ManyToOne({ primary: true })
    event!: CalendarEvent

    @Property({ primary: true })
    start!: Date

    @Property({ nullable: true })
    end: Date | null = null;

    // this is needed for proper type checks in `FilterQuery`
    [PrimaryKeyProp]?: ['event', 'start']
}
