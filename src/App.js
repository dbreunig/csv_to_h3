import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polygon } from 'react-leaflet';
import * as h3 from 'h3-js';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function isValidNumber(str) {
  // Remove leading/trailing whitespace
  str = str.trim();
  
  // Check if the string is empty after trimming
  if (str === '') return false;
  
  // Use a regular expression to check for a valid number format
  const numberPattern = /^-?\d*\.?\d+$/;
  
  return numberPattern.test(str) && !isNaN(parseFloat(str));
}

const calculateH3CellStats = (data, resolution) => {
  const cellCounts = {};
  data.forEach(row => {
    const cell = h3.latLngToCell(parseFloat(row.lat), parseFloat(row.lon), resolution);
    cellCounts[cell] = (cellCounts[cell] || 0) + 1;
  });

  const counts = Object.values(cellCounts);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const avg = counts.reduce((sum, count) => sum + count, 0) / counts.length;

  return { min, max, avg: avg.toFixed(2) };
};

const H3CellStatsReport = ({ data, resolution }) => {
  const stats = useMemo(() => calculateH3CellStats(data, resolution), [data, resolution]);

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded">
      <h2 className="text-lg font-semibold mb-2">H3 Cell Statistics (Resolution {resolution})</h2>
      <p><strong>Minimum points in a cell:</strong> {stats.min}</p>
      <p><strong>Maximum points in a cell:</strong> {stats.max}</p>
      <p><strong>Average points per cell:</strong> {stats.avg}</p>
    </div>
  );
};

const H3Cells = ({ data, resolution }) => {
  const cells = useMemo(() => {
    const uniqueCells = new Set();
    data.forEach(row => {
      const cell = h3.latLngToCell(parseFloat(row.lat), parseFloat(row.lon), resolution);
      uniqueCells.add(cell);
    });
    return Array.from(uniqueCells);
  }, [data, resolution]);

  return (
    <>
      {cells.map(cellId => {
        const vertices = h3.cellToBoundary(cellId);
        return (
          <Polygon 
            key={cellId}
            positions={vertices}
            pathOptions={{ color: 'blue', weight: 1, fillOpacity: 0.1 }}
          />
        );
      })}
    </>
  );
};

