const { pool } = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

async function list(req, res, next) {
  try {
    const { search, low_stock, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (Math.max(0, (Math.max(1, parseInt(page, 10) || 1) - 1)) * perPage) | 0;
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    if (search && search.trim()) {
      conditions.push('(name LIKE ? OR generic_name LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }
    if (low_stock === '1') {
      conditions.push('quantity <= min_stock');
    }
    const where = conditions.join(' AND ');

    const [rows] = await pool.execute(
      `SELECT id, name, generic_name, batch_number, unit, price_per_unit, quantity, min_stock, expiry_date, created_at
       FROM medicines WHERE ${where}
       ORDER BY name
       LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM medicines WHERE ${where}`, params);

    res.json({
      success: true,
      data: { medicines: rows, pagination: { page: parseInt(page, 10), limit: perPage, total } },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM medicines WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      name,
      generic_name,
      batch_number,
      unit,
      price_per_unit,
      quantity,
      min_stock,
      expiry_date,
    } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO medicines (name, generic_name, batch_number, unit, price_per_unit, quantity, min_stock, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        generic_name || null,
        batch_number || null,
        unit || 'strip',
        parseFloat(price_per_unit) || 0,
        Math.max(0, parseInt(quantity, 10) || 0),
        Math.max(0, parseInt(min_stock, 10) || 5),
        expiry_date || null,
      ]
    );
    const [rows] = await pool.execute(
      'SELECT id, name, generic_name, unit, price_per_unit, quantity, min_stock FROM medicines WHERE id = ?',
      [result.insertId]
    );
    await pool.execute(
      'INSERT INTO inventory_logs (medicine_id, type, quantity, balance_after, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [result.insertId, 'in', parseInt(quantity, 10) || 0, parseInt(quantity, 10) || 0, 'Initial stock', req.user.id]
    );
    await logActivity({
      userId: req.user.id,
      action: 'create',
      entityType: 'medicine',
      entityId: result.insertId,
      newValues: { name, quantity },
      req,
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = req.params.id;
    const [existing] = await pool.execute(
      'SELECT id, quantity FROM medicines WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    const {
      name,
      generic_name,
      batch_number,
      unit,
      price_per_unit,
      min_stock,
      expiry_date,
    } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (generic_name !== undefined) {
      updates.push('generic_name = ?');
      params.push(generic_name);
    }
    if (batch_number !== undefined) {
      updates.push('batch_number = ?');
      params.push(batch_number);
    }
    if (unit !== undefined) {
      updates.push('unit = ?');
      params.push(unit);
    }
    if (price_per_unit !== undefined) {
      updates.push('price_per_unit = ?');
      params.push(price_per_unit);
    }
    if (min_stock !== undefined) {
      updates.push('min_stock = ?');
      params.push(min_stock);
    }
    if (expiry_date !== undefined) {
      updates.push('expiry_date = ?');
      params.push(expiry_date);
    }
    if (updates.length) {
      params.push(id);
      await pool.execute(`UPDATE medicines SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const [rows] = await pool.execute(
      'SELECT id, name, generic_name, unit, price_per_unit, quantity, min_stock, expiry_date FROM medicines WHERE id = ?',
      [id]
    );
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'medicine', entityId: id, req });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function adjustStock(req, res, next) {
  try {
    const id = req.params.id;
    const { type, quantity, reason } = req.body;
    const [existing] = await pool.execute(
      'SELECT id, quantity FROM medicines WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    const qty = parseInt(quantity, 10) || 0;
    if (qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be positive' });
    }
    const current = existing[0].quantity;
    let newBalance;
    if (type === 'in') {
      newBalance = current + qty;
    } else if (type === 'out' || type === 'adjust') {
      newBalance = Math.max(0, current - qty);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid type' });
    }
    await pool.execute('UPDATE medicines SET quantity = ? WHERE id = ?', [newBalance, id]);
    await pool.execute(
      'INSERT INTO inventory_logs (medicine_id, type, quantity, balance_after, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, type, type === 'in' ? qty : -qty, newBalance, reason || type, req.user.id]
    );
    const [rows] = await pool.execute(
      'SELECT id, name, quantity, min_stock FROM medicines WHERE id = ?',
      [id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = req.params.id;
    const [existing] = await pool.execute('SELECT id FROM medicines WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    await pool.execute('UPDATE medicines SET deleted_at = NOW() WHERE id = ?', [id]);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'medicine', entityId: id, req });
    res.json({ success: true, message: 'Medicine deleted' });
  } catch (err) {
    next(err);
  }
}

async function lowStockAlerts(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, quantity, min_stock FROM medicines WHERE deleted_at IS NULL AND quantity <= min_stock ORDER BY quantity ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, adjustStock, remove, lowStockAlerts };
