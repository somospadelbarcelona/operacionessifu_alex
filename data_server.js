/**
 * SIFU BARCELONA (0801) — Data Server API (Servidor de Datos Local)
 * ========================================================
 * Sirve los datos JSON pesados con paginación, filtrado y compresión.
 * Reemplaza la carga de archivos .js estáticos de 12+ MB.
 * 
 * Endpoints:
 *   GET /api/data/master          → INITIAL_MASTER_DATA (~290 KB)
 *   GET /api/data/fichajes        → FICHAJES_RAW_PAYLOAD (~550 KB)
 *   GET /api/data/contraste       → FICHAJES_CONTRASTE_PAYLOAD (~3.5 MB)
 *   GET /api/data/contraste/kpis  → Solo KPIs del contraste (< 1 KB)
 *   GET /api/data/contraste/trabajador/:nombre → Datos de 1 trabajador
 *   GET /api/data/carteras        → HO_CARTERAS_PAYLOAD (~2 MB)
 *   GET /api/data/carteras/gestor/:id → Datos de 1 gestor + sus proyectos
 *   GET /api/data/vacaciones       → HO_VACACIONES_PAYLOAD (~1.2 MB)
 *   GET /api/data/vacaciones/kpis  → Solo KPIs de vacaciones (< 1 KB)
 *   GET /api/data/supervisor       → SUPERVISOR_SNAPSHOT (~360 KB)
 *   GET /api/data/orders           → INITIAL_ORDERS_DATA (~90 KB)
 *   GET /api/data/timestamp/:dataset → Timestamp de última actualización
 * 
 * Query params universales:
 *   ?page=1&limit=50  → Paginación
 *   ?search=MALIKA    → Búsqueda global
 *   ?fields=nombre,estado  → Selección de campos (reduce payload)
 * 
 * Uso: bun data_server.js  o  node data_server.js
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { createServer } from 'http';
import { gzipSync } from 'zlib';

const PORT = 3001;
const BASE_DIR = import.meta.dir || process.cwd();

// ─── Cache en memoria con timestamps ───────────────────────────────────────────
const dataCache = {};
const fileMeta = {};

function loadJsonFile(filename) {
    const filepath = join(BASE_DIR, filename);
    if (!existsSync(filepath)) return null;
    
    const stat = statSync(filepath);
    const mtime = stat.mtimeMs;
    
    // Solo recargar si el archivo cambió
    if (dataCache[filename] && fileMeta[filename] === mtime) {
        return dataCache[filename];
    }
    
    try {
        let raw = readFileSync(filepath, 'utf8');
        
        // Extraer JSON de archivos .js (window.VARIABLE = {...};)
        if (filename.endsWith('.js')) {
            const match = raw.match(/(?:window\.\w+|const \w+|var \w+)\s*=\s*(\{[\s\S]*\}|\[[\s\S]*\]);?\s*$/);
            if (match) {
                raw = match[1].replace(/;$/, '');
            }
        }
        
        dataCache[filename] = JSON.parse(raw);
        fileMeta[filename] = mtime;
        console.log(`📦 Cargado: ${filename} (${(stat.size / 1024).toFixed(0)} KB)`);
        return dataCache[filename];
    } catch (e) {
        console.error(`❌ Error cargando ${filename}:`, e.message);
        return null;
    }
}

// ─── Mapeo de datasets a archivos fuente ────────────────────────────────────────
const DATASET_MAP = {
    master:       { file: 'bcn_data.json',                      fallback: 'master_data.js',           key: null },
    fichajes:     { file: 'fichajes_bcn.json',                  fallback: 'fichajes_data.js',         key: null },
    contraste:    { file: 'fichajes_contraste_bcn.json',        fallback: 'fichajes_contraste_data.js', key: null },
    carteras:     { file: 'ho_carteras_cache.json',             fallback: 'ho_carteras_data.js',      key: null },
    vacaciones:   { file: 'ho_vacaciones_cache.json',           fallback: 'ho_vacaciones_data.js',    key: null },
    supervisor:   { file: 'supervisor_log_live.json',           fallback: 'supervisor_data.js',       key: null },
    orders:       { file: 'orders_data.js',                     fallback: null,                       key: null },
    cuadrantes:   { file: 'ho_cuadrantes_cache.json',           fallback: null,                       key: null },
    employees:    { file: 'ho_employees_cache.json',            fallback: null,                       key: null },
};

function getDataset(name) {
    const config = DATASET_MAP[name];
    if (!config) return null;
    
    let data = loadJsonFile(config.file);
    if (!data && config.fallback) {
        data = loadJsonFile(config.fallback);
    }
    return data;
}

// ─── Utilidades de filtrado y paginación ────────────────────────────────────────
function applySearch(arr, search) {
    if (!search || !Array.isArray(arr)) return arr;
    const lower = search.toLowerCase();
    return arr.filter(item => 
        JSON.stringify(item).toLowerCase().includes(lower)
    );
}

function applyPagination(arr, page, limit) {
    if (!Array.isArray(arr)) return arr;
    const start = (page - 1) * limit;
    return {
        data: arr.slice(start, start + limit),
        pagination: {
            page,
            limit,
            total: arr.length,
            totalPages: Math.ceil(arr.length / limit),
            hasNext: start + limit < arr.length,
            hasPrev: page > 1
        }
    };
}

function selectFields(data, fields) {
    if (!fields || !Array.isArray(data)) return data;
    const fieldList = fields.split(',').map(f => f.trim());
    return data.map(item => {
        const filtered = {};
        fieldList.forEach(f => {
            if (item[f] !== undefined) filtered[f] = item[f];
        });
        return filtered;
    });
}

// ─── Servidor HTTP ──────────────────────────────────────────────────────────────
const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;
    const params = url.searchParams;
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Solo GET
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
    }
    
    // Health check
    if (path === '/api/data/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            datasets: Object.keys(DATASET_MAP),
            cached: Object.keys(dataCache),
            uptime: process.uptime()
        }));
        return;
    }
    
    // Timestamp de un dataset
    const tsMatch = path.match(/^\/api\/data\/timestamp\/(\w+)$/);
    if (tsMatch) {
        const config = DATASET_MAP[tsMatch[1]];
        if (!config) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Dataset not found' }));
            return;
        }
        const filepath = join(BASE_DIR, config.file);
        if (!existsSync(filepath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }
        const stat = statSync(filepath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            dataset: tsMatch[1], 
            lastModified: stat.mtime.toISOString(),
            sizeKB: Math.round(stat.size / 1024)
        }));
        return;
    }
    
    // ─── Rutas de datos ─────────────────────────────────────────────────────────
    
    // Contraste: solo KPIs (< 1 KB en vez de 3.5 MB)
    if (path === '/api/data/contraste/kpis') {
        const data = getDataset('contraste');
        if (!data) { res.writeHead(404); res.end('{}'); return; }
        const { kpis, sync_salud, fecha_sincronizacion, total_trabajadores, mes_actual } = data;
        sendJson(res, req, { kpis, sync_salud, fecha_sincronizacion, total_trabajadores, mes_actual });
        return;
    }
    
    // Contraste: datos de un trabajador específico
    const trabajadorMatch = path.match(/^\/api\/data\/contraste\/trabajador\/(.+)$/);
    if (trabajadorMatch) {
        const data = getDataset('contraste');
        if (!data || !data.trabajadores) { res.writeHead(404); res.end('{}'); return; }
        const nombre = decodeURIComponent(trabajadorMatch[1]).toUpperCase();
        const trabajador = data.trabajadores.find(t => t.nombre.toUpperCase() === nombre);
        sendJson(res, req, trabajador || null);
        return;
    }
    
    // Carteras: KPIs de un gestor
    const gestorMatch = path.match(/^\/api\/data\/carteras\/gestor\/(.+)$/);
    if (gestorMatch) {
        const data = getDataset('carteras');
        if (!data || !data.gestores) { res.writeHead(404); res.end('{}'); return; }
        const gestorId = decodeURIComponent(gestorMatch[1]);
        const gestor = data.gestores.find(g => g.id === gestorId);
        if (!gestor) { res.writeHead(404); res.end('{}'); return; }
        // Incluir proyectos del gestor
        const proyectos = (data.proyectos || []).filter(p => p.gestor_id === gestorId);
        sendJson(res, req, { gestor, proyectos, total_proyectos: proyectos.length });
        return;
    }
    
    // Vacaciones: solo KPIs
    if (path === '/api/data/vacaciones/kpis') {
        const data = getDataset('vacaciones');
        if (!data) { res.writeHead(404); res.end('{}'); return; }
        const { kpis, timestamp, responsable } = data;
        sendJson(res, req, { kpis, timestamp, responsable });
        return;
    }
    
    // Datasets genéricos
    const dataMatch = path.match(/^\/api\/data\/(\w+)$/);
    if (dataMatch && DATASET_MAP[dataMatch[1]]) {
        const datasetName = dataMatch[1];
        let data = getDataset(datasetName);
        
        if (!data) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Dataset '${datasetName}' not found` }));
            return;
        }
        
        // Si el dato tiene un array principal, aplicar filtros
        const search = params.get('search');
        const page = parseInt(params.get('page')) || 0;
        const limit = parseInt(params.get('limit')) || 0;
        const fields = params.get('fields');
        
        // Determinar el array principal para filtrar/paginar
        let mainArray = null;
        let wrapperKey = null;
        
        if (Array.isArray(data)) {
            mainArray = data;
        } else if (data.trabajadores) {
            mainArray = data.trabajadores;
            wrapperKey = 'trabajadores';
        } else if (data.fichajes) {
            mainArray = data.fichajes;
            wrapperKey = 'fichajes';
        } else if (data.proyectos) {
            mainArray = data.proyectos;
            wrapperKey = 'proyectos';
        }
        
        if (mainArray) {
            if (search) mainArray = applySearch(mainArray, search);
            if (fields) mainArray = selectFields(mainArray, fields);
            
            if (page > 0 && limit > 0) {
                const paginated = applyPagination(mainArray, page, limit);
                if (wrapperKey) {
                    // Preservar metadatos del wrapper, reemplazar solo el array
                    const response = { ...data };
                    response[wrapperKey] = paginated.data;
                    response._pagination = paginated.pagination;
                    sendJson(res, req, response);
                } else {
                    sendJson(res, req, paginated);
                }
            } else {
                if (wrapperKey) {
                    const response = { ...data };
                    response[wrapperKey] = mainArray;
                    sendJson(res, req, response);
                } else {
                    sendJson(res, req, mainArray);
                }
            }
        } else {
            sendJson(res, req, data);
        }
        return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        error: 'Not Found',
        availableEndpoints: [
            '/api/data/health',
            '/api/data/master',
            '/api/data/fichajes',
            '/api/data/contraste',
            '/api/data/contraste/kpis',
            '/api/data/contraste/trabajador/:nombre',
            '/api/data/carteras',
            '/api/data/carteras/gestor/:id',
            '/api/data/vacaciones',
            '/api/data/vacaciones/kpis',
            '/api/data/supervisor',
            '/api/data/orders',
            '/api/data/timestamp/:dataset'
        ]
    }));
});

// ─── Enviar JSON comprimido ─────────────────────────────────────────────────────
function sendJson(res, req, data) {
    const json = JSON.stringify(data);
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    // ETag para caché del navegador
    const etag = `"${Buffer.byteLength(json).toString(36)}-${Date.now().toString(36)}"`;
    
    if (req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        res.end();
        return;
    }
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=30'); // 30s cache
    
    // Comprimir si el cliente lo soporta y el payload es > 1 KB
    if (acceptEncoding.includes('gzip') && json.length > 1024) {
        const compressed = gzipSync(json);
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('X-Original-Size', json.length);
        res.setHeader('X-Compressed-Size', compressed.length);
        res.writeHead(200);
        res.end(compressed);
    } else {
        res.writeHead(200);
        res.end(json);
    }
}

// ─── Precarga de datasets críticos ──────────────────────────────────────────────
console.log('');
console.log('⚡ SIFU BARCELONA (0801) — Data Server API');
console.log('═══════════════════════════════════════════');

// Precargar todos los datasets al inicio
for (const [name, config] of Object.entries(DATASET_MAP)) {
    const data = getDataset(name);
    if (data) {
        const size = JSON.stringify(data).length;
        console.log(`  ✅ ${name}: ${(size / 1024).toFixed(0)} KB en memoria`);
    } else {
        console.log(`  ⚠️ ${name}: archivo no encontrado`);
    }
}

server.listen(PORT, () => {
    console.log('');
    console.log(`🚀 Servidor de datos corriendo en: http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/data/health`);
    console.log('');
});
