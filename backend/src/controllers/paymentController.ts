import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Maps legacy payment method strings to one of the canonical categories: Cash, UPI, or Card.
 * Useful for backward compatibility with old records.
 */
export const mapLegacyPaymentMethod = (method: string): 'Cash' | 'UPI' | 'Card' => {
  const m = (method || '').toLowerCase().trim();
  if (m.includes('cash')) {
    return 'Cash';
  }
  if (m.includes('card')) {
    if (m.includes('upi')) {
      return 'UPI';
    }
    return 'Card';
  }
  if (
    m.includes('upi') ||
    m.includes('gpay') ||
    m.includes('google') ||
    m.includes('phonepe') ||
    m.includes('paytm') ||
    m.includes('bank') ||
    m.includes('transfer') ||
    m.includes('wire') ||
    m.includes('digital')
  ) {
    return 'UPI';
  }
  return 'UPI'; // fallback
};

export const addPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorId = req.user?.id;
    const creatorName = req.user?.name;
    const userRole = req.user?.role;
    const { id } = req.params; // appointment_id
    const { amount, payment_method, transaction_ref, notes, payment_splits, upi_app, payer_upi_id } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment amount is required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const transAmt = parseFloat(amount);

    // Validate single payment UPI details
    const mappedMethod = mapLegacyPaymentMethod(payment_method);
    if (mappedMethod === 'UPI' && (!payment_splits || !Array.isArray(payment_splits) || payment_splits.length === 0)) {
      if (!transaction_ref || !transaction_ref.trim()) {
        return res.status(400).json({
          success: false,
          message: 'UPI Transaction Reference ID is required for UPI payments.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
    }

    // Validation for split payments if provided
    if (payment_splits && Array.isArray(payment_splits) && payment_splits.length > 0) {
      let splitSum = 0;
      for (const split of payment_splits) {
        const splitAmt = parseFloat(split.amount);
        if (isNaN(splitAmt) || splitAmt <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Each split payment must have a valid amount greater than zero.',
            errorCode: 'INVALID_SPLIT_AMOUNT'
          });
        }
        if (!['Cash', 'UPI', 'Card'].includes(split.method)) {
          return res.status(400).json({
            success: false,
            message: `Invalid split payment method: ${split.method}. Allowed methods are Cash, UPI, Card.`,
            errorCode: 'INVALID_SPLIT_METHOD'
          });
        }
        // UPI Reference ID validation for split payments
        if (split.method === 'UPI') {
          if (!split.transaction_ref || !split.transaction_ref.trim()) {
            return res.status(400).json({
              success: false,
              message: 'UPI Transaction Reference ID is required for UPI payments.',
              errorCode: 'VALIDATION_ERROR'
            });
          }
        }
        splitSum += splitAmt;
      }

      // Check sum matches amount (using epsilon threshold)
      if (Math.abs(splitSum - transAmt) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `The sum of split payments (₹${splitSum}) must exactly equal the total payment amount (₹${transAmt}).`,
          errorCode: 'SPLIT_AMOUNT_MISMATCH'
        });
      }
    }

    // Check if appointment exists
    const appResult = await query(
      'SELECT * FROM appointments WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        errorCode: 'APPOINTMENT_NOT_FOUND'
      });
    }

    const appointment = appResult.rows[0];
    const totalAmount = parseFloat(appointment.total_amount);
    const prevPaid = parseFloat(appointment.paid_amount);

    if (prevPaid >= totalAmount && totalAmount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already fully paid.',
        errorCode: 'ALREADY_PAID'
      });
    }

    // Insert payment record
    const payResult = await query(
      `INSERT INTO payments (appointment_id, amount, payment_method, transaction_ref, notes, created_by, payment_splits, upi_app, payer_upi_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        parseInt(id, 10),
        transAmt,
        payment_method || 'Unknown',
        transaction_ref || '',
        notes || '',
        creatorId,
        payment_splits ? (typeof payment_splits === 'string' ? payment_splits : JSON.stringify(payment_splits)) : null,
        upi_app || null,
        payer_upi_id || null
      ]
    );

    const newPayment = payResult.rows[0];

    // Parse splits representation for client response
    if (newPayment.payment_splits && typeof newPayment.payment_splits === 'string') {
      try {
        newPayment.payment_splits = JSON.parse(newPayment.payment_splits);
      } catch (e) {}
    }

    // Compute new paid amount
    const newPaidAmount = prevPaid + transAmt;
    let paymentStatus = 'Unpaid';

    if (newPaidAmount >= totalAmount && totalAmount > 0) {
      paymentStatus = 'Completed';
    } else if (newPaidAmount > 0 && newPaidAmount < totalAmount) {
      paymentStatus = 'Partially Paid';
    }

    // Update appointment
    await query(
      `UPDATE appointments
       SET paid_amount = $1, payment_status = $2
       WHERE id = $3`,
      [newPaidAmount, paymentStatus, id]
    );

    const paymentChangeSummary = `• Paid amount changed from ₹${prevPaid} to ₹${newPaidAmount}\n• Status changed from ${appointment.payment_status} → ${paymentStatus}`;
    await query(
      `INSERT INTO appointment_edit_history (
        appointment_id, edited_by_user_id, edited_by_name, edited_by_designation, old_values, new_values, change_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        parseInt(id, 10),
        creatorId || null,
        creatorName || 'Unknown',
        userRole || 'Unknown',
        JSON.stringify({ paid_amount: prevPaid, payment_status: appointment.payment_status }),
        JSON.stringify({ paid_amount: newPaidAmount, payment_status: paymentStatus }),
        paymentChangeSummary
      ]
    );

    // Audit logs
    await logAudit(
      creatorId || null,
      'EDIT_PAYMENT',
      'payments',
      newPayment.id,
      `Payment of INR ${transAmt} added for appointment ID ${id} by ${creatorName}. Status: ${paymentStatus}`
    );

    // Create system notification
    await query(
      'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
      [
        null,
        'Payment Completion Check',
        `Payment of INR ${transAmt} received for ${appointment.patient_name}. Total paid: ${newPaidAmount}/${totalAmount}.`
      ]
    );

    const payload = {
      payment: newPayment,
      appointment: {
        id,
        total_amount: totalAmount,
        paid_amount: newPaidAmount,
        payment_status: paymentStatus
      }
    };

    return res.status(201).json({
      success: true,
      data: payload,
      // Backward compatibility keys
      ...payload
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getPaymentHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // appointment_id

    // Audit log for revenue access
    await logAudit(
      req.user?.id || null,
      'REVENUE_ACCESS',
      'payments',
      parseInt(id, 10) || 0,
      `Payment history accessed for appointment ID ${id} by ${req.user?.name}`
    );

    const paymentsResult = await query(
      'SELECT p.*, u.name as collector_name FROM payments p LEFT JOIN users u ON p.created_by = u.id WHERE p.appointment_id = $1 AND p.is_deleted = false ORDER BY p.created_at DESC',
      [id]
    );

    const payments = paymentsResult.rows.map((p: any) => {
      let splits = p.payment_splits;
      if (splits && typeof splits === 'string') {
        try {
          splits = JSON.parse(splits);
        } catch (e) {
          splits = null;
        }
      }
      return { ...p, payment_splits: splits };
    });

    return res.status(200).json({
      success: true,
      data: { payments },
      // Backward compatibility key
      payments
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getPaymentsReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_date, end_date, hospital_id, search, status, doctor_id } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let queryParts = [
      `SELECT p.id as transaction_id, 
              p.transaction_ref,
              a.patient_name as customer_name, 
              p.amount, 
              p.payment_method, 
              p.created_at as payment_date, 
              a.payment_status as status,
              a.hospital_id,
              p.payment_splits,
              u.name as collector_name
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE a.is_deleted = false AND p.is_deleted = false`
    ];
    const params: any[] = [];
    let paramIdx = 1;

    // Doctor/Dental Doctor restriction (can only see their own appointments' payments)
    if (userRole === 'Doctor' || userRole === 'Dental Doctor') {
      queryParts.push(`AND a.doctor_id = $${paramIdx++}`);
      params.push(userId);
    } else if (doctor_id && doctor_id !== 'All' && doctor_id !== 'undefined') {
      queryParts.push(`AND a.doctor_id = $${paramIdx++}`);
      params.push(parseInt(doctor_id as string, 10));
    }

    if (start_date && start_date !== 'undefined') {
      let start = start_date as string;
      if (!start.includes('T')) {
        start = `${start}T00:00:00.000Z`;
      }
      queryParts.push(`AND p.created_at >= $${paramIdx++}`);
      params.push(start);
    }
    if (end_date && end_date !== 'undefined') {
      let end = end_date as string;
      if (!end.includes('T')) {
        end = `${end}T23:59:59.999Z`;
      }
      queryParts.push(`AND p.created_at <= $${paramIdx++}`);
      params.push(end);
    }
    if (hospital_id && hospital_id !== 'All' && hospital_id !== 'undefined') {
      queryParts.push(`AND a.hospital_id = $${paramIdx++}`);
      params.push(parseInt(hospital_id as string, 10));
    }

    // Search filter (patient name, ID, or transaction reference)
    if (search && search !== 'undefined') {
      const searchStr = (search as string).trim();
      if (/^\d+$/.test(searchStr)) {
        queryParts.push(`AND (
          a.id = $${paramIdx} 
          OR a.patient_name ILIKE $${paramIdx + 1}
          OR p.transaction_ref ILIKE $${paramIdx + 1}
          OR p.payment_splits::text ILIKE $${paramIdx + 1}
        )`);
        params.push(parseInt(searchStr, 10));
        params.push(`%${searchStr}%`);
        paramIdx += 2;
      } else {
        queryParts.push(`AND (
          a.patient_name ILIKE $${paramIdx}
          OR p.transaction_ref ILIKE $${paramIdx}
          OR p.payment_splits::text ILIKE $${paramIdx}
        )`);
        params.push(`%${searchStr}%`);
        paramIdx++;
      }
    }

    // Status filter (payment_status on the appointment: Pending, Partially Paid, Fully Paid)
    if (status && status !== 'All' && status !== 'undefined') {
      let statusVal = status as string;
      if (statusVal === 'Pending') {
        queryParts.push(`AND (a.payment_status = 'Unpaid' OR a.payment_status = 'Pending')`);
      } else if (statusVal === 'Partially Paid') {
        queryParts.push(`AND a.payment_status = 'Partially Paid'`);
      } else if (statusVal === 'Fully Paid') {
        queryParts.push(`AND (a.payment_status = 'Completed' OR a.payment_status = 'Fully Paid' OR a.payment_status = 'Paid')`);
      }
    }

    queryParts.push(`ORDER BY p.created_at DESC`);

    const result = await query(queryParts.join(' '), params);

    const payments = result.rows.map((p: any) => {
      let splits = p.payment_splits;
      if (splits && typeof splits === 'string') {
        try {
          splits = JSON.parse(splits);
        } catch (e) {
          splits = null;
        }
      }
      return { ...p, payment_splits: splits };
    });

    let totalCash = 0;
    let totalUPI = 0;
    let totalCard = 0;
    let totalOthers = 0;

    for (const p of payments) {
      const amt = parseFloat(p.amount) || 0;
      if (p.payment_splits && Array.isArray(p.payment_splits) && p.payment_splits.length > 0) {
        for (const split of p.payment_splits) {
          const splitAmt = parseFloat(split.amount) || 0;
          const method = (split.method || '').trim().toLowerCase();
          if (method === 'cash') {
            totalCash += splitAmt;
          } else if (method === 'upi') {
            totalUPI += splitAmt;
          } else if (method === 'card') {
            totalCard += splitAmt;
          } else {
            totalOthers += splitAmt;
          }
        }
      } else {
        const legacyMode = mapLegacyPaymentMethod(p.payment_method);
        if (legacyMode === 'Cash') {
          totalCash += amt;
        } else if (legacyMode === 'Card') {
          totalCard += amt;
        } else if (legacyMode === 'UPI') {
          totalUPI += amt;
        } else {
          totalOthers += amt;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        payments,
        breakdown: {
          totalCash: parseFloat(totalCash.toFixed(2)),
          totalUPI: parseFloat(totalUPI.toFixed(2)),
          totalCard: parseFloat(totalCard.toFixed(2)),
          totalOthers: parseFloat(totalOthers.toFixed(2))
        }
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const updatePayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const userRole = req.user?.role;
    const { id, paymentId } = req.params; // id is appointment_id, paymentId is payment_id
    const { transaction_ref, upi_app, payer_upi_id, payment_splits } = req.body;

    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins can modify transaction details.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Fetch existing payment details
    const payResult = await query('SELECT * FROM payments WHERE id = $1 AND appointment_id = $2', [
      parseInt(paymentId, 10),
      parseInt(id, 10)
    ]);

    if (payResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
        errorCode: 'PAYMENT_NOT_FOUND'
      });
    }

    const currentPayment = payResult.rows[0];

    // Determine mapped payment method
    let splitsJson = payment_splits;
    if (splitsJson && typeof splitsJson === 'string') {
      try {
        splitsJson = JSON.parse(splitsJson);
      } catch (e) {}
    }

    // Validate reference ID if UPI is used
    if (splitsJson && Array.isArray(splitsJson) && splitsJson.length > 0) {
      // Split payments
      for (const split of splitsJson) {
        if (split.method === 'UPI') {
          if (!split.transaction_ref || !split.transaction_ref.trim()) {
            return res.status(400).json({
              success: false,
              message: 'UPI Transaction Reference ID is required for UPI payments.',
              errorCode: 'VALIDATION_ERROR'
            });
          }
        }
      }
    } else {
      // Single payment
      const mappedMethod = mapLegacyPaymentMethod(currentPayment.payment_method);
      if (mappedMethod === 'UPI') {
        if (!transaction_ref || !transaction_ref.trim()) {
          return res.status(400).json({
            success: false,
            message: 'UPI Transaction Reference ID is required for UPI payments.',
            errorCode: 'VALIDATION_ERROR'
          });
        }
      }
    }

    // Perform update
    const updateResult = await query(
      `UPDATE payments
       SET transaction_ref = $1, upi_app = $2, payer_upi_id = $3, payment_splits = $4
       WHERE id = $5 RETURNING *`,
      [
        transaction_ref !== undefined ? transaction_ref : currentPayment.transaction_ref,
        upi_app !== undefined ? upi_app : currentPayment.upi_app,
        payer_upi_id !== undefined ? payer_upi_id : currentPayment.payer_upi_id,
        payment_splits ? (typeof payment_splits === 'string' ? payment_splits : JSON.stringify(payment_splits)) : currentPayment.payment_splits,
        parseInt(paymentId, 10)
      ]
    );

    const updatedPayment = updateResult.rows[0];

    // Audit Log changes
    const changes: string[] = [];
    const changeMeta: any = {
      old: {},
      new: {}
    };

    const recordChange = (field: string, oldVal: any, newVal: any) => {
      const normOld = oldVal === undefined || oldVal === null ? '' : String(oldVal);
      const normNew = newVal === undefined || newVal === null ? '' : String(newVal);
      if (normOld !== normNew) {
        changes.push(`• ${field} changed from "${oldVal || ''}" to "${newVal || ''}"`);
        changeMeta.old[field] = oldVal;
        changeMeta.new[field] = newVal;
      }
    };

    recordChange('transaction_ref', currentPayment.transaction_ref, updatedPayment.transaction_ref);
    recordChange('upi_app', currentPayment.upi_app, updatedPayment.upi_app);
    recordChange('payer_upi_id', currentPayment.payer_upi_id, updatedPayment.payer_upi_id);
    
    const oldSplitsStr = typeof currentPayment.payment_splits === 'object' ? JSON.stringify(currentPayment.payment_splits) : currentPayment.payment_splits;
    const newSplitsStr = typeof updatedPayment.payment_splits === 'object' ? JSON.stringify(updatedPayment.payment_splits) : updatedPayment.payment_splits;
    recordChange('payment_splits', oldSplitsStr, newSplitsStr);

    if (changes.length > 0) {
      await logAudit(
        userId || null,
        'EDIT_PAYMENT_UPI',
        'payments',
        parseInt(paymentId, 10),
        `UPI payment details updated for payment ID ${paymentId} by Admin ${userName}. Changes:\n${changes.join('\n')}`,
        {
          paymentId: parseInt(paymentId, 10),
          appointmentId: parseInt(id, 10),
          changedBy: userName,
          role: userRole,
          changeMeta
        }
      );
    }

    // Parse splits for response
    if (updatedPayment.payment_splits && typeof updatedPayment.payment_splits === 'string') {
      try {
        updatedPayment.payment_splits = JSON.parse(updatedPayment.payment_splits);
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: 'Payment details modified successfully.',
      data: { payment: updatedPayment },
      payment: updatedPayment
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
