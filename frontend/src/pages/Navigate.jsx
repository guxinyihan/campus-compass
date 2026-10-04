import { useEffect, useRef, useState } from 'react';
import CampusMap from '../map/CampusMap';
import PoiSearch from '../map/PoiSearch';
import ServiceNotices from '../map/ServiceNotices';
import { routingApi } from '../services/routingApi';
import { identityApi } from '../services/identityApi';
import { useGeolocation } from '../hooks/useGeolocation';
import { useRoute } from '../hooks/useRoute';
import { freshness, useVehicles } from '../hooks/useVehicles';
import { deviationState, haversine, nextInstruction } from '../domain/navigation';

export default function Navigate() {
  const [campus, setCampus] = useState(null);
  const [pois, setPois] = useState([]);
  const [dataError, setDataError] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [vehicleError, setVehicleError] = useState('');
  const [notices, setNotices] = useState([]);
  const [noticeError, setNoticeError] = useState('');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [gps, setGps] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [instructionIndex, setInstructionIndex] = useState(0);
  const [deviation, setDeviation] = useState({ count: 0, offRoute: false });
  const deviationCount = useRef(0);
  const location = useGeolocation(gps);
  const routeState = useRoute();
  const live = useVehicles();

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([routingApi.campus(controller.signal), routingApi.pois(controller.signal)]).then(([data, index]) => {
      if (!controller.signal.aborted) { setCampus(data); setPois(index.pois); }
    }).catch((error) => { if (error.name !== 'AbortError') setDataError(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => {
      identityApi.vehicles(controller.signal).then((data) => { if (!controller.signal.aborted) { setVehicles(data.vehicles); setVehicleError(''); } }).catch((error) => { if (error.name !== 'AbortError') setVehicleError(error.message); });
      identityApi.notices(controller.signal).then((data) => { if (!controller.signal.aborted) { setNotices(data.notices); setNoticeError(''); } }).catch((error) => { if (error.name !== 'AbortError') setNoticeError(error.message); });
    };
    update();
    const timer = setInterval(update, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!navigating || !routeState.route || !gps || !location.position || location.status !== 'allowed') return;
    const position = location.position;
    const next = deviationState(position, routeState.route.geometry.coordinates, deviationCount.current);
    deviationCount.current = next.count;
    setDeviation(next);
    if (position.accuracy <= 50) setInstructionIndex((index) => nextInstruction(routeState.route.instructions, index, position));
  }, [location.position, location.status, navigating, gps, routeState.route]);

  const reset = () => { routeState.clear(); setNavigating(false); setInstructionIndex(0); setDeviation({ count: 0, offRoute: false }); deviationCount.current = 0; };
  const chooseOrigin = (poi) => { setOrigin(poi); setGps(false); reset(); };
  const chooseDestination = (poi) => { setDestination(poi); reset(); };
  const start = gps && location.status === 'allowed' ? location.position : gps ? null : origin;
  const calculate = async (event) => {
    event?.preventDefault();
    if (!start || !destination) return;
    setNavigating(false); setInstructionIndex(0); setDeviation({ count: 0, offRoute: false }); deviationCount.current = 0;
    const result = await routeState.calculate(start, destination);
    if (result) setNavigating(true);
  };
  const endNavigation = () => { setNavigating(false); setGps(false); location.stop(); };
  const route = routeState.route;
  const current = route?.instructions[instructionIndex];
  const nextManeuver = route?.instructions[instructionIndex + 1] || current;
  const distance = gps && location.status === 'allowed' && location.position && nextManeuver ? haversine(location.position, nextManeuver.point) : null;
  return <main className="navigation-layout"><aside className="navigation-panel">
    <div className="section-heading"><span className="eyebrow">Thapar campus</span><h1>Find your way</h1><p className="muted">Search campus places and plan a walking route.</p></div>
    {dataError && <p role="alert" className="error">Campus data unavailable: {dataError}</p>}
    <form onSubmit={calculate} className="route-form">
      <PoiSearch label="Start at a campus place" pois={pois} value={origin} onSelect={chooseOrigin} disabled={routeState.loading} />
      <button type="button" className="secondary" onClick={() => { reset(); setOrigin(null); setGps(!gps); }}>{gps ? 'Stop using my location' : 'Use my browser location'}</button>
      <p className="muted location-message" role="status">{gps ? location.message : 'Your GPS stays in this browser. An explicit route request sends its start to the routing service.'}</p>
      {gps && location.position && location.status === 'allowed' && <p className="accuracy">Approximate accuracy: ±{Math.round(location.position.accuracy)} m</p>}
      {gps && ['denied', 'timeout', 'unavailable'].includes(location.status) && <button type="button" className="text-button" onClick={location.retry}>Retry location</button>}
      <PoiSearch label="Destination" pois={pois} value={destination} onSelect={chooseDestination} disabled={routeState.loading} />
      <button disabled={!start || !destination || routeState.loading}>{routeState.loading ? 'Calculating route…' : 'Calculate walking route'}</button>
    </form>
    {routeState.error && <p role="alert" className="error">{routeState.error}</p>}
    {route && <section className="route-panel" aria-label="Walking directions"><div className="route-summary"><strong>{Math.round(route.distanceMeters)} m</strong><span>About {Math.max(1, Math.round(route.durationSeconds / 60))} min walking</span></div>
      <p className="muted">Walking only. Accessibility conditions have not been verified.</p>
      {current && <div className="current-direction" aria-live="polite"><span className="eyebrow">{navigating ? 'Current direction' : 'Route preview'}</span><strong>{current.text}</strong>{distance !== null && <span>{Math.round(distance)} m to the next maneuver</span>}</div>}
      {deviation.offRoute && navigating && <p role="status" className="warning">You appear to be away from the route. Check your location accuracy and request a route again when ready.</p>}
      <ol className="directions" start={instructionIndex + 1}>{route.instructions.slice(instructionIndex).map((instruction, index) => <li key={index}>{instruction.text}<small>{Math.round(instruction.distanceMeters)} m</small></li>)}</ol>
      <div className="button-row">{navigating && <button className="secondary" onClick={endNavigation}>End navigation</button>}<button className="secondary" disabled={!start || !destination || routeState.loading} onClick={calculate}>Request route again</button></div>
    </section>}
    <section className="vehicles-panel" aria-label="Live shuttles"><div className="section-title"><h2>Campus shuttles</h2><span className="connection">{live.connection}</span></div>
      <p className="muted">Latest public vehicle locations. Demo vehicles are labeled simulated.</p>
      {vehicleError ? <p role="status">Vehicle information is unavailable.</p> : !vehicles.length ? <p className="muted">No active vehicles.</p> : <ul className="vehicle-list">{vehicles.map((vehicle) => {
        const point = live.positions[vehicle.vehicleId];
        const status = freshness(point, live.now, live.staleAfterSeconds, live.ttlSeconds);
        return <li key={vehicle.vehicleId}><div><strong>{vehicle.displayName}</strong><small>{vehicle.code}{vehicle.simulated ? ' · Simulated demo' : ''}</small></div><span className={`status ${status}`}>{status}</span></li>;
      })}</ul>}
    </section>
    <ServiceNotices notices={notices} error={noticeError} />
  </aside><CampusMap campus={campus} route={route} position={gps && location.status === 'allowed' ? location.position : null} destination={destination} vehicles={vehicles} live={live} /></main>;
}
