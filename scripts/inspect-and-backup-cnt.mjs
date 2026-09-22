import pg from 'pg';
import fs from 'fs';

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
    const resCount = await client.query('SELECT * FROM stock_count WHERE count_number = $1', ['CNT-20260921-003']);
    console.log('Count found:', resCount.rows.length);
    if (resCount.rows.length > 0) {
      const count = resCount.rows[0];
      const resItems = await client.query('SELECT * FROM stock_count_item WHERE count_id = $1 ORDER BY description ASC', [count.id]);
      console.log('Items count:', resItems.rows.length);
      const backup = { count, items: resItems.rows };
      fs.writeFileSync('scripts/backup_CNT-20260921-003.json', JSON.stringify(backup, null, 2), 'utf8');
      console.log('Backup successfully saved to scripts/backup_CNT-20260921-003.json');
      
      const itelItems = resItems.rows.filter(i => 
        (i.description && i.description.toLowerCase().includes('itel')) || 
        (i.description && i.description.toLowerCase().includes('orange')) ||
        (i.description && i.description.toLowerCase().includes('a50'))
      );
      console.log('Matched items in CNT-20260921-003:', JSON.stringify(itelItems.map(i => ({
        id: i.id,
        code: i.code,
        description: i.description,
        expected: i.expected_qty,
        counted: i.counted_qty,
        diff: i.difference
      })), null, 2));

      // Also let's inspect the warehouse_product table for this item:
      const resWarehouse = await client.query(`
        SELECT id, codigo, nombre, marca, color, capacidad, cajas, unidades_por_caja, unidades_sueltas, cantidad, status, updated_at 
        FROM warehouse_product 
        WHERE lower(marca) LIKE '%itel%' OR lower(nombre) LIKE '%a50%'
        ORDER BY updated_at DESC
      `);
      console.log('Itel items in warehouse_product table:', JSON.stringify(resWarehouse.rows, null, 2));

      const resMov = await client.query(`
        SELECT m.id, m.tipo, m.cantidad_cajas, m.total_unidades, m.motivo, m.created_at, p.codigo, p.nombre, p.color, p.cajas, p.unidades_por_caja, p.cantidad as total_units
        FROM warehouse_movement m
        JOIN warehouse_product p ON p.id = m.product_id
        ORDER BY m.created_at DESC
        LIMIT 10
      `);
      const countActive = await client.query("SELECT count(*) FROM warehouse_product WHERE status = 'ACTIVE'");
      console.log('Total ACTIVE warehouse products:', countActive.rows[0].count);
    } else {
      const allCounts = await client.query('SELECT count_number, title, status, created_at FROM stock_count ORDER BY created_at DESC LIMIT 5');
      console.log('Recent counts:', allCounts.rows);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
