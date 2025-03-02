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

// ✅ Works
test('re-assign with same object', async () => {
  const ev = await orm.em.findOneOrFail(CalendarEvent, { id: 1 }, { populate: fullRelations });

  // This works as expected, as long as there is only one object in the collection it seems to work
  wrap(ev).assign({
    stations: [{ name: "Nantes", position: { latitude: 1, longitude: 1 } }]
  });

  await orm.em.flush();

  expect(ev.stations.length).toBe(1);
  expect(ev.stations.getItems().map(s => s.name)).toEqual(["Nantes"]);
});

// ❌ Fails
test('re-assign with same objects', async () => {
  const ev = await orm.em.findOneOrFail(CalendarEvent, { id: 1 }, { populate: fullRelations });

  // This fails, saying that "Paris" is a duplicate key (despite name being a PK and the relations being populated)
  // The generated query is an INSERT `insert into "station" ("name", "position") values ('Paris', 'SRID=4326;POINT(2 2)'::geometry)`
  wrap(ev).assign({
    stations: [
      { name: "Nantes", position: { latitude: 1, longitude: 1 } },
      { name: "Paris", position: { latitude: 2, longitude: 2 } }]
  });

  await orm.em.flush();

  expect(ev.stations.length).toBe(2);
  expect(ev.stations.getItems().map(s => s.name)).toEqual(["Nantes", "Paris"]);
  expect(ev.stations.getItems().map(s => s.position)).toEqual([{ latitude: 1, longitude: 1 }, { latitude: 2, longitude: 2 }]);
});

// ❌ Fails
test('re-assign with different objects (position change)', async () => {
  const ev = await orm.em.findOneOrFail(CalendarEvent, { id: 1 }, { populate: fullRelations });

  // This fails, saying that "Paris" is a duplicate key (despite name being a PK and the relations being populated)
  // The generated query is an INSERT `insert into "station" ("name", "position") values ('Paris', 'SRID=4326;POINT(2 2)'::geometry)`
  wrap(ev).assign({
    stations: [
      { name: "Nantes", position: { latitude: 4, longitude: 4 } },
      { name: "Paris", position: { latitude: 3, longitude: 3 } }]
  });

  await orm.em.flush();

  expect(ev.stations.length).toBe(2);
  expect(ev.stations.getItems().map(s => s.name)).toEqual(["Nantes", "Paris"]);
  expect(ev.stations.getItems().map(s => s.position)).toEqual([{ latitude: 4, longitude: 4 }, { latitude: 3, longitude: 3 }]);
});