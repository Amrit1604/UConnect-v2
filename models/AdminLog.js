/**
 * AdminLog Model - records admin actions for auditing
 */
const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.Mixed, default: null }, // user id or 'session-admin'
  actorType: { type: String, enum: ['user', 'session', 'system'], default: 'session' },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false });

adminLogSchema.index({ action: 1 });
adminLogSchema.index({ createdAt: -1 });

// Static helper to create an admin log entry
adminLogSchema.statics.logAction = async function(actor, action, entityType, entityId, details = {}) {
  try {
    const log = await this.create({
      actor,
      actorType: actor && typeof actor === 'string' ? 'session' : 'user',
      action,
      details: Object.assign({}, details, { entityType, entityId })
    });
    return log;
  } catch (err) {
    // Swallow logging errors to avoid affecting main flow
    console.error('AdminLog creation error:', err);
    return null;
  }
};

module.exports = mongoose.model('AdminLog', adminLogSchema);
