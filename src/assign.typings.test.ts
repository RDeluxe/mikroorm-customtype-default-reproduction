import { MikroORM, PostgreSqlDriver, wrap } from '@mikro-orm/postgresql';
import { CalendarEvent, Station, EventOccurrence } from './entities';

const fullRelations = ['stations', 'occurrences'] as const

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    driver: PostgreSqlDriver,
    dbName: 'postgres',
    user: 'postgres',
    password: 'password',
    port: 5477,
    entities: [CalendarEvent, Station, EventOccurrence],
    // debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

beforeEach(async () => {
  await orm.schema.refreshDatabase();

  orm.em.clear();

  const station1 = new Station();
  station1.name = 'Nantes';
  station1.position = { latitude: 1, longitude: 1 };
  orm.em.persist(station1);

  const station2 = new Station();
  station2.name = 'Paris';
  station2.position = { latitude: 2, longitude: 2 };
  orm.em.persist(station2);

  const event = new CalendarEvent();
  event.id = 1;
  event.name = 'Event 1';
  event.stations.add(station1);
  orm.em.persist(event);

  await orm.em.flush();

  orm.em.clear();
});


// 🚨 passes, but the typings are failing
test('assign with PK', async () => {
  const ev = await orm.em.findOneOrFail(CalendarEvent, { id: 1 });

  // The typings are failing here, even if the payload is valid
  wrap(ev).assign({
    // @ts-ignore
    stations: ["Nantes", "Paris"],
    occurrences: [{ start: new Date('2025-01-01') }]
  });

  await orm.em.flush();

  expect(ev.stations.length).toBe(2);
  expect(ev.stations.getItems().map(s => s.name)).toEqual(["Nantes", "Paris"]);
  expect(ev.occurrences.length).toBe(1);
  expect(ev.occurrences.getItems().map(o => o.start)).toEqual([new Date('2025-01-01')]);
});

// 🚨 passes, but the typings are failing
test('assign with objects', async () => {
  const ev = await orm.em.findOneOrFail(CalendarEvent, { id: 1 }, { populate: fullRelations });

  // The typings are still failing here, even if the payload is valid
  wrap(ev).assign({
    // @ts-ignore
    stations: ["Nantes", { name: "Bruxelles", position: { latitude: 1, longitude: 1 } }]
  });

  await orm.em.flush();

  expect(ev.stations.length).toBe(2);
  expect(ev.stations.getItems().map(s => s.name)).toEqual(["Nantes", "Bruxelles"]);
});

// 🚨 passes, but the typings are failing
test('mixing PK and objects', async () => {
  const ev = await orm.em.findOneOrFail(CalendarEvent, { id: 1 }, { populate: fullRelations });

  // The typings are still failing here, even if the payload is valid
  wrap(ev).assign({
    // @ts-ignore
    stations: ['Nantes', 'Paris'],
    occurrences: [{ start: new Date('2025-01-01') }],
  })

  await orm.em.flush();

  expect(ev.stations.length).toBe(2);
  expect(ev.stations.getItems().map(s => s.name)).toEqual(["Nantes", "Paris"]);
  expect(ev.occurrences.length).toBe(1);
  expect(ev.occurrences.getItems().map(o => o.start)).toEqual([new Date('2025-01-01')]);
})


// ❌ Fails (expected, but the typings are passing)
test('valid typescript types', async () => {
  const ev = await orm.em.findOneOrFail(CalendarEvent, { id: 1 }, { populate: fullRelations });

  // This makes TS happy, but will fail at runtime
  wrap(ev).assign({
    stations: [{ name: 'Nantes' }, { name: 'Paris' }, { name: 'Lyon' }],
    occurrences: [{ start: new Date('2025-01-01') }],
  })

  await orm.em.flush();

  expect(ev.stations.length).toBe(2);
  expect(ev.stations.getItems().map(s => s.name)).toEqual(["Nantes", "Paris"]);
  expect(ev.occurrences.length).toBe(1);
  expect(ev.occurrences.getItems().map(o => o.start)).toEqual([new Date('2025-01-01')]);
})

// ❌ Fails (expected, but the typings are passing)
test('valid typescript enum types', async () => {
  const ev = await orm.em.findOneOrFail(CalendarEvent, { id: 1 }, { populate: fullRelations });

  // This makes TS happy, but will fail at runtime
  // Invalid collection values provided for 'CalendarEvent.stations' in CalendarEvent.assign(): [ [ 'Nantes' ], [ 'Paris' ] ]
  wrap(ev).assign({
    stations: [['Nantes'], ['Paris']],
    occurrences: [{ start: new Date('2025-01-01') }],
  })

  await orm.em.flush();

  expect(ev.stations.length).toBe(2);
  expect(ev.stations.getItems().map(s => s.name)).toEqual(["Nantes", "Paris"]);
  expect(ev.occurrences.length).toBe(1);
  expect(ev.occurrences.getItems().map(o => o.start)).toEqual([new Date('2025-01-01')]);
})