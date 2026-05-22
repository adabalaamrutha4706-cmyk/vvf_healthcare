import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

export const addPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorId = req.user?.id;
    const creatorName = req.user?.name;
    const { id } = req.params; // appointment_id
    const { amount, payment_method, transaction_ref, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required.' });
    }

    // Check if appointment exists
    const appResult = await query(
      'SELECT * FROM appointments WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const appointment = appResult.rows[0];
    const totalAmount = parseFloat(appointment.total_amount);
    const prevPaid = parseFloat(appointment.paid_amount);
    const transAmt = parseFloat(amount);

    if (prevPaid >= totalAmount && totalAmount > 0) {
      return res.status(400).json({ error: 'Appointment is already fully paid.' });
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

    return res.status(201).json({
      message: 'Payment recorded successfully.',
      payment: newPayment,
      appointment: {
        id,
        total_amount: totalAmount,
        paid_amount: newPaidAmount,
        payment_status: paymentStatus
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getPaymentHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // appointment_id

    const paymentsResult = await query(
      'SELECT p.*, u.name as collector_name FROM payments p LEFT JOIN users u ON p.created_by = u.id WHERE p.appointment_id = $1 ORDER BY p.created_at DESC',
      [id]
    );

    return res.status(200).json({ payments: paymentsResult.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
