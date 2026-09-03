import { validateInventoryMovementPayload, validateInventoryProductPayload } from '../../platform/booking-domain.mjs';
import { authenticateAdmin } from '../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../_lib/http.js';
import { logError, logInfo, requestContext } from '../_lib/logging.js';
import { supabaseRequest } from '../_lib/supabase.js';

async function requireAdmin(request, response) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) sendJson(response, 401, { ok: false, error: { code: 'unauthorized', message: 'Accesso scaduto o non autorizzato.' } });
    return admin;
  } catch {
    sendJson(response, 503, { ok: false, error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' } });
    return null;
  }
}

export default async function handler(request, response) {
  const context = requestContext(request, '/api/admin/inventory');
  if (!['GET', 'POST'].includes(request.method)) return rejectMethod(response, ['GET', 'POST']);
  const admin = await requireAdmin(request, response);
  if (!admin) return;

  if (request.method === 'GET') {
    try {
      const rows = await supabaseRequest('/rest/v1/products?select=id,sku,name,unit,stock_quantity,low_stock_threshold,active,updated_at&active=eq.true&order=name.asc');
      return sendJson(response, 200, { ok: true, products: Array.isArray(rows) ? rows : [] });
    } catch (error) {
      logError(context, 'inventory_load_failed', error);
      return sendJson(response, 502, { ok: false, error: { code: 'inventory_unavailable', message: 'Magazzino temporaneamente non disponibile.' } });
    }
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }

  if (body?.action === 'movement') {
    const validation = validateInventoryMovementPayload(body);
    if (!validation.ok) return sendJson(response, 400, { ok: false, error: { code: 'invalid_movement', message: 'Controlla quantità e causale.', fields: validation.errors } });
    try {
      const product = await supabaseRequest('/rest/v1/rpc/admin_record_inventory_movement', {
        method: 'POST',
        body: {
          p_product_id: validation.value.productId,
          p_quantity_delta: validation.value.quantityDelta,
          p_reason: validation.value.reason,
          p_note: validation.value.note || null,
          p_actor_id: admin.id
        }
      });
      logInfo(context, 'inventory_movement_recorded', { reason: validation.value.reason });
      return sendJson(response, 200, { ok: true, product });
    } catch (error) {
      logError(context, 'inventory_movement_failed', error);
      const insufficient = /insufficient_stock/i.test(`${error?.message} ${error?.details}`);
      return sendJson(response, insufficient ? 409 : 502, { ok: false, error: { code: insufficient ? 'insufficient_stock' : 'movement_failed', message: insufficient ? 'La quantità disponibile non è sufficiente.' : 'Movimento non registrato.' } });
    }
  }

  const validation = validateInventoryProductPayload(body);
  if (!validation.ok) return sendJson(response, 400, { ok: false, error: { code: 'invalid_product', message: 'Controlla i dati del prodotto.', fields: validation.errors } });
  try {
    const product = await supabaseRequest('/rest/v1/rpc/admin_upsert_product', {
      method: 'POST',
      body: {
        p_product_id: validation.value.productId || null,
        p_sku: validation.value.sku,
        p_name: validation.value.name,
        p_unit: validation.value.unit,
        p_low_stock_threshold: validation.value.lowStockThreshold,
        p_active: validation.value.active,
        p_actor_id: admin.id
      }
    });
    logInfo(context, 'inventory_product_saved');
    return sendJson(response, validation.value.productId ? 200 : 201, { ok: true, product });
  } catch (error) {
    logError(context, 'inventory_product_failed', error);
    const duplicate = /duplicate|unique/i.test(`${error?.message} ${error?.details}`);
    return sendJson(response, duplicate ? 409 : 502, { ok: false, error: { code: duplicate ? 'duplicate_product' : 'product_failed', message: duplicate ? 'Esiste già un prodotto con questo nome o codice.' : 'Prodotto non salvato.' } });
  }
}
