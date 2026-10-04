import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Circle, CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { config } from '../config';
import { freshness } from '../hooks/useVehicles';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function Viewport({ campus, route }) {
  const map = useMap();
  useEffect(() => {
    if (route) map.fitBounds(route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), { padding: [32, 32] });
    else if (campus?.bounds) {
      const { south, west, north, east } = campus.bounds;
      map.fitBounds([[south, west], [north, east]], { padding: [12, 12] });
    }
  }, [map, campus, route]);
  return null;
}
Viewport.propTypes = { campus: PropTypes.object, route: PropTypes.object };

export default function CampusMap({ campus, route, position, destination, vehicles, live }) {
  const center = campus?.center || { lat: 30.35445, lng: 76.366245 };
  return <div className="map-frame" aria-label="Campus map"><MapContainer center={[center.lat, center.lng]} zoom={16} scrollWheelZoom className="campus-map">
    <TileLayer url={config.tileUrl} attribution={config.tileAttribution} maxZoom={19} />
    <Viewport campus={campus} route={route} />
    {campus && <GeoJSON data={campus} pointToLayer={(feature, latlng) => L.circleMarker(latlng, { radius: 3, color: '#718096', weight: 1 }).bindTooltip(feature.properties?.name || 'Campus point')} style={{ color: '#718096', weight: 1, fillOpacity: 0.08 }} />}
    {route && <Polyline positions={route.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: '#254dc0', weight: 5 }} />}
    {position && <><Circle center={[position.lat, position.lng]} radius={Math.min(position.accuracy, 500)} pathOptions={{ color: '#254dc0', weight: 1, fillOpacity: 0.08 }} /><CircleMarker center={[position.lat, position.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#254dc0', fillOpacity: 1 }}><Popup>Your browser location · ±{Math.round(position.accuracy)} m</Popup></CircleMarker></>}
    {destination && <CircleMarker center={[destination.lat, destination.lng]} radius={8} pathOptions={{ color: '#6b3287', fillOpacity: 0.9 }}><Popup>{destination.name}</Popup></CircleMarker>}
    {vehicles.map((vehicle) => {
      const point = live.positions[vehicle.vehicleId];
      const status = freshness(point, live.now, live.staleAfterSeconds, live.ttlSeconds);
      return point && status !== 'offline' ? <CircleMarker key={vehicle.vehicleId} center={[point.lat, point.lng]} radius={9} pathOptions={{ color: status === 'live' ? '#167047' : '#967128', fillOpacity: status === 'live' ? 0.9 : 0.4 }}><Popup>{vehicle.displayName} · {status}{vehicle.simulated ? ' · simulated demo' : ''}</Popup></CircleMarker> : null;
    })}
  </MapContainer><span className="map-hint">Walking routes · OpenStreetMap campus data</span></div>;
}
CampusMap.propTypes = { campus: PropTypes.object, route: PropTypes.object, position: PropTypes.object, destination: PropTypes.object, vehicles: PropTypes.array.isRequired, live: PropTypes.object.isRequired };
