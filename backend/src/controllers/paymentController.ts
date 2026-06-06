import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

export const addPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorId = req.user?.id;
    const creatorName = req.user?.name;
    const userRole = req.user?.role;
    const { id } = req.params; // appointment_id
    const { amount, payment_method, transaction_ref, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment amount is required.',
        errorCode: 'VALIDATION_ERROR'
      });
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
    const transAmt = parseFloat(amount);

    if (prevPaid >= totalAmount && totalAmount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already fully paid.',
        errorCode: 'ALREADY_PAID'
      });
    }

    // Insert payment record
    const payResult = await query(
      `INSERT INTO payments (appointment_id, amount, payment_method, transaction_ref, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        parseInt(id, 10),
        transAmt,
        payment_method || 'Unknown',
        transaction_ref || '',
        notes || '',
        creatorId
      ]
    );

    const newPayment = payResult.rows[0];

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
    const userRole = req.user?.role;

    // Audit log for revenue access
    await logAudit(
      req.user?.id || null,
      'REVENUE_ACCESS',
      'payments',
      parseInt(id, 10) || 0,
      `Payment history accessed for appointment ID ${id} by ${req.user?.name}`
    );

    const paymentsResult = await query(
      'SELECT p.*, u.name as collector_name FROM payments p LEFT JOIN users u ON p.created_by = u.id WHERE p.appointment_id = $1 ORDER BY p.created_at DESC',
      [id]
    );

    return res.status(200).json({
      success: true,
      data: { payments: paymentsResult.rows },
      // Backward compatibility key
      payments: paymentsResult.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
