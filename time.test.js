import test from 'node:test';
import assert from 'node:assert/strict';
import { state, mapSnapshot, timeOptions, distanceKm } from './shared.js';

test('exact time joins preserve coordinates, omit missing and compare only valid latest', () => {
  const before = { ...state };
  try {
    state.data = { places: [{ name: 'A', lat: 37.55, lng: 127, state: 'fresh', mid: 100, usual: { mid: 50 }, forecast_2h: { at: '2026-09-13 15:00', mid: 150 } }, { name: 'B', state: 'missing', mid: null }] };
    state.timeMode = 'forecast';
    assert.deepEqual(timeOptions(), ['2026-09-13 15:00']);
    state.timeAt = timeOptions()[0];
    assert.equal(mapSnapshot().places[0].delta, 50);
    assert.equal(mapSnapshot().places[0].lat, 37.55);
    state.timeAt = 'unavailable';
    assert.equal(mapSnapshot().places.length, 0);
    state.timeMode = 'history';
    state.timeline = { frames: [{ at: '2026-09-13 10:00', places: [{ name: 'A', mid: 50 }, { name: 'B', mid: 20 }] }] };
    state.timeAt = timeOptions()[0];
    assert.equal(mapSnapshot().places[0].delta, -50);
    assert.equal(mapSnapshot().places[1].delta, null);
    state.timeMode = 'usual';
    assert.equal(mapSnapshot().places.length, 1);
    assert.equal(mapSnapshot().places[0].delta, 100);
    assert.equal(distanceKm({lat:37.55,lng:127}, {lat:37.55,lng:127}), 0);
  } finally { Object.assign(state, before); }
});