const AggregationSettings = ({ numericColumns, aggregationSettings, setAggregationSettings }) => {
  const aggregateFunctions = ['sum', 'mean', 'median', 'max', 'min', 'count'];

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded">
      <h2 className="text-lg font-semibold mb-2">Aggregation Settings</h2>
      {numericColumns.map(column => (
        <div key={column} className="mb-2">
          <label className="block">{column}:</label>
          <select
            value={aggregationSettings[column] || ''}
            onChange={(e) => setAggregationSettings(prev => ({ ...prev, [column]: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value="">Select function</option>
            {aggregateFunctions.map(func => (
              <option key={func} value={func}>{func}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};


L.Marker.prototype.options.icon = DefaultIcon;

const App = () => {
  const [csvData, setCsvData] = useState(null);
  const [h3Resolution, setH3Resolution] = useState(7);
  const [includeCoordinates, setIncludeCoordinates] = useState(true);
  const [mapCenter, setMapCenter] = useState([0, 0]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [aggregationSettings, setAggregationSettings] = useState({});
  const [showAggregationSettings, setShowAggregationSettings] = useState(false);


  const removePoint = (index) => {
    setCsvData(prevData => {
      const newData = [...prevData];
      newData.splice(index, 1);
      return newData;
    });
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    Papa.parse(file, {
      complete: (results) => {
        if (results.data.length > 0 && results.data[0].hasOwnProperty('lat') && results.data[0].hasOwnProperty('lon')) {
          const validData = results.data.filter(row => 
            !isNaN(parseFloat(row.lat)) && !isNaN(parseFloat(row.lon))
          );
          
          if (validData.length > 0) {
            setCsvData(validData);
            setMapCenter([parseFloat(validData[0].lat), parseFloat(validData[0].lon)]);

            // Determine numeric columns
            const numCols = Object.keys(validData[0]).filter(key => 
              key !== 'lat' && key !== 'lon' && isValidNumber(validData[0][key])
            );
            setNumericColumns(numCols);
          } else {
            alert('No valid lat/lon pairs found in the CSV');
          }
        } else {
          alert('CSV must contain at least "lat" and "lon" columns');
        }
      },
      header: true,
    });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const exportCsv = (aggregate) => {
    if (!csvData) return;

    let exportData;
    if (aggregate) {
      const grouped = {};
      csvData.forEach(row => {
        const h3Index = h3.latLngToCell(parseFloat(row.lat), parseFloat(row.lon), h3Resolution);
        if (!grouped[h3Index]) {
          grouped[h3Index] = [];
        }
        grouped[h3Index].push(row);
      });

      exportData = Object.entries(grouped).map(([h3Index, rows]) => {
        const aggregated = { h3Index };
        numericColumns.forEach(column => {
          const func = aggregationSettings[column];
          if (func) {
            const values = rows.map(row => parseFloat(row[column]));
            switch (func) {
              case 'sum':
                aggregated[column] = values.reduce((a, b) => a + b, 0);
                break;
              case 'mean':
                aggregated[column] = values.reduce((a, b) => a + b, 0) / values.length;
                break;
              case 'median':
                const sorted = values.sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                aggregated[column] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                break;
              case 'max':
                aggregated[column] = Math.max(...values);
                break;
              case 'min':
                aggregated[column] = Math.min(...values);
                break;
              case 'count':
                aggregated[column] = values.length;
                break;
            }
          }
        });
        return aggregated;
      });
    } else {
      exportData = csvData.map(row => {
        const h3Index = h3.latLngToCell(parseFloat(row.lat), parseFloat(row.lon), h3Resolution);
        const newRow = { ...row, h3Index };
        if (!includeCoordinates) {
          delete newRow.lat;
          delete newRow.lon;
        }
        return newRow;
      });
    }

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'export.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">CSV to H3</h1>
      <div className="mb-4">
        <p>Upload a CSV file containing <b>lat</b> and <b>lon</b> columns to visualize the data on a map. H3 cells will be calculated for each point, and you can adjust the tile resolution to select the tile you'd like appended to your records or the appropriate level of aggregation.</p>
        <p className="mt-4 mb-6">This tool is by <a href="https://www.dbreunig.com/" className="underline decoration-1 decoration-slate-200 underline-offset-4 hover:decoration-2 hover:decoration-blue-400 cursor-pointer">Drew Breunig</a>. <a href="https://www.dbreunig.com/contact.html" className="underline decoration-1 decoration-slate-200 underline-offset-4 hover:decoration-2 hover:decoration-blue-400 cursor-pointer">Shoot me a note</a> if you have questions or comments.</p>
      </div>
      <div {...getRootProps()} className="border-2 border-dashed border-gray-300 p-4 mb-4 cursor-pointer">
        <input {...getInputProps()} />
        <p>Drag 'n' drop a CSV file here, or click to select one</p>
      </div>
      {csvData && (
        <>
          <MapContainer center={[csvData[0].lat, csvData[0].lon]} zoom={13} style={{ height: '400px', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <H3Cells data={csvData} resolution={h3Resolution} />
              {csvData.map((row, index) => {
                const lat = parseFloat(row.lat);
                const lon = parseFloat(row.lon);
                return !isNaN(lat) && !isNaN(lon) ? (
                  <CircleMarker 
                  key={index} 
                  center={[lat, lon]} 
                  radius={5} 
                  fillColor="red" 
                  color="black" 
                  weight={1} 
                  opacity={1} 
                  fillOpacity={0.8}
                >
                  <Popup>
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key}><strong>{key}:</strong> {value}</div>
                    ))}
                    <button 
                      onClick={() => removePoint(index)} 
                      className="mt-2 bg-red-500 text-white px-2 py-1 rounded"
                    >
                      Remove Point
                    </button>
                  </Popup>
                </CircleMarker>
              ) : null;
            })}
          </MapContainer>
          <div className="my-4">
            <label htmlFor="h3-resolution" className="block mb-2">H3 Resolution: {h3Resolution}</label>
            <input
              type="range"
              id="h3-resolution"
              min="0"
              max="15"
              value={h3Resolution}
              onChange={(e) => setH3Resolution(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeCoordinates}
                onChange={(e) => setIncludeCoordinates(e.target.checked)}
                className="mr-2"
              />
              Include coordinates
            </label>
          </div>
          <button onClick={() => exportCsv(false)} className="bg-blue-500 text-white px-4 py-2 rounded">
            Export CSV
          </button>
          <button onClick={() => setShowAggregationSettings(!showAggregationSettings)} className="ml-2 bg-green-500 text-white px-4 py-2 rounded">
            {showAggregationSettings ? 'Hide Aggregation Settings' : 'Show Aggregation Settings'}
          </button>
          {showAggregationSettings && (
            <>
              <AggregationSettings 
                numericColumns={numericColumns}
                aggregationSettings={aggregationSettings}
                setAggregationSettings={setAggregationSettings}
              />
              <button onClick={() => exportCsv(true)} className="mt-4 bg-purple-500 text-white px-4 py-2 rounded">
                Export Aggregated CSV
              </button>
            </>
          )}
          <H3CellStatsReport data={csvData} resolution={h3Resolution} />
        </>
      )}
    </div>
  );
};

export default App;