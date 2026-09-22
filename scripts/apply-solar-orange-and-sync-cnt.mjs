import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ...(connectionString.includes(".supabase.co") || connectionString.includes(".pooler.supabase.com")
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Actualizar Solar Orange en warehouse_product a 4 cajas (168 uds)
    const updateRes = await client.query(`
      UPDATE warehouse_product
      SET cajas = 4, unidades_sueltas = 0, cantidad = 168, updated_at = NOW()
      WHERE codigo = '10935'
      RETURNING id, codigo, nombre, marca, color, capacidad, cajas, unidades_por_caja, cantidad
    `);
    console.log('Updated Solar Orange in warehouse_product:', updateRes.rows[0]);

    // Registrar en audit_log
    const adminUser = await client.query("SELECT id FROM \"user\" WHERE role_code = 'ADMIN' LIMIT 1");
    const userId = adminUser.rows[0]?.id;
    if (userId) {
      await client.query(`
        INSERT INTO audit_log (id, user_id, action, module, entity_type, entity_id, after_data, created_at)
        VALUES (gen_random_uuid()::text, $1, 'warehouse_product.update', 'almacen', 'warehouse_product', $2, $3, NOW())
      `, [
        userId,
        updateRes.rows[0].id,
        JSON.stringify({
          code: '10935',
          name: 'A50CS',
          color: 'Solar Orange',
          boxes: 4,
          looseUnits: 0,
          totalUnits: 168,
          notes: 'Ajuste de 84 unidades (2 cajas) que no fueron llevadas',
        }),
      ]);
      console.log('Audit log entry created for Solar Orange adjustment');
    }

    // 2. Obtener el conteo CNT-20260921-003
    const countRes = await client.query("SELECT id, count_number, status FROM stock_count WHERE count_number = 'CNT-20260921-003'");
    if (countRes.rows.length === 0) {
      throw new Error('No se encontró el conteo CNT-20260921-003');
    }
    const countId = countRes.rows[0].id;

    // Obtener items actuales del conteo
    const itemsRes = await client.query("SELECT * FROM stock_count_item WHERE count_id = $1", [countId]);
    const currentItems = itemsRes.rows;
    console.log(`Current items in CNT-20260921-003: ${currentItems.length}`);

    // Obtener todos los productos activos de almacén
    const wpRes = await client.query("SELECT * FROM warehouse_product WHERE status = 'ACTIVE'");
    const warehouseProducts = wpRes.rows;
    console.log(`Active warehouse products: ${warehouseProducts.length}`);

    const warehouseInfoList = warehouseProducts.map((p) => {
      const brand = p.marca ? `${p.marca} ` : "";
      const name = p.nombre || "";
      const color = p.color ? ` ${p.color}` : "";
      const capacity = p.capacidad ? ` ${p.capacidad}` : "";
      const fullName = `${brand}${name}${color}${capacity}`.replace(/\s+/g, " ").trim();
      const expectedUnits = (p.cajas || 0) * (p.unidades_por_caja || 1) + (p.unidades_sueltas || 0);
      const notes = p.cajas > 0 ? `${p.cajas} cajas (${p.unidades_por_caja} c/u) + ${p.unidades_sueltas || 0} sueltas` : "";

      return {
        product: p,
        code: (p.codigo || "").trim(),
        codeUpper: (p.codigo || "").trim().toUpperCase(),
        fullName,
        normalizedDesc: fullName.toLowerCase().replace(/\s+/g, " "),
        expectedUnits,
        notes,
      };
    });

    const matchedCodes = new Set();
    const matchedIds = new Set();

    const updatedItems = currentItems.map((item) => {
      const itemCode = (item.code || "").trim().toUpperCase();
      const itemDesc = (item.description || "").toLowerCase().replace(/\s+/g, " ").trim();

      const matched = warehouseInfoList.find((w) => {
        if (itemCode && w.codeUpper === itemCode) return true;
        if (itemDesc && w.normalizedDesc === itemDesc) return true;
        return false;
      });

      if (matched) {
        matchedCodes.add(matched.codeUpper);
        matchedIds.add(matched.product.id);
        const exp = matched.expectedUnits;
        const cnt = Number(item.counted_qty) || 0;
        return {
          code: item.code || matched.code || null,
          description: item.description || matched.fullName,
          expectedQty: exp,
          countedQty: cnt,
          difference: cnt - exp,
          scannedImeis: item.scanned_imeis || null,
          notes: matched.notes || item.notes || null,
        };
      }

      const exp = Number(item.expected_qty) || 0;
      const cnt = Number(item.counted_qty) || 0;
      return {
        code: item.code || null,
        description: item.description,
        expectedQty: exp,
        countedQty: cnt,
        difference: cnt - exp,
        scannedImeis: item.scanned_imeis || null,
        notes: item.notes || null,
      };
    });

    let addedCount = 0;
    for (const w of warehouseInfoList) {
      if (!matchedCodes.has(w.codeUpper) && !matchedIds.has(w.product.id)) {
        if (w.expectedUnits > 0) {
          updatedItems.push({
            code: w.code || null,
            description: w.fullName,
            expectedQty: w.expectedUnits,
            countedQty: 0,
            difference: -w.expectedUnits,
            scannedImeis: null,
            notes: w.notes || null,
          });
          addedCount++;
        }
      }
    }

    // Reemplazar items en base de datos
    await client.query("DELETE FROM stock_count_item WHERE count_id = $1", [countId]);

    for (const it of updatedItems) {
      await client.query(`
        INSERT INTO stock_count_item (id, count_id, code, description, expected_qty, counted_qty, difference, scanned_imeis, notes, created_at)
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        countId,
        it.code,
        it.description,
        it.expectedQty,
        it.countedQty,
        it.difference,
        it.scannedImeis,
        it.notes,
      ]);
    }

    await client.query('COMMIT');
    console.log(`CNT-20260921-003 synchronized! Total items now: ${updatedItems.length} (Added: ${addedCount} new models).`);

    // Mostrar el resultado de los Itel A50CS:
    const resItels = await client.query(`
      SELECT code, description, expected_qty, counted_qty, difference, notes
      FROM stock_count_item
      WHERE count_id = $1 AND lower(description) LIKE '%a50cs%'
      ORDER BY description ASC
    `, [countId]);
    console.log('Itel A50CS in CNT-20260921-003 after sync:', JSON.stringify(resItels.rows, null, 2));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during update and sync:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
